import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { initials } from '../utils/constants.js'
import styles from './Layout.module.css'

const NAV = [
  { to: '/',         label: 'Site registry', icon: GridIcon,     always: true },
  { to: '/payments', label: 'Payments',      icon: PayIcon,      always: true },
  { to: '/calllogs', label: 'Call log',      icon: PhoneLogIcon, always: true },
  { to: '/audit',    label: 'Audit log',     icon: LogIcon,      roles: ['Admin'] },
  { to: '/admin',    label: 'Admin',         icon: GearIcon,     roles: ['Admin'] },
]

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const role = user?.role || 'View'

  const visibleNav = NAV.filter(n => n.always || (n.roles && n.roles.includes(role)))

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>MyCiti Database</div>
          <div className={styles.logoSub}>MCOA, Bidadi</div>
        </div>

        <nav className={styles.nav}>
          {visibleNav.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navActive : ''}`
              }
            >
              <n.icon size={16} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.userArea}>
          <div className={styles.avatar}>{initials(user?.name || user?.email || '')}</div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{user?.name || user?.email}</div>
            <div className={styles.userRole}>{role}</div>
          </div>
          <button className={styles.signOut} onClick={signOut} title="Sign out">
            <ExitIcon size={15} />
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}

// ── Inline SVG icons ─────────────────────────────────────────────────────────
function GridIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" opacity=".4"/><rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor"/><rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity=".4"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity=".4"/></svg>
}
function PersonIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/><path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
}
function AgentIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 13c0-2.761 2.239-4 5-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="11.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M15 13c0-2.761-2.239-4-5-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
}
function AlertIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M8 2l6.5 11H1.5L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M8 7v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
}
function ClockIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function PayIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 7h14" stroke="currentColor" strokeWidth="1.3"/><circle cx="4.5" cy="10" r="1" fill="currentColor"/></svg>
}
function PhoneLogIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M3 1h3l1.5 3.5L6 6s1 2 4 4l1.5-1.5L15 10v3a1 1 0 01-1 1C6 14 2 8 2 2a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
}
function LogIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
}
function GearIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.414 1.414M11.536 11.536l1.414 1.414M3.05 12.95l1.414-1.414M11.536 4.464l1.414-1.414" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
}
function ExitIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
