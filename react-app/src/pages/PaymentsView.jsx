import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getPayments, getPaymentHeads, updatePayment, uploadFileToDrive } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canEdit, formatCurrency, formatDate } from '../utils/constants.js'
import PaymentModal from '../components/PaymentModal.jsx'
import { PAYMENT_MODES } from '../utils/constants.js'

export default function PaymentsView() {
  const { user } = useAuth()
  const role = user?.role || 'View'

  const [payments, setPayments] = useState([])
  const [heads, setHeads]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]   = useState(null)   // payment row being edited
  const [headFilter, setHeadFilter] = useState('')
  const [modeFilter, setModeFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pays, hs] = await Promise.all([getPayments({}), getPaymentHeads()])
      pays.sort((a, b) => {
        if (!a.PaymentDate && !b.PaymentDate) return 0
        if (!a.PaymentDate) return 1
        if (!b.PaymentDate) return -1
        return new Date(b.PaymentDate) - new Date(a.PaymentDate)
      })
      setPayments(pays)
      setHeads(hs)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load] )

  const filtered = useMemo(() => {
    let list = payments
    if (headFilter) list = list.filter(p => p.HeadID === headFilter)
    if (modeFilter) list = list.filter(p => p.Mode === modeFilter)
    return list
  }, [payments, headFilter, modeFilter])

  const total = filtered.reduce((s, p) => s + Number(p.Amount || 0), 0)
  const modes = [...new Set(payments.map(p => p.Mode).filter(Boolean))]

  function headName(id) {
    return heads.find(h => h.HeadID === id)?.HeadName || id
  }

  const canEditPayments = canEdit(role, 'payments')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0
      }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Payments</h1>
        <select className="input" style={{ width: 'auto' }}
          value={headFilter} onChange={e => setHeadFilter(e.target.value)}>
          <option value="">All heads</option>
          {heads.map(h => <option key={h.HeadID} value={h.HeadID}>{h.HeadName}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }}
          value={modeFilter} onChange={e => setModeFilter(e.target.value)}>
          <option value="">All modes</option>
          {modes.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {canEditPayments && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Record payment
          </button>
        )}
      </div>

      {/* Summary strip */}
      <div style={{
        padding: '8px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 24, alignItems: 'center', flexShrink: 0,
        background: 'var(--surface-2)', fontSize: 12, color: 'var(--ink-2)'
      }}>
        <span>{filtered.length} payments</span>
        <span style={{ fontWeight: 600, color: 'var(--paid)' }}>{formatCurrency(total)} total</span>
        {(headFilter || modeFilter) && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
            onClick={() => { setHeadFilter(''); setModeFilter('') }}>
            Clear filters
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
        {loading ? (
          <div className="empty-state"><div className="spin" style={{ margin: '0 auto' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No payments found</p></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{
                position: 'sticky', top: 0,
                background: 'var(--surface-2)', borderBottom: '1px solid var(--border)'
              }}>
                {['Date','Site','Head','Amount','Mode','Bank ref / UTR','Recorded'].map(h => (
                  <th key={h} style={{
                    padding: '10px 8px', textAlign: 'left', fontWeight: 500,
                    color: 'var(--ink-2)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr
                  key={p.PaymentID}
                  onClick={() => canEditPayments && setEditing(p)}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: canEditPayments ? 'pointer' : 'default',
                  }}
                  onMouseEnter={e => { if (canEditPayments) e.currentTarget.style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '' }}
                >
                  <td style={{ padding: '10px 8px', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                    {formatDate(p.PaymentDate)}
                  </td>
                  <td style={{ padding: '10px 8px', maxWidth: 220 }}>
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.SiteNo ? `Site ${p.SiteNo}` : p.SiteID}
                      {p.Phase ? <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> · Ph {p.Phase}</span> : null}
                    </div>
                    {p.OwnerName && (
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.OwnerName}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--ink-2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {headName(p.HeadID)}
                  </td>
                  <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--paid)', whiteSpace: 'nowrap' }}>
                    {formatCurrency(p.Amount)}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--ink-2)' }}>
                    {p.Mode || '—'}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--ink-2)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.BankRef || '—'}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--ink-3)', fontSize: 11 }}>
                    <div>{formatDate(p.RecordedAt)}</div>
                    <div style={{ marginTop: 1 }}>{p.RecordedBy?.split('@')[0]}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Record payment modal */}
      {showModal && (
        <PaymentModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
          role={role}
        />
      )}

      {/* Edit payment modal */}
      {editing && (
        <EditPaymentModal
          payment={editing}
          heads={heads}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function DateField({ value, onChange }) {
  const ref = useRef(null)
  const display = value ? value.split('-').reverse().join('/') : ''
  return (
    <div style={{ position: 'relative' }}>
      <div className="input" style={{ cursor: 'pointer', color: display ? 'inherit' : 'var(--ink-3)' }}>
        {display || 'DD/MM/YYYY'}
      </div>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
      />
    </div>
  )
}

function toDateInput(val) {
  if (!val) return ''
  const s = String(val)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(val)
  if (isNaN(d)) return ''
  // Use local date components — avoids UTC midnight shifting date one day back in IST
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function EditPaymentModal({ payment, heads, onClose, onSaved }) {
  const [amount, setAmount]   = useState(String(payment.Amount || ''))
  const [mode, setMode]       = useState(payment.Mode || '')
  const [date, setDate]       = useState(toDateInput(payment.PaymentDate))
  const [receiptNo, setReceiptNo] = useState(payment.ReceiptNo || '')
  const [bankRef, setBankRef] = useState(payment.BankRef || '')
  const [proofUrl, setProofUrl] = useState(payment.ProofURL || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const fileInputRef = useRef(null)

  async function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setUploading(true); setError('')
    try {
      const url = await uploadFileToDrive(file, payment.PaymentID)
      setProofUrl(url)
    } catch (err) { setError(err.message) }
    finally { setUploading(false) }
  }

  const headName = heads.find(h => h.HeadID === payment.HeadID)?.HeadName || payment.HeadID

  async function handleSave() {
    setSaving(true); setError('')
    try {
      await updatePayment({
        paymentId: payment.PaymentID,
        Amount: Number(amount),
        Mode: mode,
        PaymentDate: date,
        ReceiptNo: receiptNo,
        BankRef: bankRef,
        ProofURL: proofUrl,
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
        width: '100%', maxWidth: 400, border: '1px solid var(--border)', overflow: 'hidden'
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Edit payment</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              {payment.SiteNo ? `Site ${payment.SiteNo} · Ph ${payment.Phase}` : payment.SiteID}
              {payment.OwnerName ? ` — ${payment.OwnerName}` : ''}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>Payment head</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{headName}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Amount (₹)</label>
              <input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="label">Transaction date</label>
              <DateField value={date} onChange={setDate} />
            </div>
          </div>

          <div>
            <label className="label">Payment mode</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {PAYMENT_MODES.map(m => (
                <button key={m} className="btn btn-sm"
                  style={mode === m ? {
                    background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)', flex: 1
                  } : { flex: 1 }}
                  onClick={() => setMode(m)}>{m}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Receipt no.</label>
              <input className="input" value={receiptNo} onChange={e => setReceiptNo(e.target.value)} />
            </div>
            <div>
              <label className="label">Bank ref / UTR</label>
              <input className="input" value={bankRef} onChange={e => setBankRef(e.target.value)} />
            </div>
          </div>

          {/* Receipt upload */}
          <div>
            <label className="label">Receipt / proof</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <button
                className="btn btn-ghost btn-sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {uploading ? 'Uploading…' : '↑ Upload receipt'}
              </button>
              <input
                className="input"
                placeholder="Or paste Drive link"
                value={proofUrl}
                onChange={e => setProofUrl(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
            {proofUrl && (
              <a
                href={proofUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: 'var(--tc)', marginTop: 4, display: 'inline-block' }}
              >
                View uploaded receipt ↗
              </a>
            )}
          </div>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--disputed)', padding: '8px 12px', background: 'var(--disputed-bg)', borderRadius: 'var(--radius-md)' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
