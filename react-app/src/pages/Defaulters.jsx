import { useState, useEffect } from 'react'
import { getDefaulters, getPaymentHeads } from '../utils/api.js'
import { formatCurrency, formatDate } from '../utils/constants.js'

export default function Defaulters() {
  const [defaulters, setDefaulters] = useState([])
  const [heads, setHeads] = useState([])
  const [selectedHead, setSelectedHead] = useState('')
  const [selectedPhase, setSelectedPhase] = useState('')
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('outstanding')

  async function load() {
    setLoading(true)
    try {
      const [d, h] = await Promise.all([
        getDefaulters({ headId: selectedHead, phase: selectedPhase, sortBy }),
        getPaymentHeads()
      ])
      setDefaulters(d)
      setHeads(h.filter(x => x.IsActive === 'TRUE'))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [selectedHead, selectedPhase, sortBy])

  const sizeMissing = defaulters.filter(d => d.status === 'size_missing')
  const actual = defaulters.filter(d => d.status !== 'size_missing')

  function exportCsv() {
    const rows = [
      ['Site No', 'Phase', 'Type', 'Sqft', 'Owner', 'Mobile', 'Head', 'Expected', 'Paid', 'Outstanding', 'Last Call'],
      ...actual.map(d => [
        d.siteNo, d.phase, d.siteType, d.sizesqft,
        d.ownerName, d.mobile, d.headName,
        d.expected, d.paid, d.outstanding,
        d.lastCallDate || ''
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `defaulters_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0
      }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Defaulters</h1>
        <button className="btn btn-sm" onClick={exportCsv}>↓ Export CSV</button>
      </div>

      {/* Filters */}
      <div style={{
        padding: '8px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0,
        flexWrap: 'wrap'
      }}>
        <div>
          <select className="input" style={{ width: 'auto' }}
            value={selectedHead} onChange={e => setSelectedHead(e.target.value)}>
            <option value="">All heads</option>
            {heads.map(h => <option key={h.HeadID} value={h.HeadID}>{h.HeadName}</option>)}
          </select>
        </div>
        <select className="input" style={{ width: 'auto' }}
          value={selectedPhase} onChange={e => setSelectedPhase(e.target.value)}>
          <option value="">All phases</option>
          <option value="1">Phase 1</option>
          <option value="2">Phase 2</option>
        </select>
        <select className="input" style={{ width: 'auto' }}
          value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="outstanding">Sort: Outstanding (high)</option>
          <option value="lastCallDate">Sort: Oldest contact first</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading ? (
          <div className="empty-state"><div className="spin" style={{ margin: '0 auto' }} /></div>
        ) : actual.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 32 }}>✓</div>
            <p>No defaulters for current filters</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Summary */}
            <div style={{
              padding: '10px 14px', background: 'var(--partial-bg)',
              borderRadius: 'var(--radius-md)', marginBottom: 14,
              display: 'flex', gap: 20
            }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--partial)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Defaulters</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--partial)' }}>{actual.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--partial)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total outstanding</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--partial)' }}>
                  {formatCurrency(actual.reduce((s, d) => s + (d.outstanding || 0), 0))}
                </div>
              </div>
            </div>

            {actual.map((d, i) => (
              <div key={i} style={{
                padding: '12px 0', borderBottom: '1px solid var(--border)',
                display: 'grid',
                gridTemplateColumns: '80px 1fr 1fr 120px',
                gap: 12, alignItems: 'start'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Site {d.siteNo}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Phase {d.phase}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{d.siteType}</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{d.ownerName}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{d.mobile}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{d.headName}</div>
                </div>
                <div>
                  {d.lastCallDate ? (
                    <>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{formatDate(d.lastCallDate)}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                        {d.lastCallSummary?.slice(0, 60)}{d.lastCallSummary?.length > 60 ? '…' : ''}
                      </div>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>No call logged</span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--partial)' }}>
                    {formatCurrency(d.outstanding)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                    {formatCurrency(d.paid)} paid
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    of {formatCurrency(d.expected)}
                  </div>
                  <span className={`badge ${d.status === 'partial' ? 'badge-partial' : 'badge-unpaid'}`} style={{ marginTop: 4 }}>
                    {d.status}
                  </span>
                </div>
              </div>
            ))}

            {sizeMissing.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 8 }}>
                  Sites excluded — size data missing ({sizeMissing.length})
                </div>
                {sizeMissing.map((d, i) => (
                  <div key={i} style={{
                    padding: '8px 12px', borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-3)', marginBottom: 6,
                    display: 'flex', justifyContent: 'space-between', fontSize: 12
                  }}>
                    <span>Site {d.siteNo} — {d.ownerName} · {d.headName}</span>
                    <span style={{ color: 'var(--ink-3)' }}>Enter Sizesqft to include</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
