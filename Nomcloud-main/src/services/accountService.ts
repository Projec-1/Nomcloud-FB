import { supabase } from '@/lib/supabase'
import type { AuthSessionUser } from '@/types/auth'

// ---------------------------------------------------------------------------
// The first-login password requirement.
//
// A school administrator provisioned by approve-school-application is created
// with a temporary password and `must_change_password` on the account. The flag
// says "this person has never chosen their own password", and until they have,
// the interface refuses the workspace.
//
// READ FROM app_metadata FIRST. Supabase exposes two metadata bags on an
// account: user_metadata, which a signed-in client may rewrite for itself, and
// app_metadata, which it may not. Provisioning writes the flag into
// user_metadata; complete-password-change writes the CLEARED answer into
// app_metadata. Preferring app_metadata therefore means the "already done"
// state cannot be forged from a browser, while accounts provisioned before this
// existed still read correctly from user_metadata.
// ---------------------------------------------------------------------------

function flagFrom(bag: unknown): boolean | undefined {
  if (typeof bag !== 'object' || bag === null) return undefined
  const value = (bag as Record<string, unknown>).must_change_password
  return typeof value === 'boolean' ? value : undefined
}

/** True when this account must choose a new password before doing anything else. */
export function mustChangePassword(user: AuthSessionUser | null): boolean {
  if (!user) return false
  return flagFrom(user.app_metadata) ?? flagFrom(user.user_metadata) ?? false
}

/**
 * Sets the person's own password and retires the requirement.
 *
 *   1. `supabase.auth.updateUser({ password })` — Supabase Auth's own call, on
 *      the caller's session. The password is never sent anywhere else.
 *   2. `complete-password-change` — clears the flag with the service role, after
 *      checking server-side that a change just happened. The browser cannot
 *      clear it itself; see that function's header.
 *   3. Sign out. The temporary password is dead, so the session it opened
 *      should not outlive it: the person signs in again with what they chose.
 */
export async function completeFirstLoginPasswordChange(newPassword: string): Promise<void> {
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) throw updateError

  const { error: clearError } = await supabase.functions.invoke('complete-password-change')
  if (clearError) {
    // The password IS already changed at this point. Saying so matters: telling
    // someone it failed would send them back to a password that no longer works.
    throw new Error(
      'Your password was changed, but we could not finish setting up your account. Please sign in with your new password and contact support if you are asked to change it again.',
    )
  }

  await supabase.auth.signOut()
}
