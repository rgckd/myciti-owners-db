// FollowUps.jsx
import { useState, useEffect } from 'react'
import { getFollowUps, markFollowUpDone } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { formatDate } from '../utils/constants.js'

export default function FollowUps() {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const params = filter === 'mine' ? { assignedTo: user.email } : {}
      const data = await getFollowUps(params)
      setLogs(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [filter])

  async function handleDone(logId) {
    await markFollowUpDone(logId)
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Follow-ups</h1>
        {['all', 'mine'].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? '' : 'btn-ghost'}`}
            style={filter === f ? { background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)' } : {}}
            onClick={() => setFilter(f)}>
            {f === 'mine' ? 'Assigned to me' : 'All open'}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading ? <div className="empty-state"><div className="spin" style={{ margin: '0 auto' }} /></div>
          : logs.length === 0 ? (
            <div className="empty-state"><div style={{ fontSize: 32 }}>✓</div><p>No open follow-ups</p></div>
          ) : logs.map(log => {
            const days = Math.floor((Date.now() - new Date(log.LoggedAt).getTime()) / 86400000)
            return (
              <div key={log.LogID} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Site {log.SiteID?.replace('S', '').replace(/-P\d/, '')}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{log.CalledBy}</span>
                    <span style={{ fontSize: 11, color: days > 7 ? 'var(--disputed)' : 'var(--ink-3)', marginLeft: 'auto' }}>
                      {days}d ago
                    </span>
                  </div>
                  <div style={{
                    fontSize: 12, padding: '4px 10px', borderRadius: 999, display: 'inline-flex',
                    background: 'var(--tc-light)', color: 'var(--tc)'
                  }}>
                    → {log.FollowUpAction}
                  </div>
                  {log.AssignedToName && (
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>Assigned: {log.AssignedToName}</div>
                  )}
                </div>
                <button className="btn btn-sm" onClick={() => handleDone(log.LogID)}>Mark done</button>
              </div>
            )
          })}
      </div>
    </div>
  )
}
