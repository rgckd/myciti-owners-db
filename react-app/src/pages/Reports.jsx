import { useState, useEffect, useMemo } from 'react'
import { getSites, getPayments, getPaymentHeads } from '../utils/api.js'
import { formatDate, formatCurrency } from '../utils/constants.js'

export default function Reports() {
  const [tab, setTab] = useState('sites')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 0, alignItems: 'center', flexShrink: 0 }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, marginRight: 20 }}>Reports</h1>
        {[['sites', 'Sites'], ['payments', 'Payments']].map(([key, label]) => (
          <button key={key}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: tab === key ? 500 : 400,
              color: tab === key ? 'var(--tc)' : 'var(--ink-2)',
              borderBottom: tab === key ? '2px solid var(--tc)' : '2px solid transparent',
            }}
            onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'sites' ? <SitesReport /> : <PaymentsReport />}
      </div>
    </div>
  )
}

// ── CSV helper ────────────────────────────────────────────────────────────────

function downloadCSV(rows, filename) {
  const csv = rows.map(row =>
    row.map(cell => {
      const s = String(cell ?? '')
      return (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')
  ).join('\n')
  // BOM ensures Excel opens UTF-8 correctly (needed for Indian names)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Filter chips ──────────────────────────────────────────────────────────────

function FilterChips({ label, options, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      {label && <span style={{ fontSize: 11, color: 'var(--ink-3)', marginRight: 2 }}>{label}</span>}
      {options.map(opt => (
        <button key={opt.value} className="btn btn-sm"
          style={value === opt.value ? { background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)' } : {}}
          onClick={() => onChange(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />
}

// ── Sites Report ──────────────────────────────────────────────────────────────

const STATUS_LABEL = {
  paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid',
  nocontact: 'No contact', disputed: 'Disputed'
}
const STATUS_COLOR = {
  paid: 'var(--paid)', partial: 'var(--partial)', unpaid: 'var(--partial)',
  nocontact: 'var(--nocontact)', disputed: 'var(--disputed)'
}

function SitesReport() {
  const [sites, setSites] = useState([])
  const [payments, setPayments] = useState([])
  const [heads, setHeads] = useState([])
  const [loading, setLoading] = useState(true)

  const [phase, setPhase] = useState('All')
  const [siteType, setSiteType] = useState('All')
  const [status, setStatus] = useState('All')
  const [membersOnly, setMembersOnly] = useState(false)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [sortBy, setSortBy] = useState('siteNo')

  useEffect(() => {
    setLoading(true)
    Promise.all([getSites(), getPayments(), getPaymentHeads()])
      .then(([s, p, h]) => { setSites(s); setPayments(p); setHeads(h) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const activeHeads = useMemo(() => heads.filter(h => h.IsActive === 'TRUE'), [heads])

  const payMap = useMemo(() => {
    const m = {}
    payments.forEach(p => {
      if (!m[p.SiteID]) m[p.SiteID] = {}
      if (!m[p.SiteID][p.HeadID]) m[p.SiteID][p.HeadID] = 0
      m[p.SiteID][p.HeadID] += parseFloat(p.Amount) || 0
    })
    return m
  }, [payments])

  const rows = useMemo(() => {
    let list = sites.map(site => {
      const headDues = activeHeads.map(h => {
        const paid = (payMap[site.SiteID] || {})[h.HeadID] || 0
        let expected = null
        if (h.AmountType === 'Flat') expected = parseFloat(h.ExpectedAmountFlat) || 0
        else if (site.Sizesqft) expected = (parseFloat(h.ExpectedAmountPerSqft) || 0) * parseFloat(site.Sizesqft)
        const due = expected != null ? Math.max(0, expected - paid) : null
        return { headId: h.HeadID, paid, expected, due }
      })
      return { ...site, headDues }
    })

    if (phase !== 'All') list = list.filter(s => String(s.Phase) === phase)
    if (siteType !== 'All') list = list.filter(s => s.SiteType === siteType)
    if (status !== 'All') list = list.filter(s => s.payStatus === status)
    if (membersOnly) list = list.filter(s => s.membershipNo)
    if (flaggedOnly) list = list.filter(s => s.FlaggedForAttention === 'TRUE')

    list.sort((a, b) => {
      if (sortBy === 'siteNo') return String(a.SiteNo).localeCompare(String(b.SiteNo), undefined, { numeric: true })
      if (sortBy === 'owner') return (a.ownerName || '').localeCompare(b.ownerName || '')
      if (sortBy === 'phase') return String(a.Phase).localeCompare(String(b.Phase))
      if (sortBy === 'status') return (a.payStatus || '').localeCompare(b.payStatus || '')
      return 0
    })
    return list
  }, [sites, activeHeads, payMap, phase, siteType, status, membersOnly, flaggedOnly, sortBy])

  function handleDownload() {
    const headers = [
      'Site No', 'Phase', 'Type', 'Sqft', 'Owner', 'MID', 'Mobile', 'Status', 'Flagged',
      ...activeHeads.flatMap(h => [`${h.HeadName} - Paid (₹)`, `${h.HeadName} - Due (₹)`])
    ]
    const data = rows.map(r => [
      r.SiteNo, r.Phase, r.SiteType || '', r.Sizesqft || '',
      r.ownerName || '', r.membershipNo || '', r.mobile || '',
      STATUS_LABEL[r.payStatus] || r.payStatus || '',
      r.FlaggedForAttention === 'TRUE' ? 'Yes' : 'No',
      ...r.headDues.flatMap(d => [d.paid || 0, d.due ?? ''])
    ])
    downloadCSV([headers, ...data], `sites-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const TH = ({ children, right }) => (
    <th style={{
      padding: '8px 10px', textAlign: right ? 'right' : 'left',
      fontWeight: 500, fontSize: 11, color: 'var(--ink-2)',
      borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
      background: 'var(--surface-2)', position: 'sticky', top: 0
    }}>{children}</th>
  )
  const TD = ({ children, mono, right, bold, color }) => (
    <td style={{
      padding: '7px 10px', textAlign: right ? 'right' : 'left',
      fontWeight: bold ? 600 : 400, fontFamily: mono ? 'var(--mono)' : undefined,
      color: color || 'inherit', whiteSpace: 'nowrap'
    }}>{children}</td>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <FilterChips label="Phase"
          options={[{value:'All',label:'All'},{value:'1',label:'Ph 1'},{value:'2',label:'Ph 2'}]}
          value={phase} onChange={setPhase} />
        <Divider />
        <FilterChips label="Type"
          options={[{value:'All',label:'All'},...['30x40','30x50','40x60','50x80','non-standard'].map(t=>({value:t,label:t}))]}
          value={siteType} onChange={setSiteType} />
        <Divider />
        <FilterChips label="Status"
          options={[{value:'All',label:'All'},{value:'paid',label:'Paid'},{value:'partial',label:'Partial'},{value:'unpaid',label:'Unpaid'},{value:'nocontact',label:'No contact'}]}
          value={status} onChange={setStatus} />
        <Divider />
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={membersOnly} onChange={e => setMembersOnly(e.target.checked)} />
          Members only
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={flaggedOnly} onChange={e => setFlaggedOnly(e.target.checked)} />
          Flagged only
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="input" style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }}
            value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="siteNo">Sort: Site No</option>
            <option value="phase">Sort: Phase</option>
            <option value="owner">Sort: Owner</option>
            <option value="status">Sort: Status</option>
          </select>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{rows.length} sites</span>
          <button className="btn btn-primary btn-sm" onClick={handleDownload} disabled={loading || rows.length === 0}>
            ↓ Download CSV
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
        {loading ? (
          <div className="empty-state"><div className="spin" style={{ margin: '0 auto' }} /></div>
        ) : rows.length === 0 ? (
          <div className="empty-state"><p>No sites match your filters</p></div>
        ) : (
          <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
            <thead>
              <tr>
                <TH>Site No</TH><TH>Phase</TH><TH>Type</TH><TH>Sqft</TH>
                <TH>Owner</TH><TH>MID</TH><TH>Mobile</TH><TH>Status</TH><TH>Flag</TH>
                {activeHeads.map(h => <TH key={h.HeadID} right>{h.HeadName}</TH>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.SiteID} style={{ borderBottom: '1px solid var(--border)' }}>
                  <TD bold>{r.SiteNo}</TD>
                  <TD color="var(--ink-2)">{r.Phase}</TD>
                  <TD color="var(--ink-2)">{r.SiteType || '—'}</TD>
                  <TD color="var(--ink-2)">{r.Sizesqft || '—'}</TD>
                  <TD>{r.ownerName || <span style={{ color: 'var(--ink-3)' }}>—</span>}</TD>
                  <TD mono color="var(--ink-2)">{r.membershipNo || '—'}</TD>
                  <TD color="var(--ink-2)">{r.mobile || '—'}</TD>
                  <TD>
                    <span style={{ color: STATUS_COLOR[r.payStatus] || 'var(--ink-2)', fontWeight: 500 }}>
                      {STATUS_LABEL[r.payStatus] || '—'}
                    </span>
                  </TD>
                  <TD>{r.FlaggedForAttention === 'TRUE' ? '🚩' : ''}</TD>
                  {r.headDues.map(d => (
                    <td key={d.headId} style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {d.expected == null ? (
                        <span style={{ color: 'var(--ink-3)' }}>—</span>
                      ) : (
                        <>
                          <span style={{ fontWeight: 600, color: d.due > 0 ? 'var(--partial)' : 'var(--paid)' }}>
                            {formatCurrency(d.paid)}
                          </span>
                          <span style={{ color: 'var(--ink-3)' }}> / {formatCurrency(d.expected)}</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Payments Report ───────────────────────────────────────────────────────────

function PaymentsReport() {
  const [payments, setPayments] = useState([])
  const [heads, setHeads] = useState([])
  const [loading, setLoading] = useState(true)

  const [headId, setHeadId] = useState('All')
  const [phase, setPhase] = useState('All')
  const [mode, setMode] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('date')

  useEffect(() => {
    setLoading(true)
    Promise.all([getPayments(), getPaymentHeads()])
      .then(([p, h]) => { setPayments(p); setHeads(h) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const headMap = useMemo(() => Object.fromEntries(heads.map(h => [h.HeadID, h.HeadName])), [heads])

  const rows = useMemo(() => {
    let list = [...payments]
    if (headId !== 'All') list = list.filter(p => p.HeadID === headId)
    if (phase !== 'All') list = list.filter(p => String(p.Phase) === phase)
    if (mode !== 'All') list = list.filter(p => p.Mode === mode)
    if (dateFrom) list = list.filter(p => (p.PaymentDate || '') >= dateFrom)
    if (dateTo) list = list.filter(p => (p.PaymentDate || '') <= dateTo)

    list.sort((a, b) => {
      if (sortBy === 'date') return (b.PaymentDate || '') > (a.PaymentDate || '') ? 1 : -1
      if (sortBy === 'amount') return (parseFloat(b.Amount) || 0) - (parseFloat(a.Amount) || 0)
      if (sortBy === 'siteNo') return String(a.SiteNo || '').localeCompare(String(b.SiteNo || ''), undefined, { numeric: true })
      return 0
    })
    return list
  }, [payments, headId, phase, mode, dateFrom, dateTo, sortBy])

  const totalAmount = useMemo(() => rows.reduce((s, p) => s + (parseFloat(p.Amount) || 0), 0), [rows])

  function handleDownload() {
    const headers = ['Date', 'Site No', 'Phase', 'Owner', 'Payment Head', 'Mode', 'Amount (₹)', 'Receipt #', 'Bank ref', 'Recorded by']
    const data = rows.map(p => [
      p.PaymentDate || '', p.SiteNo || '', p.Phase || '', p.OwnerName || '',
      headMap[p.HeadID] || p.HeadID, p.Mode || '', p.Amount || '',
      p.ReceiptNo || '', p.BankRef || '', p.RecordedBy || ''
    ])
    downloadCSV([headers, ...data], `payments-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const TH = ({ children, right }) => (
    <th style={{
      padding: '8px 10px', textAlign: right ? 'right' : 'left',
      fontWeight: 500, fontSize: 11, color: 'var(--ink-2)',
      borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
      background: 'var(--surface-2)', position: 'sticky', top: 0
    }}>{children}</th>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Head</span>
          <select className="input" style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }}
            value={headId} onChange={e => setHeadId(e.target.value)}>
            <option value="All">All heads</option>
            {heads.map(h => <option key={h.HeadID} value={h.HeadID}>{h.HeadName}</option>)}
          </select>
        </div>
        <Divider />
        <FilterChips label="Phase"
          options={[{value:'All',label:'All'},{value:'1',label:'Ph 1'},{value:'2',label:'Ph 2'}]}
          value={phase} onChange={setPhase} />
        <Divider />
        <FilterChips label="Mode"
          options={[{value:'All',label:'All'},{value:'Cash',label:'Cash'},{value:'UPI',label:'UPI'},{value:'Bank transfer',label:'Bank'}]}
          value={mode} onChange={setMode} />
        <Divider />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>From</span>
          <input type="date" className="input" style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }}
            value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>To</span>
          <input type="date" className="input" style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }}
            value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="input" style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }}
            value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="date">Sort: Date ↓</option>
            <option value="amount">Sort: Amount ↓</option>
            <option value="siteNo">Sort: Site No</option>
          </select>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--paid)' }}>{formatCurrency(totalAmount)}</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{rows.length} payments</span>
          <button className="btn btn-primary btn-sm" onClick={handleDownload} disabled={loading || rows.length === 0}>
            ↓ Download CSV
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
        {loading ? (
          <div className="empty-state"><div className="spin" style={{ margin: '0 auto' }} /></div>
        ) : rows.length === 0 ? (
          <div className="empty-state"><p>No payments match your filters</p></div>
        ) : (
          <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
            <thead>
              <tr>
                <TH>Date</TH><TH>Site No</TH><TH>Phase</TH><TH>Owner</TH>
                <TH>Head</TH><TH>Mode</TH><TH right>Amount</TH>
                <TH>Receipt #</TH><TH>Bank ref</TH><TH>Recorded by</TH>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.PaymentID} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 10px', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{formatDate(p.PaymentDate)}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 500, whiteSpace: 'nowrap' }}>{p.SiteNo}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--ink-2)' }}>{p.Phase}</td>
                  <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{p.OwnerName || '—'}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{headMap[p.HeadID] || p.HeadID}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--ink-2)' }}>{p.Mode || '—'}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--paid)', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(p.Amount)}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--ink-2)' }}>{p.ReceiptNo ? `#${p.ReceiptNo}` : '—'}</td>
                  <td style={{ padding: '7px 10px', fontFamily: 'var(--mono)', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{p.BankRef || '—'}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{p.RecordedBy || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
