import { supabase } from '@/lib/supabase'
import type { PostgrestError } from '@supabase/supabase-js'
import type { MembershipRow, ProfileRow, SchoolRow } from '@/types/auth'

// ---------------------------------------------------------------------------
// Reading who the signed-in person is.
//
// WHY THESE FOUR READS RETRY ONCE. A brand-new access token is occasionally
// rejected by PostgREST on the very first request made with it, with 401
// PGRST303 ("JWT claims validation or parsing failed"), and then accepted a
// moment later. Measured on this project twice in one day: a platform admin's
// platform_admins read at 2026-09-23T05:41:19.582Z and a teacher's profiles
// read at 2026-09-23T04:21:22.045Z, each within a second of signing in, each
// carrying a token that was valid for another hour — and in the first case a
// profiles read with THE SAME TOKEN, in the same millisecond, returned 200.
//
// These reads decide whether somebody has an identity at all, so a single
// spurious refusal locked people out of an account that was perfectly intact.
// One retry is enough: the signed-in session is already valid, and a repeat of
// the same request succeeds. Only the token-validation refusals are retried;
// every other error still surfaces immediately, because a retry cannot fix a
// missing row, a refused policy or a bad query.
// ---------------------------------------------------------------------------

/**
 * PostgREST's 401s for a token it would not accept. PGRST301 is "could not be
 * decoded", PGRST303 is "claims validation or parsing failed" — the one
 * actually observed here.
 */
const RETRYABLE_AUTH_CODES = new Set(['PGRST301', 'PGRST303'])

/** Long enough for the condition to pass, short enough to be invisible. */
const RETRY_DELAY_MS = 300

function isRetryableAuthError(error: PostgrestError | null): boolean {
  return error !== null && RETRYABLE_AUTH_CODES.has(error.code)
}

/**
 * True for the failures that are worth telling somebody to try again about,
 * rather than telling them their account has no workspace. Exported so the
 * sign-in screen can say which of the two happened.
 */
export function isTransientIdentityFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  if (typeof code === 'string' && RETRYABLE_AUTH_CODES.has(code)) return true
  // A request that never reached the server: supabase-js surfaces the browser's
  // own failure, which carries no PostgREST code.
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' && /failed to fetch|networkerror|network request failed|load failed/i.test(message)
}

/**
 * Runs a read, and runs it a second time if the first was refused by token
 * validation. `run` rebuilds the query each time, because a PostgREST query
 * builder cannot be awaited twice.
 */
async function withAuthRetry<T>(run: () => PromiseLike<{ data: T; error: PostgrestError | null }>): Promise<T> {
  const first = await run()
  if (!first.error) return first.data
  if (!isRetryableAuthError(first.error)) throw first.error

  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  const second = await run()
  if (second.error) throw second.error
  return second.data
}

export async function fetchProfileByAuthUserId(userId: string): Promise<ProfileRow | null> {
  const data = await withAuthRetry(() => supabase.from('profiles').select('*').eq('id', userId).maybeSingle())
  return data as ProfileRow | null
}

export async function fetchActiveMemberships(userId: string): Promise<MembershipRow[]> {
  const data = await withAuthRetry(() =>
    supabase.from('memberships').select('*').eq('user_id', userId).eq('status', 'active').order('role'),
  )
  return (data ?? []) as MembershipRow[]
}

export async function fetchSchoolById(schoolId: string): Promise<SchoolRow | null> {
  const data = await withAuthRetry(() => supabase.from('schools').select('*').eq('id', schoolId).maybeSingle())
  return data as SchoolRow | null
}

export async function fetchPlatformAdminStatus(userId: string): Promise<boolean> {
  const data = await withAuthRetry(() =>
    supabase.from('platform_admins').select('id').eq('user_id', userId).is('revoked_at', null).maybeSingle(),
  )
  return data !== null
}
