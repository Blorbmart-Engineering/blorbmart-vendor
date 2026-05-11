import { useEffect, useMemo, useState } from 'react';

interface PinModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => Promise<void>;
  processing?: boolean;
  title?: string;
  description?: string;
}

function Keypad({ onTap }: { onTap: (key: string) => void }) {
  const keys = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'Back'], []);
  return (
    <div className="keypad" id="pin-keypad">
      {keys.map((k, i) => (
        <button key={`${k}-${i}`} className={`key-btn ${k === '' ? 'empty' : ''}`} onClick={() => onTap(String(k))}>{k}</button>
      ))}
    </div>
  );
}

export function PinModal({
  open,
  onClose,
  onSubmit,
  processing = false,
  title = 'Verify PIN',
  description = 'Enter your 4-digit PIN to confirm this operation.',
}: PinModalProps) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPin('');
      setErr('');
      setSubmitting(false);
    }
  }, [open]);

  const tapPin = (k: string) => {
    if (submitting || processing) return;
    if (k === 'Back') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (k === '' || pin.length >= 4) return;
    setPin((p) => p + k);
  };

  const handleSubmit = async () => {
    if (pin.length < 4) {
      setErr('Enter your 4-digit PIN');
      return;
    }
    setErr('');
    setSubmitting(true);
    try {
      await onSubmit(pin);
      setPin('');
      onClose();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'PIN verification failed');
      setSubmitting(false);
    }
  };

  return (
    <div className={`overlay ${open ? 'open' : ''}`} id="pin-modal" onClick={(e) => { if ((e.target as HTMLElement).id === 'pin-modal') onClose(); }}>
      <div className="modal" style={{ maxWidth: 360 }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 20, marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--t2)' }}>{description}</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  border: '2px solid var(--b2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 600,
                  background: pin[i] ? 'var(--org)' : 'var(--s3)',
                  color: pin[i] ? '#fff' : 'var(--t2)',
                  transition: 'all 0.15s',
                }}
              >
                {pin[i] ? '•' : ''}
              </div>
            ))}
          </div>
        </div>

        <Keypad onTap={tapPin} />

        {err && <div style={{ color: 'var(--re)', fontSize: 12.5, marginBottom: 14, textAlign: 'center' }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose} disabled={submitting || processing}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleSubmit}
            disabled={submitting || processing || pin.length < 4}
          >
            {submitting || processing ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                Verifying...
              </span>
            ) : (
              'Verify'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
