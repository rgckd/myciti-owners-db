import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getPayments, getPaymentHeads, getSites } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canEdit, formatCurrency, formatDate } from '../utils/constants.js'
import PaymentModal from '../components/PaymentModal.jsx'
import PaymentDetailModal from '../components/PaymentDetailModal.jsx'
import DateInput from '../components/DateInput.jsx'

export default function PaymentsView() {
  const { user } = useAuth()
  const role = user?.role || 'View'

  const [payments, setPayments] = useState([])
  const [sites, setSites]       = useState([])
  const [heads, setHeads]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [headFilter, setHeadFilter] = useState('')
  const [modeFilter, setModeFilter] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
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

  useEffect(() => { load() }, [load])

  const headLookup = useMemo(() => {
    const map = {}
    heads.forEach(h => { map[h.HeadID] = h.HeadName || h.HeadID })
    return map
  }, [heads])

  const filtered = useMemo(() => {
    let list = payments
    if (headFilter) list = list.filter(p => p.HeadID === headFilter)
    if (modeFilter) list = list.filter(p => p.Mode === modeFilter)
    if (flaggedOnly) list = list.filter(p => p.FlaggedForAttention === 'TRUE' || p.FlaggedForAttention === true)
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(p => {
        const haystack = [
          p.PaymentID,
          p.SiteNo,
          p.SiteID,
          p.Phase,
          p.OwnerName,
          p.Mode,
          p.BankRef,
          p.ReceiptNo,
          p.RecordedBy,
          p.PaymentDate,
          formatDate(p.PaymentDate),
          formatDate(p.RecordedAt),
          p.FlagComment,
        ].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(q)
      })
    }
    return list
  }, [payments, headFilter, modeFilter, flaggedOnly, searchQuery, headLookup])

  const total = filtered.reduce((s, p) => s + Number(p.Amount || 0), 0)
  const modes = [...new Set(payments.map(p => p.Mode).filter(Boolean))]
  const hasPendingSearch = searchInput.trim() !== searchQuery.trim()

  function headName(id) { return headLookup[id] || id }

  const canEditPayments = canEdit(role, 'payments')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0
      }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Payments</h1>
        <div style={{ minWidth: 300, flex: '0 1 420px', position: 'relative' }}>
          <input
            className="input"
            style={{ width: '100%', paddingRight: 34 }}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                setSearchQuery(searchInput)
              }
            }}
            placeholder="Search site, owner, bank ref/UTR, receipt no..."
          />
          {!!(searchInput || searchQuery) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setSearchInput(''); setSearchQuery('') }}
              title="Clear search"
              aria-label="Clear search"
              style={{
                position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                minWidth: 24, width: 24, height: 24, padding: 0, lineHeight: 1, borderRadius: 999
              }}
            >
              x
            </button>
          )}
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => setSearchQuery(searchInput)}
          disabled={!hasPendingSearch}
          title="Apply search"
          aria-label="Apply search"
          style={{ minWidth: 36, width: 36, padding: 0, fontSize: 15, lineHeight: 1 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
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
        <button
          className={`btn ${flaggedOnly ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 12, gap: 6, display: 'flex', alignItems: 'center' }}
          onClick={() => setFlaggedOnly(f => !f)}
        >
          <span style={{ width: 7, height: 7, borderRadius: 999, background: flaggedOnly ? '#fff' : 'var(--partial)', display: 'inline-block' }} />
          Flagged only
        </button>
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
        {(headFilter || modeFilter || flaggedOnly || searchQuery.trim() || searchInput.trim()) && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
            onClick={() => { setSearchInput(''); setSearchQuery(''); setHeadFilter(''); setModeFilter(''); setFlaggedOnly(false) }}>
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
                {['Flag','Transaction date','Site','Head','Amount','Mode','Bank ref / UTR','Recorded'].map(h => (
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
                  onClick={() => setSelectedPayment(p)}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
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
          onSaved={() => { setShowModal(false); load(true) }}
          role={role}
        />
      )}

      {/* Payment detail modal - view only with edit option */}
      {selectedPayment && (
        <PaymentDetailModal
          payment={selectedPayment}
          site={sites.find(s => s.SiteID === selectedPayment.SiteID)}
          heads={heads}
          role={role}
          onClose={() => setSelectedPayment(null)}
          onSaved={() => { setSelectedPayment(null); load(true) }}
        />
      )}
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
