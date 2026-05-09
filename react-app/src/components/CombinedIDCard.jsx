import { useMemo, useRef, useState } from 'react'

const CARD_W = 960
const CARD_H = 560
const GAP = 36
const OUTER_PAD = 24
const PAD_X = 42

const FRONT_TITLE = 'The MyCiti Owners Association (R)'
const BACK_TEXT = `The MyCiti Owners Association (R)
MyCiti, Heggadgere Village
Ramanagara Taluk
Bengaluru Rural District
Phone: +91 9900742192
Layout Supervisor
Email: mycitiownersassociation@gmail.com
Property of MCOA - Not transferable
ID card must be shown at the MyCiti gate during site visit`

export default function CombinedIDCard({ ownership, person, site }) {
  const canvasRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadName, setDownloadName] = useState('mcoa-id-card.png')

  const payload = useMemo(() => {
    const memberName = person?.FullName || ''
    const memberId = String(ownership?.MembershipNo || '')
    const phase = String(ownership?.site?.Phase || ownership?.Phase || site?.Phase || '')
    const siteNo = String(ownership?.site?.SiteNo || ownership?.SiteNo || site?.SiteNo || '')
    const phone = person?.Mobile1 || person?.Mobile2 || '-'
    return {
      memberName,
      memberId,
      phase,
      site: siteNo,
      phone,
      memberSince: formatMemberSince(ownership?.MemberSince),
      issuedText: getCurrentIssuedText(),
      frontTitle: FRONT_TITLE,
      backText: BACK_TEXT,
      qrDataUrl: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`ID:${memberId},Name:${memberName}`)}`,
      sealDataUrl: '/myciti-seal.jpeg',
    }
  }, [ownership, person, site])

  async function handleGeneratePreview() {
    if (!payload.memberId || !payload.phase || !payload.site) {
      setError('Missing membership, phase, or site details for this owner.')
      setStatus('')
      return
    }

    setGenerating(true)
    setError('')
    setStatus('Generating card preview...')

    try {
      const dataUrl = await renderCombinedCanvas(canvasRef.current, payload)
      setPreviewUrl(dataUrl)
      setDownloadName(`mcoa-id-${payload.phase}-${payload.site}-${payload.memberId}.png`)
      setStatus('Preview ready. You can now download the combined image.')
    } catch (e) {
      setError(e.message || 'Preview rendering failed.')
      setStatus('')
    } finally {
      setGenerating(false)
    }
  }

  function handleDownloadCombined() {
    if (!previewUrl) {
      setError('Generate preview first.')
      return
    }

    setDownloading(true)
    try {
      const a = document.createElement('a')
      a.href = previewUrl
      a.download = downloadName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-sm" style={{ background: '#0f766e', color: '#fff', borderColor: '#0f766e' }} onClick={handleGeneratePreview} disabled={generating}>
          {generating ? 'Generating...' : 'Generate Preview'}
        </button>
        <button className="btn btn-sm" onClick={handleDownloadCombined} disabled={!previewUrl || generating || downloading}>
          {downloading ? 'Preparing...' : 'Download Combined PNG'}
        </button>
      </div>

      {status && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 10 }}>{status}</div>}
      {error && <div style={{ fontSize: 12, color: 'var(--disputed)', marginBottom: 10 }}>{error}</div>}

      {previewUrl && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Combined Front + Back</div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>
            Member: {payload.memberName || '-'} | Member ID: {payload.memberId} | Phase: {payload.phase} | Site: {payload.site}
          </div>
          <div style={{ border: '1px dashed #9fb4d4', borderRadius: 8, padding: 8, background: '#fff' }}>
            <img src={previewUrl} alt="Combined card preview" style={{ width: '100%', height: 'auto', borderRadius: 6, display: 'block' }} />
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}

function getCurrentIssuedText() {
  const now = new Date()
  const monthYear = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  return `Issued: ${monthYear}`
}

function formatMemberSince(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    const dd = String(date.getDate()).padStart(2, '0')
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const yyyy = date.getFullYear()
    return `${dd}.${mm}.${yyyy}`
  }
  return String(value)
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function renderCombinedCanvas(canvas, payload) {
  if (!canvas) throw new Error('Canvas is not ready.')

  canvas.width = CARD_W + (OUTER_PAD * 2)
  canvas.height = (CARD_H * 2) + GAP + (OUTER_PAD * 2)

  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const [qrImg, sealImg] = await Promise.all([
    loadImage(payload.qrDataUrl),
    loadImage(payload.sealDataUrl),
  ])

  const x = OUTER_PAD
  const frontY = OUTER_PAD
  const backY = OUTER_PAD + CARD_H + GAP

  drawFrontCard(ctx, payload, x, frontY, qrImg, sealImg)
  drawBackCard(ctx, payload, x, backY)
  drawCutMarks(ctx, x, frontY, CARD_W, CARD_H)
  drawCutMarks(ctx, x, backY, CARD_W, CARD_H)

  return canvas.toDataURL('image/png')
}

function drawFrontCard(ctx, payload, x, y, qrImg, sealImg) {
  const headerH = 52
  const qrSize = 160
  const logoH = 74
  const footerY = y + CARD_H - 68
  const nameY = y + headerH + 58
  const detailsY = nameY + 58
  const qrX = x + CARD_W - PAD_X - qrSize
  const qrY = detailsY - 8

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(x, y, CARD_W, CARD_H)

  ctx.fillStyle = String(payload.phase) === '1' ? '#1C4587' : '#2E7D32'
  ctx.fillRect(x, y, CARD_W, headerH)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = '500 22px Segoe UI, Arial, sans-serif'
  ctx.fillText(payload.frontTitle || 'MyCiti Owners Association (R)', x + PAD_X, y + 34)

  const nameMax = CARD_W - (PAD_X * 2) - 10
  const nameSize = fitFontSize(ctx, payload.memberName || '', nameMax, 64, 40)
  ctx.fillStyle = '#111827'
  ctx.font = `700 ${nameSize}px Segoe UI, Arial, sans-serif`
  ctx.fillText(payload.memberName || '', x + PAD_X, nameY)

  ctx.font = '700 31px Segoe UI, Arial, sans-serif'
  ctx.fillText(`Member ID: ${payload.memberId}`, x + PAD_X, detailsY)

  ctx.font = '400 29px Segoe UI, Arial, sans-serif'
  ctx.fillText(`Phase ${payload.phase} - Site ${payload.site}`, x + PAD_X, detailsY + 44)
  ctx.fillText(`Phone: ${payload.phone}`, x + PAD_X, detailsY + 84)
  ctx.fillText(`Member Since: ${payload.memberSince}`, x + PAD_X, detailsY + 124)

  if (qrImg) {
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)
  } else {
    ctx.strokeStyle = '#334155'
    ctx.strokeRect(qrX, qrY, qrSize, qrSize)
    ctx.fillStyle = '#334155'
    ctx.font = '600 18px Segoe UI, Arial, sans-serif'
    ctx.fillText('QR', qrX + 62, qrY + 90)
  }

  ctx.fillStyle = '#d97706'
  ctx.fillRect(qrX + 8, qrY + qrSize + 24, qrSize - 16, 4)
  ctx.fillStyle = '#b91c1c'
  ctx.font = '600 34px Segoe UI, Arial, sans-serif'
  ctx.fillText('MyCiti', qrX + 24, qrY + qrSize + 58)

  if (sealImg) {
    const sealW = CARD_W * 0.50
    const sealH = sealW
    const sealX = x + CARD_W * 0.30
    const sealY = y + CARD_H * 0.33
    ctx.save()
    ctx.globalAlpha = 0.24
    ctx.drawImage(sealImg, sealX, sealY, sealW, sealH)
    ctx.restore()
  } else {
    drawSealWatermark(ctx, x, y)
  }

  ctx.fillStyle = '#111827'
  ctx.font = '400 26px Segoe UI, Arial, sans-serif'
  ctx.fillText(payload.issuedText || getCurrentIssuedText(), x + PAD_X, footerY)
}

function drawBackCard(ctx, payload, x, y) {
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(x, y, CARD_W, CARD_H)

  const innerX = x + 54
  const innerY = y + 64
  const textW = CARD_W - 108

  const lines = String(payload.backText || '').split('\n')
  let yy = innerY
  for (let i = 0; i < lines.length; i += 1) {
    const isLastLine = i === lines.length - 1
    ctx.fillStyle = isLastLine ? '#7c2d12' : '#111827'
    ctx.font = isLastLine ? '700 24px Segoe UI, Arial, sans-serif' : '400 28px Segoe UI, Arial, sans-serif'
    if (isLastLine) yy += 18
    drawWrappedLines(ctx, lines[i], innerX, yy, textW, isLastLine ? 30 : 34)
    yy += 40
  }
}

function drawWrappedLines(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(/\s+/)
  let line = ''
  let yy = y
  for (let i = 0; i < words.length; i += 1) {
    const test = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy)
      yy += lineHeight
      line = words[i]
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, yy)
}

function drawCutMarks(ctx, x, y, w, h) {
  const len = 16
  const off = 5
  ctx.strokeStyle = '#BBBBBB'
  ctx.lineWidth = 2

  const line = (x1, y1, x2, y2) => {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  line(x - off, y, x - off, y + len)
  line(x, y - off, x + len, y - off)
  line(x + w + off, y, x + w + off, y + len)
  line(x + w - len, y - off, x + w, y - off)
  line(x - off, y + h - len, x - off, y + h)
  line(x, y + h + off, x + len, y + h + off)
  line(x + w + off, y + h - len, x + w + off, y + h)
  line(x + w - len, y + h + off, x + w, y + h + off)
}

function fitFontSize(ctx, text, maxW, start, min) {
  let size = start
  while (size > min) {
    ctx.font = `700 ${size}px Segoe UI, Arial, sans-serif`
    if (ctx.measureText(text).width <= maxW) return size
    size -= 1
  }
  return min
}

function drawSealWatermark(ctx, x, y) {
  const cx = x + CARD_W * 0.54
  const cy = y + CARD_H * 0.60
  const r = CARD_W * 0.18

  ctx.save()
  ctx.globalAlpha = 0.24
  ctx.strokeStyle = '#7c6bb6'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = '#7c6bb6'
  ctx.textAlign = 'center'
  ctx.font = '700 54px Segoe UI, Arial, sans-serif'
  ctx.fillText('BIDADI', cx, cy - 8)
  ctx.font = '700 50px Segoe UI, Arial, sans-serif'
  ctx.fillText('562 109', cx, cy + 48)

  ctx.restore()
  ctx.textAlign = 'start'
}