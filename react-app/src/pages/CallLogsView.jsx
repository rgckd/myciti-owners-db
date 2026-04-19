import { useState, useEffect, useCallback, useMemo } from 'react'
import { getCallLog, markFollowUpDone } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { formatDate } from '../utils/constants.js'

export default function CallLogsView() {
  const { user } = useAuth()
  const role = user?.role || 'View'

  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('all')   // 'all' | 'open' | 'mine'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCallLog({})
      // most recent first
      data.sort((a, b) => new Date(b.LogDate || b.LoggedAt) - new Date(a.LogDate || a.LoggedAt))
      setLogs(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const canAct = ['Edit', 'Payments', 'Caller', 'Admin'].includes(role)

  const filtered = useMemo(() => {
    if (tab === 'open') return logs.filter(l => l.FollowUpAction && l.FollowUpDone !== 'TRUE')
    if (tab === 'mine') return logs.filter(l => l.CalledBy === user?.email || l.CalledByEmail === user?.email)
    return logs
  }, [logs, tab, user])

  async function handleDone(logId) {
    await markFollowUpDone(logId)
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0
      }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Call log</h1>
        {[['all', 'All'], ['open', 'Open follow-ups'], ['mine', 'My calls']].map(([val, label]) => (
          <button key={val}
            className={`btn btn-sm ${tab === val ? '' : 'btn-ghost'}`}
            style={tab === val ? { background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)' } : {}}
            onClick={() => setTab(val)}
          >{label}</button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 4 }}>
          {filtered.length} entries
        </span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
        {loading ? (
          <div className="empty-state"><div className="spin" style={{ margin: '0 auto' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 32 }}>✓</div>
            <p>{tab === 'open' ? 'No open follow-ups' : 'No call logs'}</p>
          </div>
        ) : filtered.map(log => (
          <LogRow key={log.LogID} log={log} canAct={canAct} onDone={() => handleDone(log.LogID)} />
        ))}
      </div>
    </div>
  )
}

function LogRow({ log, canAct, onDone }) {
  const hasFollowUp = !!log.FollowUpAction
  const isDone = log.FollowUpDone === 'TRUE'
  const daysAgo = log.LogDate
    ? Math.floor((Date.now() - new Date(log.LogDate)) / 86400000)
    : null

  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Meta row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
              {log.SiteNo ? `Site ${log.SiteNo}` : log.SiteID || '—'}
            </span>
            {log.OwnerName && (
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{log.OwnerName}</span>
            )}
            <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {formatDate(log.LogDate)}
              {daysAgo !== null && daysAgo > 0 && (
                <span style={{ color: daysAgo > 7 ? 'var(--disputed)' : 'var(--ink-3)', marginLeft: 4 }}>
                  ({daysAgo}d ago)
                </span>
              )}
            </span>
          </div>

          {/* Summary */}
          <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, marginBottom: 4 }}>
            {log.Summary}
          </div>

          {/* By */}
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: hasFollowUp ? 6 : 0 }}>
            {log.CalledBy || log.CalledByEmail}
          </div>

          {/* Follow-up */}
          {hasFollowUp && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 11, padding: '2px 10px', borderRadius: 999,
                background: isDone ? 'var(--paid-bg)' : 'var(--tc-light)',
                color: isDone ? 'var(--paid)' : 'var(--tc)',
                border: `1px solid ${isDone ? 'var(--paid)' : 'var(--tc-mid)'}`,
              }}>
                {isDone ? '✓' : '→'} {log.FollowUpAction}
              </span>
              {!isDone && canAct && (
                <button className="btn btn-ghost btn-sm" onClick={onDone} style={{ fontSize: 11 }}>
                  Mark done
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
