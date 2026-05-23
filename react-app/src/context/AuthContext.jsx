import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { setToken } from '../utils/api.js'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const APPS_SCRIPT_URL  = import.meta.env.VITE_APPS_SCRIPT_URL  || ''
const SESSION_KEY = 'myciti.auth.session.v1'
const SESSION_MAX_AGE_MS = 3 * 60 * 60 * 1000 // 3 hours

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function decodeJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

function loadStoredSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.token || !parsed?.user || !parsed?.savedAt) return null
    return parsed
  } catch {
    return null
  }
}

function clearStoredSession() {
  try { window.localStorage.removeItem(SESSION_KEY) } catch {}
}

function saveSession(token, user) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user, savedAt: Date.now() }))
  } catch {}
}

function isSessionFresh(session) {
  const jwt = decodeJwt(session.token)
  if (!jwt?.exp) return false
  const now = Date.now()
  const tokenExpiry = Number(jwt.exp) * 1000
  if (!Number.isFinite(tokenExpiry) || tokenExpiry <= now) return false
  return now - Number(session.savedAt) <= SESSION_MAX_AGE_MS
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const signOut = useCallback(() => {
    setUser(null); setToken('')
    clearStoredSession()
    window.google?.accounts?.id?.disableAutoSelect()
  }, [])

  const handleCredential = useCallback(async (response) => {
    setLoading(true); setError('')
    try {
      const idToken = response.credential
      const jwtPayload = decodeJwt(idToken)
      if (!jwtPayload) throw new Error('Invalid token from Google')
      setToken(idToken)
      const payload = encodeURIComponent(JSON.stringify({ action: 'whoami', token: idToken }))
      const res = await fetch(`${APPS_SCRIPT_URL}?payload=${payload}`, { redirect: 'follow' })
      const data = await res.json()
      if (data.error) { setError(data.error); setToken(''); return }
      const nextUser = {
        email: data.email || jwtPayload.email,
        name: jwtPayload.name || data.displayName,
        picture: jwtPayload.picture || '',
        role: data.role,
        displayName: data.displayName || jwtPayload.name,
      }
      setUser(nextUser)
      saveSession(idToken, nextUser)
    } catch (e) { setError(e.message || 'Sign-in failed'); setToken('')
      clearStoredSession()
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) { setLoading(false); return }
    const init = async () => {
      if (!window.google?.accounts?.id) { setTimeout(init, 300); return }
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential, auto_select: false })

      const session = loadStoredSession()
      if (session && isSessionFresh(session)) {
        try {
          setToken(session.token)
          const payload = encodeURIComponent(JSON.stringify({ action: 'whoami', token: session.token }))
          const res = await fetch(`${APPS_SCRIPT_URL}?payload=${payload}`, { redirect: 'follow' })
          const data = await res.json()
          if (!data.error) {
            setUser({ ...session.user, role: data.role, displayName: data.displayName || session.user.displayName })
          } else {
            signOut()
          }
        } catch {
          signOut()
        }
      } else {
        clearStoredSession()
      }

      setLoading(false)
    }
    init()
  }, [handleCredential, signOut])

  return <AuthContext.Provider value={{ user, loading, error, signOut, handleCredential }}>{children}</AuthContext.Provider>
}
