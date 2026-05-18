import { useState } from 'react'
import { addOwnersToSite } from '../utils/api.js'
import DateInput from './DateInput.jsx'

export default function AddOwnerModal({ siteId, onClose, onSaved }) {
  const [newOwners, setNewOwners] = useState([{ fullName: '', mobile1: '', email: '' }])
  const [ownershipStartDate, setOwnershipStartDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function addNewOwner() {
    setNewOwners(prev => [...prev, { fullName: '', mobile1: '', email: '' }])
  }

  function removeNewOwner(index) {
    setNewOwners(prev => prev.filter((_, i) => i !== index))
  }

  function updateNewOwner(index, field, value) {
    setNewOwners(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  async function handleSave() {
    if (!ownershipStartDate) {
      setError('Owner start date is required')
      return
    }
    if (newOwners.some(o => !o.fullName || !o.mobile1)) {
      setError('All owners must have full name and mobile')
      return
    }

    setSaving(true)
    setError('')
    try {
      await addOwnersToSite({
        siteId,
        ownershipStartDate,
        newPersons: newOwners
      })
      onSaved()
    } catch (e) {
      setError(e.message || 'Failed to add owner')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1010, padding: 20
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
        width: '100%', maxWidth: 440, border: '1px solid var(--border)'
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Add owner</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Owner start date *</label>
            <DateInput value={ownershipStartDate} onChange={setOwnershipStartDate} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div className="label">New owner(s)</div>
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{newOwners.length} owner(s)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {newOwners.map((owner, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>Owner {idx + 1}</span>
                    {newOwners.length > 1 && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, color: 'var(--disputed)' }}
                        onClick={() => removeNewOwner(idx)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <input
                    className="input"
                    placeholder="Full name *"
                    value={owner.fullName}
                    onChange={e => updateNewOwner(idx, 'fullName', e.target.value)}
                    style={{ fontSize: 12 }}
                  />

                  <input
                    className="input"
                    placeholder="Mobile (10-digit) *"
                    value={owner.mobile1}
                    onChange={e => updateNewOwner(idx, 'mobile1', e.target.value)}
                    style={{ fontSize: 12 }}
                  />

                  <input
                    className="input"
                    type="email"
                    placeholder="Email (optional)"
                    value={owner.email}
                    onChange={e => updateNewOwner(idx, 'email', e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={addNewOwner}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            + Add another owner
          </button>

          <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            This adds co-owner(s) to the site without removing existing owners. Membership numbers are auto-assigned.
          </p>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--disputed)', padding: '8px 12px', background: 'var(--disputed-bg)', borderRadius: 'var(--radius-md)' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 18px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, justifyContent: 'flex-end'
        }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Add owner'}
          </button>
        </div>
      </div>
    </div>
  )
}
