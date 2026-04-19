import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { verifyMember } from '../utils/api.js'
import { formatDate } from '../utils/constants.js'

export default function Verify() {
  const { membershipId } = useParams()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!membershipId) { setLoading(false); return }
    verifyMember(membershipId)
      .then(setResult)
      .catch(() => setResult({ found: false, message: 'Could not reach verification service. Please try again.' }))
      .finally(() => setLoading(false))
  }, [membershipId])

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--surface-2)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'var(--font)'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--tc-light)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 26, margin: '0 auto 12px'
        }}>🏘</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>MyCiti Owners Association</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>Bidadi Layout · Ramanagara</div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="spin" />
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Verifying membership…</div>
        </div>
      ) : !result || !result.found ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)', padding: 32, maxWidth: 380, width: '100%',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
            Membership not found
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            {result?.message || `No active membership found for ID: ${membershipId}`}
          </div>
          <a href="https://database.mycitibidadi.com" style={{
            display: 'inline-block', marginTop: 20, fontSize: 12, color: 'var(--tc)'
          }}>
            database.mycitibidadi.com
          </a>
        </div>
      ) : result.status === 'disputed' ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)', padding: 32, maxWidth: 380, width: '100%',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            <span style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>{result.fullName}</span>
            <span className="mono">{result.membershipId}</span>
          </div>
          <div style={{
            marginTop: 16, padding: '10px 16px', borderRadius: 'var(--radius-md)',
            background: 'var(--partial-bg)', color: 'var(--partial)', fontSize: 13
          }}>
            Membership under review — contact the association.
          </div>
        </div>
      ) : (
        /* Active member card */
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)', overflow: 'hidden',
          maxWidth: 380, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)'
        }}>
          {/* Terracotta header */}
          <div style={{ background: 'var(--tc)', padding: '20px 24px' }}>
            <div style={{ fontSize: 11, color: 'var(--tc-light)', opacity: 0.8, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
              Verified member
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{result.fullName}</div>
            <div style={{ fontSize: 13, color: 'var(--tc-light)', marginTop: 4 }} className="mono">
              {result.membershipId}
            </div>
          </div>

          {/* Details */}
          <div style={{ padding: '20px 24px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 999,
              background: 'var(--paid-bg)', color: 'var(--paid)',
              fontWeight: 600, fontSize: 13, marginBottom: 20
            }}>
              <span>✓</span> Active member — MyCiti Owners Association
            </div>

            {[
              ['Site', result.siteNo ? `Site ${result.siteNo}` : '—'],
              ['Phase', result.phase ? `Phase ${result.phase}` : '—'],
              ['Member since', formatDate(result.memberSince)],
            ].map(([k, v]) => (
              <div key={k} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: '1px solid var(--border)',
                fontSize: 13
              }}>
                <span style={{ color: 'var(--ink-3)' }}>{k}</span>
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{v}</span>
              </div>
            ))}

            <div style={{ marginTop: 20, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.6, textAlign: 'center' }}>
              This verification is issued by MyCiti Owners Association.<br />
              For queries: <a href="https://database.mycitibidadi.com" style={{ color: 'var(--tc)' }}>database.mycitibidadi.com</a>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 32, fontSize: 11, color: 'var(--ink-3)', textAlign: 'center' }}>
        Verifying: <span className="mono">{membershipId}</span>
      </div>
    </div>
  )
}
