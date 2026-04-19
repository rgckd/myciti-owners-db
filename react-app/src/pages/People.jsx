import { useState, useEffect, useCallback, useMemo } from 'react'
import { getPeople, getPerson, updatePerson } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { canEdit, initials, formatDate } from '../utils/constants.js'
import IDCard from '../components/IDCard.jsx'

export default function People() {
  const { user } = useAuth()
  const role = user?.role || 'View'
  const [allPeople, setAllPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)   // { person, ownerships }
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showCard, setShowCard] = useState(null)   // ownership row for ID card

  const load = useCallback(async () => {
    setLoading(true)
    try { setAllPeople(await getPeople({})) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const people = useMemo(() => {
    if (!search.trim()) return allPeople
    const q = search.toLowerCase()
    return allPeople.filter(p =>
      (p.FullName && p.FullName.toLowerCase().includes(q)) ||
      (p.Mobile1 && p.Mobile1.includes(q)) ||
      (p.Mobile2 && p.Mobile2.includes(q)) ||
      (p.Email && p.Email.toLowerCase().includes(q))
    )
  }, [allPeople, search])

  async function selectPerson(personId) {
    setLoadingDetail(true)
    try { setSelected(await getPerson(personId)) }
    catch (e) { console.error(e) }
    finally { setLoadingDetail(false) }
  }

  const currentOwned = selected?.ownerships?.filter(o => o.IsCurrent === 'TRUE') || []
  const pastOwned    = selected?.ownerships?.filter(o => o.IsCurrent !== 'TRUE') || []

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <h1 style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Owners</h1>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '6px 10px', width: 240
          }}>
            <button
              onClick={() => setSearch(searchInput)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
            ><SearchIcon /></button>
            <input className="input"
              style={{ border: 'none', background: 'transparent', padding: 0, flex: 1 }}
              placeholder="Name, mobile, email…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setSearch(searchInput)}
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearch('') }}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)' }}
              >✕</button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {loading ? (
            <div className="empty-state"><div className="spin" style={{ margin: '0 auto' }} /></div>
          ) : people.length === 0 ? (
            <div className="empty-state"><p>No results</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {people.map(p => {
                const isSelected = selected?.person?.PersonID === p.PersonID
                return (
                  <div key={p.PersonID}
                    onClick={() => selectPerson(p.PersonID)}
                    style={{
                      padding: '10px 12px', borderRadius: 'var(--radius-md)',
                      cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center',
                      background: isSelected ? 'var(--tc-light)' : 'transparent',
                      borderBottom: '1px solid var(--border)',
                    }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: isSelected ? 'var(--tc)' : 'var(--surface-3)',
                      color: isSelected ? '#fff' : 'var(--ink-2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 600
                    }}>{initials(p.FullName)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: isSelected ? 'var(--tc-dark)' : 'var(--ink)' }}>
                        {p.FullName || '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                        {p.Mobile1 || ''}{p.Mobile1 && p.Email ? ' · ' : ''}{p.Email || ''}
                        {!p.Mobile1 && !p.Email && <span style={{ color: 'var(--nocontact)' }}>No contact info</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'right' }}>
                      {/* site count comes from ownerships — not available in list, skip */}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {(selected || loadingDetail) && (
        <div style={{
          width: 380, borderLeft: '1px solid var(--border)',
          background: 'var(--surface)', display: 'flex', flexDirection: 'column',
          height: '100%', overflow: 'hidden', flexShrink: 0
        }}>
          {loadingDetail ? (
            <div className="empty-state" style={{ marginTop: 60 }}>
              <div className="spin" style={{ margin: '0 auto' }} />
            </div>
          ) : selected && (
            <>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--tc-light)', color: 'var(--tc-dark)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700
                  }}>{initials(selected.person.FullName)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{selected.person.FullName || '—'}</div>
                    {selected.person.Mobile1 && (
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{selected.person.Mobile1}</div>
                    )}
                    {selected.person.Email && (
                      <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{selected.person.Email}</div>
                    )}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
                {/* Contact details */}
                <div style={{ marginBottom: 16 }}>
                  <div className="label" style={{ marginBottom: 8 }}>Contact details</div>
                  <div className="card" style={{ padding: '10px 12px' }}>
                    {[
                      ['Mobile', selected.person.Mobile1],
                      ['Alt mobile', selected.person.Mobile2],
                      ['Email', selected.person.Email],
                      ['Address', selected.person.Address],
                    ].filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '3px 0' }}>
                        <span style={{ color: 'var(--ink-3)', minWidth: 64 }}>{k}</span>
                        <span style={{ color: 'var(--ink)', wordBreak: 'break-all' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Current sites */}
                <div style={{ marginBottom: 16 }}>
                  <div className="label" style={{ marginBottom: 8 }}>
                    Current sites ({currentOwned.length})
                  </div>
                  {currentOwned.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>No current ownership</div>
                  ) : currentOwned.map(o => (
                    <div key={o.OwnerID} style={{
                      padding: '10px 12px', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)', marginBottom: 6,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                    }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>
                          Site {o.site?.SiteNo} — Phase {o.site?.Phase}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                          {o.MembershipNo
                            ? <span className="mono">{o.MembershipNo}</span>
                            : 'Non-member'
                          }
                          {o.MemberSince && ` · Since ${formatDate(o.MemberSince)}`}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                          {o.site?.SiteType} · {o.site?.Sizesqft ? `${o.site.Sizesqft} sqft` : ''}
                        </div>
                      </div>
                      {o.MembershipNo && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setShowCard(o)}
                          style={{ fontSize: 11 }}
                        >
                          ID card
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Past ownership */}
                {pastOwned.length > 0 && (
                  <details>
                    <summary style={{ fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer', marginBottom: 8 }}>
                      Past ownership ({pastOwned.length})
                    </summary>
                    {pastOwned.map(o => (
                      <div key={o.OwnerID} style={{
                        padding: '6px 10px', fontSize: 12, color: 'var(--ink-2)',
                        borderBottom: '1px solid var(--border)'
                      }}>
                        Site {o.site?.SiteNo} Phase {o.site?.Phase} ·
                        {o.OwnershipStartDate ? ` From ${formatDate(o.OwnershipStartDate)}` : ''}
                        {o.OwnershipEndDate ? ` to ${formatDate(o.OwnershipEndDate)}` : ''}
                      </div>
                    ))}
                  </details>
                )}

                {/* Notes */}
                {selected.person.Notes && (
                  <div style={{ marginTop: 16 }}>
                    <div className="label" style={{ marginBottom: 4 }}>Notes</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                      {selected.person.Notes}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ID Card modal */}
      {showCard && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
            padding: 24, maxWidth: 520, width: '100%',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontWeight: 600 }}>Membership ID Card</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCard(null)}>✕</button>
            </div>
            <IDCard ownership={showCard} person={selected?.person} />
          </div>
        </div>
      )}
    </div>
  )
}

function SearchIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="var(--ink-3)" strokeWidth="1.4"/><path d="M11 11l3 3" stroke="var(--ink-3)" strokeWidth="1.4" strokeLinecap="round"/></svg>
}
