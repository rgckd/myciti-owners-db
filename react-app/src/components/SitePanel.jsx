import { useState, useEffect, useCallback, useRef } from 'react'
import { getSite, getPayments, getPaymentHeads, getCallLog, flagSite, updateSite, updatePerson, updateOwner, createCallLog, markFollowUpDone, uploadFileToDrive } from '../utils/api.js'
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
  const [showUpload, setShowUpload] = useState(false)
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
      await load()
      onRefresh?.()
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
              <div className="label">Current owner(s)</div>
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
          <AttachmentsTab site={site} role={role} onUpload={() => setShowUpload(true)} />
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

      {showUpload && (
        <UploadAttachmentModal
          siteId={siteId}
          site={site}
          onClose={() => setShowUpload(false)}
          onSaved={() => { setShowUpload(false); load() }}
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
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingIdProof, setUploadingIdProof] = useState(false)
  const photoInputRef = useRef(null)
  const idProofInputRef = useRef(null)

  function parseIdProofUrls(raw) {
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
    } catch (_) {}
    return String(raw)
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(Boolean)
  }

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
      photoUrl: p.PhotoURL || '',
      idProofUrls: p.IDProofURLs || '',
      membershipNo: owner.MembershipNo || '',
      memberSince: toDateInput(owner.MemberSince),
      nominatedContact: owner.NominatedContact || '',
    })
    setEditing(true)
  }

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !p.PersonID) return
    setSaveError('')
    setUploadingPhoto(true)
    try {
      const url = await uploadFileToDrive(file, 'People', p.PersonID)
      set('photoUrl', url)
    } catch (err) {
      setSaveError(err.message || 'Photo upload failed')
    } finally { setUploadingPhoto(false) }
  }

  async function handleIdProofUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !p.PersonID) return
    setSaveError('')
    setUploadingIdProof(true)
    try {
      const url = await uploadFileToDrive(file, 'People', p.PersonID)
      const current = parseIdProofUrls(form.idProofUrls)
      const next = [...current, url]
      set('idProofUrls', JSON.stringify(next))
    } catch (err) {
      setSaveError(err.message || 'ID proof upload failed')
    } finally { setUploadingIdProof(false) }
  }

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
        PhotoURL: form.photoUrl,
        IDProofURLs: form.idProofUrls,
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
          <EditField label="Full name(s)" value={form.fullName}        onChange={v => set('fullName', v)} />
          <EditField label="Mobile"       value={form.mobile1}         onChange={v => set('mobile1', v)} />
          <EditField label="Alt mobile"   value={form.mobile2}         onChange={v => set('mobile2', v)} />
          <EditField label="Email"        value={form.email}           onChange={v => set('email', v)} />
          <EditField label="Address"      value={form.address}         onChange={v => set('address', v)} />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 80, textAlign: 'right', marginTop: 6 }}>Photo</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  disabled={uploadingPhoto || uploadingIdProof}
                  onClick={() => photoInputRef.current?.click()}
                >
                  {uploadingPhoto ? 'Uploading photo…' : 'Upload photo'}
                </button>
                {form.photoUrl && (
                  <a href={form.photoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--tc)', textDecoration: 'none' }}>
                    Open ↗
                  </a>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoUpload}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 80, textAlign: 'right', marginTop: 6 }}>ID proof</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  disabled={uploadingPhoto || uploadingIdProof}
                  onClick={() => idProofInputRef.current?.click()}
                >
                  {uploadingIdProof ? 'Uploading ID…' : 'Upload ID proof'}
                </button>
                {parseIdProofUrls(form.idProofUrls).map((url, i) => (
                  <a key={`${url}-${i}`} href={url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--tc)', textDecoration: 'none' }}>
                    ID {i + 1} ↗
                  </a>
                ))}
              </div>
              <input
                ref={idProofInputRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={handleIdProofUpload}
              />
            </div>
          </div>

          <EditField label="Membership #" value={form.membershipNo}    onChange={v => set('membershipNo', v)} />
          <EditField label="Member since" value={form.memberSince}     onChange={v => set('memberSince', v)} type="date" />
          <EditField label="Primary contact" value={form.nominatedContact} onChange={v => set('nominatedContact', v)} />
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
        border: '1px solid var(--border)',
        background: 'var(--surface-2)',
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
  if (type === 'date') return <DateEditField label={label} value={value} onChange={onChange} />
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

function DateEditField({ label, value, onChange }) {
  const [text, setText] = useState(() => ymdToDmy(value))

  function ymdToDmy(ymd) {
    if (!ymd || ymd.length < 10) return ''
    const [y, m, d] = ymd.split('-')
    return `${d}/${m}/${y}`
  }

  function handleChange(e) {
    let v = e.target.value.replace(/[^\d/]/g, '')
    // auto-insert slashes
    if (v.length === 2 && !v.includes('/')) v = v + '/'
    if (v.length === 5 && v.split('/').length < 3) v = v + '/'
    setText(v)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      const [d, m, y] = v.split('/')
      onChange(`${y}-${m}-${d}`)
    } else if (!v) {
      onChange('')
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 80, textAlign: 'right' }}>{label}</span>
      <input
        className="input"
        style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
        value={text}
        placeholder="dd/mm/yyyy"
        maxLength={10}
        onChange={handleChange}
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

function parseAttachments(raw) {
  if (!raw) return []
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p : []
  } catch { return [] }
}

function AttachmentsTab({ site, role, onUpload }) {
  const items = parseAttachments(site.AttachmentURLs)
  return (
    <div>
      {items.length === 0 ? (
        <div className="empty-state"><p>No attachments yet</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {items.map((item, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{item.type === 'image' ? '🖼' : '📄'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                {item.uploadedAt && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{item.uploadedAt}</div>}
              </div>
              <a href={item.url} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: 'var(--tc)', textDecoration: 'none' }}>Open ↗</a>
            </div>
          ))}
        </div>
      )}
      {canEdit(role, 'owners') && (
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={onUpload}>
          + Upload file
        </button>
      )}
    </div>
  )
}

async function compressImage(file, maxPx = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        canvas.toBlob(blob => resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })), 'image/jpeg', quality)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

function UploadAttachmentModal({ siteId, site, onClose, onSaved }) {
  const [file, setFile] = useState(null)
  const [label, setLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!file) return
    setUploading(true); setError('')
    try {
      let uploadFile = file
      if (file.type.startsWith('image/')) {
        uploadFile = await compressImage(file)
      }
      const url = await uploadFileToDrive(uploadFile, 'Sites', siteId)
      const current = parseAttachments(site.AttachmentURLs)
      current.push({
        label: label.trim() || file.name,
        url,
        type: file.type.startsWith('image/') ? 'image' : 'pdf',
        uploadedAt: new Date().toISOString().slice(0, 10),
      })
      await updateSite({ siteId, AttachmentURLs: JSON.stringify(current) })
      onSaved()
    } catch (e) { setError(e.message || 'Upload failed') }
    finally { setUploading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 380, border: '1px solid var(--border)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          Upload attachment
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">File (photo or PDF) *</label>
            <input
              type="file"
              accept="image/*,.pdf"
              className="input"
              style={{ padding: '6px 8px' }}
              onChange={e => { setFile(e.target.files[0] || null); setError('') }}
            />
            {file && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                {file.name} · {(file.size / 1024).toFixed(0)} KB
                {file.type.startsWith('image/') && ' · will be compressed'}
              </div>
            )}
          </div>
          <div>
            <label className="label">Label</label>
            <input className="input" placeholder="e.g. ID proof, Site photo…" value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          {error && <div style={{ fontSize: 12, padding: '8px 12px', background: 'var(--disputed-bg)', color: 'var(--disputed)', borderRadius: 'var(--radius-md)' }}>{error}</div>}
          {uploading && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Uploading to Google Drive… this may take a moment</div>}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={uploading}>Cancel</button>
          <button className="btn btn-primary" disabled={!file || uploading} onClick={handleSave}>
            {uploading ? 'Uploading…' : 'Upload'}
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
