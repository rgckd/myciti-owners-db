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
