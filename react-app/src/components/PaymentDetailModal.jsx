import { useState, useRef, useMemo } from 'react'
import { canEdit, canGeneratePaymentReceipt, formatCurrency, formatDate, toDateInput, PAYMENT_MODES } from '../utils/constants.js'
import { updatePayment, deletePayment, uploadFileToDrive, generatePaymentReceipt } from '../utils/api.js'
import PaymentReceiptModal from './PaymentReceiptModal.jsx'

function formatOwnerDisplay(ownerName, membershipNo) {
  const name = String(ownerName || '').trim()
  const membership = String(membershipNo || '').trim()
  if (name && membership) return `${name} (${membership})`
  if (name) return name
  if (membership) return `Member ID ${membership}`
  return ''
}

function getFallbackOwnerFromCurrentOwners(currentOwners, paymentOwnerId) {
  const list = Array.isArray(currentOwners) ? currentOwners : []
  const exactOwner = list.find(o => String(o?.OwnerID || '') === String(paymentOwnerId || ''))
  const firstOwner = exactOwner || list[0] || null
  if (!firstOwner) return { ownerName: '', membershipNo: '' }
  return {
    ownerName: String(firstOwner?.person?.FullName || '').trim(),
    membershipNo: String(firstOwner?.MembershipNo || '').trim(),
  }
}

export default function PaymentDetailModal({ payment, site, currentOwners, heads, role, onClose, onSaved }) {
  const head = heads.find(h => h.HeadID === payment.HeadID)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [selectedHeadId, setSelectedHeadId] = useState(payment.HeadID || '')
  const [form, setForm] = useState({
    amount: String(payment.Amount || ''),
    mode: payment.Mode || '',
    date: toDateInput(payment.PaymentDate),
    receiptNo: payment.ReceiptNo || '',
    bankRef: payment.BankRef || '',
    proofUrl: payment.ProofURL || '',
  })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [generatingReceipt, setGeneratingReceipt] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const canEditPayment = canEdit(role, 'payments')
  const canGenerateReceipt = canGeneratePaymentReceipt(role)
  const headOptions = useMemo(() => {
    const list = Array.isArray(heads) ? [...heads] : []
    if (payment.HeadID && !list.some(h => h.HeadID === payment.HeadID)) {
      list.unshift({ HeadID: payment.HeadID, HeadName: payment.HeadID, IsActive: 'FALSE' })
    }
    return list
  }, [heads, payment.HeadID])
  const displayPhase = payment.Phase || site?.Phase || ''
  const displaySiteNo = payment.SiteNo || site?.SiteNo || ''

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    setError('')
    try {
      const url = await uploadFileToDrive(file, 'Payments', payment.PaymentID)
      setForm(f => ({ ...f, proofUrl: url }))
    } catch (err) {
      setError(err.message || 'Receipt upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!selectedHeadId) {
      setError('Payment head is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await updatePayment({
        paymentId: payment.PaymentID,
        HeadID: selectedHeadId,
        Amount: Number(form.amount),
        Mode: form.mode,
        PaymentDate: form.date,
        ReceiptNo: form.receiptNo,
        BankRef: form.bankRef,
        ProofURL: form.proofUrl,
      })
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deletePayment(payment.PaymentID)
      onSaved()
    } catch (e) {
      setError(e.message)
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  async function handleGenerateReceipt() {
    setGeneratingReceipt(true)
    setError('')
    try {
      const result = await generatePaymentReceipt(payment.PaymentID)
      const fallbackOwner = getFallbackOwnerFromCurrentOwners(currentOwners, payment.OwnerID)
      const ownerName =
        result.ownerName ||
        payment.OwnerName ||
        payment.ownerName ||
        fallbackOwner.ownerName ||
        ''
      const membershipNo = result.membershipNo || fallbackOwner.membershipNo || ''
      setForm(f => ({ ...f, receiptNo: result.receiptNo }))
      setReceiptData({
        receiptNo: result.receiptNo,
        issueDate: result.issueDate,
        receiptDateKey: result.receiptDateKey,
        ownerName: formatOwnerDisplay(ownerName, membershipNo),
        siteNo: displaySiteNo,
        phase: displayPhase,
        headName: head?.HeadName || payment.HeadID,
        headId: payment.HeadID,
        amount: payment.Amount,
        mode: payment.Mode,
        bankRef: payment.BankRef || '',
        paymentDate: payment.PaymentDate,
        recordedBy: result.recordedByName || 'Automated',
      })
      setShowReceiptModal(true)
    } catch (e) {
      setError(e.message || 'Failed to generate receipt')
    } finally {
      setGeneratingReceipt(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 420, border: '1px solid var(--border)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{editing ? 'Edit payment' : (head?.HeadName || payment.HeadID)}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              {displaySiteNo ? `Site ${displaySiteNo} · Ph ${displayPhase}` : (payment.SiteID || site?.SiteID || '—')}
              {payment.OwnerName ? ` — ${payment.OwnerName}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {canEditPayment && !editing && !confirmDelete && (
              <button
                className="btn btn-sm"
                style={{ color: 'var(--disputed)', borderColor: 'var(--disputed-bg)', background: '#fff' }}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {confirmDelete ? (
            <div style={{ padding: '12px', background: 'var(--disputed-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--disputed)' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--disputed)', marginBottom: 4 }}>Delete this payment?</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 12 }}>
                {formatCurrency(payment.Amount)} · {formatDate(payment.PaymentDate)} · {payment.Mode}<br />
                This is audit-logged and cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</button>
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--disputed)', color: '#fff', borderColor: 'var(--disputed)' }}
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
              </div>
            </div>
          ) : editing ? (
            <>
              <div>
                <label className="label">Payment head</label>
                <select className="input" value={selectedHeadId} onChange={e => setSelectedHeadId(e.target.value)}>
                  <option value="">Select payment head</option>
                  {headOptions.map(h => (
                    <option key={h.HeadID} value={h.HeadID}>{h.HeadName}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Amount (₹)</label>
                  <input className="input" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Transaction date</label>
                  <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Payment mode</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {PAYMENT_MODES.map(m => (
                    <button
                      key={m}
                      className="btn btn-sm"
                      style={form.mode === m
                        ? { background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)', flex: 1 }
                        : { flex: 1 }}
                      onClick={() => setForm(f => ({ ...f, mode: m }))}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Receipt no.</label>
                  <input className="input" value={form.receiptNo} onChange={e => setForm(f => ({ ...f, receiptNo: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Bank ref / UTR</label>
                  <input className="input" value={form.bankRef} onChange={e => setForm(f => ({ ...f, bankRef: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Receipt / proof</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {uploading ? 'Uploading…' : '↑ Upload receipt'}
                  </button>
                  <input
                    className="input"
                    value={form.proofUrl}
                    onChange={e => setForm(f => ({ ...f, proofUrl: e.target.value }))}
                    placeholder="Or paste Drive link"
                    style={{ flex: 1 }}
                  />
                </div>
                {form.proofUrl && (
                  <a
                    href={form.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 11, color: 'var(--tc)', marginTop: 4, display: 'inline-block', textDecoration: 'none' }}
                  >
                    View uploaded receipt ↗
                  </a>
                )}
              </div>
            </>
          ) : (
            <>
              <DetailRow label="Amount" value={formatCurrency(payment.Amount)} bold />
              <DetailRow label="Date" value={formatDate(payment.PaymentDate)} />
              <DetailRow label="Mode" value={payment.Mode} />
              {payment.ReceiptNo && <DetailRow label="Receipt #" value={`#${payment.ReceiptNo}`} />}
              {payment.BankRef && <DetailRow label="Bank ref" value={payment.BankRef} mono />}
              {payment.ProofURL && (
                <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--ink-3)', minWidth: 84, flexShrink: 0 }}>Proof</span>
                  <a href={payment.ProofURL} target="_blank" rel="noreferrer" style={{ color: 'var(--tc)', textDecoration: 'none' }}>View ↗</a>
                </div>
              )}
              <DetailRow label="Recorded by" value={payment.RecordedBy} />
              <DetailRow label="Recorded at" value={formatDate(payment.RecordedAt)} />
            </>
          )}

          {error && (
            <div style={{ fontSize: 12, padding: '8px 12px', background: 'var(--disputed-bg)', color: 'var(--disputed)', borderRadius: 'var(--radius-md)' }}>
              {error}
            </div>
          )}
        </div>

        {!confirmDelete && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
            {!editing && canGenerateReceipt && (
              <button className="btn btn-sm" onClick={handleGenerateReceipt} disabled={generatingReceipt}>
                {generatingReceipt ? 'Generating...' : 'Generate receipt'}
              </button>
            )}
            <div style={{ flex: 1 }} />
            {editing ? (
              <>
                <button className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" disabled={saving || uploading} onClick={handleSave}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-sm" onClick={onClose}>Close</button>
                {canEditPayment && (
                  <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>Edit</button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showReceiptModal && receiptData && (
        <PaymentReceiptModal
          receipt={receiptData}
          onClose={() => {
            setShowReceiptModal(false)
            setReceiptData(null)
          }}
        />
      )}
    </div>
  )
}

function DetailRow({ label, value, bold, mono }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
      <span style={{ color: 'var(--ink-3)', minWidth: 84, flexShrink: 0 }}>{label}</span>
      <span
        className={mono ? 'mono' : ''}
        style={{
          fontWeight: bold ? 600 : 400,
          color: 'var(--ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={value}
      >
        {value || '—'}
      </span>
    </div>
  )
}
