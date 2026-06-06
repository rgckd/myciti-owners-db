import { useEffect, useRef, useState } from 'react'
import { formatCurrency, formatDate } from '../utils/constants.js'

const RECEIPT_CONTACT_LINES = [
  'The MyCiti Owners Association (R)',
  'MyCiti, Heggadgere Village',
  'Ramanagara Taluk, Bengaluru Rural District',
  'Contact Treasurer: Mr. Vijay Kumar · +91 98451 5747',
  'Email: mycitilayout@gmail.com (for questions)',
]

export default function PaymentReceiptModal({ receipt, onClose }) {
  const canvasRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const [seal, setSeal] = useState(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => setSeal(img)
    img.onerror = () => setSeal(null)
    img.src = '/myciti-seal.jpeg'
  }, [])

  useEffect(() => {
    if (!canvasRef.current || !receipt) return
    drawReceipt(canvasRef.current, receipt, seal)
  }, [receipt, seal])

  function handleDownload() {
    if (!canvasRef.current) return
    setDownloading(true)
    try {
      const safeNo = String(receipt.receiptNo || 'receipt').replace(/[^a-zA-Z0-9]/g, '_')
      const link = document.createElement('a')
      link.download = `MCOA_Receipt_${safeNo}.png`
      link.href = canvasRef.current.toDataURL('image/png')
      link.click()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 760,
        border: '1px solid var(--border)', overflow: 'hidden'
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Generated receipt</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>x</button>
        </div>

        <div style={{ padding: 16, background: 'var(--surface-2)', display: 'flex', justifyContent: 'center' }}>
          <canvas
            ref={canvasRef}
            width={900}
            height={1200}
            style={{ width: '100%', maxWidth: 520, height: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }}
          />
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Preparing...' : 'Download PNG'}
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function drawReceipt(canvas, data, seal) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)

  // Letterhead
  ctx.fillStyle = '#D85A30'
  ctx.fillRect(0, 0, w, 120)
  ctx.fillStyle = '#FAECE7'
  ctx.font = '700 40px Segoe UI, Arial, sans-serif'
  ctx.fillText('MYCITI OWNERS ASSOCIATION (R)', 34, 56)
  ctx.font = '500 22px Segoe UI, Arial, sans-serif'
  ctx.fillStyle = '#F9B39B'
  ctx.fillText('Bidadi, Ramanagara District', 34, 92)

  if (seal) {
    ctx.save()
    ctx.globalAlpha = 0.13
    ctx.drawImage(seal, w - 305, 515, 250, 250)
    ctx.restore()
  }

  let y = 170
  ctx.fillStyle = '#2C2C2A'
  ctx.font = '700 34px Segoe UI, Arial, sans-serif'
  ctx.fillText('PAYMENT RECEIPT', 34, y)

  y += 52
  ctx.font = '600 24px Segoe UI, Arial, sans-serif'
  ctx.fillText(`Receipt No: ${data.receiptNo || '-'}`, 34, y)

  y += 38
  ctx.font = '500 22px Segoe UI, Arial, sans-serif'
  ctx.fillText(`Issue Date: ${formatDate(data.issueDate)}`, 34, y)

  y += 48
  drawRow(ctx, 'Received From', data.ownerName || '-', 34, y)
  y += 42
  drawRow(ctx, 'Site', `Site ${data.siteNo || '-'} · Phase ${data.phase || '-'}`, 34, y)
  y += 42
  drawRow(ctx, 'Payment Head', data.headName || data.headId || '-', 34, y)
  y += 42
  drawRow(ctx, 'Amount', formatCurrency(data.amount), 34, y)
  y += 42
  drawRow(ctx, 'Mode', data.mode || '-', 34, y)
  y += 42
  drawRow(ctx, 'Bank Ref / UTR', data.bankRef || '-', 34, y)
  y += 42
  drawRow(ctx, 'Payment Date', formatDate(data.paymentDate), 34, y)
  y += 42
  drawRow(ctx, 'Recorded By', data.recordedBy || '-', 34, y)

  y += 64
  ctx.strokeStyle = '#D7D4CB'
  ctx.beginPath()
  ctx.moveTo(34, y)
  ctx.lineTo(w - 34, y)
  ctx.stroke()

  y += 38
  ctx.fillStyle = '#5F5E5A'
  ctx.font = '500 18px Segoe UI, Arial, sans-serif'
  ctx.fillText('This is a digitally generated receipt.', 34, y)

  y += 40
  ctx.fillStyle = '#6A6860'
  ctx.font = '500 17px Segoe UI, Arial, sans-serif'
  RECEIPT_CONTACT_LINES.forEach(line => {
    ctx.fillText(line, 34, y)
    y += 28
  })
}

function drawRow(ctx, label, value, x, y) {
  ctx.fillStyle = '#8A887F'
  ctx.font = '500 19px Segoe UI, Arial, sans-serif'
  ctx.fillText(label, x, y)
  ctx.fillStyle = '#2C2C2A'
  ctx.font = '600 20px Segoe UI, Arial, sans-serif'
  ctx.fillText(String(value || '-'), x + 230, y)
}
