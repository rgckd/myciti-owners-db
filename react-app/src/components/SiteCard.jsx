import { initials } from '../utils/constants.js'

const PHASE_COLORS = { '1': '#2B6CB0', '2': '#276749' }

export default function SiteCard({ site, selected, onClick }) {
  const payStatus = site.payStatus === 'nocontact' ? 'unpaid' : site.payStatus
  const edgeColor = PHASE_COLORS[String(site.Phase)] || '#9CA3AF'
  const isFlagged = site.FlaggedForAttention === 'TRUE'
  const hasNoPhone = !site.mobile
  const hasFollowUp = Boolean(site.hasOpenFollowUp)

  return (
    <div
      onClick={onClick}
      style={{
        background: isFlagged ? '#FFFBEB' : 'var(--surface)',
        border: `1px solid ${selected ? 'var(--tc)' : isFlagged ? '#F6D860' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        boxShadow: selected ? '0 0 0 3px var(--tc-light)' : 'none',
        position: 'relative',
      }}
    >
      {/* Phase edge */}
      <div style={{ height: 3, background: edgeColor }} />

      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
              Site {site.SiteNo}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
              Phase {site.Phase} · {site.SiteType || '—'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {hasNoPhone && <SignalChip icon="📵" title="No phone" />}
            {hasFollowUp && <SignalChip icon="🔔" title="Follow-up" />}
            {isFlagged && <SignalChip icon="🚩" title="Issue" />}
            <PayBadge status={payStatus} />
          </div>
        </div>

        <div style={{
          fontSize: 13, color: 'var(--ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: 4
        }}>
          {site.ownerName || <span style={{ color: 'var(--ink-3)' }}>No owner data</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--ink-3)', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {site.membershipNo
              ? <span className="mono" style={{ color: 'var(--ink-2)' }}>{site.membershipNo}</span>
              : <span className="badge badge-nonmember">Non-member</span>}
          </div>
          {site.mobile && (
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{site.mobile}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function SignalChip({ icon, title }) {
  return (
    <span className="card-signal" title={title} aria-label={title}>
      <span aria-hidden="true">{icon}</span>
    </span>
  )
}

function PayBadge({ status }) {
  const map = {
    paid:     { label: 'Paid',     cls: 'badge-paid' },
    partial:  { label: 'Default',  cls: 'badge-partial' },
    unpaid:   { label: 'Dues',     cls: 'badge-unpaid' },
    disputed: { label: 'Disputed', cls: 'badge-disputed' },
  }
  const entry = map[status]
  if (!entry) return null
  return <span className={`badge ${entry.cls}`}>{entry.label}</span>
}
