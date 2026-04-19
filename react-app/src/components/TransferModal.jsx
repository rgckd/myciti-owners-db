import { useState } from 'react'
import { transferOwnership } from '../utils/api.js'
import { formatDate } from '../utils/constants.js'

const STEPS = ['Outgoing owner', 'Incoming person', 'Transfer details']

export default function TransferModal({ siteId, fromOwner, onClose, onSaved }) {
  const [step, setStep] = useState(0)
  const [newName, setNewName] = useState('')
  const [newMobile, setNewMobile] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0])
  const [salePrice, setSalePrice] = useState('')
  const [docRef, setDocRef] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!transferDate) { setError('Transfer date is required'); return }
    setSaving(true); setError('')
    try {
      await transferOwnership({
        siteId,
        fromOwnerId: fromOwner?.OwnerID,
        transferDate,
        salePrice: salePrice ? Number(salePrice) : '',
        docRef,
        newPerson: { fullName: newName, mobile1: newMobile, email: newEmail }
      })
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally { setSaving(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1010, padding: 20
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
        width: '100%', maxWidth: 420, border: '1px solid var(--border)'
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Transfer ownership</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', padding: '12px 18px', gap: 6 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600,
                background: i <= step ? 'var(--tc)' : 'var(--surface-3)',
                color: i <= step ? '#fff' : 'var(--ink-3)'
              }}>{i + 1}</div>
              <span style={{ fontSize: 11, color: i === step ? 'var(--ink)' : 'var(--ink-3)' }}>{s}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '14px 18px', minHeight: 180 }}>
          {step === 0 && (
            <div>
              <div className="label">Outgoing owner</div>
              <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontWeight: 500 }}>{fromOwner?.person?.FullName || '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                  {fromOwner?.MembershipNo || 'Non-member'} · {fromOwner?.person?.Mobile1 || '—'}
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 12 }}>
                This owner's IsCurrent will be set to false. The ownership end date will be set to the transfer date.
              </p>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="label">Full name *</label>
                <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="New owner's full name" />
              </div>
              <div>
                <label className="label">Mobile *</label>
                <input className="input" value={newMobile} onChange={e => setNewMobile(e.target.value)} placeholder="10-digit mobile" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Optional" />
              </div>
              <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                A new membership number will be auto-assigned.
              </p>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="label">Transfer date *</label>
                <input className="input" type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Sale price (₹)</label>
                <input className="input" type="number" placeholder="Optional" value={salePrice} onChange={e => setSalePrice(e.target.value)} />
              </div>
              <div>
                <label className="label">Document reference</label>
                <input className="input" placeholder="Registration doc no. (optional)" value={docRef} onChange={e => setDocRef(e.target.value)} />
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--disputed)', padding: '8px 12px', background: 'var(--disputed-bg)', borderRadius: 'var(--radius-md)' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 18px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, justifyContent: 'flex-end'
        }}>
          {step > 0 && <button className="btn" onClick={() => setStep(s => s - 1)}>Back</button>}
          <button className="btn" onClick={onClose}>Cancel</button>
          {step < 2 ? (
            <button className="btn btn-primary" onClick={() => setStep(s => s + 1)}>Next</button>
          ) : (
            <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'Complete transfer'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
