// ---------------------------------------------------------------------------
// School-level reads and writes. Phase 8 batch 1.
//
// The READ already existed: identityService.fetchSchoolById has been fetching
// the signed-in user's school on every sign-in since Phase 4, and AuthContext
// holds the result. Batch 1 does not add a second fetch; it points the interface
// at the row that was already in memory and retires the parallel mock object.
//
// TENANT SCOPING. fetchSchoolById filters `.eq('id', schoolId)` where schoolId
// comes from profiles.school_id, so the query asks for one row by primary key
// rather than asking for all schools and letting RLS narrow the answer. That is
// deliberate: RLS is the boundary that makes a mistake safe, not the mechanism
// the application should rely on to be correct. The update below is scoped the
// same way.
// ---------------------------------------------------------------------------

import { supabase } from '@/lib/supabase'
import type { SchoolRow } from '@/types/auth'

/**
 * The columns a school administrator may edit from Admin → Settings.
 *
 * Deliberately narrower than the table. Excluded, with reasons:
 *
 *   id, created_at, updated_at   not editable data
 *   shortcode                    the school's subdomain. Changing it moves the
 *                                school's address and trips the reserved-
 *                                shortcode trigger; it is displayed read-only.
 *   status, suspended_at,
 *   suspension_reason            tenant lifecycle, owned by the platform
 *   is_demo                      set once by migration 20260913000002
 *   country, currency, locale,
 *   weekend_days                 real columns with no field in this form today.
 *                                weekend_days now drives the calendar (batch 0),
 *                                so giving it an editor is a deliberate UI
 *                                decision rather than a connection task.
 */
export interface SchoolSettingsUpdate {
  name: string
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  primary_color: string
  grading_scale: SchoolRow['grading_scale']
  timezone: string
  attendance_cutoff_time: string
  email_notifications: boolean
  sms_notifications: boolean
  parent_portal_enabled: boolean
}

/**
 * Updates the signed-in user's own school and returns the stored row.
 *
 * Scoped by primary key, not by RLS alone. RLS additionally requires
 * has_school_admin_role, so owner, director and administrator succeed and every
 * other role updates zero rows without raising — which is why the caller must
 * treat a null return as a refusal rather than as success.
 */
export async function updateSchool(schoolId: string, patch: SchoolSettingsUpdate): Promise<SchoolRow | null> {
  const { data, error } = await supabase
    .from('schools')
    .update(patch)
    .eq('id', schoolId)
    .select('*')
    .maybeSingle()

  if (error) throw error
  return (data as SchoolRow | null) ?? null
}

/** The initial shown on the brand badge when a school has no logo image. */
export function schoolInitial(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  return trimmed ? trimmed[0].toUpperCase() : '?'
}
