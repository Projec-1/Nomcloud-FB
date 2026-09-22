// ---------------------------------------------------------------------------
// What the page was opened with, captured BEFORE anything else runs.
//
// Supabase's password-recovery link points at /auth/v1/verify, which answers
// with a 303 to the redirect target and puts the result in the URL FRAGMENT:
//
//   /reset-password#access_token=…&refresh_token=…&type=recovery
//   /reset-password#error=access_denied&error_description=Email+link+is+invalid…
//
// The supabase-js client is created with detectSessionInUrl on (its default),
// so on load it reads that fragment, stores the session and STRIPS the
// fragment from the address bar. By the time a React component mounts the
// evidence can already be gone, and a page that only looked at
// window.location would be unable to tell three different situations apart:
//
//   a real recovery arrival, an expired or reused link, and somebody simply
//   typing /reset-password while already signed in.
//
// This module is imported first in main.tsx, so the values below are read at
// the very start of the page load, before the client has had a chance to
// consume them. The tokens themselves are deliberately NOT kept here: the
// session they produce is handled by supabase-js, and copying access tokens
// into application state would only create a second place for them to leak.
// ---------------------------------------------------------------------------

function fragmentParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  return new URLSearchParams(hash)
}

const params = fragmentParams()
const type = params.get('type')

export const recoveryLanding = {
  /** The page was opened by following a password-recovery link. */
  isRecovery: type === 'recovery',
  /**
   * The page was opened by following an ACTIVATION link. Supabase marks a fresh
   * invite as 'invite'; a resend to an account that already has a password comes
   * back as 'recovery', and both land on /activate, so both count here.
   */
  isActivation: type === 'invite' || type === 'recovery',
  /**
   * Supabase reported the link itself as unusable — expired, already used, or
   * tampered with. Its own sentence is kept so the screen can show it.
   */
  errorDescription: params.get('error_description')?.replace(/\+/g, ' ') ?? params.get('error') ?? null,
}
