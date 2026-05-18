import { useState } from 'react';
import type { VendorOrder } from '../../types/portal';

interface OrdersScreenProps {
  orders: VendorOrder[];
  activeTab: VendorOrder['status'];
  onTabChange: (tab: VendorOrder['status']) => void | Promise<void>;
  onAdvance: (id: string) => void | Promise<void>;
  onReject: (id: string) => void | Promise<void>;
  onSetReadyInMinutes: (id: string, minutes: number) => void | Promise<void>;
  kitchenOpen: boolean;
  onGoHours: () => void;
}

const ORDER_FLOW = {
  new:      { action: 'Accept Order',   chipCls: 'chip-yellow', chipLabel: 'New Order',        color: 'var(--ye)' },
  accepted: { action: 'Mark as Ready',  chipCls: 'chip-blue',   chipLabel: 'Preparing',        color: 'var(--bl)' },
  ready:    { action: 'Dispatch Order', chipCls: 'chip-orange', chipLabel: 'Ready for Pickup', color: 'var(--or)' },
  picked:   { action: 'Mark Delivered', chipCls: 'chip-green',  chipLabel: 'Out for Delivery', color: 'var(--gr)' },
  done:     { action: null,             chipCls: 'chip-green',  chipLabel: 'Delivered',        color: 'var(--gr)' },
} as const;

const TAB_LABELS: Record<VendorOrder['status'], string> = {
  new: 'New', accepted: 'Preparing', ready: 'Ready', picked: 'Delivery', done: 'Done',
};

const PRESET_MINUTES = [10, 15, 20, 30, 45, 60];

const formatAbsoluteTime = (ms: number) =>
  new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms));

const elapsedMinutes = (ms: number) => Math.floor((Date.now() - ms) / 60000);

function ReadyInModal({
  orderId,
  onConfirm,
  onClose,
}: {
  orderId: string;
  onConfirm: (minutes: number) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState('');

  const minutes = selected ?? (custom ? Number(custom) : null);
  const valid = minutes !== null && Number.isFinite(minutes) && minutes >= 1;

  const handleConfirm = () => {
    if (!valid || minutes === null) return;
    onConfirm(minutes);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 17 }}>Set Ready Time</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 3 }}>Order {orderId}</div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ padding: '4px 8px', fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--t2)', marginBottom: 12 }}>How long until this order is ready?</div>

        {/* Preset buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {PRESET_MINUTES.map((m) => (
            <button
              key={m}
              className="btn btn-ghost btn-sm"
              onClick={() => { setSelected(m); setCustom(''); }}
              style={{
                border: selected === m ? '2px solid var(--or)' : '1px solid var(--b1)',
                color: selected === m ? 'var(--or)' : 'var(--t2)',
                fontWeight: selected === m ? 800 : 600,
                minWidth: 60,
              }}
            >
              {m} min
            </button>
          ))}
        </div>

        {/* Custom input */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: 'var(--t2)', display: 'block', marginBottom: 5 }}>
            Or enter custom minutes
          </label>
          <input
            type="number"
            min="1"
            max="240"
            placeholder="e.g. 25"
            value={custom}
            onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
            style={{
              width: '100%', padding: '9px 12px',
              background: 'var(--s2)', border: '1px solid var(--b1)',
              borderRadius: 'var(--r2)', color: 'var(--t1)', fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Info note */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--blg, rgba(59,130,246,.08))',
          border: '1px solid rgba(59,130,246,.2)',
          borderRadius: 'var(--r3)', padding: '8px 12px', marginBottom: 20, fontSize: 12, color: 'var(--bl)',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          Customer will receive a push notification with the ETA.
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 2, justifyContent: 'center', opacity: valid ? 1 : 0.45 }}
            disabled={!valid}
            onClick={handleConfirm}
          >
            {valid && minutes !== null ? `Notify customer — ${minutes} min` : 'Select a time'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrdersScreen({
  orders, activeTab, onTabChange, onAdvance, onReject, onSetReadyInMinutes, kitchenOpen, onGoHours,
}: OrdersScreenProps) {
  const [readyInModal, setReadyInModal] = useState<{ orderId: string } | null>(null);
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null);

  const tabs: VendorOrder['status'][] = ['new', 'accepted', 'ready', 'picked', 'done'];
  const counts = tabs.reduce(
    (acc, tab) => ({ ...acc, [tab]: orders.filter((o) => o.status === tab).length }),
    {} as Record<VendorOrder['status'], number>,
  );
  const filtered = orders.filter((o) => o.status === activeTab);

  const handleReadyInConfirm = async (minutes: number) => {
    if (!readyInModal) return;
    setReadyInModal(null);
    await onSetReadyInMinutes(readyInModal.orderId, minutes);
  };

  return (
    <div id="screen-orders" className="screen">
      <style>{`@keyframes badge-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}`}</style>
      <div className="fu">
        <div className="page-header">
          <div className="stack-sm">
            <div className="page-eyebrow">Order Desk</div>
            <div className="page-title">Manage incoming orders.</div>
          </div>
          <div className="surface-note" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                width: 9, height: 9, borderRadius: '50%',
                background: kitchenOpen ? 'var(--gr)' : 'var(--ye)',
                boxShadow: kitchenOpen ? '0 0 8px var(--gr)' : '0 0 8px var(--ye)',
                animation: 'glow 1.8s ease-in-out infinite',
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: kitchenOpen ? 'var(--gr)' : 'var(--ye)' }}>
              {kitchenOpen ? 'Kitchen Open' : 'Kitchen Paused'}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={onGoHours}>Change Status</button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'var(--s2)', borderRadius: 'var(--r2)', padding: 4, border: '1px solid var(--b1)', flexWrap: 'wrap' }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              className="btn order-tab"
              onClick={() => onTabChange(tab)}
              style={{
                flex: 1, justifyContent: 'center', borderRadius: 10,
                background: activeTab === tab ? 'var(--or)' : 'none',
                color: activeTab === tab ? '#fff' : 'var(--t2)',
                boxShadow: activeTab === tab ? '0 2px 10px rgba(249,115,22,.3)' : 'none',
                minWidth: 90,
              }}
            >
              {TAB_LABELS[tab]}
              <span
                className="order-tab-ct"
                style={{
                  background: activeTab === tab
                    ? 'rgba(255,255,255,.25)'
                    : (tab === 'new' && counts['new'] > 0 ? 'rgba(249,115,22,.15)' : 'var(--s4)'),
                  color: activeTab === tab
                    ? '#fff'
                    : (tab === 'new' && counts['new'] > 0 ? 'var(--or)' : 'var(--t2)'),
                  animation: tab === 'new' && counts['new'] > 0 && activeTab !== 'new'
                    ? 'badge-pulse 1.4s ease-in-out infinite'
                    : 'none',
                }}
              >
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* Order list */}
        <div id="orders-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              No {TAB_LABELS[activeTab].toLowerCase()} orders right now.
            </div>
          ) : (
            filtered.map((order) => {
              const flow = ORDER_FLOW[order.status];
              const isNew = order.status === 'new';
              const isDone = order.status === 'done';
              const elapsed = elapsedMinutes(order.createdAtMs);
              const isUrgent = isNew && elapsed >= 5;
              const absTime = formatAbsoluteTime(order.createdAtMs);

              return (
                <div
                  className="card"
                  key={order.id}
                  style={{ borderLeft: `4px solid ${isUrgent ? '#ef4444' : flow.color}` }}
                >
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 15 }}>{order.id}</span>
                        <span className={`chip ${flow.chipCls}`}>{flow.chipLabel}</span>
                        {isUrgent && (
                          <span className="chip" style={{ background: 'rgba(239,68,68,.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,.25)' }}>
                            Waiting {elapsed} min
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{order.customer}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{order.addr}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 20, color: 'var(--or)', lineHeight: 1 }}>
                        ₦{order.total.toLocaleString()}
                      </div>
                      {order.placed !== 'Just now' && (
                        <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4, fontWeight: 600 }}>
                          {order.placed}
                        </div>
                      )}
                      <div style={{ fontSize: 10.5, color: 'var(--t3)', marginTop: 1 }}>
                        {absTime}
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div style={{ background: 'var(--s2)', borderRadius: 'var(--r2)', padding: '10px 13px', marginBottom: 12 }}>
                    {order.items.map((it) => (
                      <div
                        key={`${order.id}-${it.name}`}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--b1)' }}
                      >
                        <span style={{ color: 'var(--t2)' }}>
                          <span style={{ fontWeight: 700, color: 'var(--t1)', marginRight: 5 }}>{it.qty}×</span>
                          {it.name}
                        </span>
                        <span style={{ fontWeight: 700, flexShrink: 0 }}>₦{(it.qty * it.price).toLocaleString()}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, paddingTop: 8, fontWeight: 800 }}>
                      <span style={{ color: 'var(--t2)' }}>
                        {order.items.reduce((s, i) => s + i.qty, 0)} item{order.items.reduce((s, i) => s + i.qty, 0) !== 1 ? 's' : ''}
                      </span>
                      <span style={{ color: 'var(--or)' }}>₦{order.total.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Customer note */}
                  {order.note && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, background: 'var(--yeg)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 'var(--r3)', padding: '8px 12px', fontSize: 12, color: 'var(--ye)', marginBottom: 12 }}>
                      <svg style={{ flexShrink: 0, marginTop: 1 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                      <span><b>Note:</b> {order.note}</span>
                    </div>
                  )}

                  {/* Ready-in banner */}
                  {order.readyInMinutes ? (
                    <div style={{ fontSize: 12, color: 'var(--bl)', marginBottom: 10, fontWeight: 600 }}>
                      ⏱ Ready in {order.readyInMinutes} min
                    </div>
                  ) : null}

                  {/* Actions */}
                  {isDone ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--gr)', fontSize: 13, fontWeight: 700 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gr)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      Delivered successfully
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {isNew && (
                        <button className="btn btn-danger btn-sm" onClick={() => setRejectConfirmId(order.id)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Reject
                        </button>
                      )}
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => onAdvance(order.id)}
                      >
                        {flow.action}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setReadyInModal({ orderId: order.id })}
                      >
                        ⏱ Ready in…
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Ready-in modal */}
      {readyInModal && (
        <ReadyInModal
          orderId={readyInModal.orderId}
          onConfirm={handleReadyInConfirm}
          onClose={() => setReadyInModal(null)}
        />
      )}

      {/* Reject confirmation modal */}
      {rejectConfirmId && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setRejectConfirmId(null); }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 380, padding: 24 }}>
            <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 17, marginBottom: 8 }}>
              Reject Order?
            </div>
            <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 20 }}>
              Order <b>{rejectConfirmId}</b> will be cancelled and the customer will be notified.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setRejectConfirmId(null)}
              >
                Keep Order
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  const id = rejectConfirmId;
                  setRejectConfirmId(null);
                  onReject(id);
                }}
              >
                Yes, Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
