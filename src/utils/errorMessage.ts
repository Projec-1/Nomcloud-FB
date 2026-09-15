// ---------------------------------------------------------------------------
// Human-readable text for anything a catch block receives.
//
// WHY THIS EXISTS. supabase-js returns database failures as plain
// { code, message, details, hint } objects, NOT Error instances (verified
// against the installed 2.112.4: `error instanceof Error` is false). Services
// rethrow those objects, so the common pattern
//   err instanceof Error ? err.message : String(err)
// rendered "[object Object]" for every database refusal — which is how
// "Student not added [object Object]" reached a user.
//
// Every catch that shows an error to a person goes through errorMessage (or
// toError, for state consumed by ResourceGate), so a raw object is never shown.
// Known PostgreSQL codes get a plain-language sentence; anything else keeps the
// server's own message, which is readable text rather than an object.
// ---------------------------------------------------------------------------

const FALLBACK = 'Something went wrong. Please try again.'

interface ErrorLike {
  code?: unknown
  message?: unknown
}

/** "students_gender_check" on table students -> "gender". */
function constraintField(message: string): string | null {
  const match = message.match(/constraint "([^"]+)"/)
  if (!match) return null
  const table = message.match(/relation "([^"]+)"/)?.[1] ?? message.match(/table "([^"]+)"/)?.[1]
  let name = match[1]
  if (table && name.startsWith(`${table}_`)) name = name.slice(table.length + 1)
  name = name.replace(/_(check|key|fkey|not_null)$/, '')
  return name.replace(/_/g, ' ').trim() || null
}

export function errorMessage(error: unknown, fallback: string = FALLBACK): string {
  if (typeof error === 'string') return error.trim() || fallback

  const candidate = (error ?? {}) as ErrorLike
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const message = typeof candidate.message === 'string' ? candidate.message.trim() : ''

  switch (code) {
    case '23514': {
      const field = constraintField(message)
      return field ? `The value entered for ${field} is not accepted.` : 'One of the values entered is not accepted.'
    }
    case '23505':
      return 'This would duplicate a record that already exists.'
    case '23503':
      return 'This refers to a record that no longer exists, or is still used by other records.'
    case '23502': {
      const column = message.match(/column "([^"]+)"/)?.[1]
      return column ? `A required field is missing: ${column.replace(/_/g, ' ')}.` : 'A required field is missing.'
    }
    case '22P02':
    case '22007':
    case '22008':
      return 'One of the values entered is not in a valid format.'
    case '42501':
      return "You don't have permission to make this change."
    case 'PGRST116':
      return "The record wasn't found, or you don't have access to it."
  }

  if (error instanceof TypeError && /fetch|network/i.test(message)) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  if (message && message !== '[object Object]') return message
  return fallback
}

/** An Error whose message is always readable, for error state rendered later. */
export function toError(error: unknown): Error {
  return error instanceof Error && error.message ? error : new Error(errorMessage(error))
}
