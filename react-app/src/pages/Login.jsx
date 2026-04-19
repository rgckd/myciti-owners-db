import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { error, handleCredential } = useAuth()
  const btnRef = useRef(null)

  useEffect(() => {
    if (!window.google?.accounts?.id || !btnRef.current) return
    window.google.accounts.id.renderButton(btnRef.current, {
      type: 'standard',
      shape: 'rectangular',
      theme: 'outline',
      text: 'signin_with',
      size: 'large',
      logo_alignment: 'left',
      width: 280,
    })
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-2)', padding: '24px'
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)', padding: '40px 36px',
        width: '100%', maxWidth: '380px', textAlign: 'center'
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--tc-light)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 22
        }}>
          🏘
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
          MyCiti Owners Association
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 28 }}>
          Bidadi Layout · Ramanagara
        </p>

        <div ref={btnRef} style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }} />

        {error && (
          <div style={{
            marginTop: 12, padding: '10px 14px',
            background: 'var(--disputed-bg)', borderRadius: 'var(--radius-md)',
            color: 'var(--disputed)', fontSize: 13
          }}>
            {error}
          </div>
        )}

        <p style={{ marginTop: 20, fontSize: 11, color: 'var(--ink-3)' }}>
          Sign in with your Google account.<br />
          Contact the App Admin if you need access.
        </p>
      </div>
    </div>
  )
}
