import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getPayments, getPaymentHeads, getSites, updatePayment, deletePayment, uploadFileToDrive } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canEdit, formatCurrency, formatDate } from '../utils/constants.js'
import PaymentModal from '../components/PaymentModal.jsx'
import { PAYMENT_MODES } from '../utils/constants.js'

export default function PaymentsView() {
  const { user } = useAuth()
  const role = user?.role || 'View'

  const [payments, setPayments] = useState([])
  const [sites, setSites]       = useState([])
  const [heads, setHeads]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]   = useState(null)   // payment row being edited
  const [headFilter, setHeadFilter] = useState('')
  const [modeFilter, setModeFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pays, hs, ss] = await Promise.all([getPayments({}), getPaymentHeads(), getSites({})])
      pays.sort((a, b) => {
        const recordedA = a.RecordedAt ? new Date(a.RecordedAt).getTime() : 0
        const recordedB = b.RecordedAt ? new Date(b.RecordedAt).getTime() : 0
        if (recordedA !== recordedB) return recordedB - recordedA

        const paymentA = a.PaymentDate ? new Date(a.PaymentDate).getTime() : 0
        const paymentB = b.PaymentDate ? new Date(b.PaymentDate).getTime() : 0
        if (paymentA !== paymentB) return paymentB - paymentA

        return String(b.PaymentID || '').localeCompare(String(a.PaymentID || ''))
      })
      setPayments(pays)
      setHeads(hs)
      setSites(ss)
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
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        {loading ? (
          <div className="empty-state"><div className="spin" style={{ margin: '0 auto' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No payments found</p></div>
        ) : (
          <table style={{ width: 'max-content', minWidth: 0, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 13 }}>
            <colgroup>
              <col style={{ width: 138 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 290 }} />
              <col style={{ width: 98 }} />
              <col style={{ width: 104 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 86 }} />
            </colgroup>
            <thead>
              <tr style={{
                position: 'sticky', top: 0,
                background: 'var(--surface-2)', borderBottom: '1px solid var(--border)'
              }}>
                {['Flag','Date','Site','Head','Amount','Mode','Bank ref / UTR','Recorded'].map(h => (
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
                  <td style={{ padding: '10px 8px', color: 'var(--ink-2)', fontSize: 11, maxWidth: 300 }}>
                    {(p.FlaggedForAttention === 'TRUE' || p.FlaggedForAttention === true) ? (
                      <>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--partial)', fontWeight: 600 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--partial)', display: 'inline-block' }} />
                          Needs follow-up
                        </div>
                        <div style={{ marginTop: 2, whiteSpace: 'normal', lineHeight: 1.35, color: 'var(--ink-3)' }}>
                          {p.FlagComment || 'Flagged payment'}
                        </div>
                      </>
                    ) : '—'}
                  </td>
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
                  <td
                    title={p.BankRef || ''}
                    style={{ padding: '10px 8px', color: 'var(--ink-2)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {p.BankRef || '—'}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--ink-3)', fontSize: 11, whiteSpace: 'nowrap' }}>
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
          sites={sites}
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

function EditPaymentModal({ payment, heads, sites, onClose, onSaved }) {
  const [amount, setAmount]   = useState(String(payment.Amount || ''))
  const [mode, setMode]       = useState(payment.Mode || '')
  const [date, setDate]       = useState(toDateInput(payment.PaymentDate))
  const [receiptNo, setReceiptNo] = useState(payment.ReceiptNo || '')
  const [bankRef, setBankRef] = useState(payment.BankRef || '')
  const [proofUrl, setProofUrl] = useState(payment.ProofURL || '')
  const [flagged, setFlagged] = useState(payment.FlaggedForAttention === 'TRUE' || payment.FlaggedForAttention === true)
  const [flagComment, setFlagComment] = useState(payment.FlagComment || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]     = useState('')
  const fileInputRef = useRef(null)

  const phaseOptions = useMemo(() => {
    const values = [...new Set((sites || []).map(s => String(s.Phase || '')).filter(Boolean))]
    return values.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, undefined, { numeric: true }))
  }, [sites])

  const matchedSite = useMemo(() => (sites || []).find(s => s.SiteID === payment.SiteID), [sites, payment.SiteID])
  const [sitePhase, setSitePhase] = useState((matchedSite?.Phase || payment.Phase || '').toString())
  const [siteNo, setSiteNo] = useState((matchedSite?.SiteNo || payment.SiteNo || '').toString())

  const siteNoOptions = useMemo(() => {
    if (!sitePhase) return []
    return (sites || [])
      .filter(s => String(s.Phase || '') === String(sitePhase))
      .map(s => String(s.SiteNo || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [sites, sitePhase])

  async function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setUploading(true); setError('')
    try {
      const url = await uploadFileToDrive(file, 'Payments', payment.PaymentID)
      setProofUrl(url)
    } catch (err) { setError(err.message) }
    finally { setUploading(false) }
  }

  const headName = heads.find(h => h.HeadID === payment.HeadID)?.HeadName || payment.HeadID

  async function handleSave() {
    setSaving(true); setError('')
    try {
      let selectedSiteId = payment.SiteID || ''
      if (!sitePhase && !siteNo) {
        selectedSiteId = ''
      } else if (sitePhase && siteNo) {
        const selectedSite = (sites || []).find(
          s => String(s.Phase || '') === String(sitePhase) && String(s.SiteNo || '').trim() === String(siteNo).trim()
        )
        if (!selectedSite) {
          throw new Error('Selected Phase + Site number does not exist')
        }
        selectedSiteId = selectedSite.SiteID
      } else {
        throw new Error('Select both Phase and Site number, or leave both blank')
      }

      await updatePayment({
        paymentId: payment.PaymentID,
        SiteID: selectedSiteId,
        Amount: Number(amount),
        Mode: mode,
        PaymentDate: date,
        ReceiptNo: receiptNo,
        BankRef: bankRef,
        ProofURL: proofUrl,
        FlaggedForAttention: flagged ? 'TRUE' : 'FALSE',
        FlagComment: flagComment,
      })
      onSaved()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    const ok = window.confirm('Delete this payment record? This action cannot be undone.')
    if (!ok) return

    setDeleting(true)
    setError('')
    try {
      await deletePayment(payment.PaymentID)
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setDeleting(false)
    }
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
          <div style={{
            padding: '10px 12px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--surface-2)'
          }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>Site mapping</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                Phase
                <select className='input' value={sitePhase} onChange={e => { setSitePhase(e.target.value); setSiteNo('') }}>
                  <option value=''>Unmapped</option>
                  {phaseOptions.map(ph => <option key={ph} value={ph}>Phase {ph}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 11, color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                Site number
                <select className='input' value={siteNo} disabled={!sitePhase} onChange={e => setSiteNo(e.target.value)}>
                  <option value=''>{sitePhase ? 'Select site' : 'Select phase first'}</option>
                  {siteNoOptions.map(no => <option key={no} value={no}>{no}</option>)}
                </select>
              </label>
            </div>
          </div>

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

          <div style={{
            padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            background: 'var(--surface-2)'
          }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              <input type="checkbox" checked={flagged} onChange={e => setFlagged(e.target.checked)} />
              Flag this payment for follow-up
            </label>
            {flagged && (
              <div style={{ marginTop: 8 }}>
                <label className="label">Flag comment</label>
                <textarea
                  className="input"
                  rows={3}
                  value={flagComment}
                  onChange={e => setFlagComment(e.target.value)}
                  placeholder="Example: Zombie payment - Site/Ph missing; update after verification"
                  style={{ resize: 'vertical' }}
                />
              </div>
            )}
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

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button className="btn" onClick={handleDelete} disabled={saving || deleting} style={{ color: 'var(--disputed)', borderColor: 'var(--disputed)' }}>
            {deleting ? 'Deleting…' : 'Delete payment'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving || deleting} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}
