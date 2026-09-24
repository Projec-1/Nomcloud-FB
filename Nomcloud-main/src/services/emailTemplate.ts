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

const BRAND_ORANGE = '#FF5A1F'
const INK = '#101114'
const MUTED = '#667085'
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
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f8fa;padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #e9ecef;border-radius:20px;overflow:hidden">
          <tr><td style="padding:28px 32px;border-bottom:1px solid #f0f1f3">
            <table role="presentation" width="100%"><tr>
              <td><img src="${LOGO_URL}" width="34" height="34" alt="Nom Cloud" style="vertical-align:middle;border-radius:9px;margin-right:9px"><span style="vertical-align:middle;font-size:18px;font-weight:700;letter-spacing:-.4px">${'Nom Cloud'}</span></td>
              <td align="right" style="font-size:12px;color:${MUTED}">School operations, simplified.</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:40px 32px 28px">
            <div style="color:${BRAND_ORANGE};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">${escapeHtml(eyebrow)}</div>
            <h1 style="margin:12px 0 12px;font-size:30px;line-height:1.15;letter-spacing:-1px">${escapeHtml(title)}</h1>
            <p style="margin:0;color:${MUTED};font-size:15px;line-height:1.7">${escapeHtml(intro)}</p>
            ${fields?.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:26px">${detailRows}</table>` : ''}
            ${actionLabel && actionUrl ? `<a href="${escapeHtml(actionUrl)}" style="display:inline-block;margin-top:28px;padding:13px 20px;border-radius:999px;background:${BRAND_ORANGE};color:#fff;text-decoration:none;font-size:14px;font-weight:700">${escapeHtml(actionLabel)} &rarr;</a>` : ''}
          </td></tr>
          <tr><td style="padding:22px 32px;background:#fafafa;color:${MUTED};font-size:12px;line-height:1.6">
            ${escapeHtml(footer ?? 'Nom Cloud · Via Liberia, Mogadishu, Somalia')}<br>
            <a href="mailto:Sul.abdulsaq@gmail.com" style="color:${BRAND_ORANGE};text-decoration:none">Sul.abdulsaq@gmail.com</a>
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

