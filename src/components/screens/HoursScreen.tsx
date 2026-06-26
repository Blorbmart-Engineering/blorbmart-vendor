import { useState } from 'react';
import type { WeekScheduleRow } from '../../data/mock';
import type { PreorderConfig } from '../../types/portal';

const FULFILLMENT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface Closure {
  date: string;
  reason: string;
}

interface HoursScreenProps {
  kitchenOpen: boolean;
  onToggleKitchen: () => void | Promise<void>;
  schedule: WeekScheduleRow[];
  onToggleDay: (idx: number) => void;
  onUpdateHour: (idx: number, field: 'from' | 'to', value: string) => void;
  onSaveSettings: () => void | Promise<void>;
  closures: Closure[];
  onAddClosure: (date: string, reason: string) => void | Promise<void>;
  onRemoveClosure: (idx: number) => void | Promise<void>;
  pauseMinutes: number;
  onPauseMinutesChange: (minutes: number) => void;
  onPauseStore: () => void | Promise<void>;
  preorderConfig: PreorderConfig;
  preorderStatusMessage: string | null;
  onPreorderChange: (patch: Partial<PreorderConfig>) => void;
  onSavePreorder: () => void | Promise<void>;
  onPromotePreorders: () => void | Promise<void>;
}

export function HoursScreen({
  kitchenOpen,
  onToggleKitchen,
  schedule,
  onToggleDay,
  onUpdateHour,
  onSaveSettings,
  closures,
  onAddClosure,
  onRemoveClosure,
  pauseMinutes,
  onPauseMinutesChange,
  onPauseStore,
  preorderConfig,
  preorderStatusMessage,
  onPreorderChange,
  onSavePreorder,
  onPromotePreorders,
}: HoursScreenProps) {
  const [closureDate, setClosureDate] = useState('');
  const [closureReason, setClosureReason] = useState('');

  return (
    <div id="screen-hours" className="screen">
      <div className="fu">
        <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Hours &amp; Status</div>
        <div style={{ color: 'var(--t3)', fontSize: 13, marginBottom: 22 }}>Control when your kitchen accepts orders</div>

        <div className="card fu fu1" style={{ marginBottom: 16, maxWidth: 560 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: preorderConfig.enabled ? 16 : 0 }}>
            <div>
              <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 16 }}>Preorder Fulfillment</div>
              <div style={{ fontSize: 12.5, color: 'var(--t3)', marginTop: 4 }}>
                Let customers order ahead for specific fulfillment days and times.
              </div>
            </div>
            <div
              onClick={() => onPreorderChange({ enabled: !preorderConfig.enabled })}
              style={{
                width: 54, height: 28, borderRadius: 999,
                background: preorderConfig.enabled ? 'var(--or)' : 'var(--t3)',
                cursor: 'pointer', position: 'relative', transition: 'background .3s', flexShrink: 0,
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3, left: preorderConfig.enabled ? 29 : 3,
                transition: 'left .25s', boxShadow: '0 2px 6px rgba(0,0,0,.3)',
              }} />
            </div>
          </div>

          {preorderConfig.enabled && (
            <>
              {preorderStatusMessage && (
                <div style={{ padding: '10px 12px', borderRadius: 'var(--r2)', background: 'var(--org)', border: '1px solid rgba(249,115,22,.2)', fontSize: 13, color: 'var(--or)', marginBottom: 16 }}>
                  {preorderStatusMessage}
                </div>
              )}

              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Fulfillment days</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {FULFILLMENT_DAYS.map((day) => {
                  const selected = preorderConfig.fulfillmentDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{
                        border: selected ? '1px solid var(--or)' : '1px solid var(--b1)',
                        background: selected ? 'rgba(249,115,22,.12)' : 'var(--s2)',
                        color: selected ? 'var(--or)' : 'var(--t2)',
                      }}
                      onClick={() => {
                        const next = selected
                          ? preorderConfig.fulfillmentDays.filter((d) => d !== day)
                          : [...preorderConfig.fulfillmentDays, day];
                        onPreorderChange({ fulfillmentDays: next });
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="lbl">Fulfillment start time</label>
                  <input
                    className="inp"
                    type="time"
                    value={preorderConfig.fulfillmentTime}
                    onChange={(e) => onPreorderChange({ fulfillmentTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="lbl">Cutoff (hours before)</label>
                  <input
                    className="inp"
                    type="number"
                    min={0}
                    step={1}
                    value={preorderConfig.cutoffHoursBefore}
                    onChange={(e) => onPreorderChange({ cutoffHoursBefore: Math.max(0, Number(e.target.value || 0)) })}
                  />
                </div>
                <div>
                  <label className="lbl">Max orders per day (optional)</label>
                  <input
                    className="inp"
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    value={preorderConfig.maxOrdersPerDay ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      onPreorderChange({ maxOrdersPerDay: raw === '' ? null : Math.max(1, Number(raw)) });
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
                  <input
                    id="allow-asap"
                    type="checkbox"
                    checked={preorderConfig.allowAsapWhenOpen}
                    onChange={(e) => onPreorderChange({ allowAsapWhenOpen: e.target.checked })}
                  />
                  <label htmlFor="allow-asap" style={{ fontSize: 13 }}>Also accept ASAP orders when open</label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={onSavePreorder}>Save Preorder Settings</button>
                <button className="btn btn-ghost" onClick={onPromotePreorders}>Start Fulfillment Day</button>
              </div>
            </>
          )}
        </div>

        <div className="card fu fu1" style={{ marginBottom: 16, maxWidth: 560 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div id="status-icon-wrap" style={{ width: 50, height: 50, borderRadius: 14, background: kitchenOpen ? 'var(--grg)' : 'var(--yeg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={kitchenOpen ? 'var(--gr)' : 'var(--ye)'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 16 }}>
                  {preorderConfig.enabled && !preorderConfig.allowAsapWhenOpen
                    ? (preorderStatusMessage || 'Accepting preorders')
                    : kitchenOpen ? 'Kitchen is Open' : 'Kitchen is Paused'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
                  {preorderConfig.enabled && !preorderConfig.allowAsapWhenOpen
                    ? 'Preorder-only mode — ASAP orders disabled'
                    : kitchenOpen ? 'Accepting orders right now' : 'Not accepting new orders'}
                </div>
              </div>
            </div>
            <div onClick={onToggleKitchen} id="kitchen-toggle" style={{ width: 54, height: 28, borderRadius: 999, background: kitchenOpen ? 'var(--gr)' : 'var(--t3)', cursor: 'pointer', position: 'relative', transition: 'background .3s', flexShrink: 0 }}>
              <div id="kitchen-toggle-knob" style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: kitchenOpen ? 29 : 3, transition: 'left .25s', boxShadow: '0 2px 6px rgba(0,0,0,.3)' }} />
            </div>
          </div>
        </div>
        <div className="card fu fu1" style={{ marginBottom: 16, maxWidth: 560 }}>
          <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Temporary Pause Timer</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="inp" type="number" min={5} step={5} value={pauseMinutes} onChange={(e) => onPauseMinutesChange(Math.max(5, Number(e.target.value || 0)))} />
            <button className="btn btn-ghost" onClick={onPauseStore}>Pause Store</button>
          </div>
        </div>

        {!kitchenOpen && (
          <div id="pause-banner" style={{ padding: '13px 16px', borderRadius: 'var(--r2)', background: 'var(--yeg)', border: '1px solid rgba(245,158,11,.25)', fontSize: 13, color: 'var(--ye)', marginBottom: 16, maxWidth: 560 }}>
            ⏸ Kitchen is paused — no new orders will be accepted until you reopen.
          </div>
        )}

        <div className="card fu fu2" style={{ maxWidth: 560, marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Weekly Schedule</div>
          <div id="hours-schedule">
            {schedule.map((row, i) => (
              <div key={row.day} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < schedule.length - 1 ? '1px solid var(--b1)' : 'none' }}>
                <div style={{ width: 88, fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{row.day}</div>
                <div onClick={() => onToggleDay(i)} style={{ width: 38, height: 22, borderRadius: 999, background: row.open ? 'var(--or)' : 'var(--s4)', cursor: 'pointer', position: 'relative', transition: 'background .25s', flexShrink: 0 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: row.open ? 19 : 3, transition: 'left .22s', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} />
                </div>
                {row.open ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <input className="inp" type="time" value={row.from} style={{ flex: 1, padding: '6px 10px', fontSize: 12.5 }} onChange={(e) => onUpdateHour(i, 'from', e.target.value)} />
                    <span style={{ color: 'var(--t3)', fontSize: 12, flexShrink: 0 }}>to</span>
                    <input className="inp" type="time" value={row.to} style={{ flex: 1, padding: '6px 10px', fontSize: 12.5 }} onChange={(e) => onUpdateHour(i, 'to', e.target.value)} />
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--t3)' }}>Closed</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card fu fu3" style={{ maxWidth: 560, marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Delivery Settings</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="lbl">Min Order (₦)</label>
              <input className="inp" id="min-order" type="number" defaultValue={1500} placeholder="e.g. 1500" />
            </div>
            <div>
              <label className="lbl">Avg Prep Time (mins)</label>
              <input className="inp" id="avg-prep" type="number" defaultValue={25} placeholder="e.g. 25" />
            </div>
            <div>
              <label className="lbl">Delivery Radius (km)</label>
              <input className="inp" id="del-radius" type="number" defaultValue={5} placeholder="e.g. 5" />
            </div>
            <div>
              <label className="lbl">Max Active Orders</label>
              <input className="inp" id="max-orders" type="number" defaultValue={10} placeholder="e.g. 10" />
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onSaveSettings}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
            Save Settings
          </button>
        </div>

        <div className="card fu fu4" style={{ maxWidth: 560 }}>
          <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Temporary Closure</div>
          <div style={{ fontSize: 12.5, color: 'var(--t3)', marginBottom: 14 }}>Mark your kitchen closed for a specific date (e.g. public holiday)</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input className="inp" type="date" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
            <input className="inp" type="text" value={closureReason} onChange={(e) => setClosureReason(e.target.value)} placeholder="Reason (e.g. Public Holiday)" style={{ flex: 2, minWidth: 160 }} />
            <button className="btn btn-ghost" onClick={() => {
              if (!closureDate) return;
              onAddClosure(closureDate, closureReason.trim() || 'Temporary closure');
              setClosureDate('');
              setClosureReason('');
            }}>Add Closure</button>
          </div>
          <div id="closure-list" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {closures.map((c, i) => (
              <div key={`${c.date}-${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--s2)', borderRadius: 'var(--r2)', padding: '9px 13px', fontSize: 13 }}>
                <div><span style={{ fontWeight: 600 }}>{c.date}</span> <span style={{ color: 'var(--t3)', marginLeft: 8 }}>{c.reason}</span></div>
                <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => onRemoveClosure(i)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
