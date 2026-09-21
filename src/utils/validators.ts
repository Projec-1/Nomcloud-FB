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
 * The project's password rule, and the only one: Supabase Auth refuses anything
 * shorter (`minimum_password_length = 6` in supabase/config.toml, confirmed
 * against the live project). Checking it here only produces a better message;
 * Supabase remains the authority.
 */
export const MIN_PASSWORD_LENGTH = 6

export function isValidPassword(value: string): boolean {
  return value.length >= MIN_PASSWORD_LENGTH
}

export interface FieldErrors {
  [key: string]: string | undefined
}
