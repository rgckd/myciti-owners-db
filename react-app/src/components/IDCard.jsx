import { useRef, useEffect, useState } from 'react'
import { initials, formatDate } from '../utils/constants.js'

const VERIFY_BASE = 'https://adminapp.mycitibidadi.com/verify'

export default function IDCard({ ownership, person }) {
  const canvasRef = useRef(null)
  const [downloading, setDownloading] = useState(false)

  const mid  = ownership?.MembershipNo || ''
  const name = person?.FullName || '—'
  const site = ownership?.site
  const siteLabel = site ? `Site ${site.SiteNo} · Phase ${site.Phase} · ${site.SiteType || ''}` : ''
  const since = ownership?.MemberSince ? formatDate(ownership.MemberSince) : '—'
  const verifyUrl = `${VERIFY_BASE}/${mid}`

  useEffect(() => {
    drawCard(canvasRef.current, { mid, name, siteLabel, since, verifyUrl })
  }, [mid, name, siteLabel, since])

  async function handleDownload() {
    setDownloading(true)
    try {
      const canvas = canvasRef.current
      const link = document.createElement('a')
      link.download = `MyCiti_${mid}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally { setDownloading(false) }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(verifyUrl)
      .then(() => alert('Verify link copied!'))
  }

  function handleWhatsApp() {
    const msg = encodeURIComponent(
      `*MyCiti Owners Association*\n\nDear ${name},\n\nYour membership card is ready.\nMembership ID: ${mid}\n\nVerify online: ${verifyUrl}\n\n— MyCiti Owners Association, Bidadi`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'center',
        background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)',
        padding: 20, marginBottom: 16
      }}>
        <canvas ref={canvasRef} width={600} height={364}
          style={{ width: 300, height: 182, borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button className="btn btn-sm" onClick={handleDownload} disabled={downloading}>
          {downloading ? 'Saving…' : '↓ Download PNG'}
        </button>
        <button className="btn btn-sm" onClick={handleCopyLink}>
          🔗 Copy verify link
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleWhatsApp}>
          WhatsApp
        </button>
      </div>
      <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: 'var(--ink-3)' }}>
        {verifyUrl}
      </div>
    </div>
  )
}

function drawCard(canvas, { mid, name, siteLabel, since, verifyUrl }) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const W = 600, H = 364

  // ── Background ──────────────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff'
  ctx.roundRect(0, 0, W, H, 16)
  ctx.fill()

  // ── Header bar ──────────────────────────────────────────────────────────
  ctx.fillStyle = '#D85A30'
  ctx.fillRect(0, 0, W, 72)
  // round top corners only
  ctx.beginPath()
  ctx.moveTo(16, 0)
  ctx.lineTo(W - 16, 0)
  ctx.quadraticCurveTo(W, 0, W, 16)
  ctx.lineTo(W, 72)
  ctx.lineTo(0, 72)
  ctx.lineTo(0, 16)
  ctx.quadraticCurveTo(0, 0, 16, 0)
  ctx.fillStyle = '#D85A30'
  ctx.fill()

  // ── Org name ────────────────────────────────────────────────────────────
  ctx.fillStyle = '#FAECE7'
  ctx.font = '500 18px Inter, system-ui, sans-serif'
  ctx.fillText('MyCiti Owners Association', 20, 32)
  ctx.font = '400 13px Inter, system-ui, sans-serif'
  ctx.fillStyle = '#F0997B'
  ctx.fillText('Bidadi Layout · Ramanagara District', 20, 54)

  // ── MID badge ───────────────────────────────────────────────────────────
  const midText = mid
  ctx.font = '600 14px DM Mono, monospace'
  const midW = ctx.measureText(midText).width + 20
  ctx.fillStyle = '#993C1D'
  roundRect(ctx, W - midW - 16, 22, midW, 26, 13)
  ctx.fill()
  ctx.fillStyle = '#FAECE7'
  ctx.fillText(midText, W - midW - 6, 40)

  // ── Avatar circle ───────────────────────────────────────────────────────
  const avX = 40, avY = 108, avR = 40
  ctx.beginPath()
  ctx.arc(avX, avY, avR, 0, Math.PI * 2)
  ctx.fillStyle = '#FAECE7'
  ctx.fill()
  ctx.strokeStyle = '#F0997B'
  ctx.lineWidth = 2
  ctx.stroke()
  // initials
  const ini = initials(name)
  ctx.fillStyle = '#993C1D'
  ctx.font = `600 ${ini.length === 1 ? 28 : 22}px Inter, system-ui`
  ctx.textAlign = 'center'
  ctx.fillText(ini, avX, avY + 8)
  ctx.textAlign = 'left'

  // ── Owner info ──────────────────────────────────────────────────────────
  const tx = 100
  ctx.fillStyle = '#2C2C2A'
  ctx.font = '600 20px Inter, system-ui'
  ctx.fillText(clip(name, 28), tx, 96)

  ctx.fillStyle = '#5F5E5A'
  ctx.font = '400 13px Inter, system-ui'
  ctx.fillText(`Member since ${since}`, tx, 118)

  // Site info rows
  const rows = [
    ['Site', siteLabel],
  ]
  let ry = 148
  rows.forEach(([label, val]) => {
    ctx.fillStyle = '#888780'
    ctx.font = '400 12px Inter, system-ui'
    ctx.fillText(label, tx, ry)
    ctx.fillStyle = '#2C2C2A'
    ctx.font = '500 12px Inter, system-ui'
    ctx.fillText(clip(val, 36), tx + 42, ry)
    ry += 22
  })

  // ── Footer bar ──────────────────────────────────────────────────────────
  ctx.fillStyle = '#F1EFE8'
  ctx.fillRect(0, H - 36, W, 36)
  // round bottom corners
  ctx.beginPath()
  ctx.moveTo(0, H - 36)
  ctx.lineTo(W, H - 36)
  ctx.lineTo(W, H - 16)
  ctx.quadraticCurveTo(W, H, W - 16, H)
  ctx.lineTo(16, H)
  ctx.quadraticCurveTo(0, H, 0, H - 16)
  ctx.lineTo(0, H - 36)
  ctx.fillStyle = '#F1EFE8'
  ctx.fill()

  ctx.fillStyle = '#888780'
  ctx.font = '400 11px Inter, system-ui'
  ctx.fillText(verifyUrl, 16, H - 12)

  // ── QR placeholder (simple pattern) ─────────────────────────────────────
  drawQRPlaceholder(ctx, W - 80, H - 96, 72)

  // Divider
  ctx.strokeStyle = '#D3D1C7'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, H - 36)
  ctx.lineTo(W, H - 36)
  ctx.stroke()
}

function clip(str, max) {
  if (!str) return '—'
  return str.length > max ? str.slice(0, max) + '…' : str
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawQRPlaceholder(ctx, x, y, size) {
  const cell = size / 7
  // simple 7x7 QR finder pattern simulation
  const pattern = [
    [1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1],
    [1,0,1,0,1,0,1],
    [1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1],
  ]
  // Background
  ctx.fillStyle = '#F1EFE8'
  ctx.fillRect(x - 4, y - 4, size + 8, size + 8)

  pattern.forEach((row, ri) => {
    row.forEach((cell_val, ci) => {
      ctx.fillStyle = cell_val ? '#2C2C2A' : '#F1EFE8'
      ctx.fillRect(x + ci * cell, y + ri * cell, cell - 1, cell - 1)
    })
  })
}
