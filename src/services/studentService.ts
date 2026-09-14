// ---------------------------------------------------------------------------
// Roster reads shared by the teacher and management screens. Phase 8 batch 5.
//
// WHY THIS FILE EXISTS. Batch 3 put student reading in guardianService, because
// a guardian was the only identity that needed it. Batch 5 gives attendance,
// grades and homework their own rosters, and those screens are reached by a
// teacher or by management, not by a guardian. Rather than have a teacher screen
// import from a file named for guardians, the pieces both sides need live here
// and guardianService imports the colour helper from this module.
//
// A ROSTER IS NOT A COLUMN. SCHEMA_DESIGN gives students no class_id: enrolment
// is a time-scoped relation in class_enrollments, which is why every caller here
// passes the student ids it already resolved through that table rather than
// asking for "the students of this class".
//
// TENANT SCOPING. Both reads pin school_id and an explicit id list. Neither asks
// broadly and lets RLS narrow the answer, which is the standing rule from the
// RLS rollout: RLS is what makes a mistake safe, not what makes a query correct.
// ---------------------------------------------------------------------------

import { supabase } from '@/lib/supabase'
import { AVATAR_COLORS } from '@/constants/avatarColors'

/**
 * Deterministic per-student colour, so a child looks the same on every screen.
 *
 * Derived, never stored. SCHEMA_DESIGN section F lists exactly this as
 * presentation that would otherwise be "34 bytes of design system in every
 * people row", and students has no such column.
 */
export function avatarColorForId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

/** A student as the marking and grading screens render one. */
export interface RosterStudent {
  id: string
  name: string
  admissionNo: string
  avatarColor: string
}

/**
 * The given students, by id, ordered by name.
 *
 * Returns [] for an empty id list without a round trip. A class whose roster is
 * empty is a real state, not a denial: the caller renders `empty`.
 */
export async function fetchRosterStudents(
  schoolId: string,
  studentIds: string[],
): Promise<RosterStudent[]> {
  if (studentIds.length === 0) return []

  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, admission_no')
    .eq('school_id', schoolId)
    .in('id', studentIds)
    .order('full_name', { ascending: true })

  if (error) throw error

  return ((data ?? []) as { id: string; full_name: string; admission_no: string }[]).map((s) => ({
    id: s.id,
    name: s.full_name,
    admissionNo: s.admission_no,
    avatarColor: avatarColorForId(s.id),
  }))
}

/**
 * Every active student in the school, ordered by name.
 *
 * Phase 8 batch 6. A fee record names a student directly, so the invoice form
 * needs the school's roster rather than one class's. Scoped to the caller's own
 * school explicitly; RLS narrows nothing here for management, who can already
 * read every student in their school.
 */
export async function fetchSchoolStudents(schoolId: string): Promise<RosterStudent[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, admission_no')
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .order('full_name', { ascending: true })

  if (error) throw error

  return ((data ?? []) as { id: string; full_name: string; admission_no: string }[]).map((s) => ({
    id: s.id,
    name: s.full_name,
    admissionNo: s.admission_no,
    avatarColor: avatarColorForId(s.id),
  }))
}
