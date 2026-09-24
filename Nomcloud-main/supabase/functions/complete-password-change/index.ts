import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Clears the first-login password requirement, AFTER the password has changed.
//
// WHY A FUNCTION AND NOT A CLIENT WRITE. `must_change_password` is written by
// approve-school-application into the account's user_metadata, which a signed-in
// client can rewrite for itself through /auth/v1/user. Clearing the flag from
// the browser would therefore be indistinguishable from a caller simply
// switching it off, so the flag is cleared here, with the service role, and only
// when the conditions below hold.
//
// WHAT IS CHECKED, IN ORDER:
//   1. the caller holds a valid session (their own JWT decides who they are —
//      no user id is accepted from the request body, so nobody can clear
//      somebody else's flag);
//   2. that account actually carries the requirement (otherwise nothing to do);
//   3. the account was updated within the last few minutes, which is the trace
//      the password change itself leaves. A caller who has not just changed
//      their password gets 409 and the flag stays on.
//
// WHERE THE ANSWER IS WRITTEN. app_metadata is set to false as well as
// user_metadata. app_metadata cannot be written by a client at all, so once this
// has run the "already done" answer is tamper-proof, and the application reads
// app_metadata in preference to user_metadata.
//
// The new password never reaches this function. It is set by the browser through
// supabase.auth.updateUser({ password }), which is Supabase Auth's own path.
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

/** How recently the account must have been updated for the change to count. */
const RECENT_CHANGE_MS = 5 * 60 * 1000

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

  const { data: caller, error: callerError } = await callerClient.auth.getUser(token)
  if (callerError || !caller.user) return json({ error: 'Authentication is required' }, 401)

  const { data: account, error: accountError } = await adminClient.auth.admin.getUserById(caller.user.id)
  if (accountError || !account.user) return json({ error: 'Account could not be read' }, 500)

  const userMetadata = (account.user.user_metadata ?? {}) as Record<string, unknown>
  const appMetadata = (account.user.app_metadata ?? {}) as Record<string, unknown>
  const required = appMetadata.must_change_password === true || userMetadata.must_change_password === true

  if (!required) return json({ cleared: false, reason: 'not_required' })

  const updatedAt = account.user.updated_at ? Date.parse(account.user.updated_at) : 0
  if (!updatedAt || Date.now() - updatedAt > RECENT_CHANGE_MS) {
    return json({ error: 'Change your password first; this request did not follow one.' }, 409)
  }

  const { error: clearError } = await adminClient.auth.admin.updateUserById(caller.user.id, {
    app_metadata: { ...appMetadata, must_change_password: false },
    user_metadata: { ...userMetadata, must_change_password: false },
  })
  if (clearError) return json({ error: clearError.message }, 500)

  return json({ cleared: true })
})
