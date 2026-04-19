import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import SiteRegistry from './pages/SiteRegistry.jsx'
import People from './pages/People.jsx'
import Agents from './pages/Agents.jsx'
import Defaulters from './pages/Defaulters.jsx'
import FollowUps from './pages/FollowUps.jsx'
import AuditView from './pages/AuditView.jsx'
import Admin from './pages/Admin.jsx'
import Verify from './pages/Verify.jsx'
import PaymentsView from './pages/PaymentsView.jsx'
import CallLogsView from './pages/CallLogsView.jsx'

function ProtectedApp() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className="spin" />
    </div>
  )

  if (!user) return <Login />

  return (
    <Layout>
      <Routes>
        <Route path="/"           element={<SiteRegistry />} />
        <Route path="/people"     element={<People />} />
        <Route path="/agents"     element={<Agents />} />
        <Route path="/defaulters" element={<Defaulters />} />
        <Route path="/followups"  element={<FollowUps />} />
        <Route path="/payments"   element={<PaymentsView />} />
        <Route path="/calllogs"   element={<CallLogsView />} />
        <Route path="/audit"      element={<AuditView />} />
        <Route path="/admin"      element={<Admin />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/verify/:membershipId" element={<Verify />} />
        <Route path="/*" element={<ProtectedApp />} />
      </Routes>
    </AuthProvider>
  )
}
