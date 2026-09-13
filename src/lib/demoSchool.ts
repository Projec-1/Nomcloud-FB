// ---------------------------------------------------------------------------
// The demo-school boundary.
//
// Decision 12 in docs/PHASE8_CONNECTION_PLAN.md section H.9: demo mode is kept
// for sales and marketing, structurally separated from customer data rather
// than mixed into it, and reachable ONLY in development.
//
// Separation has two halves, and they work at different layers:
//
//   TENANT      The demo school is a real row in public.schools with
//               is_demo = true and the reserved shortcode 'demo'. Its data is
//               separated from every customer's by the same RLS tenant boundary
//               that separates two customers from each other. That is the whole
//               reason a real tenant was chosen over a client-side mock: a mock
//               would prove nothing about the policies Phase 7 built.
//
//   BUILD       Reachability is a compile-time boundary, the same pattern
//               AUTH_DESIGN section 8 uses for demo credentials.
//               import.meta.env.DEV is statically replaced by Vite, so in a
//               production build isDemoAccessAllowed() folds to `false`.
//
//               The two consumers below are affected in OPPOSITE directions,
//               which is easy to get wrong:
//
//                 shouldShowDemoIndicator  ->  `x && false`  ->  eliminated.
//                   Verified: "Demo Mode", "This is sample data", the school
//                   name and the banner icon are all absent from the production
//                   bundle.
//
//                 isDemoSessionBlocked     ->  `x && true`   ->  RETAINED.
//                   It must be. This is the check that refuses a demo session
//                   in production, so eliminating it would remove the boundary
//                   instead of enforcing it. Its message string and the
//                   is_demo property read do ship, which is correct and is not
//                   a leak: neither reveals anything a user could act on.
//
//               The demo row may exist in production; nothing in a production
//               bundle can route into it.
//
// The marker is never inferred from the shortcode. A shortcode is routing and
// branding, which AUTH_DESIGN sections 7 and 8 are explicit must never be an
// authorisation or classification input. schools.is_demo is the fact.
// ---------------------------------------------------------------------------

import type { SchoolRow } from '@/types/auth'

/** Reserved in public.reserved_shortcodes by migration 20260913000002. */
export const DEMO_SCHOOL_SHORTCODE = 'demo'

/**
 * Whether demo tenants may be used in this build at all.
 *
 * `import.meta.env.DEV` is a compile-time constant, so this collapses to a
 * literal and every guarded branch disappears from a production bundle.
 */
export function isDemoAccessAllowed(): boolean {
  return import.meta.env.DEV
}

/** Whether a school is the demonstration tenant. Reads the column, not the name. */
export function isDemoSchool(school: SchoolRow | null | undefined): boolean {
  return school?.is_demo === true
}

/**
 * Whether the Demo Mode indicator should be shown.
 *
 * True only when the active school really is the demo tenant and this build
 * permits demo access, so the indicator can never appear for a customer and can
 * never be the thing that leaks demo existence into production.
 */
export function shouldShowDemoIndicator(school: SchoolRow | null | undefined): boolean {
  return isDemoSchool(school) && isDemoAccessAllowed()
}

/**
 * Whether a signed-in session must be refused because it belongs to the demo
 * tenant in a build that does not permit demo access.
 *
 * In development this is always false. In production it is true for any demo
 * session, which routes the user to the decision 3 message rather than showing
 * them demonstration data dressed as their own.
 */
export function isDemoSessionBlocked(school: SchoolRow | null | undefined): boolean {
  return isDemoSchool(school) && !isDemoAccessAllowed()
}
