export type EmailField = {
  label: string
  value: string
}

export type BrandedEmail = {
  to: string
  subject: string
  html: string
  text: string
  template: string
}

const BRAND_RED = '#e6252a'
const HEADING_BLUE = '#073b82'
const INK = '#536273'
const MUTED = '#536273'
const LOGO_URL = '/logo-512.png'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[character] ?? character))
}

function layout({ preheader, eyebrow, title, intro, fields, actionLabel, actionUrl, footer }: {
  preheader: string
  eyebrow: string
  title: string
  intro: string
  fields?: EmailField[]
  actionLabel?: string
  actionUrl?: string
  footer?: string
}) {
  const detailRows = fields?.map((field) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #edf0f2;color:${MUTED};font-size:13px;width:38%">${escapeHtml(field.label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #edf0f2;color:${INK};font-size:14px;font-weight:600">${escapeHtml(field.value)}</td>
    </tr>`).join('') ?? ''

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f7f8fa;color:${INK};font-family:Inter,Arial,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #dbe2eb;border-top:8px solid ${BRAND_RED};overflow:hidden">
          <tr><td style="padding:32px 36px 12px;text-align:center">
            <img src="${LOGO_URL}" width="92" height="92" alt="NOM CLOUD" style="display:block;margin:0 auto;object-fit:contain">
            <div style="margin-top:12px;color:${BRAND_RED};font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase">NOM CLOUD</div>
          </td></tr>
          <tr><td style="padding:28px 36px 36px;text-align:left">
            <div style="color:${HEADING_BLUE};font-size:22px;font-weight:700;line-height:1.25;text-transform:uppercase">${escapeHtml(eyebrow)}</div>
            <h1 style="margin:14px 0 14px;color:${HEADING_BLUE};font-size:25px;line-height:1.2">${escapeHtml(title)}</h1>
            <p style="margin:0;color:${MUTED};font-size:15px;line-height:1.7">${escapeHtml(intro)}</p>
            ${fields?.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:26px">${detailRows}</table>` : ''}
            ${actionLabel && actionUrl ? `<a href="${escapeHtml(actionUrl)}" style="display:inline-block;margin-top:28px;padding:13px 20px;background:${BRAND_RED};color:#fff;text-decoration:none;font-size:14px;font-weight:700">${escapeHtml(actionLabel)} &rarr;</a>` : ''}
          </td></tr>
          <tr><td style="padding:22px 36px;background:#fff;color:${MUTED};font-size:12px;line-height:1.6">
            ${escapeHtml(footer ?? 'Nom Cloud · Via Liberia, Mogadishu, Somalia')}<br>
            <a href="mailto:Sul.abdulsaq@gmail.com" style="color:${BRAND_RED};text-decoration:none">Sul.abdulsaq@gmail.com</a>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;color:#98a2b3;font-size:11px">© ${new Date().getFullYear()} Nom Cloud. Built for schools.</p>
      </td></tr>
    </table>
  </body>
</html>`
}

function plainText(title: string, intro: string, fields: EmailField[] = [], actionUrl?: string) {
  return [title, '', intro, '', ...fields.map((field) => `${field.label}: ${field.value}`), actionUrl ? `Action: ${actionUrl}` : ''].filter(Boolean).join('\n')
}

export function buildClientRequestEmail(payload: {
  schoolName: string
  contactName: string
  email: string
  phone?: string
  studentCount?: string
  plan?: string
  message?: string
  submittedAt?: string
  actionUrl?: string
}): BrandedEmail {
  const fields = [
    { label: 'School', value: payload.schoolName },
    { label: 'Contact person', value: payload.contactName },
    { label: 'Email', value: payload.email },
    ...(payload.phone ? [{ label: 'Phone', value: payload.phone }] : []),
    ...(payload.studentCount ? [{ label: 'Students', value: payload.studentCount }] : []),
    ...(payload.plan ? [{ label: 'Plan', value: payload.plan }] : []),
    { label: 'Received', value: payload.submittedAt ?? new Date().toISOString() },
    ...(payload.message ? [{ label: 'Message', value: payload.message }] : []),
  ]
  const title = `New request from ${payload.schoolName}`
  const intro = `${payload.contactName} has submitted a request to use Nom Cloud. Review the details and follow up with the school.`
  return {
    to: 'team@nomcloud.com',
    subject: `[Nom Cloud] New school request · ${payload.schoolName}`,
    html: layout({ preheader: intro, eyebrow: 'New school request', title, intro, fields, actionLabel: 'Review request', actionUrl: payload.actionUrl }),
    text: plainText(title, intro, fields, payload.actionUrl),
    template: 'client-request',
  }
}

export function buildWelcomeEmail(payload: { name: string; email: string; actionUrl: string }): BrandedEmail {
  const title = 'Welcome to Nom Cloud'
  const intro = `Hi ${payload.name}, your school workspace is ready. Use the button below to continue setting up your account.`
  return {
    to: payload.email,
    subject: 'Welcome to Nom Cloud',
    html: layout({ preheader: intro, eyebrow: 'Welcome', title, intro, actionLabel: 'Open Nom Cloud', actionUrl: payload.actionUrl }),
    text: plainText(title, intro, [], payload.actionUrl),
    template: 'welcome',
  }
}
