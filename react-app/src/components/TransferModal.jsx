import { useState, useRef } from 'react'
import { transferOwnership, uploadFileToDrive } from '../utils/api.js'
import { formatDate } from '../utils/constants.js'
import DateInput from './DateInput.jsx'

const STEPS = ['Outgoing owners', 'Incoming owners', 'Transfer details']

export default function TransferModal({ siteId, fromOwner, currentOwners, onClose, onSaved }) {
  const [step, setStep] = useState(0)
  const [newOwners, setNewOwners] = useState([{ fullName: '', mobile1: '', email: '' }])
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0])
  const [salePrice, setSalePrice] = useState('')
  const [docRef, setDocRef] = useState('')
  const [docFileName, setDocFileName] = useState('')
  const [docUploading, setDocUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const outgoingOwners = currentOwners && currentOwners.length > 0 ? currentOwners : (fromOwner ? [fromOwner] : [])
  const hasOutgoingOwners = outgoingOwners.length > 0

  async function handleDocUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setDocUploading(true); setError('')
    try {
      const url = await uploadFileToDrive(file, 'Transfers', siteId)
      setDocRef(url)
      setDocFileName(file.name)
    } catch (err) {
      setError('Document upload failed: ' + (err.message || 'Unknown error'))
    } finally { setDocUploading(false) }
  }

  async function handleSave() {
    if (!transferDate) { setError('Transfer date is required'); return }
    const ownerIds = outgoingOwners.map(o => o?.OwnerID).filter(Boolean)
    if (newOwners.some(o => !o.fullName || !o.mobile1)) { setError('All new owners must have full name and mobile'); return }
    if (!docRef) { setError('Please upload the transfer document before completing'); return }
    setSaving(true); setError('')
    try {
      await transferOwnership({
        siteId,
        fromOwnerIds: ownerIds,
        transferDate,
        salePrice: salePrice ? Number(salePrice) : '',
        docRef,
        newPersons: newOwners
      })
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally { setSaving(false) }
  }

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
          <div style={{ fontSize: 15, fontWeight: 600 }}>{hasOutgoingOwners ? 'Transfer ownership' : 'Add owner'}</div>
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
              <div className="label">Outgoing owners ({outgoingOwners.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {outgoingOwners.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>No current owners. You are assigning the first owner for this site.</div>
                ) : (
                  outgoingOwners.map((owner, idx) => (
                    <div key={idx} style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontWeight: 500 }}>{owner?.person?.FullName || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                        {owner?.MembershipNo || 'Non-member'} · {owner?.person?.Mobile1 || '—'}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 12 }}>
                {hasOutgoingOwners
                  ? 'All current owners will stop being recorded as owners of this site. Their ownership will be marked as ended on the transfer date you set in step 3.'
                  : 'No existing owner records will be changed. The incoming owner(s) will be recorded as the first owner(s) from the transfer date.'}
              </p>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div className="label">Incoming owners</div>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{newOwners.length} owner(s)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {newOwners.map((owner, idx) => (
                    <div key={idx} style={{ padding: '10px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                New membership numbers will be auto-assigned for each owner.
              </p>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="label">Transfer date *</label>
                <DateInput value={transferDate} onChange={setTransferDate} />
              </div>
              <div>
                <label className="label">Sale price (₹)</label>
                <input className="input" type="number" placeholder="Optional" value={salePrice} onChange={e => setSalePrice(e.target.value)} />
              </div>
              <div>
                <label className="label">Transfer document *</label>
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleDocUpload} />
                {docRef ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      flex: 1, padding: '8px 10px', background: 'var(--paid-bg)',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--paid)',
                      fontSize: 12, color: 'var(--paid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      ✓ {docFileName}
                    </div>
                    <a href={docRef} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--tc)', textDecoration: 'none', flexShrink: 0 }}>View ↗</a>
                    <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => fileInputRef.current?.click()}>Replace</button>
                  </div>
                ) : (
                  <button
                    className="btn btn-sm"
                    style={{ width: '100%' }}
                    disabled={docUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {docUploading ? 'Uploading…' : '↑ Upload sale deed / registration doc'}
                  </button>
                )}
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                  Upload the sale deed or registration certificate (PDF or photo). Required to complete transfer.
                </div>
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
            <button className="btn btn-primary" disabled={saving || docUploading || !docRef} onClick={handleSave}>
              {saving ? 'Saving…' : 'Complete transfer'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
