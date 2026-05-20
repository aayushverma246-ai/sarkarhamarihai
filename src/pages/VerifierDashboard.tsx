import React, { useEffect, useState, useCallback } from 'react';

const API_BASE: string = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001/api';
const CRON_SECRET = 'sarkar_cron_key_v1';

interface DashboardData {
  metrics: any;
  sourceStatus: any;
  summary: any;
  dbStats: any;
  scheduler: any;
  recentLogs: any[];
  recentMismatches: any[];
  alerts: any[];
}

function fmt(n: number) { return n?.toLocaleString() ?? '0'; }
function ago(ts: string | null) {
  if (!ts) return 'Never';
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60000) return `${Math.round(d/1000)}s ago`;
  if (d < 3600000) return `${Math.round(d/60000)}m ago`;
  return `${Math.round(d/3600000)}h ago`;
}

export default function VerifierDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [actionResult, setActionResult] = useState<any>(null);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/verifier/dashboard-data`);
      const d = await r.json();
      if (d.success !== false) setData(d);
      else setError(d.error || 'Failed to load');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 30000); return () => clearInterval(i); }, [fetchData]);

  const runAction = async (endpoint: string, label: string) => {
    setActionLoading(label);
    setActionResult(null);
    try {
      const r = await fetch(`${API_BASE}/verifier/${endpoint}?secret=${CRON_SECRET}`);
      const d = await r.json();
      setActionResult({ label, ...d });
      fetchData();
    } catch (e: any) { setActionResult({ label, error: e.message }); }
    finally { setActionLoading(''); }
  };

  if (loading) return (
    <div style={styles.container}>
      <div style={styles.loader}><div style={styles.spinner}/><p style={{color:'#94a3b8',marginTop:16}}>Loading Verifier Dashboard...</p></div>
    </div>
  );

  if (error && !data) return (
    <div style={styles.container}>
      <div style={{...styles.card, borderColor:'#ef4444', textAlign:'center' as const}}>
        <h2 style={{color:'#ef4444',margin:0}}>⚠️ Connection Error</h2>
        <p style={{color:'#94a3b8',marginTop:8}}>{error}</p>
        <button onClick={fetchData} style={styles.btnPrimary}>Retry</button>
      </div>
    </div>
  );

  const m = data?.metrics || {};
  const db = data?.dbStats || {};
  const summary = data?.summary || {};
  const health = summary.health || {};
  const alerts = data?.alerts || [];

  const healthColor = health.status === 'healthy' ? '#22c55e' : health.status === 'warning' ? '#f59e0b' : '#ef4444';
  const verifiedPct = db.totalRecords ? Math.round((db.verifiedRecords / db.totalRecords) * 100) : 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🔍 Data Verification System</h1>
          <p style={styles.subtitle}>Real-time monitoring & data integrity dashboard</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{...styles.healthBadge, background: healthColor}}>{(health.status || 'unknown').toUpperCase()}</span>
          <button onClick={fetchData} style={styles.btnGhost}>↻ Refresh</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={styles.kpiGrid}>
        <KpiCard icon="📊" label="Total Records" value={fmt(db.totalRecords)} sub={`${fmt(db.verifiedRecords)} verified`} color="#6366f1" />
        <KpiCard icon="✅" label="Verified" value={`${verifiedPct}%`} sub={`${fmt(db.verifiedRecords)} / ${fmt(db.totalRecords)}`} color="#22c55e" />
        <KpiCard icon="⚠️" label="Mismatches" value={fmt(m.totalMismatches)} sub={`${fmt(summary?.mismatches?.bySeverity?.critical || 0)} critical`} color="#f59e0b" />
        <KpiCard icon="🔄" label="Syncs" value={fmt(m.totalSyncs)} sub={`Success: ${m.successRate || 100}%`} color="#06b6d4" />
        <KpiCard icon="⚡" label="Avg Latency" value={`${m.avgDurationMs || 0}ms`} sub={`Last: ${m.lastRunDurationMs || 0}ms`} color="#8b5cf6" />
        <KpiCard icon="🕐" label="Last Run" value={ago(m.lastRunTimestamp)} sub={m.lastRunTimestamp ? new Date(m.lastRunTimestamp).toLocaleTimeString() : 'N/A'} color="#ec4899" />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{...styles.card, borderColor:'#ef4444'}}>
          <h3 style={styles.cardTitle}>🚨 Active Alerts ({alerts.length})</h3>
          {alerts.slice(0, 5).map((a: any, i: number) => (
            <div key={i} style={styles.alertRow}>
              <span style={{color:'#fca5a5',fontWeight:600}}>{a.type}</span>
              <span style={{color:'#94a3b8',fontSize:13}}>{a.details?.message || JSON.stringify(a.details)}</span>
              <span style={{color:'#64748b',fontSize:12}}>{a.timestamp_ist}</span>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>⚙️ Manual Actions</h3>
        <div style={styles.actionGrid}>
          <ActionBtn label="Full Verify" icon="🔍" loading={actionLoading} onClick={() => runAction('run', 'Full Verify')} color="#6366f1" />
          <ActionBtn label="Incremental" icon="📝" loading={actionLoading} onClick={() => runAction('incremental', 'Incremental')} color="#22c55e" />
          <ActionBtn label="Delta Sync" icon="🔄" loading={actionLoading} onClick={() => runAction('sync', 'Delta Sync')} color="#06b6d4" />
          <ActionBtn label="Fix Stale" icon="🔧" loading={actionLoading} onClick={() => runAction('stale', 'Fix Stale')} color="#f59e0b" />
        </div>
        {actionResult && (
          <div style={{marginTop:16,padding:12,background:'#0f172a',borderRadius:8,fontSize:13,color: actionResult.error ? '#fca5a5' : '#86efac'}}>
            <strong>{actionResult.label}:</strong> {actionResult.error ? `❌ ${actionResult.error}` : `✅ Success`}
            {actionResult.report && <span> — {actionResult.report.totalRecords} records, {actionResult.report.mismatchCount ?? actionResult.report.mismatches ?? 0} mismatches</span>}
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div style={styles.twoCol}>
        {/* Status Distribution */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>📈 Status Distribution</h3>
          {(db.statusDistribution || []).map((s: any) => {
            const pct = db.totalRecords ? Math.round((Number(s.cnt) / db.totalRecords) * 100) : 0;
            const color = s.form_status === 'LIVE' ? '#22c55e' : s.form_status === 'UPCOMING' ? '#6366f1' : s.form_status === 'RECENTLY_CLOSED' ? '#f59e0b' : '#64748b';
            return (
              <div key={s.form_status} style={styles.barRow}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{color:'#e2e8f0',fontSize:13}}>{s.form_status}</span>
                  <span style={{color:'#94a3b8',fontSize:12}}>{fmt(Number(s.cnt))} ({pct}%)</span>
                </div>
                <div style={styles.barBg}><div style={{...styles.barFill, width:`${pct}%`, background: color}}/></div>
              </div>
            );
          })}
        </div>

        {/* Category Distribution */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🏷️ Top Categories</h3>
          <div style={{maxHeight:280,overflowY:'auto' as const}}>
            {(db.categoryDistribution || []).slice(0, 12).map((c: any) => {
              const pct = db.totalRecords ? Math.round((Number(c.cnt) / db.totalRecords) * 100) : 0;
              return (
                <div key={c.job_category} style={styles.barRow}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{color:'#e2e8f0',fontSize:13}}>{c.job_category || 'Unknown'}</span>
                    <span style={{color:'#94a3b8',fontSize:12}}>{fmt(Number(c.cnt))}</span>
                  </div>
                  <div style={styles.barBg}><div style={{...styles.barFill, width:`${pct}%`, background:'#6366f1'}}/></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mismatch Summary */}
      {summary?.mismatches?.topFields?.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🔎 Mismatch Hotspots (24h)</h3>
          <div style={{display:'flex',flexWrap:'wrap' as const,gap:8}}>
            {summary.mismatches.topFields.map((f: any) => (
              <span key={f.field} style={styles.tag}>{f.field}: {f.count}</span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Logs */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>📜 Recent Operations</h3>
        <div style={{overflowX:'auto' as const}}>
          <table style={styles.table}>
            <thead><tr>
              <th style={styles.th}>Time</th><th style={styles.th}>Operation</th><th style={styles.th}>Records</th>
              <th style={styles.th}>Verified</th><th style={styles.th}>Mismatches</th><th style={styles.th}>Duration</th>
            </tr></thead>
            <tbody>
              {(data?.recentLogs || []).slice(-10).reverse().map((l: any, i: number) => (
                <tr key={i} style={i%2===0 ? styles.trEven : {}}>
                  <td style={styles.td}>{l.timestamp_ist || new Date(l.created_at).toLocaleTimeString()}</td>
                  <td style={styles.td}><span style={{...styles.opBadge, background: l.operation === 'full_cycle' ? '#6366f1' : l.operation === 'sync' ? '#06b6d4' : '#22c55e'}}>{l.operation}</span></td>
                  <td style={styles.td}>{fmt(l.total_records)}</td>
                  <td style={styles.td}>{fmt(l.verified)}</td>
                  <td style={{...styles.td, color: l.mismatches > 0 ? '#fbbf24' : '#86efac'}}>{fmt(l.mismatches)}</td>
                  <td style={styles.td}>{l.duration_ms}ms</td>
                </tr>
              ))}
              {(!data?.recentLogs || data.recentLogs.length === 0) && (
                <tr><td colSpan={6} style={{...styles.td, textAlign:'center' as const, color:'#64748b'}}>No operations yet. Run a verification to see results.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scheduler Status */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>⏰ Scheduler Tasks</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
          {Object.values(data?.scheduler || {}).map((t: any) => (
            <div key={t.name} style={styles.schedCard}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{color:'#e2e8f0',fontWeight:600,fontSize:14}}>{t.name}</span>
                <span style={{...styles.healthBadge, background: t.enabled ? '#22c55e' : '#64748b', fontSize:11}}>{t.enabled ? 'ON' : 'OFF'}</span>
              </div>
              <div style={{marginTop:8,fontSize:12,color:'#94a3b8'}}>
                <div>Interval: {t.interval}</div>
                <div>Runs: {t.runCount} | Errors: {t.errorCount}</div>
                <div>Last: {ago(t.lastRun)}</div>
                {t.consecutiveFailures > 0 && <div style={{color:'#fca5a5'}}>⚠ {t.consecutiveFailures} consecutive failures</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{textAlign:'center' as const,padding:'24px 0',color:'#475569',fontSize:12}}>
        Dynamic Data Verifier v1.0 — SarkarHamariHai • Auto-refreshes every 30s
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{...styles.card, borderLeft:`3px solid ${color}`, padding:'16px 20px'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <span style={{fontSize:20}}>{icon}</span>
        <span style={{color:'#94a3b8',fontSize:12,textTransform:'uppercase' as const,letterSpacing:1}}>{label}</span>
      </div>
      <div style={{fontSize:28,fontWeight:700,color:'#f1f5f9',lineHeight:1}}>{value}</div>
      <div style={{fontSize:12,color:'#64748b',marginTop:6}}>{sub}</div>
    </div>
  );
}

function ActionBtn({ label, icon, loading, onClick, color }: { label: string; icon: string; loading: string; onClick: () => void; color: string }) {
  const isLoading = loading === label;
  return (
    <button onClick={onClick} disabled={!!loading} style={{...styles.btnAction, borderColor: color, opacity: loading && !isLoading ? 0.5 : 1}}>
      {isLoading ? <span style={styles.spinnerSm}/> : <span>{icon}</span>} {label}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 1200, margin: '0 auto', padding: '24px 16px', fontFamily: "'Inter','Segoe UI',sans-serif", background: '#030712', minHeight: '100vh', color: '#e2e8f0' },
  loader: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' },
  spinner: { width: 40, height: 40, border: '3px solid #1e293b', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  spinnerSm: { width: 16, height: 16, border: '2px solid #334155', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 24, fontWeight: 700, margin: 0, background: 'linear-gradient(135deg,#6366f1,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subtitle: { color: '#64748b', fontSize: 14, margin: '4px 0 0' },
  healthBadge: { padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: 0.5 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 12, marginBottom: 16 },
  card: { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 16 },
  barRow: { marginBottom: 10 },
  barBg: { height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, transition: 'width 0.5s ease' },
  tag: { background: '#1e293b', color: '#94a3b8', padding: '4px 10px', borderRadius: 6, fontSize: 12, border: '1px solid #334155' },
  actionGrid: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  btnAction: { background: 'transparent', border: '1px solid #334155', color: '#e2e8f0', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' },
  btnPrimary: { background: '#6366f1', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btnGhost: { background: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  alertRow: { display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 0', borderBottom: '1px solid #1e293b' },
  schedCard: { background: '#1e293b', borderRadius: 8, padding: 14, border: '1px solid #334155' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 10px', color: '#64748b', borderBottom: '1px solid #1e293b', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { padding: '8px 10px', color: '#cbd5e1', borderBottom: '1px solid #0f172a' },
  trEven: { background: '#0a1628' },
  opBadge: { padding: '2px 8px', borderRadius: 4, color: '#fff', fontSize: 11, fontWeight: 600 },
};
