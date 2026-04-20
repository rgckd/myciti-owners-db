import { useState, useEffect, useCallback, useRef } from 'react'
import { getSite, getPayments, getPaymentHeads, getCallLog, flagSite, updatePerson, updateOwner, createOwner, getPeople, createCallLog, markFollowUpDone } from '../utils/api.js'
import { canEdit, canFlag, formatCurrency, formatDate, initials, toDateInput } from '../utils/constants.js'
import PaymentModal from './PaymentModal.jsx'
import TransferModal from './TransferModal.jsx'

const TABS = ['Overview', 'Dues', 'Payments', 'Call log', 'Attachments']

export default function SitePanel({ siteId, onClose, onRefresh, role }) {
  const [tab, setTab] = useState('Overview')
  const [data, setData] = useState(null)
  const [payments, setPayments] = useState([])
  const [heads, setHeads] = useState([])
  const [callLog, setCallLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPayment, setShowPayment] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showAddCoOwner, setShowAddCoOwner] = useState(false)
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [pendingFlag, setPendingFlag] = useState(null)
  const [flagComment, setFlagComment] = useState('')
  const [flagSaving, setFlagSaving] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [followup, setFollowup] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [siteData, paysData, headsData, logsData] = await Promise.all([
        getSite(siteId),
        getPayments({ siteId }),
        getPaymentHeads(),
        getCallLog({ siteId }),
      ])
      setData(siteData)
      setPayments(paysData)
      setHeads(headsData)
      setCallLog(logsData)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [siteId])

  useEffect(() => { load() }, [load])

  const dues = heads
    .filter(h => h.IsActive === 'TRUE')
    .map(h => {
      const sitePays = payments.filter(p => p.HeadID === h.HeadID)
      const paid = sitePays.reduce((s, p) => s + Number(p.Amount || 0), 0)
      const site = data?.site
      let expected = null
      let sizeMissing = false
      if (h.AmountType === 'Flat') {
        expected = Number(h.ExpectedAmountFlat || 0)
      } else if (site?.Sizesqft) {
        expected = Number(h.ExpectedAmountPerSqft || 0) * Number(site.Sizesqft)
      } else {
        sizeMissing = true
      }
      const outstanding = expected != null ? expected - paid : null
      return {
        headId: h.HeadID, headName: h.HeadName, amountType: h.AmountType,
        expected, paid, outstanding, sizeMissing,
        status: sizeMissing ? 'size_missing' : outstanding <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
        payments: sitePays
      }
    })

  function openFlagModal(flag) {
    setPendingFlag(flag)
    setFlagComment('')
    setShowFlagModal(true)
  }

  async function handleFlagConfirm() {
    if (!flagComment.trim()) return
    setFlagSaving(true)
    try {
      await flagSite(siteId, pendingFlag, flagComment.trim())
      setShowFlagModal(false)
      load()
    } finally { setFlagSaving(false) }
  }

  async function handleSaveNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      await createCallLog({
        siteId,
        ownerId: data?.currentOwners?.[0]?.OwnerID || '',
        summary: noteText,
        followUpAction: followup,
      })
      setNoteText(''); setFollowup('')
      load()
    } finally { setSavingNote(false) }
  }

  if (loading) return (
    <PanelShell onClose={onClose}>
      <div className="empty-state"><div className="spin" style={{ margin: '0 auto' }} /></div>
    </PanelShell>
  )
  if (!data) return null

  const { site, currentOwners, pastOwners } = data
  const isFlagged = site.FlaggedForAttention === 'TRUE'

  return (
    <PanelShell onClose={onClose}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
            Site {site.SiteNo} — Phase {site.Phase}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[site.SiteType, site.Sizesqft ? `${site.Sizesqft} sqft` : null, site.RegDate ? `Reg: ${formatDate(site.RegDate)}` : null]
            .filter(Boolean).map((t, i) => (
              <span key={i} style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 999,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--ink-2)'
              }}>{t}</span>
          ))}
          {isFlagged && (
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 999,
              background: 'var(--tc-light)', color: 'var(--tc)', border: '1px solid var(--tc-mid)'
            }}>🚩 Flagged</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '10px 4px', fontSize: 12, fontWeight: tab === t ? 500 : 400,
              color: tab === t ? 'var(--tc)' : 'var(--ink-2)',
              borderBottom: tab === t ? '2px solid var(--tc)' : '2px solid transparent',
              transition: 'color 0.1s',
            }}
          >{t}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {tab === 'Overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Flag toggle */}
            {canFlag(role) && (
              <div style={{
                padding: '10px 12px', borderRadius: 'var(--radius-md)',
                border: `1px solid ${isFlagged ? 'var(--tc-mid)' : 'var(--border)'}`,
                background: isFlagged ? 'var(--tc-light)' : 'var(--surface-2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: isFlagged ? 'var(--tc)' : 'var(--ink-2)' }}>
                    {isFlagged ? `🚩 Flagged — ${site.FlagComment || 'No comment'}` : 'Flag for attention'}
                  </span>
                  <button
                    className={`btn btn-sm ${isFlagged ? '' : 'btn-ghost'}`}
                    style={isFlagged ? { background: 'var(--tc)', color: '#fff', borderColor: 'var(--tc)' } : {}}
                    onClick={() => openFlagModal(!isFlagged)}
                  >
                    {isFlagged ? 'Clear flag' : '🚩 Flag'}
                  </button>
                </div>
                {isFlagged && site.FlaggedBy && (
                  <div style={{ fontSize: 11, color: 'var(--tc-dark)', marginTop: 4 }}>
                    Flagged by {site.FlaggedBy} · {formatDate(site.FlaggedAt)}
                  </div>
                )}
              </div>
            )}

            {/* Current owners */}
            <div>
              <div className="label">Current owner{currentOwners.length > 1 ? 's' : ''}</div>
              {currentOwners.length === 0 ? (
                <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>No owner recorded</div>
              ) : currentOwners.map(o => (
                <OwnerRow key={o.OwnerID} owner={o} role={role} onRefresh={load} />
              ))}
              {canEdit(role, 'owners') && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowTransfer(true)}>
                    Transfer ownership
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAddCoOwner(true)}>+ Add co-owner</button>
                </div>
              )}
            </div>

            {/* Ownership history */}
            {pastOwners.length > 0 && (
              <details>
                <summary style={{ fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer', marginBottom: 8 }}>
                  Ownership history ({pastOwners.length})
                </summary>
                {pastOwners.map(o => (
                  <div key={o.OwnerID} style={{
                    padding: '8px 0', borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', fontSize: 12
                  }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{o.person?.FullName || '—'}</div>
                      <div style={{ color: 'var(--ink-3)' }}>{o.MembershipNo || 'Non-member'}</div>
                    </div>
                    <div style={{ color: 'var(--ink-3)', textAlign: 'right', fontSize: 11 }}>
                      <div>{formatDate(o.OwnershipStartDate) || '—'} →</div>
                      <div>{formatDate(o.OwnershipEndDate) || '—'}</div>
                    </div>
                  </div>
                ))}
              </details>
            )}
          </div>
        )}

        {tab === 'Dues' && (
          <div>
            {dues.length === 0 ? (
              <div className="empty-state"><p>No active payment heads</p></div>
            ) : dues.map(d => (
              <DuesRow key={d.headId} due={d} />
            ))}
            {canEdit(role, 'payments') && (
              <button className="btn btn-primary btn-sm" style={{ marginTop: 14, width: '100%' }}
                onClick={() => setShowPayment(true)}>
                + Record payment
              </button>
            )}
          </div>
        )}

        {tab === 'Payments' && (
          <div>
            {payments.length === 0 ? (
              <div className="empty-state"><p>No payments recorded</p></div>
            ) : payments.map(p => {
              const head = heads.find(h => h.HeadID === p.HeadID)
              return (
                <div key={p.PaymentID} style={{
                  padding: '10px 0', borderBottom: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{head?.HeadName || p.HeadID}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                        {formatDate(p.PaymentDate)} · {p.Mode || '—'} · {p.ReceiptNo ? `#${p.ReceiptNo}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--paid)' }}>
                        {formatCurrency(p.Amount)}
                      </div>
                      {p.BankRef && (
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
                          {p.BankRef}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                    Recorded by {p.RecordedBy} · {formatDate(p.RecordedAt)}
                  </div>
                </div>
              )
            })}
            {canEdit(role, 'payments') && (
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12, width: '100%' }}
                onClick={() => setShowPayment(true)}>
                + Record payment
              </button>
            )}
          </div>
        )}

        {tab === 'Call log' && (
          <div>
            {/* Add note form */}
            {canEdit(role, 'calllog') && (
              <div style={{
                padding: '12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', background: 'var(--surface-2)', marginBottom: 14
              }}>
                <div className="label">Add note</div>
                <textarea
                  className="input"
                  style={{ resize: 'vertical', minHeight: 72, marginBottom: 8 }}
                  placeholder="What was discussed…"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                />
                <input
                  className="input"
                  style={{ marginBottom: 8 }}
                  placeholder="Follow-up action (optional)"
                  value={followup}
                  onChange={e => setFollowup(e.target.value)}
                />
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!noteText.trim() || savingNote}
                  onClick={handleSaveNote}
                >
                  {savingNote ? 'Saving…' : 'Save note'}
                </button>
              </div>
            )}

            {callLog.length === 0 ? (
              <div className="empty-state"><p>No call notes yet</p></div>
            ) : callLog.map(log => (
              <LogEntry key={log.LogID} log={log} onDone={() => { markFollowUpDone(log.LogID).then(load) }} role={role} />
            ))}
          </div>
        )}

        {tab === 'Attachments' && (
          <div>
            {!site.AttachmentURLs && (
              <div className="empty-state"><p>No attachments yet</p></div>
            )}
            {canEdit(role, 'owners') && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
                + Upload file
              </button>
            )}
          </div>
        )}
      </div>

      {showPayment && (
        <PaymentModal
          siteId={siteId}
          siteNo={site.SiteNo}
          owners={currentOwners}
          onClose={() => setShowPayment(false)}
          onSaved={() => { setShowPayment(false); load() }}
          role={role}
        />
      )}

      {showTransfer && (
        <TransferModal
          siteId={siteId}
          fromOwner={currentOwners[0]}
          onClose={() => setShowTransfer(false)}
          onSaved={() => { setShowTransfer(false); load(); onRefresh() }}
        />
      )}

      {showFlagModal && (
        <FlagModal
          flagging={pendingFlag}
          comment={flagComment}
          saving={flagSaving}
          onChange={setFlagComment}
          onConfirm={handleFlagConfirm}
          onCancel={() => setShowFlagModal(false)}
        />
      )}

      {showAddCoOwner && (
        <AddCoOwnerModal
          siteId={siteId}
          onClose={() => setShowAddCoOwner(false)}
          onSaved={() => { setShowAddCoOwner(false); load() }}
        />
      )}
    </PanelShell>
  )
}

function PanelShell({ children, onClose }) {
  return (
    <div style={{
      width: 'var(--panel-w)', borderLeft: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column',
      height: '100%', flexShrink: 0, overflow: 'hidden'
    }}>
      {children}
    </div>
  )
}

function OwnerRow({ owner, role, onRefresh }) {
  const p = owner.person || {}
  const isFlagged = owner.FlaggedForAttention === 'TRUE'
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  function startEdit(e) {
    e.stopPropagation()
    setSaveError('')
    setExpanded(true)
    setForm({
      fullName: p.FullName || '',
      mobile1: p.Mobile1 || '',
      mobile2: p.Mobile2 || '',
      email: p.Email || '',
      address: p.Address || '',
      membershipNo: owner.MembershipNo || '',
      memberSince: toDateInput(owner.MemberSince),
      nominatedContact: owner.NominatedContact || '',
    })
    setEditing(true)
  }

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      await updatePerson({
        personId: p.PersonID,
        FullName: form.fullName,
        Mobile1: form.mobile1,
        Mobile2: form.mobile2,
        Email: form.email,
        Address: form.address,
      })
      await updateOwner({
        ownerId: owner.OwnerID,
        MembershipNo: form.membershipNo,
        MemberSince: form.memberSince,
        NominatedContact: form.nominatedContact,
      })
      setEditing(false)
      onRefresh()
    } catch (e) {
      setSaveError(e.message || 'Save failed')
    } finally { setSaving(false) }
  }

  if (editing) {
    return (
      <div style={{
        padding: '12px', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--tc)', background: 'var(--surface-2)', marginBottom: 8
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <EditField label="Full name"    value={form.fullName}        onChange={v => set('fullName', v)} />
          <EditField label="Mobile"       value={form.mobile1}         onChange={v => set('mobile1', v)} />
          <EditField label="Alt mobile"   value={form.mobile2}         onChange={v => set('mobile2', v)} />
          <EditField label="Email"        value={form.email}           onChange={v => set('email', v)} />
          <EditField label="Address"      value={form.address}         onChange={v => set('address', v)} />
          <EditField label="Membership #" value={form.membershipNo}    onChange={v => set('membershipNo', v)} />
          <EditField label="Member since" value={form.memberSince}     onChange={v => set('memberSince', v)} type="date" />
          <EditField label="Contact name" value={form.nominatedContact} onChange={v => set('nominatedContact', v)} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          {saveError && <span style={{ fontSize: 11, color: 'var(--disputed)' }}>{saveError}</span>}
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        padding: '10px 12px', borderRadius: 'var(--radius-md)',
        border: `1px solid ${isFlagged ? 'var(--tc-mid)' : 'var(--border)'}`,
        background: isFlagged ? 'var(--tc-light)' : 'var(--surface-2)',
        marginBottom: 8, cursor: 'pointer'
      }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--tc-light)', color: 'var(--tc-dark)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 600, flexShrink: 0
        }}>
          {initials(p.FullName || '?')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{p.FullName || '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {owner.MembershipNo
              ? <span className="mono">{owner.MembershipNo}</span>
              : 'Non-member'
            }
            {owner.MemberSince && ` · Since ${formatDate(owner.MemberSince)}`}
          </div>
        </div>
        <span style={{ fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
            {p.Mobile1 && <InfoRow label="Mobile" value={p.Mobile1} />}
            {p.Mobile2 && <InfoRow label="Alt" value={p.Mobile2} />}
            {p.Email && <InfoRow label="Email" value={p.Email} />}
            {owner.NominatedContact && <InfoRow label="Contact" value={owner.NominatedContact} />}
          </div>
          {canEdit(role, 'owners') && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={startEdit}>Edit</button>
          )}
        </div>
      )}
    </div>
  )
}

function EditField({ label, value, onChange, type = 'text' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 80, textAlign: 'right' }}>{label}</span>
      <input
        className="input"
        type={type}
        style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
      <span style={{ color: 'var(--ink-3)', minWidth: 48 }}>{label}</span>
      <span style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  )
}

function DuesRow({ due }) {
  const statusColors = {
    paid: { bg: 'var(--paid-bg)', color: 'var(--paid)' },
    partial: { bg: 'var(--partial-bg)', color: 'var(--partial)' },
    unpaid: { bg: 'var(--partial-bg)', color: 'var(--partial)' },
    size_missing: { bg: 'var(--surface-3)', color: 'var(--ink-2)' },
  }
  const { bg, color } = statusColors[due.status] || statusColors.unpaid

  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{due.headName}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
            {due.amountType === 'PerSqft' ? 'Per sq ft' : 'Flat fee'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {due.sizeMissing ? (
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Size required</span>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color }}>
                {formatCurrency(due.outstanding)} due
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                {formatCurrency(due.paid)} of {formatCurrency(due.expected)} paid
              </div>
            </>
          )}
        </div>
      </div>
      {/* Progress bar */}
      {!due.sizeMissing && due.expected > 0 && (
        <div style={{
          marginTop: 8, height: 4, borderRadius: 2,
          background: 'var(--surface-3)', overflow: 'hidden'
        }}>
          <div style={{
            width: `${Math.min(100, (due.paid / due.expected) * 100)}%`,
            height: '100%', background: color, borderRadius: 2,
            transition: 'width 0.3s'
          }} />
        </div>
      )}
    </div>
  )
}

function FlagModal({ flagging, comment, saving, onChange, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 360, border: '1px solid var(--border)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
          {flagging ? '🚩 Flag for attention' : 'Clear flag'}
        </div>
        <div style={{ padding: '16px 18px' }}>
          <label className="label">{flagging ? 'Reason for flagging' : 'Reason for clearing'} *</label>
          <textarea
            className="input"
            style={{ resize: 'vertical', minHeight: 72 }}
            placeholder="Required…"
            value={comment}
            autoFocus
            onChange={e => onChange(e.target.value)}
          />
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!comment.trim() || saving}
            onClick={onConfirm}
          >
            {saving ? 'Saving…' : flagging ? 'Flag' : 'Clear flag'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddCoOwnerModal({ siteId, onClose, onSaved }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [membershipNo, setMembershipNo] = useState('')
  const [memberSince, setMemberSince] = useState('')
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const debounce = useRef(null)

  function handleQuery(v) {
    setQuery(v)
    setSelected(null)
    clearTimeout(debounce.current)
    if (v.trim().length < 2) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try { setResults(await getPeople({ q: v.trim() })) }
      catch { setResults([]) }
      finally { setSearching(false) }
    }, 350)
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true); setError('')
    try {
      await createOwner({ siteId, personId: selected.PersonID, membershipNo, memberSince })
      onSaved()
    } catch (e) { setError(e.message || 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 400, border: '1px solid var(--border)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          Add co-owner
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Search person *</label>
            <input className="input" placeholder="Name or phone…" value={query} onChange={e => handleQuery(e.target.value)} autoFocus />
            {searching && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>Searching…</div>}
            {results.length > 0 && !selected && (
              <div style={{ marginTop: 4, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxHeight: 180, overflowY: 'auto' }}>
                {results.slice(0, 10).map(p => (
                  <div key={p.PersonID} onClick={() => { setSelected(p); setQuery(p.FullName); setResults([]) }}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <div style={{ fontWeight: 500 }}>{p.FullName}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{p.Mobile1 || p.Email || p.PersonID}</div>
                  </div>
                ))}
              </div>
            )}
            {selected && (
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--paid)' }}>
                ✓ Selected: {selected.FullName}
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8, fontSize: 10 }} onClick={() => { setSelected(null); setQuery('') }}>Change</button>
              </div>
            )}
          </div>
          <div>
            <label className="label">Membership #</label>
            <input className="input" placeholder="MC…" value={membershipNo} onChange={e => setMembershipNo(e.target.value)} />
          </div>
          <div>
            <label className="label">Member since</label>
            <input className="input" type="date" value={memberSince} onChange={e => setMemberSince(e.target.value)} />
          </div>
          {error && <div style={{ fontSize: 12, padding: '8px 12px', background: 'var(--disputed-bg)', color: 'var(--disputed)', borderRadius: 'var(--radius-md)' }}>{error}</div>}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!selected || saving} onClick={handleSave}>
            {saving ? 'Adding…' : 'Add co-owner'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LogEntry({ log, onDone, role }) {
  const canDone = ['Edit', 'Payments', 'Caller', 'Admin'].includes(role)
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>{log.CalledBy}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{formatDate(log.LogDate)}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{log.Summary}</div>
      {log.FollowUpAction && (
        <div style={{
          marginTop: 6, display: 'flex', alignItems: 'center', gap: 8
        }}>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 999,
            background: log.FollowUpDone === 'TRUE' ? 'var(--paid-bg)' : 'var(--tc-light)',
            color: log.FollowUpDone === 'TRUE' ? 'var(--paid)' : 'var(--tc)',
          }}>
            {log.FollowUpDone === 'TRUE' ? '✓' : '→'} {log.FollowUpAction}
          </span>
          {log.FollowUpDone !== 'TRUE' && canDone && (
            <button className="btn btn-ghost btn-sm" onClick={onDone} style={{ fontSize: 11 }}>
              Mark done
            </button>
          )}
        </div>
      )}
    </div>
  )
}
