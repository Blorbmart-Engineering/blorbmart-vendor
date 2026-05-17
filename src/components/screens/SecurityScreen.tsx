import { useEffect, useMemo, useState } from 'react';
import { setupWalletPin, changeWalletPin, fetchWalletOverview, requestPinReset, confirmPinReset } from '../../services/vendorPortal';

interface SecurityScreenProps {
  onShowToast: (msg: string) => void;
}

type PinMode = 'main' | 'setup' | 'change' | 'reset-request' | 'reset-otp' | 'reset-pin' | 'done';

function Keypad({ onTap }: { onTap: (key: string) => void }) {
  const keys = useMemo(() => [1,2,3,4,5,6,7,8,9,'',0,'⌫'], []);
  return (
    <div className="keypad" id="pin-keypad">
      {keys.map((k, i) => (
        <button key={`${k}-${i}`} className={`key-btn ${k === '' ? 'empty' : ''}`} onClick={() => onTap(String(k))}>{k}</button>
      ))}
    </div>
  );
}

export function SecurityScreen({ onShowToast }: SecurityScreenProps) {
  const [mode, setMode] = useState<PinMode>('main');
  const [pinPhase, setPinPhase] = useState(0);
  const [pins, setPins] = useState(['', '', '']);
  const [mismatch, setMismatch] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  // Reset flow state
  const [resetMaskedEmail, setResetMaskedEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetOtpError, setResetOtpError] = useState('');
  const [resetPins, setResetPins] = useState(['', '']);
  const [resetPinPhase, setResetPinPhase] = useState(0);
  const [resetPinMismatch, setResetPinMismatch] = useState(false);
  const [requestingReset, setRequestingReset] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Check if wallet has PIN set
  useEffect(() => {
    checkPinStatus();
  }, []);

  const checkPinStatus = async () => {
    try {
      const wallet = await fetchWalletOverview();
      setHasPin(!!wallet?.pinSet);
    } catch (error) {
      console.error('Failed to check PIN status:', error);
      setHasPin(null);
    }
  };

  // Resend cooldown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleRequestReset = async () => {
    setRequestingReset(true);
    try {
      const { emailMasked } = await requestPinReset();
      setResetMaskedEmail(emailMasked);
      setResetOtp('');
      setResetOtpError('');
      setResendCooldown(60);
      setMode('reset-otp');
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Failed to send code');
    } finally {
      setRequestingReset(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setRequestingReset(true);
    try {
      const { emailMasked } = await requestPinReset();
      setResetMaskedEmail(emailMasked);
      setResetOtp('');
      setResetOtpError('');
      setResendCooldown(60);
      onShowToast('New code sent');
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Failed to resend code');
    } finally {
      setRequestingReset(false);
    }
  };

  const handleOtpContinue = () => {
    if (resetOtp.length !== 6) return;
    setResetOtpError('');
    setResetPins(['', '']);
    setResetPinPhase(0);
    setMode('reset-pin');
  };

  const tapResetPin = (k: string) => {
    if (savingPin) return;
    if (k === '⌫') {
      setResetPins((p) => { const n = [...p]; n[resetPinPhase] = n[resetPinPhase].slice(0, -1); return n; });
      return;
    }
    if (k === '') return;
    setResetPins((p) => {
      if (p[resetPinPhase].length >= 4) return p;
      const n = [...p]; n[resetPinPhase] = n[resetPinPhase] + k; return n;
    });
  };

  // Auto-advance reset PIN phases
  useEffect(() => {
    if (mode !== 'reset-pin') return;
    const val = resetPins[resetPinPhase];
    if (val.length !== 4) return;

    if (resetPinPhase === 0) {
      const t = setTimeout(() => {
        setResetPinPhase(1);
        setResetPins((p) => [p[0], '']);
      }, 220);
      return () => clearTimeout(t);
    }

    if (resetPinPhase === 1) {
      if (resetPins[0] !== resetPins[1]) {
        setResetPinMismatch(true);
        setTimeout(() => {
          setResetPins(['', '']);
          setResetPinPhase(0);
          setResetPinMismatch(false);
        }, 600);
        return;
      }
      handleConfirmReset();
    }
  }, [resetPinPhase, resetPins, mode]);

  const handleConfirmReset = async () => {
    if (savingPin) return;
    setSavingPin(true);
    try {
      await confirmPinReset(resetOtp, resetPins[0]);
      setHasPin(true);
      setMode('done');
    } catch (error) {
      // OTP was rejected — send them back to OTP entry
      const msg = error instanceof Error ? error.message : 'Invalid code';
      setResetOtpError(msg);
      setResetPins(['', '']);
      setResetPinPhase(0);
      setMode('reset-otp');
      onShowToast(msg);
    } finally {
      setSavingPin(false);
    }
  };

  const resetPinFlow = () => {
    setPinPhase(0);
    setPins(['', '', '']);
    setMismatch(false);
  };

  const handlePinComplete = async () => {
    if (savingPin) return;
    
    setSavingPin(true);
    try {
      if (mode === 'setup') {
        // Setup: pins[0]=new, pins[1]=confirm
        if (pins[0] !== pins[1]) {
          setMismatch(true);
          setTimeout(() => {
            setPins(['', '']);
            setPinPhase(0);
            setMismatch(false);
          }, 600);
          return;
        }
        await setupWalletPin(pins[0]);
        setHasPin(true);
        onShowToast('PIN set successfully!');
      } else if (mode === 'change') {
        // Change: pins[0]=current, pins[1]=new, pins[2]=confirm
        if (pins[1] !== pins[2]) {
          setMismatch(true);
          setTimeout(() => {
            setPins([pins[0], '', '']);
            setPinPhase(1);
            setMismatch(false);
          }, 600);
          return;
        }
        await changeWalletPin(pins[0], pins[1]);
        onShowToast('PIN changed successfully!');
      }
      setMode('done');
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Failed to save PIN');
      resetPinFlow();
    } finally {
      setSavingPin(false);
    }
  };

  const tapPin = (k: string) => {
    if (savingPin) return;
    
    if (k === '⌫') {
      setPins((p) => {
        const next = [...p];
        next[pinPhase] = next[pinPhase].slice(0, -1);
        return next;
      });
      return;
    }
    if (k === '') return;
    setPins((p) => {
      if (p[pinPhase].length >= 4) return p;
      const next = [...p];
      next[pinPhase] = next[pinPhase] + k;
      return next;
    });
  };

  // Auto-advance and handle completion
  useEffect(() => {
    const phaseValue = pins[pinPhase];
    if (phaseValue.length !== 4) return;

    if (mode === 'setup') {
      // Setup: 0=new, 1=confirm
      if (pinPhase === 0) {
        const t = setTimeout(() => {
          setPinPhase(1);
          setPins((p) => [p[0], '', '']);
        }, 220);
        return () => clearTimeout(t);
      }
      if (pinPhase === 1) {
        handlePinComplete();
      }
    } else if (mode === 'change') {
      // Change: 0=current, 1=new, 2=confirm
      if (pinPhase < 2) {
        const t = setTimeout(() => {
          setPinPhase((p) => p + 1);
          setPins((p) => {
            const next = [...p];
            next[pinPhase + 1] = '';
            return next;
          });
        }, 220);
        return () => clearTimeout(t);
      }
      if (pinPhase === 2) {
        handlePinComplete();
      }
    }
  }, [pinPhase, pins, mode]);

  return (
    <div id="screen-security" className="screen">
      <div className="fu">
        <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Security &amp; PIN</div>
        <div style={{ color: 'var(--t3)', fontSize: 13, marginBottom: 20 }}>Protect your wallet from unauthorised withdrawals</div>

        {mode === 'main' && (
          <div id="sec-main" style={{ maxWidth: 480 }}>
            {hasPin === false && (
              <div style={{ padding: '14px 16px', borderRadius: 'var(--r2)', background: 'var(--yeg)', border: '1px solid rgba(245,158,11,.25)', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ye)" strokeWidth="2">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ye)' }}>PIN Required</div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>Set up your PIN to enable withdrawals</div>
                  </div>
                </div>
              </div>
            )}
            
            {hasPin ? (
              <div className="sec-card" onClick={() => { setMode('change'); resetPinFlow(); }}>
                <div className="sec-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--or)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11a7 7 0 0114 0v1h1a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-8a1 1 0 011-1h1v-1zm7 5v2" /></svg></div>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>Change Wallet PIN</div><div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>Update your 4-digit withdrawal PIN</div></div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
              </div>
            ) : (
              <div className="sec-card" onClick={() => { setMode('setup'); resetPinFlow(); }} style={{ border: '2px solid var(--or)' }}>
                <div className="sec-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--or)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11a7 7 0 0114 0v1h1a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-8a1 1 0 011-1h1v-1zm7 5v2" /></svg></div>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>Set Up Wallet PIN</div><div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>Create your 4-digit withdrawal PIN</div></div>
                <span className="chip chip-orange">Required</span>
              </div>
            )}
            <div className="sec-card" onClick={() => { setMode('reset-request'); setResetOtp(''); setResetOtpError(''); setResetPins(['', '']); setResetPinPhase(0); }}>
              <div className="sec-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--or)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v5h5M20 20v-5h-5M20.5 9A9 9 0 005.2 5.2M3.5 15a9 9 0 0015.3 3.8" /></svg></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>Reset PIN via Email</div><div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>Verify your email to reset your PIN</div></div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
            </div>
            <div className="sec-card" style={{ cursor: 'default' }}>
              <div className="sec-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--or)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>Withdrawal Lock</div><div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>PIN required on every withdrawal</div></div>
              <span className="chip chip-green">Active</span>
            </div>
            <div className="sec-card" style={{ cursor: 'default' }}>
              <div className="sec-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--or)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3C7.7 6.2 6 8.4 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>Security Alerts</div><div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>Notify on withdrawals and lock events</div></div>
              <span className="chip chip-green">On</span>
            </div>
            <div style={{ padding: '13px 16px', borderRadius: 'var(--r2)', background: 'var(--reg)', border: '1px solid rgba(244,63,94,.18)', fontSize: 12.5, color: 'var(--re)' }}>
              🔒 After 5 wrong PIN attempts, withdrawals lock for 24 hours.
            </div>
          </div>
        )}

        {(mode === 'change' || mode === 'setup') && (
          <div id="sec-change" style={{ maxWidth: 360 }}>
            <div className="card fu">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setMode('main')}>← Back</button>
                <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 16 }}>
                  {mode === 'setup' ? 'Set Up PIN' : 'Change PIN'}
                </div>
              </div>
              
              {savingPin && (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'inline-block', width: 24, height: 24, border: '2px solid var(--or)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>Saving...</p>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: 6, marginBottom: 22 }} id="pin-steps">
                {(mode === 'setup' ? [0, 1] : [0, 1, 2]).map((i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div id={`step-bar-${i}`} className="step-bar" style={{ background: i <= pinPhase ? 'var(--or)' : 'var(--s4)' }}></div>
                    <div id={`step-lbl-${i}`} style={{ fontSize: 10, color: i === pinPhase ? 'var(--or)' : 'var(--t3)', fontWeight: 600, marginTop: 5 }}>
                      {mode === 'setup' 
                        ? (i === 0 ? 'New' : 'Confirm')
                        : (i === 0 ? 'Current' : i === 1 ? 'New' : 'Confirm')
                      }
                    </div>
                  </div>
                ))}
              </div>
              
              <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--t2)', marginBottom: 4 }} id="pin-prompt">
                {mode === 'setup'
                  ? (pinPhase === 0 ? 'Enter new 4-digit PIN' : 'Confirm new PIN')
                  : (pinPhase === 0 ? 'Enter current PIN' : pinPhase === 1 ? 'Enter new PIN' : 'Confirm new PIN')
                }
              </div>
              
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '18px 0' }} id="pin-dots">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`pin-dot ${i < pins[pinPhase].length ? 'filled' : ''}`} id={`pd${i}`} />
                ))}
              </div>
              {mismatch && <div id="pin-mismatch" style={{ textAlign: 'center', color: 'var(--re)', fontSize: 12, marginBottom: 8 }}>PINs don&apos;t match — try again</div>}
              <Keypad onTap={tapPin} />
            </div>
          </div>
        )}

        {mode === 'reset-request' && (
          <div style={{ maxWidth: 480 }}>
            <div className="card fu">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setMode('main')}>← Back</button>
                <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 16 }}>Reset Wallet PIN</div>
              </div>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ye)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v5h5M20 20v-5h-5M20.5 9A9 9 0 005.2 5.2M3.5 15a9 9 0 0015.3 3.8" /></svg>
              </div>
              <div style={{ textAlign: 'center', fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Verify Your Email</div>
              <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--t3)', lineHeight: 1.6, marginBottom: 24 }}>
                We'll send a 6-digit code to your registered email address. Enter it on the next screen to reset your PIN.
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 'var(--r2)', background: 'var(--yeg)', border: '1px solid rgba(245,158,11,.18)', fontSize: 12.5, color: 'var(--ye)', marginBottom: 20 }}>
                ⚠ Make sure you have access to your registered email before continuing.
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleRequestReset}
                disabled={requestingReset}
              >
                {requestingReset ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                    Sending...
                  </span>
                ) : 'Send Reset Code'}
              </button>
            </div>
          </div>
        )}

        {mode === 'reset-otp' && (
          <div style={{ maxWidth: 480 }}>
            <div className="card fu">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setMode('reset-request')}>← Back</button>
                <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 16 }}>Enter Reset Code</div>
              </div>
              <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--t3)', marginBottom: 6 }}>
                A 6-digit code was sent to
              </div>
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, color: 'var(--t1)', marginBottom: 20 }}>
                {resetMaskedEmail}
              </div>
              <input
                className="inp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                style={{ fontSize: 26, letterSpacing: '0.4em', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, marginBottom: 8 }}
                value={resetOtp}
                onChange={(e) => {
                  setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setResetOtpError('');
                }}
              />
              {resetOtpError && (
                <div style={{ color: 'var(--re)', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>{resetOtpError}</div>
              )}
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--t3)', marginBottom: 20 }}>
                Code expires in <strong style={{ color: 'var(--t2)' }}>10 minutes</strong>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
                onClick={handleOtpContinue}
                disabled={resetOtp.length !== 6}
              >
                Continue
              </button>
              <button
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || requestingReset}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : requestingReset ? 'Sending...' : 'Resend Code'}
              </button>
            </div>
          </div>
        )}

        {mode === 'reset-pin' && (
          <div id="sec-reset-pin" style={{ maxWidth: 360 }}>
            <div className="card fu">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setMode('reset-otp')}>← Back</button>
                <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 16 }}>Set New PIN</div>
              </div>
              {savingPin && (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'inline-block', width: 24, height: 24, border: '2px solid var(--or)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>Saving...</p>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
                {[0, 1].map((i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div className="step-bar" style={{ background: i <= resetPinPhase ? 'var(--or)' : 'var(--s4)' }} />
                    <div style={{ fontSize: 10, color: i === resetPinPhase ? 'var(--or)' : 'var(--t3)', fontWeight: 600, marginTop: 5 }}>
                      {i === 0 ? 'New PIN' : 'Confirm'}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--t2)', marginBottom: 4 }}>
                {resetPinPhase === 0 ? 'Enter new 4-digit PIN' : 'Confirm new PIN'}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '18px 0' }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`pin-dot ${i < resetPins[resetPinPhase].length ? 'filled' : ''}`} />
                ))}
              </div>
              {resetPinMismatch && (
                <div style={{ textAlign: 'center', color: 'var(--re)', fontSize: 12, marginBottom: 8 }}>PINs don&apos;t match — try again</div>
              )}
              <Keypad onTap={tapResetPin} />
            </div>
          </div>
        )}

        {mode === 'done' && (
          <div id="sec-done" style={{ maxWidth: 360 }}>
            <div className="card fu" style={{ textAlign: 'center', padding: '40px 28px' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--grg)', border: '1px solid rgba(34,197,94,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', animation: 'glow 2s ease-in-out infinite' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gr)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </div>
              <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 20, marginBottom: 8 }}>
                {hasPin ? 'PIN Updated!' : 'PIN Set Up!'}
              </div>
              <div style={{ color: 'var(--t3)', fontSize: 13, marginBottom: 22 }}>
                {hasPin 
                  ? 'Your wallet PIN has been changed successfully.'
                  : 'Your wallet PIN has been set up. You can now make withdrawals!'
                }
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setMode('main')}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
