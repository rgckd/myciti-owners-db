import { useState, useEffect } from 'react'
import { getAuditLog } from '../utils/api.js'
import { formatDate } from '../utils/constants.js'

const TABS_LIST = ['People','Sites','Owners','Agents','Payments','PaymentHeads','Transfers','Roles']
const ACTIONS   = ['Create','Update','SoftDelete','Restore']

export default function AuditView() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [tabFilter, setTabFilter]       = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [search, setSearch]             = useState('')

  async function load() {
    setLoading(true)
    try {
      const data = await getAuditLog({ tab: tabFilter, action: actionFilter, limit: 500 })
      setLogs(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tabFilter, actionFilter])

  const filtered = search
    ? logs.filter(l =>
        String(l.RecordID).includes(search) ||
        String(l.UserEmail).toLowerCase().includes(search.toLowerCase()) ||
        String(l.FieldName).toLowerCase().includes(search.toLowerCase()) ||
        String(l.NewValue).toLowerCase().includes(search.toLowerCase())
      )
    : logs

  const ACTION_COLORS = {
    Create:     { bg: 'var(--paid-bg)',     color: 'var(--paid)' },
    Update:     { bg: 'var(--tc-light)',    color: 'var(--tc-dark)' },
    SoftDelete: { bg: 'var(--disputed-bg)', color: 'var(--disputed)' },
    Restore:    { bg: 'var(--partial-bg)',  color: 'var(--partial)' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 15, fontWeight: 600 }}>Audit log</h1>
        <input className="input" style={{ width: 200 }}
          placeholder="Record ID, user, field…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" style={{ width: 'auto' }}
          value={tabFilter} onChange={e => setTabFilter(e.target.value)}>
          <option value="">All tabs</option>
          {TABS_LIST.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }}
          value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="">All actions</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 'auto' }}>
          {filtered.length} entries
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
        {loading ? (
          <div className="empty-state"><div className="spin" style={{ margin: '0 auto' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No audit entries</p></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['When','Who','Action','Tab','Record','Field','Old','New'].map(h => (
                  <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 500, color: 'var(--ink-2)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => {
                const ac = ACTION_COLORS[log.Action] || { bg: 'var(--surface-3)', color: 'var(--ink-2)' }
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                      {new Date(log.Timestamp).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--ink-2)' }}>
                      {log.DisplayName || log.UserEmail}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 500, padding: '2px 7px',
                        borderRadius: 999, background: ac.bg, color: ac.color
                      }}>{log.Action}</span>
                    </td>
                    <td style={{ padding: '8px', color: 'var(--ink-2)' }}>{log.Tab}</td>
                    <td style={{ padding: '8px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)' }}>
                      {String(log.RecordID).slice(0, 12)}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--ink-2)' }}>{log.FieldName || '—'}</td>
                    <td style={{ padding: '8px', color: 'var(--ink-3)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.OldValue ? String(log.OldValue).slice(0, 30) : '—'}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--ink)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.NewValue ? String(log.NewValue).slice(0, 40) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
