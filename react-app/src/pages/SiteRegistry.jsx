import { useState, useEffect, useMemo, useCallback } from 'react'
import { getSites, getStats } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canFlag } from '../utils/constants.js'
import SiteCard from '../components/SiteCard.jsx'
import SitePanel from '../components/SitePanel.jsx'

const SORT_FIELDS = [
  { value: 'SiteNo', label: 'Site No' },
  { value: 'Phase', label: 'Phase' },
  { value: 'OwnerName', label: 'Owner name' },
  { value: 'Status', label: 'Status' },
]

// Module-level cache — survives navigation, avoids reload on back-nav
let _sitesCache = []
let _statsCache = null
export function getSitesCache() { return _sitesCache }

export default function SiteRegistry() {
  const { user } = useAuth()
  const role = user?.role || 'View'

  const [sites, setSites] = useState(_sitesCache)
  const [stats, setStats] = useState(_statsCache)
  const [loading, setLoading] = useState(_sitesCache.length === 0)
  const [selectedSiteId, setSelectedSiteId] = useState(null)

  // Filters
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [phase, setPhase] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [memberFilter, setMemberFilter] = useState('all') // 'all' | 'members' | 'non-members'
  const [payFilter, setPayFilter] = useState('')          // '' | 'paid' | 'partial' | 'unpaid'
  const [flagFilters, setFlagFilters] = useState({ noPhone: false, followUp: false, issue: false })

  // Sort (up to 3 levels)
  const [sorts, setSorts] = useState([{ field: 'Phase', dir: 'asc' }, { field: 'SiteNo', dir: 'asc' }])

  function commitSearch() { setSearch(searchInput) }

  const load = useCallback(async () => {
    if (_sitesCache.length === 0) setLoading(true)
    try {
      const [sitesData, statsData] = await Promise.all([getSites(), getStats()])
      _sitesCache = sitesData
      _statsCache = statsData
      setSites(sitesData)
      setStats(statsData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let list = [...sites]
    if (phase !== 'All') list = list.filter(s => String(s.Phase) === phase)
    if (memberFilter === 'members') list = list.filter(s => !!s.membershipNo)
    if (memberFilter === 'non-members') list = list.filter(s => !s.membershipNo)
    if (payFilter) list = list.filter(s => s.payStatus === payFilter)
    const anyFlagFilter = flagFilters.noPhone || flagFilters.followUp || flagFilters.issue
    if (anyFlagFilter) list = list.filter(s =>
      (flagFilters.noPhone && !s.mobile) ||
      (flagFilters.followUp && s.hasOpenFollowUp) ||
      (flagFilters.issue && (s.FlaggedForAttention === 'TRUE' || s.ownerFlagged === true))
    )
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        String(s.SiteNo).toLowerCase().includes(q) ||
        (s.ownerName && s.ownerName.toLowerCase().includes(q)) ||
        (s.membershipNo && String(s.membershipNo).toLowerCase().includes(q)) ||
        (s.mobile && String(s.mobile).includes(q))
      )
    }

    // Sort
    list.sort((a, b) => {
      for (const { field, dir } of sorts) {
        const av = String(a[field] || '').toLowerCase()
        const bv = String(b[field] || '').toLowerCase()
        if (field === 'SiteNo') {
          const an = parseInt(av) || 0, bn = parseInt(bv) || 0
          if (an !== bn) return dir === 'asc' ? an - bn : bn - an
        }
        if (av < bv) return dir === 'asc' ? -1 : 1
        if (av > bv) return dir === 'asc' ? 1 : -1
      }
      return 0
    })
    return list
  }, [sites, phase, search, memberFilter, payFilter, flagFilters, sorts])

  const flaggedCount = useMemo(() =>
    sites.filter(s => !s.mobile || s.hasOpenFollowUp || s.FlaggedForAttention === 'TRUE' || s.ownerFlagged).length,
  [sites])

  function addSort() {
    if (sorts.length >= 3) return
    setSorts(s => [...s, { field: 'Phase', dir: 'asc' }])
  }
  function updateSort(i, key, val) {
    setSorts(s => s.map((item, idx) => idx === i ? { ...item, [key]: val } : item))
  }
  function removeSort(i) {
    setSorts(s => s.filter((_, idx) => idx !== i))
  }

  const selectedSite = sites.find(s => s.SiteID === selectedSiteId)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Main list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{
          padding: '12px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0
        }}>
          <h1 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>Site Registry</h1>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '6px 12px',
            width: 240
          }}>
            <button
              onClick={commitSearch}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
            ><SearchIcon /></button>
            <input
              className="input"
              style={{ border: 'none', background: 'transparent', padding: 0, flex: 1 }}
              placeholder="Site, owner, MID, mobile…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && commitSearch()}
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearch('') }}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)' }}
              >✕</button>
            )}
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div style={{
            display: 'flex', gap: 0,
            borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)'
          }}>
            {[
              { label: 'Total sites', value: stats.totalSites },
              { label: 'Members', value: stats.totalMembers },
              { label: 'Flagged', value: flaggedCount },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '10px 20px', borderRight: '1px solid var(--border)'
              }}>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter bar */}
        <div style={{
          padding: '8px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0
        }}>
          {/* Phase */}
          {['1', '2'].map(p => (
            <button key={p}
              className={`btn btn-sm ${phase === p ? '' : 'btn-ghost'}`}
              style={phase === p ? { background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)' } : {}}
              onClick={() => setPhase(cur => cur === p ? 'All' : p)}
            >{`Phase ${p}`}</button>
          ))}
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          {/* Membership — toggle on/off */}
          {[['members','Members'],['non-members','Non-members']].map(([val, label]) => (
            <button key={val}
              className={`btn btn-sm ${memberFilter === val ? '' : 'btn-ghost'}`}
              style={memberFilter === val ? { background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)' } : {}}
              onClick={() => setMemberFilter(f => f === val ? 'all' : val)}
            >{label}</button>
          ))}
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          {/* Payment status */}
          {[['paid','Paid'],['unpaid','Dues'],['partial','Default']].map(([val, label]) => (
            <button key={val}
              className={`btn btn-sm ${payFilter === val ? '' : 'btn-ghost'}`}
              style={payFilter === val ? { background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)' } : {}}
              onClick={() => setPayFilter(f => f === val ? '' : val)}
            >{label}</button>
          ))}
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          {/* Flagged sub-filters */}
          {[
            ['noPhone',  '📵 No phone'],
            ['followUp', '🔔 Follow-up'],
            ['issue',    '🚩 Issue'],
          ].map(([key, label]) => (
            <button key={key}
              className={`btn btn-sm ${flagFilters[key] ? '' : 'btn-ghost'}`}
              style={flagFilters[key] ? { background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)' } : {}}
              onClick={() => setFlagFilters(f => ({ ...f, [key]: !f[key] }))}
            >{label}</button>
          ))}
        </div>

        {/* Sort controls */}
        <div style={{
          padding: '6px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0,
          background: 'var(--surface-2)'
        }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Sort:</span>
          {sorts.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {i > 0 && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>then</span>}
              <select
                className="input"
                style={{ padding: '3px 6px', width: 'auto', fontSize: 12 }}
                value={s.field}
                onChange={e => updateSort(i, 'field', e.target.value)}
              >
                {SORT_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <select
                className="input"
                style={{ padding: '3px 6px', width: 'auto', fontSize: 12 }}
                value={s.dir}
                onChange={e => updateSort(i, 'dir', e.target.value)}
              >
                <option value="asc">A→Z</option>
                <option value="desc">Z→A</option>
              </select>
              {i > 0 && (
                <button className="btn-ghost" style={{ padding: '2px 6px', fontSize: 12, color: 'var(--ink-3)' }} onClick={() => removeSort(i)}>✕</button>
              )}
            </div>
          ))}
          {sorts.length < 3 && (
            <button className="btn btn-ghost btn-sm" onClick={addSort} style={{ fontSize: 12 }}>+ Add level</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>
            {filtered.length} site{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <div className="empty-state"><div className="spin" style={{ margin: '0 auto' }} /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 32 }}>🏘</div>
              <p>No sites match your filters</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 10
            }}>
              {filtered.map(site => (
                <SiteCard
                  key={site.SiteID}
                  site={site}
                  selected={selectedSiteId === site.SiteID}
                  onClick={() => setSelectedSiteId(
                    selectedSiteId === site.SiteID ? null : site.SiteID
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Side panel */}
      {selectedSiteId && (
        <SitePanel
          siteId={selectedSiteId}
          onClose={() => setSelectedSiteId(null)}
          onRefresh={load}
          role={role}
        />
      )}

    </div>
  )
}

function SearchIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="var(--ink-3)" strokeWidth="1.4"/><path d="M11 11l3 3" stroke="var(--ink-3)" strokeWidth="1.4" strokeLinecap="round"/></svg>
}
