import { useState, useEffect, useMemo, useRef } from 'react'
import { getSites, getPaymentHeads, createPayment, uploadFileToDrive } from '../utils/api.js'
import { PAYMENT_MODES, formatCurrency } from '../utils/constants.js'
import { getSitesCache } from '../pages/SiteRegistry.jsx'

export default function PaymentModal({ siteId: prefillSiteId, siteNo, owners = [], onClose, onSaved }) {
  const [heads, setHeads] = useState([])
  const [selectedSiteId, setSelectedSiteId] = useState(prefillSiteId || '')
  const [selectedOwnerId, setSelectedOwnerId] = useState(owners[0]?.OwnerID || '')
  const [selectedHeadId, setSelectedHeadId] = useState('')
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [receiptNo, setReceiptNo] = useState('')
  const [bankRef, setBankRef] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const dateInputRef = useRef(null)

  // Site picker state (only used when not pre-filled)
  const [sitePhase, setSitePhase] = useState('All')
  const [siteSearch, setSiteSearch] = useState('')
  const [allSites, setAllSites] = useState(() => getSitesCache())

  useEffect(() => {
    if (allSites.length === 0 && !prefillSiteId) {
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

  useEffect(() => {
    getPaymentHeads().then(h => {
      const active = h.filter(head => head.IsActive === 'TRUE' || head.IsActive === true)
      setHeads(active)
      if (active.length > 0) setSelectedHeadId(active[0].HeadID)
    })
  }, [])

  const selectedHead = heads.find(h => h.HeadID === selectedHeadId)
  const selectedSite = allSites.find(s => s.SiteID === selectedSiteId)

  async function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setUploading(true); setError('')
    try {
      const url = await uploadFileToDrive(file, 'Payments', selectedSiteId || 'new')
      setProofUrl(url)
    } catch (err) { setError(err.message) }
    finally { setUploading(false) }
  }

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
        receiptNo, bankRef, proofUrl
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
        width: '100%', maxWidth: 440, overflow: 'hidden',
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

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Site — pre-filled banner OR picker */}
          {siteNo ? (
            <div style={{
              padding: '10px 14px',
              background: 'var(--tc-light)', borderRadius: 'var(--radius-md)'
            }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--tc)' }}>Site {siteNo}</div>
              {owners[0]?.person?.FullName && (
                <div style={{ fontSize: 12, color: 'var(--tc-dark)', marginTop: 2 }}>
                  {owners[0].person.FullName} · {owners[0].MembershipNo || 'Non-member'}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="label">Site *</label>
              {/* Phase filter */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {['All', '1', '2'].map(p => (
                  <button
                    key={p}
                    className={`btn btn-sm ${sitePhase === p ? '' : 'btn-ghost'}`}
                    style={sitePhase === p ? { background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)' } : {}}
                    onClick={() => { setSitePhase(p); setSelectedSiteId('') }}
                  >
                    {p === 'All' ? 'All phases' : `Phase ${p}`}
                  </button>
                ))}
              </div>
              {/* Search */}
              <input
                className="input"
                placeholder="Search site no, owner name, MID…"
                value={siteSearch}
                onChange={e => { setSiteSearch(e.target.value); setSelectedSiteId('') }}
                style={{ marginBottom: 6 }}
              />
              {/* Site list */}
              <div style={{
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                maxHeight: 180, overflowY: 'auto'
              }}>
                {filteredSites.length === 0 ? (
                  <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-3)' }}>No sites found</div>
                ) : filteredSites.map(s => (
                  <div
                    key={s.SiteID}
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
          )}

          {/* Payment head */}
          <div>
            <label className="label">Payment head *</label>
            {heads.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>No active payment heads — add one in Admin.</div>
            ) : (
              <select className="input" value={selectedHeadId} onChange={e => setSelectedHeadId(e.target.value)}>
                {heads.map(h => (
                  <option key={h.HeadID} value={h.HeadID}>{h.HeadName}</option>
                ))}
              </select>
            )}
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
              <label className="label">Transaction date *</label>
              <div style={{ position: 'relative' }}>
                <div className="input" style={{ cursor: 'pointer', color: date ? 'inherit' : 'var(--ink-3)' }}>
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
                disabled={uploading || !selectedSiteId}
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
              <a href={proofUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: 'var(--tc)', marginTop: 4, display: 'inline-block' }}>
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
