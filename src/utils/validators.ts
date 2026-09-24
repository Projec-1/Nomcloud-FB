export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function isValidPhone(value: string): boolean {
  return /^[+]?[\d\s()-]{7,}$/.test(value.trim())
}

export function minLength(value: string, len: number): boolean {
  return value.trim().length >= len
}

/**
 * The project's password rule, and the only one. Every password screen —
 * activation, reset and forced first-login change — imports this constant, so
 * the rule cannot drift between them.
 *
 * It is deliberately a MIRROR, not the enforcement. Supabase Auth's own
 * "Minimum password length" setting is the authority, because only it also
 * governs someone calling the API directly instead of using a form. Both are
 * set to 8; if you change one, change the other.
 */
export const MIN_PASSWORD_LENGTH = 8

export function isValidPassword(value: string): boolean {
  return value.length >= MIN_PASSWORD_LENGTH
}

export interface FieldErrors {
  [key: string]: string | undefined
}
