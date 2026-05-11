import { useEffect, useState } from 'react';
import type { BankAccount } from '../../types/portal';
import { PinModal } from '../modals/PinModal';
import { fetchBanks, verifyBankAccount, saveBankAccount, deleteBankAccount, verifyWalletPin } from '../../services/vendorPortal';

interface Bank {
  name: string;
  code: string;
  active: boolean;
}

interface BankScreenProps {
  onShowToast: (msg: string) => void;
  bankAccount?: BankAccount | null;
  onBankAccountChange?: (account: BankAccount | null) => void;
}

export function BankScreen({ onShowToast, bankAccount, onBankAccountChange }: BankScreenProps) {
  const [editing, setEditing] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [acctInput, setAcctInput] = useState('');
  const [acctName, setAcctName] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'update' | 'delete' | null>(null);

  useEffect(() => {
    if (editing) {
      loadBanks();
    }
  }, [editing]);

  const loadBanks = async () => {
    setLoadingBanks(true);
    try {
      const bankList = await fetchBanks();
      setBanks(bankList.filter(b => b.active).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Failed to load banks');
    } finally {
      setLoadingBanks(false);
    }
  };

  const handleVerifyAccount = async () => {
    if (!selectedBankCode || acctInput.length !== 10) return;
    
    setVerifying(true);
    try {
      const result = await verifyBankAccount(selectedBankCode, acctInput);
      setAcctName(result.accountName);
      onShowToast('Account verified successfully');
    } catch (error) {
      setAcctName('');
      onShowToast(error instanceof Error ? error.message : 'Failed to verify account');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (selectedBankCode && acctInput.length === 10) {
      const timeout = setTimeout(() => {
        handleVerifyAccount();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [selectedBankCode, acctInput]);

  const handleSave = async () => {
    if (!selectedBankCode || acctInput.length !== 10 || !acctName) {
      onShowToast('Please enter a valid bank account');
      return;
    }

    // If updating existing account, require PIN verification
    if (bankAccount) {
      setPendingAction('update');
      setPinModalOpen(true);
      return;
    }

    // New account - save directly
    await performSave();
  };

  const performSave = async () => {
    setSaving(true);
    try {
      const saved = await saveBankAccount(selectedBankCode, acctInput);
      onBankAccountChange?.(saved);
      setEditing(false);
      setSelectedBankCode('');
      setAcctInput('');
      setAcctName('');
      onShowToast('Bank account saved and verified successfully');
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Failed to save bank account');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove your bank account?')) return;
    
    // Require PIN verification for deletion
    setPendingAction('delete');
    setPinModalOpen(true);
  };

  const performDelete = async () => {
    setSaving(true);
    try {
      await deleteBankAccount();
      onBankAccountChange?.(null);
      onShowToast('Bank account removed');
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Failed to remove bank account');
    } finally {
      setSaving(false);
    }
  };

  const handlePinSubmit = async (pin: string) => {
    const valid = await verifyWalletPin(pin);
    if (!valid) {
      throw new Error('Incorrect PIN. Please try again.');
    }
    if (pendingAction === 'update') {
      await performSave();
    } else if (pendingAction === 'delete') {
      await performDelete();
    }
    setPendingAction(null);
    setPinModalOpen(false);
  };


  return (
    <>
      <div id="screen-bank" className="screen">
        <div className="fu">
          <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Bank Account</div>
          <div style={{ color: 'var(--t3)', fontSize: 13, marginBottom: 20 }}>Your payout destination</div>

          {!editing && (
            <div id="bank-view" style={{ maxWidth: 500 }}>
            {bankAccount ? (
              <>
                <div style={{ background: 'linear-gradient(135deg,#1A2535,#0F1825)', border: '1px solid var(--b2)', borderRadius: 14, padding: '22px 22px 18px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,107,43,0.08)' }} />
                  <div style={{ position: 'absolute', bottom: -40, left: 20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, position: 'relative', zIndex: 1 }}>
                    <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 14, color: 'var(--or)' }}>{bankAccount.bankName}</div>
                    {bankAccount.isVerified && (
                      <span className="chip chip-green"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--gr)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg> Verified</span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--hd)', fontWeight: 600, fontSize: 18, letterSpacing: '.18em', color: 'var(--t1)', marginBottom: 16, position: 'relative', zIndex: 1 }}>{bankAccount.accountMasked || '**** **** **** ****'}</div>
                  <div style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 500, position: 'relative', zIndex: 1 }}>{bankAccount.accountName}</div>
                </div>

                <div className="card" style={{ marginBottom: 14, padding: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--b1)', fontSize: 13 }}><span style={{ color: 'var(--t3)' }}>Account Name</span><span style={{ fontWeight: 600 }}>{bankAccount.accountName}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--b1)', fontSize: 13 }}><span style={{ color: 'var(--t3)' }}>Bank</span><span style={{ fontWeight: 600 }}>{bankAccount.bankName}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--b1)', fontSize: 13 }}><span style={{ color: 'var(--t3)' }}>Account No.</span><span style={{ fontWeight: 600 }}>{bankAccount.accountMasked || '****'}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', fontSize: 13 }}><span style={{ color: 'var(--t3)' }}>Status</span><span className="chip chip-green">{bankAccount.isVerified ? 'Verified' : 'Pending'}</span></div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: 'var(--r2)', background: 'var(--yeg)', border: '1px solid rgba(245,158,11,.18)', fontSize: 12.5, color: 'var(--ye)', marginBottom: 14 }}>
                  ⚠ Only one bank account allowed. Updating requires re-verification.
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditing(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 112.8 2.8L11.8 15H9v-2.8l8.6-8.6z" /></svg>
                    Update Account
                  </button>
                  <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', color: 'var(--re)' }} onClick={handleDelete}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                    Remove
                  </button>
                </div>
              </>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 10v11M12 10v11M16 10v11" /></svg>
                </div>
                <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No Bank Account Added</div>
                <div style={{ color: 'var(--t3)', fontSize: 13, marginBottom: 20 }}>Add a bank account to receive withdrawals</div>
                <button className="btn btn-primary" onClick={() => setEditing(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}><path d="M12 5v14M5 12h14" /></svg>
                  Add Bank Account
                </button>
              </div>
            )}
          </div>
        )}

        {editing && (
          <div id="bank-edit" style={{ maxWidth: 500 }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 17 }}>{bankAccount ? 'Update Bank Account' : 'Add Bank Account'}</div>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  setEditing(false);
                  setSelectedBankCode('');
                  setAcctInput('');
                  setAcctName('');
                }}>✕</button>
              </div>
              
              <div style={{ marginBottom: 14 }}>
                <label className="lbl">Bank Name</label>
                <select 
                  className="inp" 
                  value={selectedBankCode}
                  onChange={(e) => {
                    setSelectedBankCode(e.target.value);
                    setAcctName('');
                  }}
                  disabled={loadingBanks}
                >
                  <option value="">{loadingBanks ? 'Loading banks...' : 'Select your bank'}</option>
                  {banks.map((bank) => (
                    <option key={bank.code} value={bank.code}>{bank.name}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ marginBottom: 14 }}>
                <label className="lbl">Account Number</label>
                <input 
                  className="inp" 
                  type="text" 
                  placeholder="10-digit account number" 
                  maxLength={10} 
                  value={acctInput} 
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setAcctInput(val);
                    if (val.length !== 10) setAcctName('');
                  }}
                  disabled={verifying || saving}
                />
              </div>
              
              <div style={{ marginBottom: 20 }}>
                <label className="lbl">Account Name</label>
                <div
                  id="acct-name-field"
                  style={acctName ? { background: 'var(--grg)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 'var(--r2)', padding: '10px 13px', color: 'var(--gr)', fontWeight: 600, fontSize: 13.5 } : { background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 'var(--r2)', padding: '10px 13px', color: 'var(--t3)', fontSize: 13 }}
                >
                  {verifying ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                      Verifying with Paystack...
                    </span>
                  ) : (
                    acctName || 'Auto-filled after entering account number...'
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  className="btn btn-ghost" 
                  style={{ flex: 1 }} 
                  onClick={() => {
                    setEditing(false);
                    setSelectedBankCode('');
                    setAcctInput('');
                    setAcctName('');
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 2, justifyContent: 'center' }}
                  onClick={handleSave}
                  disabled={saving || !selectedBankCode || acctInput.length !== 10 || !acctName || verifying}
                >
                  {saving ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                      Saving...
                    </span>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                      Save & Verify
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <PinModal
        open={pinModalOpen}
        onClose={() => {
          setPinModalOpen(false);
          setPendingAction(null);
        }}
        onSubmit={handlePinSubmit}
        processing={saving}
        title={pendingAction === 'delete' ? 'Confirm Deletion' : 'Verify Bank Update'}
        description={pendingAction === 'delete' ? 'Enter your PIN to remove your bank account.' : 'Enter your PIN to update your bank account.'}
      />
    </>
  );
}
