import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Inviting one teacher or guardian.
//
// ONE PERSON PER CALL, deliberately. Bulk invitation is the caller looping over
// this with pacing, so a single failure is one row's failure and every other row
// still goes out, and so progress can be shown honestly.
//
// WHO MAY INVITE IS NOT DECIDED HERE. The invitation row is inserted with the
// CALLER'S OWN session, so invitations_admin_insert decides: owner, director or
// administrator of that school, and invited_by = auth.uid(). A teacher or
// guardian calling this gets the same refusal they would get from the database,
// because it IS the database refusing. The service role is used only to create
// the account and send the email — never to write the invitation.
//
// NO PASSWORD, NO TOKEN IN A LINK. The account is created by Supabase Auth's
// invite, which emails a single-use link that lands on /activate. The invitation
// row carries the authority (school, role, teacher_id or guardian_id) and is
// claimed there by accept_pending_invitation() against the signed-in address, so
// nothing secret travels in the URL.
//
// THE ROW IS ONLY AS TRUE AS THE EMAIL. If the email cannot be sent, the
// invitation just written is revoked again before answering, so "invited" never
// describes somebody who was never written to.
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

/** Seven days, matching the invitations table's own expectation. */
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

interface InviteRequest {
  school_id: string
  role: 'teacher' | 'guardian'
  /** teachers.id or guardians.id — which one is decided by `role`. */
  person_id: string
}

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

/** A random token, stored only as its SHA-256. The raw value is never used or kept. */
async function tokenHash(): Promise<string> {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Where the activation link must land.
 *
 * THIS IS NOT TAKEN FROM THE CALLER. It used to be built from the request's
 * Origin header, which meant the link pointed wherever the ADMINISTRATOR
 * happened to be. That silently broke invitations twice on 2026-09-24: an
 * administrator working against a local dev server sent invitations whose
 * Origin was http://localhost:5173, the https check rejected it, no redirectTo
 * was sent at all, and Supabase fell back to the project's Site URL — so the
 * invited teacher opened their email and arrived on the marketing homepage with
 * no activation screen and no password form.
 *
 * The same silent fallback happens for any https origin that is not on
 * Supabase's redirect allow-list: a Vercel preview or deployment-specific URL,
 * a www. host, a school subdomain, a future custom domain. Supabase reports no
 * error for any of them.
 *
 * So the origin is CONFIGURED, not observed. APP_ORIGIN is the one host whose
 * /activate is on the allow-list. The request's own origin is used only if
 * APP_ORIGIN is unset, and only when it is https — the old behaviour, kept so a
 * local stack without the secret still functions.
 */
const activationRedirect = (request: Request): string | undefined => {
  const configured = Deno.env.get('APP_ORIGIN')?.trim()
  if (configured) {
    try {
      return `${new URL(configured).origin}/activate`
    } catch {
      // A malformed secret must not silently become "no redirect at all".
      console.error(`APP_ORIGIN is not a valid URL: ${configured}`)
    }
  }
  const origin = request.headers.get('Origin') ?? ''
  try {
    const url = new URL(origin)
    return url.protocol === 'https:' ? `${url.origin}/activate` : undefined
  } catch {
    return undefined
  }
}

/** Finds an auth user by email through the Admin API. Pages through the list. */
async function findAuthUserByEmail(adminClient: SupabaseClient, email: string) {
  const target = email.trim().toLowerCase()
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const match = data.users.find((user) => user.email?.toLowerCase() === target)
    if (match) return match
    if (data.users.length < 1000) return null
  }
  return null
}

/**
 * Sends the activation email: an invite for an account that has never been
 * activated, a recovery link for one that already has a password. Both land on
 * /activate, which claims the invitation.
 *
 * THE RECOVERY FALLBACK ONLY APPLIES TO AN ADDRESS THAT ALREADY HAS AN ACCOUNT.
 * /recover is deliberately non-enumerable: for an address Supabase does not
 * know, it answers 200 and sends nothing at all. Reading that 200 as delivery
 * is how this function once reported "invitation sent" for three people who
 * were never emailed, leaving their invitations live. For a new invitee a
 * failed invite is simply a failed send, and is reported as one.
 */
async function sendActivationEmail(
  adminClient: SupabaseClient,
  email: string,
  redirectTo: string | undefined,
  hasAccount: boolean,
  metadata: Record<string, string>,
) {
  // `metadata` becomes auth.users.user_metadata, which the Invite email
  // template reads as {{ .Data.<key> }}. Without it the template has no way to
  // name the school or the role, and Go templates render a missing key as
  // "<no value>" — so the keys written here and the keys used in the template
  // must stay in step.
  const invite = await adminClient.auth.admin.inviteUserByEmail(email, {
    ...(redirectTo ? { redirectTo } : {}),
    data: metadata,
  })
  if (!invite.error) return { sent: true, kind: 'invite' as const }

  if (!hasAccount) return { sent: false, kind: 'invite' as const, error: invite.error.message }

  const recovery = await adminClient.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined)
  if (!recovery.error) return { sent: true, kind: 'recovery' as const }
  return { sent: false, kind: 'recovery' as const, error: recovery.error.message }
}

/** The mail server's own words, flattened so they fit in one readable line. */
const tidy = (reason: string | undefined) => (reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 220)

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication is required' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Server authentication configuration is incomplete' }, 500)
  }

  const token = authorization.slice('Bearer '.length)
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: caller, error: callerError } = await callerClient.auth.getUser(token)
  if (callerError || !caller.user) return json({ error: 'Authentication is required' }, 401)

  let input: InviteRequest
  try {
    input = await request.json() as InviteRequest
  } catch {
    return json({ error: 'Request body must be valid JSON' }, 400)
  }

  if (!isUuid(input.school_id) || !isUuid(input.person_id) || (input.role !== 'teacher' && input.role !== 'guardian')) {
    return json({ error: 'school_id, person_id and role (teacher or guardian) are required' }, 400)
  }

  // The person's own record, read with the CALLER's session: somebody who may
  // not see this school's people cannot invite them either.
  const table = input.role === 'teacher' ? 'teachers' : 'guardians'
  const { data: person, error: personError } = await callerClient
    .from(table)
    .select('id, full_name, email, status')
    .eq('school_id', input.school_id)
    .eq('id', input.person_id)
    .maybeSingle()

  if (personError) return json({ error: personError.message }, 500)
  if (!person) return json({ status: 'skipped', reason: 'not_found', message: 'That person is not in this school.' }, 404)

  const email = (person.email ?? '').trim().toLowerCase()
  if (!email) {
    return json({ status: 'skipped', reason: 'no_email', name: person.full_name, message: 'No email address on record.' })
  }

  // Already has an account AND a membership here: there is nothing to activate.
  const existingUser = await findAuthUserByEmail(adminClient, email)
  if (existingUser) {
    const { data: membership } = await adminClient
      .from('memberships')
      .select('role, status')
      .eq('user_id', existingUser.id)
      .eq('school_id', input.school_id)
      .eq('role', input.role)
      .maybeSingle()
    if (membership?.status === 'active') {
      return json({ status: 'skipped', reason: 'already_active', email, name: person.full_name, message: 'They already have access.' })
    }
    if (membership?.status === 'suspended') {
      return json({ status: 'skipped', reason: 'access_revoked', email, name: person.full_name, message: 'Their access was revoked. Restore it instead of inviting.' })
    }
  }

  // The invitation itself, written as the caller so RLS decides who may invite.
  const { data: invitation, error: invitationError } = await callerClient
    .from('invitations')
    .insert({
      school_id: input.school_id,
      email,
      role: input.role,
      teacher_id: input.role === 'teacher' ? input.person_id : null,
      guardian_id: input.role === 'guardian' ? input.person_id : null,
      token_hash: await tokenHash(),
      expires_at: new Date(Date.now() + INVITATION_LIFETIME_MS).toISOString(),
      invited_by: caller.user.id,
    })
    .select('id')
    .single()

  if (invitationError) {
    if (invitationError.code === '23505') {
      return json({ status: 'skipped', reason: 'already_invited', email, name: person.full_name, message: 'A live invitation already exists. Revoke it first to send a new one.' })
    }
    if (invitationError.code === '42501') {
      return json({ status: 'failed', reason: 'not_allowed', email, name: person.full_name, message: 'Only an owner, director or administrator of this school may invite.' }, 403)
    }
    return json({ status: 'failed', reason: 'database', email, name: person.full_name, message: invitationError.message }, 500)
  }

  // The school's own name, for the email. Read with the service role because
  // the email must say the same thing whoever triggered it; authority to invite
  // was already settled by the insert above.
  const { data: school } = await adminClient.from('schools').select('name').eq('id', input.school_id).maybeSingle()

  const sent = await sendActivationEmail(adminClient, email, activationRedirect(request), existingUser !== null, {
    school_name: school?.name ?? '',
    role_label: input.role === 'teacher' ? 'Teacher' : 'Parent',
    full_name: person.full_name ?? '',
  })
  if (!sent.sent) {
    // Keep the record honest: nothing was delivered, so nothing is pending. If
    // even the revoke fails, say so — a row left live would otherwise block the
    // next attempt with "a live invitation already exists", and the
    // administrator would have no idea why.
    const { error: revokeError } = await adminClient
      .from('invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', invitation.id)

    const why = tidy(sent.error)
    return json(
      {
        status: 'failed',
        reason: 'email',
        email,
        name: person.full_name,
        revoked: !revokeError,
        message: revokeError
          ? `No email could be sent to ${email}, and the invitation could not be cancelled afterwards. Revoke it by hand before trying again.${why ? ` Mail server: ${why}` : ''}`
          : `No email could be sent to ${email}, so the invitation was cancelled. Nothing has reached them — you can try again once email is working.${why ? ` Mail server: ${why}` : ''}`,
      },
      502,
    )
  }

  return json({ status: 'sent', email, name: person.full_name, invitation_id: invitation.id, email_kind: sent.kind })
})
