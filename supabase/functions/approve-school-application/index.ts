import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email: application.email,
    password,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  })

  if (createUserError || !createdUser.user) {
    return json({ error: createUserError?.message ?? 'Auth user creation failed' }, 502)
  }

  const { data: approval, error: approvalError } = await callerClient.rpc('approve_school_application', {
    p_application_id: input.application_id,
    p_auth_user_id: createdUser.user.id,
    p_shortcode: input.shortcode,
  })

  if (approvalError) {
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(createdUser.user.id)
    if (cleanupError) {
      return json({ error: approvalError.message, cleanup_error: cleanupError.message }, 500)
    }
    return json({ error: approvalError.message }, 400)
  }

  return json({
    ...approval,
    temporary_password: password,
  })
})
