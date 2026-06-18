import { useEffect, useRef, useState } from 'react';
import { auth } from '../../lib/firebase';
import {
  registerVendor,
  sendVendorEmailOtp,
  sendVendorResetEmail,
  signInVendor,
  signInVendorWithGoogle,
  verifyVendorEmailOtp,
} from '../../services/vendorAuth';
import { compressImageFile } from '../../lib/image';
import { uploadProfilePhotoToCloudinary, updateVendorProfilePhoto } from '../../services/vendorPortal';

type AuthStep = 'login' | 'forgot' | 'register' | 'otp' | 'profile' | 'complete';

interface AuthShellProps {
  hidden: boolean;
  onComplete: () => void;
  onShowToast: (msg: string) => void;
}

const featureBullets = [
  'Instant wallet credits after every delivery',
  'Withdraw to any Nigerian bank account',
  'Real-time order management dashboard',
  'Firebase-secured with end-to-end encryption',
];

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
  'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

export function AuthShell({ hidden, onComplete, onShowToast }: AuthShellProps) {
  const [step, setStep] = useState<AuthStep>('login');
  const [otpTimer, setOtpTimer] = useState(0);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  const [regData, setRegData] = useState({ fname: '', lname: '', kitchen: '', email: '', phone: '', pw: '' });
  const [regAgree, setRegAgree] = useState(false);
  const [regErr, setRegErr] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);

  const [forgotEmail, setForgotEmail] = useState('');

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpErr, setOtpErr] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [bizAddress, setBizAddress] = useState('');
  const [bizState, setBizState] = useState('');
  const [bizLga, setBizLga] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState<'login' | 'google' | 'register' | 'forgot' | 'otp' | null>(null);

  useEffect(() => {
    if (otpTimer <= 0) return;
    const t = setTimeout(() => setOtpTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [otpTimer]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    if (!hidden) {
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
    } else {
      html.style.overflow = '';
      body.style.overflow = '';
    }

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [hidden]);


  const goAuthStep = (s: AuthStep) => {
    setStep(s);
    setLoginErr('');
    setRegErr('');
    setOtpErr('');
  };

  const doLogin = async () => {
    if (!loginEmail.includes('@')) { setLoginErr('Please enter a valid email.'); return; }
    if (loginPw.length < 6) { setLoginErr('Password must be at least 6 characters.'); return; }
    setLoginErr('');
    try {
      setLoading('login');
      await signInVendor(loginEmail, loginPw);
      setStep('complete');
      setTimeout(() => onComplete(), 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in.';
      if (message.toLowerCase().includes('email otp verification required')) {
        setStep('otp');
        setOtpTimer(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        onShowToast('Verification code sent to your email.');
      } else {
        setLoginErr(message);
      }
    } finally {
      setLoading(null);
    }
  };

  const doGoogleLogin = async () => {
    try {
      setLoading('google');
      await signInVendorWithGoogle();
      setStep('complete');
      setTimeout(() => onComplete(), 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in with Google.';
      if (message.toLowerCase().includes('email otp verification required')) {
        setStep('otp');
        setOtpTimer(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        onShowToast('Verification code sent to your email.');
      } else {
        setLoginErr(message);
      }
    } finally {
      setLoading(null);
    }
  };

  const doRegister = async () => {
    const { fname, lname, kitchen, email, phone, pw } = regData;
    if (!fname || !lname || !kitchen || !email || !phone || !pw) {
      setRegErr('Please fill in all fields.');
      return;
    }
    if (!email.includes('@')) { setRegErr('Please enter a valid email.'); return; }
    if (pw.length < 6) { setRegErr('Password must be at least 6 characters.'); return; }
    if (!regAgree) { setRegErr('Please agree to the terms.'); return; }
    setRegErr('');
    setLoading('register');

    // Step 1: create the Firebase account. If the account already exists from a
    // previous partially-completed attempt (network dropped after account creation
    // but before OTP was sent), treat it as recoverable and continue to OTP.
    let accountAlreadyExisted = false;
    try {
      await registerVendor({ firstName: fname, lastName: lname, businessName: kitchen, email, phone, password: pw });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create your account.';
      if (!message.toLowerCase().includes('already in use')) {
        setRegErr(message);
        setLoading(null);
        return;
      }
      accountAlreadyExisted = true;
    }

    // Step 2: send OTP — non-critical, user can resend from the next screen
    try {
      await sendVendorEmailOtp(email);
    } catch {
      // network hiccup — proceed anyway, resend button is available on OTP screen
    }

    setLoading(null);
    setStep('otp');
    setOtpTimer(60);
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
    onShowToast(
      accountAlreadyExisted
        ? 'Verification code sent. Check your email to continue.'
        : 'Account created. Verification code sent to your email.'
    );
  };

  const doOtp = async () => {
    const code = otpDigits.join('');
    if (code.length < 6) { setOtpErr('Please enter the complete 6-digit code.'); return; }
    const email = auth.currentUser?.email || regData.email;
    if (!email.includes('@')) { setOtpErr('Missing registration email. Please register again.'); return; }
    setOtpErr('');
    try {
      setLoading('otp');
      await verifyVendorEmailOtp(email, code, auth.currentUser?.uid);
      setStep('profile');
      onShowToast('Email verified successfully. Please complete your profile.');
    } catch (error) {
      setOtpErr(error instanceof Error ? error.message : 'Invalid code.');
    } finally {
      setLoading(null);
    }
  };

  const resendOtp = async () => {
    const email = auth.currentUser?.email || regData.email;
    if (!email.includes('@')) {
      setOtpErr('Missing registration email.');
      return;
    }
    try {
      setLoading('otp');
      await sendVendorEmailOtp(email);
      setOtpTimer(60);
      onShowToast('Verification code resent.');
    } catch (error) {
      setOtpErr(error instanceof Error ? error.message : 'Failed to resend code.');
    } finally {
      setLoading(null);
    }
  };

  const doForgot = async () => {
    if (!forgotEmail.includes('@')) { setLoginErr('Please enter a valid email.'); return; }
    try {
      setLoading('forgot');
      await sendVendorResetEmail(forgotEmail);
      onShowToast('Reset link sent to your email if it exists.');
      goAuthStep('login');
    } catch (error) {
      setLoginErr(error instanceof Error ? error.message : 'Unable to send reset link.');
    } finally {
      setLoading(null);
    }
  };

  const handleProfilePhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onShowToast('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onShowToast('Image must be less than 5MB');
      return;
    }

    try {
      setUploadingPhoto(true);
      const compressed = await compressImageFile(file, 0.85);
      const cloudinaryUrl = await uploadProfilePhotoToCloudinary(compressed);
      setProfilePhoto(cloudinaryUrl);
      onShowToast('Profile photo added!');
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const doProfileSubmit = async () => {
    if (!auth.currentUser) {
      onShowToast('Your session expired. Please sign in again.');
      setStep('login');
      return;
    }

    if (!profilePhoto) {
      onShowToast('Please upload a profile photo.');
      return;
    }

    if (!bizAddress || !bizState || !bizLga) {
      onShowToast('Please fill in all location fields.');
      return;
    }

    try {
      setLoading('register');
      
      await updateVendorProfilePhoto(profilePhoto);
      
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      
      await setDoc(doc(db, 'vendors', auth.currentUser.uid), {
        businessName: regData.kitchen,
        businessEmail: regData.email,
        businessPhone: regData.phone,
        address: bizAddress,
        state: bizState,
        lga: bizLga,
        vendorStatus: 'pending',
        status: 'pending',
        profileComplete: true,
        approvalRequestedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      onShowToast('Profile completed successfully!');
      setStep('complete');
      setTimeout(() => onComplete(), 1500);
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Unable to complete your profile.');
    } finally {
      setLoading(null);
    }
  };

  const handleOtpInput = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otpDigits];
    next[idx] = val.slice(-1);
    setOtpDigits(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const authShellClass = hidden ? 'hidden' : '';

  return (
    <div id="auth-shell" className={authShellClass}>
      <div className="auth-left">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <img src="/orangelogo.png" alt="Blorbmart" style={{ width: 40, height: 40, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(249,115,22,0.45))' }} />
            <div>
              <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 16 }}>Blorbmart</div>
              <div style={{ fontSize: 11, color: 'var(--or)', fontWeight: 600, letterSpacing: '.05em' }}>KITCHEN PORTAL</div>
            </div>
          </div>

          <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 32, lineHeight: 1.2, marginBottom: 16 }}>
            Cook great food.<br />
            <span style={{ color: 'var(--or)' }}>Earn great money.</span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--t3)', lineHeight: 1.7, marginBottom: 40 }}>
            Join thousands of restaurants and food vendors already earning on Blorbmart. Get paid directly to your wallet — no middlemen.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {featureBullets.map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--org)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--or)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <span style={{ fontSize: 13, color: 'var(--t2)' }}>{f}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 40, padding: '16px 18px', background: 'rgba(255,255,255,.04)', borderRadius: 'var(--r2)', border: '1px solid var(--b1)' }}>
            <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 10, fontStyle: 'italic' }}>"I went from 5 orders a day to over 30 within two months. The wallet feature makes payouts completely stress-free."</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,var(--or),#CC4010)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 12, color: '#fff' }}>FA</div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>Funke Adeyemi</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>Funke's Kitchen · Yaba, Lagos</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          {step === 'login' && (
            <div className="auth-step active" id="step-login">
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 26, marginBottom: 6 }}>Welcome back</div>
                <div style={{ fontSize: 13.5, color: 'var(--t3)' }}>Sign in to your kitchen dashboard</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <button className="social-btn" onClick={doGoogleLogin} disabled={loading === 'google'}>
                  <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M5.27 9.76A7.08 7.08 0 0112 4.9c1.76 0 3.35.65 4.57 1.7l3.4-3.4A11.95 11.95 0 0012 1C8.2 1 4.83 3 2.84 6.07l2.43 3.69z" /><path fill="#34A853" d="M16.04 18.01A7.08 7.08 0 0112 19.1c-2.84 0-5.27-1.67-6.48-4.1l-3.69 2.43A11.95 11.95 0 0012 23c3.24 0 6.18-1.22 8.4-3.22l-4.36-1.77z" /><path fill="#4A90D9" d="M20.4 19.78A11.95 11.95 0 0023 12c0-.78-.08-1.53-.22-2.27H12v4.54h6.19a5.4 5.4 0 01-2.15 3.27l4.36 1.77-.01.47z" /><path fill="#FBBC05" d="M5.52 15A7.08 7.08 0 014.9 12c0-1.05.18-2.07.5-3l-2.56-3.93A11.95 11.95 0 001 12c0 1.93.46 3.75 1.27 5.38L5.52 15z" /></svg>
                  {loading === 'google' ? 'Connecting...' : 'Continue with Google'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--b1)' }}></div>
                <span style={{ fontSize: 12, color: 'var(--t3)' }}>or sign in with email</span>
                <div style={{ flex: 1, height: 1, background: 'var(--b1)' }}></div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 6 }}>
                <div>
                  <label className="lbl">Email Address</label>
                  <input className="inp" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div>
                  <label className="lbl">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input className="inp" type={showLoginPw ? 'text' : 'password'} value={loginPw} onChange={(e) => setLoginPw(e.target.value)} placeholder="Your password" style={{ paddingRight: 42 }} />
                    <button onClick={() => setShowLoginPw((s) => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 2 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', marginBottom: 20 }}>
                <button onClick={() => goAuthStep('forgot')} style={{ background: 'none', border: 'none', color: 'var(--or)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--bd)' }}>Forgot password?</button>
              </div>

              {loginErr && <div id="login-err" style={{ color: 'var(--re)', fontSize: 12.5, marginBottom: 12, background: 'var(--reg)', padding: '10px 13px', borderRadius: 'var(--r2)' }}>{loginErr}</div>}

              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 13, fontSize: 14 }} onClick={doLogin} disabled={loading === 'login'}>
                {loading === 'login' ? 'Signing In...' : 'Sign In to Dashboard'}
              </button>

              <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--t3)' }}>
                New kitchen? <button onClick={() => goAuthStep('register')} style={{ background: 'none', border: 'none', color: 'var(--or)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--bd)' }}>Create an account</button>
              </div>
            </div>
          )}

          {step === 'forgot' && (
            <div className="auth-step active" id="step-forgot">
              <button onClick={() => goAuthStep('login')} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--bd)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, padding: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m0 0l7 7m-7-7l7-7" /></svg>
                Back to sign in
              </button>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 24, marginBottom: 6 }}>Reset Password</div>
                <div style={{ fontSize: 13, color: 'var(--t3)' }}>We'll send a reset link to your email</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="lbl">Email Address</label>
                <input className="inp" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 13 }} onClick={doForgot} disabled={loading === 'forgot'}>{loading === 'forgot' ? 'Sending...' : 'Send Reset Link'}</button>
            </div>
          )}

          {step === 'register' && (
            <div className="auth-step active" id="step-register">
              <button onClick={() => goAuthStep('login')} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--bd)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, padding: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m0 0l7 7m-7-7l7-7" /></svg>
                Back to sign in
              </button>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 24, marginBottom: 4 }}>Create Food Vendor Account</div>
                <div style={{ fontSize: 13, color: 'var(--t3)' }}>Start your food business on Blorbmart</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="lbl">First Name</label>
                    <input className="inp" value={regData.fname} onChange={(e) => setRegData((d) => ({ ...d, fname: e.target.value }))} placeholder="Funke" />
                  </div>
                  <div>
                    <label className="lbl">Last Name</label>
                    <input className="inp" value={regData.lname} onChange={(e) => setRegData((d) => ({ ...d, lname: e.target.value }))} placeholder="Adeyemi" />
                  </div>
                </div>
                <div>
                  <label className="lbl">Kitchen / Business Name</label>
                  <input className="inp" value={regData.kitchen} onChange={(e) => setRegData((d) => ({ ...d, kitchen: e.target.value }))} placeholder="Funke's Kitchen" />
                </div>
                <div>
                  <label className="lbl">Email Address</label>
                  <input className="inp" type="email" value={regData.email} onChange={(e) => setRegData((d) => ({ ...d, email: e.target.value }))} placeholder="you@example.com" />
                </div>
                <div>
                  <label className="lbl">Phone Number</label>
                  <input className="inp" type="tel" value={regData.phone} onChange={(e) => setRegData((d) => ({ ...d, phone: e.target.value }))} placeholder="08012345678" />
                </div>
                <div>
                  <label className="lbl">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input className="inp" type={showRegPw ? 'text' : 'password'} value={regData.pw} onChange={(e) => setRegData((d) => ({ ...d, pw: e.target.value }))} placeholder="Create a password" style={{ paddingRight: 42 }} />
                    <button onClick={() => setShowRegPw((s) => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 2 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--t2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={regAgree} onChange={(e) => setRegAgree(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--or)' }} />
                  I agree to the Terms of Service and Privacy Policy
                </label>
              </div>

              {regErr && <div style={{ color: 'var(--re)', fontSize: 12.5, marginBottom: 12, background: 'var(--reg)', padding: '10px 13px', borderRadius: 'var(--r2)' }}>{regErr}</div>}

              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 13, fontSize: 14 }} onClick={doRegister} disabled={loading === 'register'}>
                {loading === 'register' ? 'Creating Account...' : 'Create Account'}
              </button>

              <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--t3)' }}>
                Already have an account? <button onClick={() => goAuthStep('login')} style={{ background: 'none', border: 'none', color: 'var(--or)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--bd)' }}>Sign in</button>
              </div>
            </div>
          )}

          {step === 'otp' && (
            <div className="auth-step active" id="step-otp">
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 24, marginBottom: 4 }}>Verify Email</div>
                <div style={{ fontSize: 13, color: 'var(--t3)' }}>Enter the 6-digit code sent to your email</div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <input
                    key={i}
                    ref={el => {
                      otpRefs.current[i] = el;
                    }}
                    className="otp-input"
                    type="text"
                    maxLength={1}
                    value={otpDigits[i]}
                    onChange={(e) => handleOtpInput(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    style={{
                      width: 42,
                      height: 48,
                      textAlign: 'center',
                      fontSize: 18,
                      fontWeight: 700,
                      background: 'var(--s1)',
                      border: '1px solid var(--b1)',
                      borderRadius: '8px',
                      color: 'var(--t1)',
                    }}
                  />
                ))}
              </div>

              {otpErr && <div style={{ color: 'var(--re)', fontSize: 12.5, marginBottom: 12, background: 'var(--reg)', padding: '10px 13px', borderRadius: 'var(--r2)', textAlign: 'center' }}>{otpErr}</div>}

              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 13 }} onClick={doOtp} disabled={loading === 'otp'}>
                {loading === 'otp' ? 'Verifying...' : 'Verify Email'}
              </button>

              <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--t3)' }}>
                Didn't receive code?{' '}
                <button onClick={resendOtp} disabled={loading === 'otp' || otpTimer > 0} style={{ background: 'none', border: 'none', color: otpTimer > 0 ? 'var(--t3)' : 'var(--or)', fontWeight: 600, cursor: otpTimer > 0 ? 'not-allowed' : 'pointer', fontFamily: 'var(--bd)' }}>
                  {otpTimer > 0 ? `Resend in ${otpTimer}s` : 'Resend'}
                </button>
              </div>
            </div>
          )}

          {step === 'profile' && (
            <div className="auth-step active" id="step-profile">
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 24, marginBottom: 4 }}>Complete Your Profile</div>
                <div style={{ fontSize: 13, color: 'var(--t3)' }}>Tell us about your kitchen location</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div>
                  <label className="lbl">Profile Photo *</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: profilePhoto ? `url(${profilePhoto}) center/cover` : 'var(--s3)', border: '2px solid var(--or)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {!profilePhoto && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
                    </div>
                    <input
                      type="file"
                      id="profile-photo-input"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleProfilePhotoUpload(file);
                      }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => document.getElementById('profile-photo-input')?.click()}
                      disabled={uploadingPhoto}
                    >
                      {uploadingPhoto ? 'Uploading...' : profilePhoto ? 'Change Photo' : 'Upload Photo'}
                    </button>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 6 }}>Required for your vendor profile</div>
                </div>

                <div>
                  <label className="lbl">Kitchen Address</label>
                  <input className="inp" value={bizAddress} onChange={(e) => setBizAddress(e.target.value)} placeholder="12 Allen Ave, Ikeja" />
                </div>

                <div>
                  <label className="lbl">State</label>
                  <select className="inp" value={bizState} onChange={(e) => setBizState(e.target.value)}>
                    <option value="">Select State</option>
                    {NIGERIAN_STATES.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="lbl">LGA / Local Area</label>
                  <input className="inp" value={bizLga} onChange={(e) => setBizLga(e.target.value)} placeholder="Ikeja" />
                </div>
              </div>

              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 13 }} onClick={doProfileSubmit} disabled={loading === 'register'}>
                {loading === 'register' ? 'Submitting...' : 'Complete Profile'}
              </button>
            </div>
          )}

          {step === 'complete' && (
            <div className="auth-step active" id="step-complete" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--grg)', border: '2px solid rgba(34,197,94,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gr)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </div>
              <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 24, marginBottom: 8 }}>Welcome to Blorbmart!</div>
              <div style={{ fontSize: 13, color: 'var(--t3)' }}>Your kitchen is ready to start receiving orders.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
