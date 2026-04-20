import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getCallLog, createCallLog, updateCallLog, markFollowUpDone, getSites, getAssignableUsers } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { formatDate, canEdit } from '../utils/constants.js'
import { getSitesCache } from '../pages/SiteRegistry.jsx'

function parseFollowUpParts(rawFollowUp) {
  const text = String(rawFollowUp || '').trim()
  const marker = '//Resolution:'
  const markerIdx = text.indexOf(marker)
  if (markerIdx < 0) return { action: text, resolution: '' }
  return {
    action: text.slice(0, markerIdx).trim(),
    resolution: text.slice(markerIdx + marker.length).trim(),
  }
}

export default function CallLogsView() {
  const { user } = useAuth()
  const role = user?.role || 'View'

  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('all')   // 'all' | 'open' | 'mine'
  const [editing, setEditing] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [assignableUsers, setAssignableUsers] = useState([])

  const canAct = canEdit(role, 'calllog')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCallLog({})
      data.sort((a, b) => new Date(b.LogDate || b.LoggedAt) - new Date(a.LogDate || a.LoggedAt))
      setLogs(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    getAssignableUsers().then(setAssignableUsers).catch(console.error)
  }, [])

  const filtered = useMemo(() => {
    if (tab === 'open') return logs.filter(l => l.FollowUpAction && l.FollowUpDone !== 'TRUE')
    if (tab === 'mine') return logs.filter(l =>
      l.CalledBy === user?.name || l.CalledBy === user?.email || l.CalledBy === user?.displayName
    )
    return logs
  }, [logs, tab, user])

  const openCount = useMemo(() =>
    logs.filter(l => l.FollowUpAction && l.FollowUpDone !== 'TRUE').length
  , [logs])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0
      }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Call log</h1>
        {[
          ['all',  'All'],
          ['open', openCount > 0 ? `Open follow-ups (${openCount})` : 'Open follow-ups'],
          ['mine', 'My calls'],
        ].map(([val, label]) => (
          <button key={val}
            className={`btn btn-sm ${tab === val ? '' : 'btn-ghost'}`}
            style={tab === val ? { background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)' } : {}}
            onClick={() => setTab(val)}
          >{label}</button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{filtered.length} entries</span>
        {canAct && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add log</button>
        )}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        {loading ? (
          <div className="empty-state"><div className="spin" style={{ margin: '0 auto' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 28 }}>✓</div>
            <p>{tab === 'open' ? 'No open follow-ups' : 'No call logs'}</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Date', 'Site', 'Summary', 'Follow-up', 'Logged by'].map(h => (
                  <th key={h} style={{
                    padding: '10px 8px', textAlign: 'left', fontWeight: 500,
                    color: 'var(--ink-2)', fontSize: 11, whiteSpace: 'nowrap'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <LogRow
                  key={log.LogID}
                  log={log}
                  canAct={canAct}
                  onClick={() => setEditing(log)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <CallLogModal
          log={editing}
          canAct={canAct}
          assignableUsers={assignableUsers}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}

      {showAdd && (
        <AddCallLogModal
          assignableUsers={assignableUsers}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
        />
      )}
    </div>
  )
}

function LogRow({ log, canAct, onClick }) {
  const followUp = parseFollowUpParts(log.FollowUpAction)
  const hasFollowUp = !!followUp.action
  const isDone = log.FollowUpDone === 'TRUE'

  return (
    <tr
      onClick={onClick}
      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
      onMouseLeave={e => { e.currentTarget.style.background = '' }}
    >
      {/* Date */}
      <td style={{ padding: '10px 8px', color: 'var(--ink-2)', whiteSpace: 'nowrap', width: 100 }}>
        {formatDate(log.LogDate)}
      </td>

      {/* Site */}
      <td style={{ padding: '10px 8px', width: 180 }}>
        <div style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
          {log.SiteNo ? `Site ${log.SiteNo}` : log.SiteID}
          {log.Phase ? <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> · Ph {log.Phase}</span> : null}
        </div>
        {log.OwnerName && (
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{log.OwnerName}</div>
        )}
      </td>

      {/* Summary */}
      <td style={{ padding: '10px 8px', color: 'var(--ink)', lineHeight: 1.4 }}>
        {log.Summary}
      </td>

      {/* Follow-up */}
      <td style={{ padding: '10px 8px', width: 280 }}>
        {hasFollowUp ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 999, width: 'fit-content',
              background: isDone ? 'var(--paid-bg,#EBF5E0)' : 'var(--tc-light)',
              color: isDone ? 'var(--paid)' : 'var(--tc)',
              border: `1px solid ${isDone ? 'var(--paid)' : 'var(--tc-mid)'}`,
            }}>
              {isDone ? '✓ ' : '→ '}{followUp.action}
            </span>
            {log.AssignedToName && (
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Assigned: {log.AssignedToName}</span>
            )}
            {followUp.resolution && (
              <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>Resolution: {followUp.resolution}</span>
            )}
          </div>
        ) : <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>No follow-up</span>}
      </td>

      {/* Logged by */}
      <td style={{ padding: '10px 8px', color: 'var(--ink-3)', fontSize: 12, whiteSpace: 'nowrap' }}>
        {log.CalledBy}
      </td>
    </tr>
  )
}

function CallLogModal({ log, canAct, assignableUsers, onClose, onSaved }) {
  const parsedFollowUp = parseFollowUpParts(log.FollowUpAction)
  const [summary, setSummary]       = useState(log.Summary || '')
  const [followUp, setFollowUp]     = useState(parsedFollowUp.action)
  const [assignedTo, setAssignedTo] = useState(log.AssignedTo || '')
  const [resolutionComment, setResolutionComment] = useState('')
  const [saving, setSaving]         = useState(false)
  const [marking, setMarking]       = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    if (!followUp.trim()) setAssignedTo('')
  }, [followUp])

  const isDone = log.FollowUpDone === 'TRUE'
  const selectedAssignee = assignableUsers.find(u => u.email === assignedTo)

  async function handleSave() {
    const followUpText = followUp.trim()
    if (followUpText && !selectedAssignee) {
      setError('Select who should follow up when follow-up action is provided')
      return
    }

    setSaving(true); setError('')
    try {
      await updateCallLog({
        logId: log.LogID,
        Summary: summary.trim(),
        FollowUpAction: followUpText,
        AssignedTo: followUpText ? selectedAssignee.email : '',
        AssignedToName: followUpText ? selectedAssignee.displayName : '',
      })
      onSaved()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleMarkDone() {
    setMarking(true); setError('')
    try {
      await markFollowUpDone(log.LogID, resolutionComment.trim())
      onSaved()
    } catch (e) { setError(e.message) }
    finally { setMarking(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
        width: '100%', maxWidth: 460, border: '1px solid var(--border)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Call log entry</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              {log.SiteNo ? `Site ${log.SiteNo}` : log.SiteID}
              {log.Phase ? ` · Ph ${log.Phase}` : ''}
              {log.OwnerName ? ` — ${log.OwnerName}` : ''}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Meta */}
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--ink-3)' }}>
            <span><b style={{ color: 'var(--ink-2)' }}>Date:</b> {formatDate(log.LogDate)}</span>
            <span><b style={{ color: 'var(--ink-2)' }}>Logged by:</b> {log.CalledBy}</span>
          </div>

          {/* Summary */}
          <div>
            <label className="label">Summary</label>
            {canAct ? (
              <textarea
                className="input"
                rows={4}
                value={summary}
                onChange={e => setSummary(e.target.value)}
                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
              />
            ) : (
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{log.Summary}</div>
            )}
          </div>

          {/* Follow-up */}
          <div>
            <label className="label">Follow-up action</label>
            {canAct ? (
              <input
                className="input"
                placeholder="e.g. Call back next week"
                value={followUp}
                onChange={e => setFollowUp(e.target.value)}
              />
            ) : (
              <div style={{ fontSize: 13, color: followUp ? 'var(--ink)' : 'var(--ink-3)' }}>
                {followUp || 'None'}
              </div>
            )}
          </div>

          {followUp.trim() && (
            <div>
              <label className="label">Who should follow up *</label>
              {canAct ? (
                <select className="input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                  <option value="">Select user</option>
                  {assignableUsers.map(u => (
                    <option key={u.email} value={u.email}>{u.displayName} ({u.role})</option>
                  ))}
                </select>
              ) : (
                <div style={{ fontSize: 13, color: log.AssignedToName ? 'var(--ink)' : 'var(--ink-3)' }}>
                  {log.AssignedToName || 'Not assigned'}
                </div>
              )}
            </div>
          )}

          {/* Follow-up done status */}
          {followUp.trim() && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 11, padding: '2px 10px', borderRadius: 999,
                background: isDone ? 'var(--paid-bg,#EBF5E0)' : 'var(--tc-light)',
                color: isDone ? 'var(--paid)' : 'var(--tc)',
                border: `1px solid ${isDone ? 'var(--paid)' : 'var(--tc-mid)'}`,
              }}>
                {isDone ? `✓ Done — ${log.DoneBy?.split('@')[0] || ''}` : '→ Follow-up open'}
              </span>
              {!isDone && canAct && (
                <button className="btn btn-ghost btn-sm" disabled={marking} onClick={handleMarkDone}>
                  {marking ? 'Marking…' : 'Mark done'}
                </button>
              )}
            </div>
          )}

          {!isDone && canAct && followUp.trim() && (
            <div>
              <label className="label">Resolution comment (optional)</label>
              <textarea
                className="input"
                rows={2}
                value={resolutionComment}
                onChange={e => setResolutionComment(e.target.value)}
                placeholder="Will be appended as //Resolution: ..."
                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
              />
            </div>
          )}

          {parsedFollowUp.resolution && (
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              <b style={{ color: 'var(--ink)' }}>Resolution:</b> {parsedFollowUp.resolution}
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: 'var(--disputed)', padding: '8px 12px', background: 'var(--disputed-bg)', borderRadius: 'var(--radius-md)' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Close</button>
          {canAct && (
            <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AddCallLogModal({ assignableUsers, onClose, onSaved }) {
  const [allSites, setAllSites]   = useState(() => getSitesCache())
  const [siteSearch, setSiteSearch] = useState('')
  const [sitePhase, setSitePhase]   = useState('All')
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [summary, setSummary]     = useState('')
  const [followUp, setFollowUp]   = useState('')
  const [selectedAssignee, setSelectedAssignee] = useState('')
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const dateInputRef              = useRef(null)

  useEffect(() => {
    if (allSites.length === 0) {
      getSites().then(setAllSites).catch(console.error)
    }
  }, [])

  const filteredSites = useMemo(() => {
    let list = allSites
    if (sitePhase !== 'All') list = list.filter(s => String(s.Phase) === sitePhase)
    if (siteSearch.trim()) {
      const q = siteSearch.toLowerCase()
      list = list.filter(s =>
        String(s.SiteNo).toLowerCase().includes(q) ||
        (s.ownerName && s.ownerName.toLowerCase().includes(q)) ||
        (s.membershipNo && String(s.membershipNo).toLowerCase().includes(q)) ||
        (s.mobile && String(s.mobile).includes(q))
      )
    }
    return list.slice(0, 50)
  }, [allSites, sitePhase, siteSearch])

  const selectedSite = allSites.find(s => s.SiteID === selectedSiteId)

  useEffect(() => {
    if (!followUp.trim()) setSelectedAssignee('')
  }, [followUp])

  async function handleSave() {
    const followUpText = followUp.trim()
    const assignee = assignableUsers.find(u => u.email === selectedAssignee)

    if (!selectedSiteId || !summary.trim()) {
      setError('Please select a site and enter a summary')
      return
    }
    if (followUpText && !assignee) {
      setError('Select who should follow up when follow-up action is provided')
      return
    }

    setSaving(true); setError('')
    try {
      await createCallLog({
        siteId: selectedSiteId,
        logDate: date,
        summary: summary.trim(),
        followUpAction: followUpText,
        assignedTo: followUpText ? assignee?.email || '' : '',
        assignedToName: followUpText ? assignee?.displayName || '' : '',
      })
      onSaved()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
        width: '100%', maxWidth: 460, border: '1px solid var(--border)', overflow: 'hidden',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
        }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Add call log</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

          {/* Site picker */}
          <div>
            <label className="label">Site *</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {['All', '1', '2'].map(p => (
                <button key={p}
                  className={`btn btn-sm ${sitePhase === p ? '' : 'btn-ghost'}`}
                  style={sitePhase === p ? { background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)' } : {}}
                  onClick={() => { setSitePhase(p); setSelectedSiteId('') }}
                >
                  {p === 'All' ? 'All phases' : `Phase ${p}`}
                </button>
              ))}
            </div>
            <input
              className="input"
              placeholder="Search site no, owner name, MID…"
              value={siteSearch}
              onChange={e => { setSiteSearch(e.target.value); setSelectedSiteId('') }}
              style={{ marginBottom: 6 }}
            />
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', maxHeight: 160, overflowY: 'auto' }}>
              {filteredSites.length === 0 ? (
                <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-3)' }}>No sites found</div>
              ) : filteredSites.map(s => (
                <div key={s.SiteID}
                  onClick={() => setSelectedSiteId(s.SiteID)}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                    borderBottom: '1px solid var(--border)',
                    background: selectedSiteId === s.SiteID ? 'var(--tc-light)' : 'transparent',
                    color: selectedSiteId === s.SiteID ? 'var(--tc-dark)' : 'var(--ink)',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>Site {s.SiteNo}</span>
                  <span style={{ color: 'var(--ink-3)', marginLeft: 6 }}>Ph {s.Phase}</span>
                  {s.ownerName && <span style={{ marginLeft: 6 }}> — {s.ownerName}</span>}
                </div>
              ))}
            </div>
            {selectedSite && (
              <div style={{ fontSize: 11, color: 'var(--tc)', marginTop: 4 }}>
                ✓ Selected: Site {selectedSite.SiteNo} Phase {selectedSite.Phase}
                {selectedSite.ownerName ? ` — ${selectedSite.ownerName}` : ''}
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="label">Call date *</label>
            <div style={{ position: 'relative' }}>
              <div className="input" style={{ cursor: 'pointer' }}>
                {date ? date.split('-').reverse().join('/') : 'DD/MM/YYYY'}
              </div>
              <input
                ref={dateInputRef}
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
              />
            </div>
          </div>

          {/* Summary */}
          <div>
            <label className="label">Summary *</label>
            <textarea
              className="input"
              rows={4}
              placeholder="What was discussed…"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
            />
          </div>

          {/* Follow-up */}
          <div>
            <label className="label">Follow-up action</label>
            <input
              className="input"
              placeholder="e.g. Call back after payment due date"
              value={followUp}
              onChange={e => setFollowUp(e.target.value)}
            />
          </div>

          {followUp.trim() && (
            <div>
              <label className="label">Who should follow up *</label>
              <select className="input" value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)}>
                <option value="">Select user</option>
                {assignableUsers.map(u => (
                  <option key={u.email} value={u.email}>{u.displayName} ({u.role})</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: 'var(--disputed)', padding: '8px 12px', background: 'var(--disputed-bg)', borderRadius: 'var(--radius-md)' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save log'}
          </button>
        </div>
      </div>
    </div>
  )
}
