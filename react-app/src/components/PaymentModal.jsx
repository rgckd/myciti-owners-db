import { useState, useEffect } from 'react'
import { getSites, getPaymentHeads, createPayment } from '../utils/api.js'
import { PAYMENT_MODES, formatCurrency } from '../utils/constants.js'

export default function PaymentModal({ siteId: prefillSiteId, siteNo, owners = [], onClose, onSaved }) {
  const [sites, setSites] = useState([])
  const [heads, setHeads] = useState([])
  const [selectedSiteId, setSelectedSiteId] = useState(prefillSiteId || '')
  const [selectedOwnerId, setSelectedOwnerId] = useState(owners[0]?.OwnerID || '')
  const [selectedHeadId, setSelectedHeadId] = useState('')
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [receiptNo, setReceiptNo] = useState('')
  const [bankRef, setBankRef] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getSites(), getPaymentHeads()]).then(([s, h]) => {
      setSites(s)
      const active = h.filter(head => head.IsActive === 'TRUE')
      setHeads(active)
      if (active.length > 0) setSelectedHeadId(active[0].HeadID)
    })
  }, [])

  const siteOwners = owners.length > 0 ? owners :
    (selectedSiteId ? [] : []) // in full modal, owners come from site selection

  const selectedHead = heads.find(h => h.HeadID === selectedHeadId)

  async function handleSave() {
    if (!selectedSiteId || !selectedHeadId || !amount || !mode || !date) {
      setError('Please fill in all required fields')
      return
    }
    setSaving(true); setError('')
    try {
      await createPayment({
        siteId: selectedSiteId,
        ownerId: selectedOwnerId,
        headId: selectedHeadId,
        amount: Number(amount),
        mode, paymentDate: date,
        receiptNo, bankRef
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
      zIndex: 1000, padding: 20
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
        width: '100%', maxWidth: 420, overflow: 'hidden',
        border: '1px solid var(--border)'
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Record payment</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Site banner */}
        {siteNo && (
          <div style={{
            margin: '14px 18px 0', padding: '10px 14px',
            background: 'var(--tc-light)', borderRadius: 'var(--radius-md)'
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--tc)' }}>Site {siteNo}</div>
            {owners[0]?.person?.FullName && (
              <div style={{ fontSize: 12, color: 'var(--tc-dark)', marginTop: 2 }}>
                {owners[0].person.FullName} · {owners[0].MembershipNo || 'Non-member'}
              </div>
            )}
          </div>
        )}

        {!siteNo && (
          <div style={{ padding: '14px 18px 0' }}>
            <label className="label">Site *</label>
            <select
              className="input"
              value={selectedSiteId}
              onChange={e => setSelectedSiteId(e.target.value)}
            >
              <option value="">Select site…</option>
              {sites.map(s => (
                <option key={s.SiteID} value={s.SiteID}>
                  Site {s.SiteNo} — Phase {s.Phase} ({s.ownerName || 'No owner'})
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Payment head */}
          <div>
            <label className="label">Payment head *</label>
            <select className="input" value={selectedHeadId} onChange={e => setSelectedHeadId(e.target.value)}>
              {heads.map(h => (
                <option key={h.HeadID} value={h.HeadID}>{h.HeadName}</option>
              ))}
            </select>
          </div>

          {/* Mode */}
          <div>
            <label className="label">Payment mode *</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {PAYMENT_MODES.map(m => (
                <button
                  key={m}
                  className="btn btn-sm"
                  style={mode === m ? {
                    background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)', flex: 1
                  } : { flex: 1 }}
                  onClick={() => setMode(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Amount + Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Amount (₹) *</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 13, color: 'var(--ink-2)'
                }}>₹</span>
                <input
                  className="input" type="number"
                  style={{ paddingLeft: 22 }}
                  placeholder={selectedHead ? String(selectedHead.ExpectedAmountFlat || selectedHead.ExpectedAmountPerSqft || '') : ''}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Date *</label>
              <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {/* Receipt + Bank ref */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Receipt no.</label>
              <input className="input" placeholder="e.g. 476" value={receiptNo} onChange={e => setReceiptNo(e.target.value)} />
            </div>
            <div>
              <label className="label">Bank ref / UTR</label>
              <input className="input" placeholder="Optional" value={bankRef} onChange={e => setBankRef(e.target.value)} />
            </div>
          </div>

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
            {saving ? 'Saving…' : 'Save payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
