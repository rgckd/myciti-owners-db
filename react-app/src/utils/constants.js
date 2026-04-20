// constants.js

export const ROLES = { EDIT: 'Edit', PAYMENTS: 'Payments', CALLER: 'Caller', VIEW: 'View', ADMIN: 'Admin' }

export const SITE_TYPES = ['30x40', '30x50', '40x60', '50x80', '27x50', '40x40', 'non-standard']

export const SITE_TYPE_SQFT = {
  '30x40': 1200, '30x50': 1500, '40x60': 2400,
  '50x80': 4000, '27x50': 1350, '40x40': 1600,
}

export const PAYMENT_MODES = ['Cash', 'UPI', 'Bank transfer']

export const STATUS_OPTIONS = ['Active', 'Non-member', 'Disputed']

export const FY_PERIODS = ['FY2024-25', 'FY2025-26', 'FY2026-27', 'FY2027-28', 'Membership Fee']

// Derive site payment status from dues data
export function sitePayStatus(dues) {
  if (!dues || dues.length === 0) return 'nocontact'
  const active = dues.filter(d => d.isActive)
  if (active.length === 0) return 'paid'
  const anyMissing = active.some(d => d.status === 'size_missing')
  if (anyMissing) return 'partial'
  const allPaid = active.every(d => d.status === 'paid')
  if (allPaid) return 'paid'
  const anyPartial = active.some(d => d.status === 'partial')
  return anyPartial ? 'partial' : 'unpaid'
}

export function statusEdge(status, hasContact) {
  if (!hasContact) return 'nocontact'
  switch (status) {
    case 'paid':      return 'paid'
    case 'partial':   return 'partial'
    case 'unpaid':    return 'partial'
    case 'disputed':  return 'disputed'
    default:          return 'nocontact'
  }
}

export function formatCurrency(n) {
  if (n == null || n === '') return '—'
  return '₹' + Number(n).toLocaleString('en-IN')
}

export function formatDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt)) return String(d)
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Converts any date value from Sheets (ISO datetime string, Date object, or YYYY-MM-DD)
// to the YYYY-MM-DD string required internally. Uses local date methods to avoid
// UTC↔IST timezone shift (a Sheets date stored as "2026-02-02" comes back as
// "2026-02-01T18:30:00.000Z" in UTC, so slice(0,10) would give the wrong day).
export function toDateInput(val) {
  if (!val) return ''
  const s = String(val).trim()
  if (s.length === 10 && s[4] === '-') return s  // already YYYY-MM-DD

  // Handle local format: dd/mm/yyyy
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    const d = dmy[1].padStart(2, '0')
    const m = dmy[2].padStart(2, '0')
    return `${dmy[3]}-${m}-${d}`
  }

  // Normalize ordinal date text such as "2nd Feb 2026"
  const normalized = s
    .replace(/(\d+)(st|nd|rd|th)/gi, '$1')
    .replace(/\s+/g, ' ')

  let d = new Date(normalized)

  // Fallback parser: d Mon yyyy
  if (isNaN(d)) {
    const parts = normalized.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/)
    if (parts) {
      const monthMap = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      }
      const mon = monthMap[parts[2].slice(0, 3).toLowerCase()]
      if (mon != null) d = new Date(Number(parts[3]), mon, Number(parts[1]))
    }
  }

  if (!isNaN(d)) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return ''
}

export function initials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function canEdit(role, domain) {
  const map = {
    Edit:     { owners: true,  payments: true,  calllog: true  },
    Payments: { owners: false, payments: true,  calllog: true  },
    Caller:   { owners: false, payments: false, calllog: true  },
    View:     { owners: false, payments: false, calllog: false },
    Admin:    { owners: true,  payments: true,  calllog: true  },
  }
  return map[role]?.[domain] || false
}

export function canFlag(role) {
  return ['Edit', 'Payments', 'Caller', 'Admin'].includes(role)
}
