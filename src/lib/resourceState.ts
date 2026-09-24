// ---------------------------------------------------------------------------
// The four-state contract for every domain read.
//
// Specified in docs/PHASE8_CONNECTION_PLAN.md section F.7 and settled as
// decision 3. Built in Phase 8 batch 0 because every later batch depends on it
// existing first, and because the alternative — each page inventing its own
// empty/loading handling — is what produced the problem F.7 describes.
//
// THE CONTRACT
//
//   loading   the query is in flight              -> a skeleton or spinner
//   empty     succeeded, zero rows, caller is
//             entitled to rows                    -> the existing EmptyState copy
//   denied    caller is not entitled to this
//             data or this route                  -> ACCESS_DENIED_MESSAGE
//   error     failed for a reason that is not
//             permission                          -> a retry affordance
//
// A fifth member, `ready`, carries the data. F.7 calls this a four-state
// contract because four of the five render something other than the page's own
// content; `ready` is the page rendering normally. Naming it here rather than
// leaving it implicit keeps the union exhaustive, so TypeScript can prove every
// consumer handles every case.
//
// TWO RULES THAT COME FROM THE DATABASE, NOT FROM PREFERENCE
//
// 1. `denied` cannot be detected from the read itself. RLS filters rather than
//    raises: a forbidden SELECT returns an empty set indistinguishable from an
//    empty table, and a forbidden UPDATE returns zero rows without error. Only
//    a forbidden INSERT reliably raises, with SQLSTATE 42501. So `denied` must
//    be derived from what the application already knows about the caller —
//    their active membership role, the route being entered — and never from a
//    query result. `deriveResourceState` enforces this by taking `canAccess` as
//    a separate input that no row count can influence.
//
// 2. A zero row count is never sufficient evidence of denial. Where a screen
//    cannot tell the two apart it must show `empty`. Guessing `denied` on an
//    empty result would tell an administrator of a brand-new school that they
//    lack access to their own students.
// ---------------------------------------------------------------------------

/**
 * The exact copy a denied read or an unreachable route renders.
 *
 * Quoted verbatim from docs/PHASE8_CONNECTION_PLAN.md section F.7. Do not
 * paraphrase it per screen: a user who sees two different wordings for the same
 * condition cannot tell whether they hit two different problems.
 */
export const ACCESS_DENIED_MESSAGE = "You don't have access to this."

export type ResourceState<T> =
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'error'; error: Error; retry?: () => void }
  | { status: 'empty' }
  | { status: 'ready'; data: T }

export interface DeriveResourceStateInput<T> {
  /** True while the query is in flight. */
  isLoading: boolean
  /**
   * Whether the caller is entitled to this data, derived from the caller's
   * identity and never from the result. Pass `false` only when the application
   * positively knows the caller is not entitled. Omitting it, or passing
   * `true`, means "no reason to think otherwise", which is the right default:
   * RLS is the real boundary and this flag only decides what the user is told.
   */
  canAccess?: boolean
  /** A non-permission failure. A caught 42501 belongs in `canAccess`, not here. */
  error?: Error | null
  /** The resolved data, if the query has returned. */
  data?: T | null
  /**
   * Whether resolved data counts as empty. Defaults to treating an empty array
   * as empty and anything else as present, which covers every list screen.
   */
  isEmpty?: (data: T) => boolean
  /** Offered to the user alongside an `error`. */
  retry?: () => void
}

function defaultIsEmpty(data: unknown): boolean {
  return Array.isArray(data) && data.length === 0
}

/**
 * Collapses the inputs of a domain read into exactly one contract state.
 *
 * Precedence is deliberate. `denied` is decided first, so a caller who is known
 * to be outside the boundary is told so immediately rather than watching a
 * spinner resolve to an empty list. `empty` is decided last, so it can never
 * mask an error.
 */
export function deriveResourceState<T>({
  isLoading,
  canAccess,
  error,
  data,
  isEmpty = defaultIsEmpty,
  retry,
}: DeriveResourceStateInput<T>): ResourceState<T> {
  if (canAccess === false) return { status: 'denied' }
  if (isLoading) return { status: 'loading' }
  if (error) return { status: 'error', error, retry }
  if (data === null || data === undefined) return { status: 'empty' }
  if (isEmpty(data)) return { status: 'empty' }
  return { status: 'ready', data }
}

/**
 * True when a Postgres error is a row-level security or privilege refusal.
 *
 * Useful on WRITE paths, which do raise. Reads almost never reach this, for the
 * reason given in rule 1 above.
 */
export function isPermissionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '42501'
  )
}
