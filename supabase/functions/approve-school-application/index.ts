import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApprovalRequest {
  application_id: string
  shortcode: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const temporaryPassword = () => {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------------
// Existing-account handling.
//
// WHY THIS EXISTS. Approval always created a brand-new auth user. If an account
// with the applicant's email already existed, Auth refused with a duplicate-email
// error and the whole approval failed with an unexplained 502. That happened on
// 2026-09-15 with an account left over from the removed public sign-up page.
//
// WHAT COUNTS AS GENUINELY ORPHANED, AND IS THEREFORE SAFE TO REUSE. An auth
// user with the application's email that has:
//   - no profiles row,
//   - no memberships,
//   - no platform_admins row.
// Such an account belongs to no school and grants nothing, so giving it to the
// applicant whose email it is takes nothing from anyone. Anything else — an
// account already attached to a school or to the platform — is refused with 409,
// never reused, because reusing it would move a real person into a new school.
//
// The reused account gets a fresh temporary password, a confirmed email and
// must_change_password, exactly like a newly created one, so the applicant's
// first sign-in is identical either way.
// ---------------------------------------------------------------------------

/** Finds an auth user by email through the Admin API. Pages through the list. */
async function findAuthUserByEmail(adminClient: SupabaseClient, email: string): Promise<User | null> {
  const target = email.trim().toLowerCase()
  const perPage = 1000
  // A hard cap keeps a pathological user count from looping forever.
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const match = data.users.find((user) => user.email?.toLowerCase() === target)
    if (match) return match
    if (data.users.length < perPage) return null
  }
  return null
}

/** True when the account is attached to nothing: no profile, membership or platform-admin row. */
async function isOrphanedAccount(adminClient: SupabaseClient, userId: string): Promise<boolean> {
  const [profile, membership, platformAdmin] = await Promise.all([
    adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('id', userId),
    adminClient.from('memberships').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    adminClient.from('platform_admins').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ])
  for (const result of [profile, membership, platformAdmin]) {
    if (result.error) throw result.error
  }
  return (profile.count ?? 0) === 0 && (membership.count ?? 0) === 0 && (platformAdmin.count ?? 0) === 0
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return json({ error: 'Authentication is required' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Server authentication configuration is incomplete' }, 500)
  }

  const token = authorization.slice('Bearer '.length)
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: userData, error: userError } = await callerClient.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'Authentication is required' }, 401)

  const { data: platformAdmin, error: platformAdminError } = await adminClient
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .is('revoked_at', null)
    .maybeSingle()

  if (platformAdminError) return json({ error: platformAdminError.message }, 500)
  if (!platformAdmin) return json({ error: 'Platform-admin authority is required' }, 403)

  let input: ApprovalRequest
  try {
    input = await request.json() as ApprovalRequest
  } catch {
    return json({ error: 'Request body must be valid JSON' }, 400)
  }

  if (
    typeof input.application_id !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.application_id)
  ) {
    return json({ error: 'Application id must be a UUID' }, 400)
  }
  if (typeof input.shortcode !== 'string' || !/^[a-z0-9]([a-z0-9-]{1,61})[a-z0-9]$/.test(input.shortcode)) {
    return json({ error: 'Shortcode must be DNS-safe, lowercase, and 3-63 characters' }, 400)
  }

  const { data: application, error: applicationError } = await adminClient
    .from('school_applications')
    .select('id, email, status')
    .eq('id', input.application_id)
    .maybeSingle()

  if (applicationError) return json({ error: applicationError.message }, 500)
  if (!application) return json({ error: 'Application not found' }, 404)
  if (application.status !== 'pending') return json({ error: 'Application is no longer pending' }, 409)

  const password = temporaryPassword()
  let authUserId: string
  let reusedExistingAccount = false

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email: application.email,
    password,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  })

  if (!createUserError && createdUser.user) {
    authUserId = createdUser.user.id
  } else {
    // Creation failed. The common cause is an account that already has this
    // email; decide whether it is safe to reuse before reporting anything.
    let existing: User | null
    try {
      existing = await findAuthUserByEmail(adminClient, application.email)
    } catch (lookupError) {
      const message = lookupError instanceof Error ? lookupError.message : String(lookupError)
      return json({ error: `Auth user creation failed (${createUserError?.message ?? 'unknown'}); lookup of an existing account also failed: ${message}` }, 502)
    }

    if (!existing) {
      const duplicate = /duplicate|already|exists|users_email/i.test(createUserError?.message ?? '')
      if (duplicate) {
        // Auth reports the email as taken but cannot return the account. That
        // happens only for a row written directly into auth.users outside the
        // Auth service, which the Admin API cannot see or repair.
        return json({
          error: `An account with ${application.email} already exists but the Auth service cannot load it, so it cannot be reused. It was created outside Supabase Auth and must be removed by an operator before this application can be approved.`,
        }, 409)
      }
      return json({ error: createUserError?.message ?? 'Auth user creation failed' }, 502)
    }

    let orphaned: boolean
    try {
      orphaned = await isOrphanedAccount(adminClient, existing.id)
    } catch (checkError) {
      return json({ error: checkError instanceof Error ? checkError.message : String(checkError) }, 500)
    }

    if (!orphaned) {
      return json({
        error: `An account with ${application.email} already exists and is linked to a school or to the platform. It cannot be reused for a new school; use a different email for this application.`,
      }, 409)
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(existing.user_metadata ?? {}), must_change_password: true },
    })
    if (updateError) {
      return json({ error: `Existing account ${application.email} could not be prepared for reuse: ${updateError.message}` }, 502)
    }

    authUserId = existing.id
    reusedExistingAccount = true
  }

  const { data: approval, error: approvalError } = await callerClient.rpc('approve_school_application', {
    p_application_id: input.application_id,
    p_auth_user_id: authUserId,
    p_shortcode: input.shortcode,
  })

  if (approvalError) {
    // Only an account this request created is removed. A reused account existed
    // before this request and is left in place, still orphaned, so a corrected
    // retry can reuse it again.
    if (!reusedExistingAccount) {
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(authUserId)
      if (cleanupError) {
        return json({ error: approvalError.message, cleanup_error: cleanupError.message }, 500)
      }
    }
    return json({ error: approvalError.message }, 400)
  }

  return json({
    ...approval,
    reused_existing_account: reusedExistingAccount,
    temporary_password: password,
  })
})
