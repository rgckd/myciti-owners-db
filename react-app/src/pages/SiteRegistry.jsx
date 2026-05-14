import { useState, useEffect, useMemo, useCallback } from 'react'
import { getSites, getArchivedSites, getStats, createSite, unarchiveSite } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canFlag, SITE_TYPES, SITE_TYPE_SQFT, toDateInput } from '../utils/constants.js'
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
let _archivedSitesCache = []
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
  const [showAddSite, setShowAddSite] = useState(false)
  const [addingSite, setAddingSite] = useState(false)
  const [siteForm, setSiteForm] = useState({ siteNo: '', phase: '1', released: 'FALSE', siteType: '', sizesqft: '', regDate: '' })
  const [siteError, setSiteError] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  // Sort (up to 3 levels)
  const [sorts, setSorts] = useState([{ field: 'Phase', dir: 'asc' }, { field: 'SiteNo', dir: 'asc' }])

  function commitSearch() { setSearch(searchInput) }

  const load = useCallback(async () => {
    const activeView = !showArchived
    const cache = activeView ? _sitesCache : _archivedSitesCache
    if (cache.length === 0) setLoading(true)
    try {
      if (activeView) {
        const [sitesData, statsData] = await Promise.all([getSites(), getStats()])
        _sitesCache = sitesData
        _statsCache = statsData
        setSites(sitesData)
        setStats(statsData)
      } else {
        const archivedData = await getArchivedSites()
        _archivedSitesCache = archivedData
        setSites(archivedData)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [showArchived])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (role !== 'Admin' && showArchived) setShowArchived(false)
  }, [role, showArchived])

  const filtered = useMemo(() => {
    let list = [...sites]
    if (showArchived) {
      if (search) {
        const q = search.toLowerCase()
        list = list.filter(s =>
          String(s.SiteNo).toLowerCase().includes(q) ||
          (s.ownerName && s.ownerName.toLowerCase().includes(q)) ||
          (s.membershipNo && String(s.membershipNo).toLowerCase().includes(q)) ||
          (s.mobile && String(s.mobile).includes(q))
        )
      }
      list.sort((a, b) => {
        const an = parseInt(String(a.SiteNo || '')) || 0
        const bn = parseInt(String(b.SiteNo || '')) || 0
        if (an !== bn) return an - bn
        return String(a.SiteNo || '').localeCompare(String(b.SiteNo || ''))
      })
      return list
    }
    if (phase !== 'All') list = list.filter(s => String(s.Phase) === phase)
    if (memberFilter === 'members') list = list.filter(s => !!s.membershipNo)
    if (memberFilter === 'non-members') list = list.filter(s => !s.membershipNo)
    if (payFilter) list = list.filter(s => {
      const effective = s.payStatus === 'nocontact' ? 'unpaid' : s.payStatus
      return effective === payFilter
    })
    const anyFlagFilter = flagFilters.noPhone || flagFilters.followUp || flagFilters.issue
    if (anyFlagFilter) list = list.filter(s =>
      (flagFilters.noPhone && !s.mobile) ||
      (flagFilters.followUp && s.hasOpenFollowUp) ||
      (flagFilters.issue && s.FlaggedForAttention === 'TRUE')
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
  }, [sites, phase, search, memberFilter, payFilter, flagFilters, sorts, showArchived])

  const flaggedCount = useMemo(() =>
    sites.filter(s => !s.mobile || s.hasOpenFollowUp || s.FlaggedForAttention === 'TRUE').length,
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

  function openAddSite() {
    setSiteForm({ siteNo: '', phase: '1', released: 'FALSE', siteType: '', sizesqft: '', regDate: '' })
    setSiteError('')
    setShowAddSite(true)
  }

  async function handleAddSite() {
    if (!siteForm.siteNo.trim()) {
      setSiteError('Site number is required')
      return
    }
    if (!siteForm.phase.trim()) {
      setSiteError('Phase is required')
      return
    }
    if (!siteForm.siteType) {
      setSiteError('Site type is required')
      return
    }
    const sqft = siteForm.siteType !== 'non-standard'
      ? (SITE_TYPE_SQFT[siteForm.siteType] || '')
      : siteForm.sizesqft.trim()
    if (siteForm.siteType === 'non-standard' && !sqft) {
      setSiteError('Size (sqft) is required for non-standard sites')
      return
    }

    setAddingSite(true)
    setSiteError('')
    try {
      await createSite({
        siteNo: siteForm.siteNo.trim(),
        phase: siteForm.phase.trim(),
        released: siteForm.released,
        siteType: siteForm.siteType,
        sizesqft: String(sqft || ''),
        regDate: toDateInput(siteForm.regDate) || siteForm.regDate,
      })
      setShowAddSite(false)
      await load()
    } catch (e) {
      setSiteError(e.message || 'Failed to add site')
    } finally {
      setAddingSite(false)
    }
  }

  async function handleUnarchiveSite(siteId, siteNo) {
    if (!window.confirm(`Unarchive site ${siteNo}?`)) return
    try {
      await unarchiveSite(siteId)
      _archivedSitesCache = _archivedSitesCache.filter(s => s.SiteID !== siteId)
      _sitesCache = []
      await load()
    } catch (e) {
      window.alert(e.message || 'Failed to unarchive site')
    }
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
          {role === 'Admin' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                className={`btn btn-sm ${showArchived ? 'btn-ghost' : ''}`}
                style={!showArchived ? { background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)' } : {}}
                onClick={() => setShowArchived(false)}
              >
                Active sites
              </button>
              <button
                className={`btn btn-sm ${showArchived ? '' : 'btn-ghost'}`}
                style={showArchived ? { background: 'var(--tc-light)', color: 'var(--tc)', borderColor: 'var(--tc-mid)' } : {}}
                onClick={() => setShowArchived(true)}
              >
                Archived sites
              </button>
            </div>
          )}
          {role === 'Admin' && (
            <button className="btn btn-primary btn-sm" onClick={openAddSite} disabled={showArchived} title={showArchived ? 'Switch to Active sites to add a site' : ''}>
              + Add site
            </button>
          )}
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
        {!showArchived && stats && (
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
        {!showArchived && (
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
        )}

        {/* Sort controls */}
        {!showArchived && (
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
        )}

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
              {showArchived
                ? filtered.map(site => (
                  <div key={site.SiteID} className="card" style={{ border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Site {site.SiteNo}</div>
                      <span className="badge badge-nonmember">Archived</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Phase {site.Phase || '—'} · {site.SiteType || '—'}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink)' }}>{site.ownerName || 'No owner data'}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm" onClick={() => handleUnarchiveSite(site.SiteID, site.SiteNo)}>
                        Unarchive
                      </button>
                    </div>
                  </div>
                ))
                : filtered.map(site => (
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
      {selectedSiteId && !showArchived && (
        <SitePanel
          siteId={selectedSiteId}
          onClose={() => setSelectedSiteId(null)}
          onRefresh={load}
          role={role}
        />
      )}

      {showAddSite && role === 'Admin' && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: 420, border: '1px solid var(--border)'
          }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600 }}>Add site</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddSite(false)}>✕</button>
            </div>
            <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                Site no *
                <input className="input" value={siteForm.siteNo} onChange={e => setSiteForm(f => ({ ...f, siteNo: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                Phase *
                <input className="input" value={siteForm.phase} onChange={e => setSiteForm(f => ({ ...f, phase: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                Site type *
                <select className="input" value={siteForm.siteType} onChange={e => setSiteForm(f => ({ ...f, siteType: e.target.value, sizesqft: SITE_TYPE_SQFT[e.target.value] || (e.target.value === 'non-standard' ? f.sizesqft : '') }))}>
                  <option value="">— select —</option>
                  {SITE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                Released
                <select className="input" value={siteForm.released} onChange={e => setSiteForm(f => ({ ...f, released: e.target.value }))}>
                  <option value="FALSE">No</option>
                  <option value="TRUE">Yes</option>
                </select>
              </label>
              {siteForm.siteType === 'non-standard' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  Size (sqft) *
                  <input className="input" type="number" value={siteForm.sizesqft} onChange={e => setSiteForm(f => ({ ...f, sizesqft: e.target.value }))} />
                </label>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                Registration date
                <input className="input" type="date" value={siteForm.regDate} onChange={e => setSiteForm(f => ({ ...f, regDate: e.target.value }))} />
              </label>
              {siteError && (
                <div style={{ gridColumn: '1 / -1', fontSize: 12, padding: '10px 12px', background: 'var(--disputed-bg)', color: 'var(--disputed)', borderRadius: 'var(--radius-md)' }}>
                  {siteError}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowAddSite(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={addingSite} onClick={handleAddSite}>
                {addingSite ? 'Adding…' : 'Add site'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function SearchIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="var(--ink-3)" strokeWidth="1.4"/><path d="M11 11l3 3" stroke="var(--ink-3)" strokeWidth="1.4" strokeLinecap="round"/></svg>
}
