import { initials } from '../utils/constants.js'

const PHASE_COLORS = { '1': '#2B6CB0', '2': '#276749' }

export default function SiteCard({ site, selected, onClick }) {
  const hasContact = !!(site.mobile)
  const payStatus = site.payStatus || (hasContact ? 'unpaid' : 'nocontact')
  const edgeColor = PHASE_COLORS[String(site.Phase)] || '#9CA3AF'
  const isFlagged = site.FlaggedForAttention === 'TRUE' || site.ownerFlagged === true

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {isFlagged && <span title="Flagged" style={{ fontSize: 12 }}>🚩</span>}
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
            {site.membershipNo && (
              <span className="mono" style={{ color: 'var(--ink-2)' }}>{site.membershipNo}</span>
            )}
            {!site.membershipNo && <span>Non-member</span>}
          </div>
          {site.mobile ? (
            <a
              href={`tel:${site.mobile}`}
              onClick={e => e.stopPropagation()}
              title={site.mobile}
              style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ink-2)', textDecoration: 'none'
              }}
            >
              <PhoneIcon />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function PhoneIcon() {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 1h3l1.5 3.5L6 6s1 2 4 4l1.5-1.5L15 10v3a1 1 0 01-1 1C6 14 2 8 2 2a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
}

function PayBadge({ status }) {
  const map = {
    paid:      { label: 'Paid',      cls: 'badge-paid' },
    partial:   { label: 'Default',   cls: 'badge-partial' },
    unpaid:    { label: 'Unpaid',    cls: 'badge-unpaid' },
    disputed:  { label: 'Disputed',  cls: 'badge-disputed' },
    nocontact: { label: 'No contact',cls: 'badge-nocontact' },
  }
  const { label, cls } = map[status] || map.nocontact
  return <span className={`badge ${cls}`}>{label}</span>
}
