import { initials } from '../utils/constants.js'

const EDGE_COLORS = {
  paid:      'var(--paid)',
  partial:   'var(--partial)',
  unpaid:    'var(--partial)',
  disputed:  'var(--disputed)',
  nocontact: 'var(--nocontact)',
}

export default function SiteCard({ site, selected, onClick }) {
  const hasContact = !!(site.mobile)
  const payStatus = site.payStatus || (hasContact ? 'unpaid' : 'nocontact')
  const edgeColor = EDGE_COLORS[payStatus] || EDGE_COLORS.nocontact
  const isSiteFlagged  = site.FlaggedForAttention === 'TRUE'
  const isOwnerFlagged = site.ownerFlagged === true

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${selected ? 'var(--tc)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        boxShadow: selected ? '0 0 0 3px var(--tc-light)' : 'none',
        position: 'relative',
      }}
    >
      {/* Status edge */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {isSiteFlagged  && <span title="Site flagged" style={{ fontSize: 12 }}>🚩</span>}
            {isOwnerFlagged && <span title="Owner flagged" style={{ fontSize: 12 }}>⚑</span>}
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

        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--ink-3)' }}>
          {site.membershipNo && (
            <span className="mono" style={{ color: 'var(--ink-2)' }}>{site.membershipNo}</span>
          )}
          {site.mobile && <span>{site.mobile}</span>}
          {!site.membershipNo && !site.mobile && <span>Non-member</span>}
        </div>
      </div>
    </div>
  )
}

function PayBadge({ status }) {
  const map = {
    paid:      { label: 'Paid',      cls: 'badge-paid' },
    partial:   { label: 'Partial',   cls: 'badge-partial' },
    unpaid:    { label: 'Unpaid',    cls: 'badge-unpaid' },
    disputed:  { label: 'Disputed',  cls: 'badge-disputed' },
    nocontact: { label: 'No contact',cls: 'badge-nocontact' },
  }
  const { label, cls } = map[status] || map.nocontact
  return <span className={`badge ${cls}`}>{label}</span>
}
