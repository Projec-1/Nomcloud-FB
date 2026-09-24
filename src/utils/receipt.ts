export interface ReceiptDetails {
  reference: string
  schoolName: string
  studentName: string
  category: string
  amount: number
  method: string
  payerName: string
  date: string
}

const methodLabels: Record<string, string> = {
  card: 'Debit / Credit Card',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank Transfer',
  edahab: 'eDahab',
  evc_plus: 'EVC Plus',
  cash: 'Cash',
}

/**
 * Renders a payment receipt to a PNG image (via the Canvas API — no external
 * dependency needed) and triggers a browser download. This is the client-side
 * "evidence of transaction" a parent can keep or forward to the school.
 */
export function downloadReceiptImage(details: ReceiptDetails) {
  const width = 640
  const height = 820
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Background
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  // Top brand band
  const gradient = ctx.createLinearGradient(0, 0, width, 0)
  gradient.addColorStop(0, '#FF5A1F')
  gradient.addColorStop(1, '#0071E3')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, 120)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = '600 26px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
  ctx.fillText('Nom Cloud', 40, 60)
  ctx.font = '400 13px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
  ctx.fillText('Payment Receipt', 40, 86)

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '600 13px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('PAID', width - 40, 70)
  ctx.textAlign = 'left'

  // Success badge
  ctx.fillStyle = '#F5F5F7'
  ctx.beginPath()
  ctx.roundRect(40, 150, width - 80, 90, 20)
  ctx.fill()
  ctx.fillStyle = '#1D1D1F'
  ctx.font = '600 30px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
  ctx.fillText(
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(details.amount),
    62,
    205,
  )
  ctx.fillStyle = '#6E6E73'
  ctx.font = '400 13px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
  ctx.fillText('Amount Paid', 62, 227)

  // Detail rows
  const rows: [string, string][] = [
    ['Reference', details.reference],
    ['School', details.schoolName],
    ['Student', details.studentName],
    ['Fee category', details.category],
    ['Payment method', methodLabels[details.method] ?? details.method],
    ['Paid by', details.payerName],
    ['Date', new Date(details.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })],
  ]

  let y = 290
  rows.forEach(([label, value], i) => {
    if (i > 0) {
      ctx.strokeStyle = '#E5E5E7'
      ctx.beginPath()
      ctx.moveTo(40, y - 22)
      ctx.lineTo(width - 40, y - 22)
      ctx.stroke()
    }
    ctx.fillStyle = '#6E6E73'
    ctx.font = '400 13px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
    ctx.fillText(label, 40, y)
    ctx.fillStyle = '#1D1D1F'
    ctx.font = '600 14px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(value, width - 40, y)
    ctx.textAlign = 'left'
    y += 44
  })

  // Footer
  ctx.fillStyle = '#8E8E93'
  ctx.font = '400 11px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
  ctx.fillText('This receipt was generated automatically by Nom Cloud and serves as proof of payment.', 40, height - 50)
  ctx.fillText(`Generated ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`, 40, height - 30)

  const dataUrl = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `nomcloud-receipt-${details.reference}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
