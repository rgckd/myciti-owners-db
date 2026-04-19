import { useState, useEffect, useCallback, useMemo } from 'react'
import { getPayments, getPaymentHeads } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canEdit, formatCurrency, formatDate } from '../utils/constants.js'
import PaymentModal from '../components/PaymentModal.jsx'

export default function PaymentsView() {
  const { user } = useAuth()
  const role = user?.role || 'View'

  const [payments, setPayments] = useState([])
  const [heads, setHeads]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [headFilter, setHeadFilter] = useState('')
  const [modeFilter, setModeFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pays, hs] = await Promise.all([getPayments({}), getPaymentHeads()])
      // most recent first
      pays.sort((a, b) => new Date(b.PaymentDate || b.RecordedAt) - new Date(a.PaymentDate || a.RecordedAt))
      setPayments(pays)
      setHeads(hs)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

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
        {canEdit(role, 'payments') && (
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
                {['Date','Site','Head','Amount','Mode','Receipt','Recorded by'].map(h => (
                  <th key={h} style={{
                    padding: '10px 8px', textAlign: 'left', fontWeight: 500,
                    color: 'var(--ink-2)', fontSize: 11, whiteSpace: 'nowrap'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.PaymentID} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 8px', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                    {formatDate(p.PaymentDate)}
                  </td>
                  <td style={{ padding: '10px 8px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {p.SiteNo ? `Site ${p.SiteNo}` : p.SiteID || '—'}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--ink-2)' }}>
                    {headName(p.HeadID)}
                  </td>
                  <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--paid)', whiteSpace: 'nowrap' }}>
                    {formatCurrency(p.Amount)}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--ink-2)' }}>
                    {p.Mode || '—'}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                    {p.ReceiptNo ? `#${p.ReceiptNo}` : p.BankRef || '—'}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--ink-3)', fontSize: 11 }}>
                    {p.RecordedBy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <PaymentModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
          role={role}
        />
      )}
    </div>
  )
}
