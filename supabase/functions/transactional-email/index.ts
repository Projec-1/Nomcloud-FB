const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const SENDER = 'Nom Cloud <onboarding@resend.dev>'

type TemplateName = 'application_link' | 'invitation'

interface EmailRequest {
  recipient: string
  template: TemplateName
  variables: Record<string, unknown>
}

/*
 * Transactional email sender. RESEND_API_KEY is read only from Supabase Edge
 * Function secrets and is never returned or logged. Resend's shared
 * onboarding@resend.dev sender is currently limited on free accounts and will
 * usually deliver only to the account owner's address; this is expected during
 * testing, not a delivery defect. Configure a verified domain before launch.
 */

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidLink(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

function isOptionalName(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length <= 200)
}

function maskRecipient(recipient: string): string {
  const [localPart, domain] = recipient.split('@')
  return `${localPart.slice(0, 1)}***@${domain}`
}

function renderTemplate(template: TemplateName, variables: Record<string, unknown>): { subject: string; text: string } | null {
  const link = variables.link
  const recipientName = variables.recipientName
  const schoolName = variables.schoolName
  if (!isValidLink(link) || !isOptionalName(recipientName)) return null

  const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,'

  if (template === 'application_link') {
    if (schoolName !== undefined && (typeof schoolName !== 'string' || schoolName.length > 200)) return null
    return {
      subject: 'Complete your Nom Cloud school application',
      text: `${greeting}

You started a school application with Nom Cloud. Use the link below to complete it:

${link}

Purpose: complete your school application.
Expiry: this link may expire; request a new link if it no longer works.

From: Nom Cloud
`,
    }
  }

  if (typeof schoolName !== 'string' || schoolName.length === 0 || schoolName.length > 200) return null
  return {
    subject: `Your Nom Cloud invitation for ${schoolName}`,
    text: `${greeting}

You have been invited to join ${schoolName} on Nom Cloud. Use the link below to accept your invitation:

${link}

Purpose: accept your school invitation and complete account setup.
Expiry: this invitation expires 7 days after it was issued.

From: Nom Cloud
`,
  }
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === keys.slice().sort()[index])
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405)

  const authorization = request.headers.get('authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !supabaseAnonKey) {
    return json({ ok: false, error: 'Authentication required.' }, 401)
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      authorization,
    },
  })
  if (!authResponse.ok) return json({ ok: false, error: 'Authentication required.' }, 401)

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.error('Transactional email unavailable: RESEND_API_KEY is not configured.')
    return json({ ok: false, error: 'Email service is not configured.' }, 500)
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return json({ ok: false, error: 'Request body must be valid JSON.' }, 400)
  }

  if (!isPlainObject(payload) || !hasExactKeys(payload, ['recipient', 'template', 'variables'])) {
    return json({ ok: false, error: 'Payload must contain only recipient, template, and variables.' }, 400)
  }

  const { recipient, template, variables } = payload as Partial<EmailRequest>
  if (!isValidEmail(recipient) || (template !== 'application_link' && template !== 'invitation') || !isPlainObject(variables)) {
    return json({ ok: false, error: 'Invalid email request.' }, 400)
  }

  const allowedVariableKeys = template === 'invitation' ? ['link', 'recipientName', 'schoolName'] : ['link', 'recipientName']
  if (!hasExactKeys(variables, allowedVariableKeys)) {
    return json({ ok: false, error: 'Invalid template variables.' }, 400)
  }

  const rendered = renderTemplate(template, variables)
  if (!rendered) return json({ ok: false, error: 'Invalid template variables.' }, 400)

  try {
    const resendResponse = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: SENDER,
        to: [recipient],
        subject: rendered.subject,
        text: rendered.text,
      }),
    })

    if (!resendResponse.ok) {
      console.error('Transactional email provider rejected request.', { status: resendResponse.status })
      return json({ ok: false, error: 'Email delivery failed.' }, 502)
    }

    const result = await resendResponse.json().catch(() => null)
    console.info('Transactional email sent.', { template, recipient: maskRecipient(recipient) })
    return json({ ok: true, id: typeof result?.id === 'string' ? result.id : undefined })
  } catch {
    console.error('Transactional email provider request failed.')
    return json({ ok: false, error: 'Email delivery failed.' }, 502)
  }
})
