import type { Txn } from '../../data/mock';
import type { WalletOverview, WalletSummary } from '../../types/portal';
import type { PageKey } from '../../types/ui';
import { fmtNaira } from '../../utils/format';

interface OverviewScreenProps {
  chart: { d: string; v: number }[];
  txns: Txn[];
  wallet: WalletOverview | null;
  summary: WalletSummary | null;
  scheduledOrdersCount: number;
  preorderStatusMessage: string | null;
  onOpenWithdraw: () => void;
  onNavigate: (page: PageKey) => void;
  onOpenScheduledOrders: () => void;
  onOpenTxDetail: (id: string) => void;
}

const txMeta = (t: Txn['type']) =>
  ({
    credit: { cls: 'chip-green', label: 'Credit' },
    debit: { cls: 'chip-red', label: 'Debit' },
    reversal: { cls: 'chip-yellow', label: 'Reversal' },
    adjustment: { cls: 'chip-blue', label: 'Adjustment' },
  }[t] || { cls: 'chip-orange', label: 'Other' });

export function OverviewScreen({ chart, txns, wallet, summary, scheduledOrdersCount, preorderStatusMessage, onOpenWithdraw, onNavigate, onOpenScheduledOrders, onOpenTxDetail }: OverviewScreenProps) {
  const max = Math.max(1, ...chart.map((d) => d.v));
  const chartPeak = Math.max(0, ...chart.map((item) => item.v));
  const chartTotal = chart.reduce((sum, item) => sum + item.v, 0);
  const busiestDay = chart.find((item) => item.v === chartPeak)?.d || '--';

  return (
    <div id="screen-overview" className="screen active">
      <div className="page-header fu">
        <div className="stack-sm">
          <div className="page-eyebrow">Overview</div>
          <div className="page-title">Your kitchen at a glance</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={onOpenWithdraw}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m0 0l-7 7m7-7l7 7" /></svg>
            Withdraw Funds
          </button>
          <button className="btn btn-ghost" onClick={() => onNavigate('orders')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /><path d="M9 12h6M9 16h4" /></svg>
            Check Orders
          </button>
        </div>
      </div>

      {(scheduledOrdersCount > 0 || preorderStatusMessage) && (
        <div className="card fu fu4" style={{ marginBottom: 20, border: '1px solid rgba(249,115,22,.2)', background: 'var(--org)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 15, color: 'var(--or)' }}>
                {scheduledOrdersCount > 0
                  ? `${scheduledOrdersCount} preorder${scheduledOrdersCount === 1 ? '' : 's'} scheduled`
                  : 'Preorders enabled'}
              </div>
              {preorderStatusMessage && (
                <div style={{ fontSize: 12.5, color: 'var(--t2)', marginTop: 4 }}>{preorderStatusMessage}</div>
              )}
            </div>
            {scheduledOrdersCount > 0 && (
              <button className="btn btn-primary btn-sm" onClick={onOpenScheduledOrders}>View Scheduled</button>
            )}
          </div>
        </div>
      )}

      <div className="bal-grid fu" style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div className="bal-card hot fu fu1">
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.72)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Available Balance</div>
          <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 28, letterSpacing: '-.03em', lineHeight: 1, color: '#fff', position: 'relative', zIndex: 1 }}>{fmtNaira(wallet?.availableBalance || 0)}</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.7)', marginTop: 10 }}>Ready to withdraw</div>
        </div>
        <div className="bal-card fu fu2">
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Pending Balance</div>
          <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 26, letterSpacing: '-.02em', lineHeight: 1 }}>{fmtNaira(wallet?.pendingBalance || 0)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 8 }}>Clears after delivery</div>
        </div>
        <div className="bal-card fu fu3">
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Total Earned</div>
          <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 26, letterSpacing: '-.02em', lineHeight: 1 }}>{fmtNaira(wallet?.totalEarned || 0)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 8 }}>All-time total</div>
        </div>
      </div>

      <div className="quick-grid fu fu4" style={{ marginBottom: 20 }}>
        <div className="metric-card">
          <div className="metric-label">This Week</div>
          <div className="metric-value">{fmtNaira(summary?.earningsWeek || 0)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">This Month</div>
          <div className="metric-value">{fmtNaira(summary?.earningsMonth || 0)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Orders This Month</div>
          <div className="metric-value">{summary?.ordersThisMonth || 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg. Order Value</div>
          <div className="metric-value">{fmtNaira(summary?.averageOrderValue || 0)}</div>
        </div>
      </div>

      <div className="stats-chart-grid fu fu5" style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 14, marginBottom: 20 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 16 }}>Earnings summary</div>
              <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>Last 7 days</div>
            </div>
            <span className="chip chip-orange">Busiest day: {busiestDay}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="surface-note">
              <div className="metric-label">Peak Day Sales</div>
              <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 16 }}>{fmtNaira(chartPeak)}</div>
            </div>
            <div className="surface-note">
              <div className="metric-label">7-Day Total</div>
              <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 16 }}>{fmtNaira(chartTotal)}</div>
            </div>
            <div className="surface-note">
              <div className="metric-label">Pending Release</div>
              <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 16 }}>{fmtNaira(wallet?.pendingBalance || 0)}</div>
            </div>
            <div className="surface-note">
              <div className="metric-label">Ready to Withdraw</div>
              <div style={{ fontFamily: 'var(--hd)', fontWeight: 700, fontSize: 16 }}>{fmtNaira(wallet?.availableBalance || 0)}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 16 }}>Daily earnings</div>
              <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>Last 7 days</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('txns')}>Open ledger</button>
          </div>
          <div id="chart" style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
            {chart.map((d, i) => (
              <div className="bar-wrap" key={d.d}>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      height: `${(d.v / max) * 100}%`,
                      background: d.v === max ? 'linear-gradient(to top,var(--or),var(--or2))' : 'rgba(249,115,22,.28)',
                      animationDelay: `${i * 55}ms`,
                    }}
                  />
                </div>
                <span style={{ fontSize: 9.5, color: 'var(--t2)', fontWeight: 600 }}>{d.d}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 11.5, color: 'var(--t2)' }}>
            <span>Peak: {fmtNaira(chartPeak)}</span>
            <span>Total: {fmtNaira(chartTotal)}</span>
          </div>
        </div>
      </div>

      <div className="card fu fu6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 16 }}>Recent activity</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>Last 4 wallet events</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('txns')}>View all</button>
        </div>
        <div>
          {txns.length === 0 && (
            <div className="empty-state">No recent transactions yet. Once orders settle, your wallet activity will show here.</div>
          )}
          {txns.slice(0, 4).map((tx) => {
            const m = txMeta(tx.type);
            return (
              <div className="tx-row" key={tx.id} onClick={() => onOpenTxDetail(tx.id)}>
                <div className="tx-icon" style={{ background: tx.dir === 'in' ? 'var(--grg)' : 'var(--reg)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={tx.dir === 'in' ? 'var(--gr)' : 'var(--re)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {tx.dir === 'in' ? <path d="M12 5v14m0 0l7-7m-7 7l-7-7" /> : <path d="M12 19V5m0 0l-7 7m7-7l7 7" />}
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.desc}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 2 }}>{tx.time}</div>
                </div>
                <span className={`chip ${m.cls}`}>{m.label}</span>
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 92 }}>
                  <div style={{ fontFamily: 'var(--hd)', fontWeight: 800, fontSize: 14, color: tx.dir === 'in' ? 'var(--gr)' : 'var(--re)' }}>
                    {tx.dir === 'in' ? '+' : '-'}{fmtNaira(tx.amt)}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--t2)', marginTop: 1 }}>Balance {fmtNaira(tx.bal)}</div>
                </div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
