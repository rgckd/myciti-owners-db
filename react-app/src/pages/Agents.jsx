import { useState, useEffect } from 'react'
import { getAgents, createAgent, updateAgent, softDeleteAgent } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canEdit, initials } from '../utils/constants.js'

export default function Agents() {
  const { user } = useAuth()
  const role = user?.role || 'View'
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', mobile: '', email: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try { setAgents(await getAgents()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function startAdd() {
    setForm({ name: '', mobile: '', email: '', notes: '' })
    setSelected(null)
    setShowForm(true)
  }

  function startEdit(a) {
    setSelected(a)
    setForm({ name: a.Name, mobile: a.Mobile, email: a.Email, notes: a.Notes || '' })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name || !form.mobile) { setError('Name and mobile are required'); return }
    setSaving(true); setError('')
    try {
      if (selected) {
        await updateAgent({ agentId: selected.AgentID, name: form.name, mobile: form.mobile, email: form.email, notes: form.notes })
      } else {
        await createAgent({ name: form.name, mobile: form.mobile, email: form.email, notes: form.notes })
      }
      setShowForm(false); setSelected(null)
      load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(agentId) {
    if (!window.confirm('Remove this agent?')) return
    await softDeleteAgent(agentId)
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Agents</h1>
        {canEdit(role, 'owners') && (
          <button className="btn btn-primary btn-sm" onClick={startAdd}>+ Add agent</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading ? (
          <div className="empty-state"><div className="spin" style={{ margin: '0 auto' }} /></div>
        ) : agents.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 32 }}>👤</div>
            <p>No agents recorded yet</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12
          }}>
            {agents.map(a => (
              <div key={a.AgentID} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--surface-3)', color: 'var(--ink-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 600
                }}>{initials(a.Name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{a.Name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{a.Mobile}</div>
                  {a.Email && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{a.Email}</div>}
                  {a.Notes && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{a.Notes}</div>}
                </div>
                {canEdit(role, 'owners') && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(a)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--disputed)' }}
                      onClick={() => handleDelete(a.AgentID)}>✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: 380, border: '1px solid var(--border)'
          }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600 }}>{selected ? 'Edit agent' : 'Add agent'}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Mobile *</label>
                <input className="input" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" style={{ resize: 'vertical', minHeight: 60 }}
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {error && <div style={{ fontSize: 12, color: 'var(--disputed)', padding: '8px 12px', background: 'var(--disputed-bg)', borderRadius: 'var(--radius-md)' }}>{error}</div>}
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
