import { useState, useEffect } from 'react'
import { getUsers, addUser, updateUser, removeUser, checkSheetAccess,
         getPaymentHeads, createPaymentHead, updatePaymentHead } from '../utils/api.js'
import { formatDate, toDateInput } from '../utils/constants.js'

const ROLES = ['Edit', 'Payments', 'Caller', 'View']

export default function Admin() {
  const [tab, setTab] = useState('users')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 0, alignItems: 'center' }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, marginRight: 20 }}>Admin</h1>
        {['users', 'heads'].map(t => (
          <button key={t}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: tab === t ? 500 : 400,
              color: tab === t ? 'var(--tc)' : 'var(--ink-2)',
              borderBottom: tab === t ? '2px solid var(--tc)' : '2px solid transparent',
            }}
            onClick={() => setTab(t)}>
            {t === 'users' ? 'Users' : 'Payment Heads'}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {tab === 'users' ? <UsersTab /> : <PaymentHeadsTab />}
      </div>
    </div>
  )
}

// ── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [email, setEmail]     = useState('')
  const [name, setName]       = useState('')
  const [role, setRole]       = useState('View')
  const [checking, setChecking] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function load() {
    setLoading(true)
    try { setUsers(await getUsers()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!email) { setError('Email required'); return }
    setChecking(true); setError('')
    try {
      const access = await checkSheetAccess(email)
      if (!access.hasAccess) {
        setError('This account does not have access to the MyCiti Sheets workbook. Share the workbook first, then retry.')
        return
      }
      setSaving(true)
      await addUser({ email, displayName: name || email, role })
      setShowAdd(false); setEmail(''); setName(''); setRole('View')
      load()
    } catch (e) { setError(e.message) }
    finally { setChecking(false); setSaving(false) }
  }

  async function handleRoleChange(userEmail, newRole) {
    await updateUser({ email: userEmail, role: newRole })
    load()
  }

  async function handleRemove(userEmail) {
    if (!window.confirm(`Remove ${userEmail} from the app?`)) return
    await removeUser(userEmail)
    load()
  }

  const ROLE_COLORS = {
    Edit:     'var(--tc)', Payments: 'var(--partial)',
    Caller:   'var(--paid)', View: 'var(--ink-3)', Admin: 'var(--disputed)'
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{users.length} users</div>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(true); setError('') }}>
          + Add user
        </button>
      </div>

      {loading ? <div className="empty-state"><div className="spin" style={{ margin: '0 auto' }} /></div>
        : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {users.map(u => (
            <div key={u.UserEmail} style={{
              padding: '12px 0', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'var(--surface-3)', color: ROLE_COLORS[u.Role] || 'var(--ink-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600
              }}>
                {(u.DisplayName || u.UserEmail || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{u.DisplayName || u.UserEmail}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{u.UserEmail}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Added {formatDate(u.AddedAt)}</div>
              </div>
              <select
                className="input"
                style={{ width: 'auto', fontSize: 12, color: ROLE_COLORS[u.Role] || 'var(--ink)' }}
                value={u.Role}
                onChange={e => handleRoleChange(u.UserEmail, e.target.value)}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--disputed)' }}
                onClick={() => handleRemove(u.UserEmail)}
              >Remove</button>
            </div>
          ))}
        </div>
      )}

      {/* Add user modal */}
      {showAdd && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: 380, border: '1px solid var(--border)'
          }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600 }}>Add user</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label">Google email *</label>
                <input className="input" type="email" placeholder="user@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                  Must already have access to the MyCiti Sheets workbook.
                </div>
              </div>
              <div>
                <label className="label">Display name</label>
                <input className="input" placeholder="Optional" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={role} onChange={e => setRole(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {error && (
                <div style={{ fontSize: 12, padding: '10px 12px', background: 'var(--disputed-bg)', color: 'var(--disputed)', borderRadius: 'var(--radius-md)' }}>
                  {error}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={checking || saving} onClick={handleAdd}>
                {checking ? 'Checking access…' : saving ? 'Adding…' : 'Add user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Payment Heads Tab ────────────────────────────────────────────────────────

function PaymentHeadsTab() {
  const [heads, setHeads]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    headName: '', amountType: 'Flat', expectedAmount: '',
    dueDate: '', notes: '', isActive: 'TRUE'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function load() {
    setLoading(true)
    try { setHeads(await getPaymentHeads()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function startAdd() {
    setEditing(null)
    setForm({ headName: '', amountType: 'Flat', expectedAmount: '', dueDate: '', notes: '', isActive: 'TRUE' })
    setShowForm(true); setError('')
  }

  function startEdit(h) {
    setEditing(h)
    setForm({
      headName: h.HeadName,
      amountType: h.AmountType,
      expectedAmount: h.AmountType === 'Flat' ? h.ExpectedAmountFlat : h.ExpectedAmountPerSqft,
      dueDate: toDateInput(h.DueDate),
      notes: h.Notes || '',
      isActive: h.IsActive
    })
    setShowForm(true); setError('')
  }

  async function handleSave() {
    if (!form.headName || !form.expectedAmount) { setError('Name and amount required'); return }
    setSaving(true); setError('')
    try {
      if (editing) {
        await updatePaymentHead({
          headId: editing.HeadID,
          headName: form.headName,
          expectedAmountFlat:    form.amountType === 'Flat'    ? form.expectedAmount : '',
          expectedAmountPerSqft: form.amountType === 'PerSqft' ? form.expectedAmount : '',
          dueDate: form.dueDate, notes: form.notes, isActive: form.isActive
        })
      } else {
        await createPaymentHead({
          headName: form.headName, amountType: form.amountType,
          expectedAmount: form.expectedAmount,
          dueDate: form.dueDate, notes: form.notes
        })
      }
      setShowForm(false); load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={startAdd}>+ Add payment head</button>
      </div>

      {loading ? <div className="empty-state"><div className="spin" style={{ margin: '0 auto' }} /></div>
        : heads.map(h => (
        <div key={h.HeadID} style={{
          padding: '14px 0', borderBottom: '1px solid var(--border)',
          display: 'flex', gap: 12, alignItems: 'flex-start'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{h.HeadName}</span>
              <span className={`badge ${h.IsActive === 'TRUE' ? 'badge-active' : 'badge-nocontact'}`}>
                {h.IsActive === 'TRUE' ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>
              {h.AmountType === 'Flat'
                ? `₹${Number(h.ExpectedAmountFlat).toLocaleString('en-IN')} flat per site`
                : `₹${h.ExpectedAmountPerSqft} per sq ft`}
              {h.DueDate && ` · Due ${formatDate(h.DueDate)}`}
            </div>
            {h.Notes && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{h.Notes}</div>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => startEdit(h)}>Edit</button>
        </div>
      ))}

      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: 400, border: '1px solid var(--border)'
          }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600 }}>{editing ? 'Edit payment head' : 'Add payment head'}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label">Head name *</label>
                <input className="input" value={form.headName} onChange={e => setForm(f => ({ ...f, headName: e.target.value }))}
                  placeholder="e.g. FY2025-26 Maintenance" />
              </div>
              <div>
                <label className="label">Amount type *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Flat', 'PerSqft'].map(t => (
                    <button key={t} className="btn btn-sm" style={{
                      flex: 1,
                      ...(form.amountType === t ? { background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)' } : {})
                    }}
                    onClick={() => setForm(f => ({ ...f, amountType: t }))}
                    disabled={!!editing}>
                      {t === 'Flat' ? 'Flat per site' : 'Per sq ft'}
                    </button>
                  ))}
                </div>
                {editing && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>Amount type cannot change after payments are recorded.</div>}
              </div>
              <div>
                <label className="label">
                  {form.amountType === 'Flat' ? 'Amount (₹ per site) *' : 'Amount (₹ per sqft) *'}
                </label>
                <input className="input" type="number"
                  value={form.expectedAmount} onChange={e => setForm(f => ({ ...f, expectedAmount: e.target.value }))} />
              </div>
              <div>
                <label className="label">Due date</label>
                <input className="input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
              {editing && (
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.value }))}>
                    <option value="TRUE">Active</option>
                    <option value="FALSE">Inactive</option>
                  </select>
                </div>
              )}
              <div>
                <label className="label">Notes</label>
                <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {error && <div style={{ fontSize: 12, padding: '8px 12px', background: 'var(--disputed-bg)', color: 'var(--disputed)', borderRadius: 'var(--radius-md)' }}>{error}</div>}
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
