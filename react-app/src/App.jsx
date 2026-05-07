import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'

const Login        = lazy(() => import('./pages/Login.jsx'))
const SiteRegistry = lazy(() => import('./pages/SiteRegistry.jsx'))
const People       = lazy(() => import('./pages/People.jsx'))
const Agents       = lazy(() => import('./pages/Agents.jsx'))
const Defaulters   = lazy(() => import('./pages/Defaulters.jsx'))
const FollowUps    = lazy(() => import('./pages/FollowUps.jsx'))
const AuditView    = lazy(() => import('./pages/AuditView.jsx'))
const Admin        = lazy(() => import('./pages/Admin.jsx'))
const Verify       = lazy(() => import('./pages/Verify.jsx'))
const PaymentsView = lazy(() => import('./pages/PaymentsView.jsx'))
const CallLogsView = lazy(() => import('./pages/CallLogsView.jsx'))
const Reports      = lazy(() => import('./pages/Reports.jsx'))

const Spinner = () => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
    <div className="spin" />
  </div>
)

function ProtectedApp() {
  const { user, loading } = useAuth()

  if (loading) return <Spinner />

  if (!user) return (
    <Suspense fallback={<Spinner />}>
      <Login />
    </Suspense>
  )

  return (
    <Layout>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/"           element={<SiteRegistry />} />
          <Route path="/people"     element={<People />} />
          <Route path="/agents"     element={<Agents />} />
          <Route path="/defaulters" element={<Defaulters />} />
          <Route path="/followups"  element={<FollowUps />} />
          <Route path="/payments"   element={<PaymentsView />} />
          <Route path="/calllogs"   element={<CallLogsView />} />
          <Route path="/reports"    element={<Reports />} />
          <Route path="/audit"      element={<AuditView />} />
          <Route path="/admin"      element={<Admin />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/verify/:membershipId" element={
          <Suspense fallback={<Spinner />}>
            <Verify />
          </Suspense>
        } />
        <Route path="/*" element={<ProtectedApp />} />
      </Routes>
    </AuthProvider>
  )
}
