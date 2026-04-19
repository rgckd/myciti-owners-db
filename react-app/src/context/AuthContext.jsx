import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { setToken } from '../utils/api.js'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const APPS_SCRIPT_URL  = import.meta.env.VITE_APPS_SCRIPT_URL  || ''

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const signOut = useCallback(() => {
    setUser(null); setToken('')
    window.google?.accounts?.id?.disableAutoSelect()
  }, [])

  const handleCredential = useCallback(async (response) => {
    setLoading(true); setError('')
    try {
      const idToken = response.credential
      setToken(idToken)
      const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'whoami', token: idToken }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setToken(''); return }
      setUser({ email: data.email || payload.email, name: payload.name || data.displayName,
                picture: payload.picture || '', role: data.role, displayName: data.displayName || payload.name })
    } catch (e) { setError(e.message || 'Sign-in failed'); setToken('')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) { setLoading(false); return }
    const init = () => {
      if (!window.google?.accounts?.id) { setTimeout(init, 300); return }
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential, auto_select: false })
      setLoading(false)
    }
    init()
  }, [handleCredential])

  return <AuthContext.Provider value={{ user, loading, error, signOut, handleCredential }}>{children}</AuthContext.Provider>
}
