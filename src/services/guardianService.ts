// ---------------------------------------------------------------------------
// Guardian to student resolution. Phase 8 batch 3.
//
// THIS FILE IS THE FIX FOR PLAN SECTION A.4.
//
// The bug: useSelectedChild resolved the signed-in guardian by comparing
// activeMembership.guardian_id, a real UUID, against mock parent ids 'p1' and
// 'p2' from mockData.ts. The comparison never matched, so every parent page
// rendered as though the account had no children. It has been broken for every
// real guardian since Phase 4 wired identity to Supabase while the data stayed
// mock.
//
// HOW "WHICH GUARDIAN IS THIS" IS RESOLVED NOW. The chain is entirely real and
// entirely server-side:
//
//   auth.uid()
//     -> memberships row with role = 'guardian'          (AuthContext)
//     -> memberships.guardian_id                          a real guardians.id
//     -> student_guardians (school_id, guardian_id)       the link rows
//     -> students (school_id, id)                         the children
//
// memberships.guardian_id is not a label the client chose. It is a composite
// foreign key, (school_id, guardian_id) -> guardians (school_id, id), written by
// accept_invitation at the moment the guardian redeemed their invitation. That
// is why it is trustworthy as the anchor.
//
// TENANT SCOPING. Both queries filter school_id and the specific guardian or
// student ids explicitly. Neither asks for a broad set and lets RLS narrow the
// answer. RLS is what makes a mistake safe, not what makes the query correct.
// Independently, is_guardian_of_student (batch 2 of the RLS rollout) means a
// guardian reading students sees only linked children even if this code were
// wrong, which is the belt and braces the design intends.
//
// WHY TWO QUERIES RATHER THAN ONE EMBEDDED SELECT. student_guardians reaches
// students through a COMPOSITE foreign key, (school_id, student_id). PostgREST
// resource embedding across composite foreign keys is not something to rely on
// silently, and a failure there would look like "this guardian has no children",
// which is precisely the bug being fixed. Two explicit queries cannot fail that
// way.
// ---------------------------------------------------------------------------

import { supabase } from '@/lib/supabase'
import { avatarColorForId } from '@/services/studentService'

export interface GuardianRow {
  id: string
  school_id: string
  full_name: string
  email: string | null
  phone: string
  status: string
  created_at: string
  updated_at: string
}

export interface StudentRow {
  id: string
  school_id: string
  full_name: string
  admission_no: string
  gender: string | null
  date_of_birth: string | null
  status: string
  enrolled_date: string
  photo_path: string | null
  created_at: string
  updated_at: string
}

/**
 * The child shape the parent screens render.
 *
 * A view model, not a row. `id` is the real students.id UUID, which is the part
 * that matters and the part that was broken. The display field names are kept
 * close to what the screens already used so this batch changes identity
 * resolution without also rewriting eight pages' markup.
 *
 * `avatarColor` is derived, never stored: SCHEMA_DESIGN section F lists it as
 * presentation that would otherwise be "34 bytes of design system in every
 * people row", and students has no such column.
 *
 * `classId` and `className` are resolved through class_enrollments, which batch
 * 4 connected. A student's class is NOT a column on students; it is a
 * time-scoped enrolment row, which is why SCHEMA_DESIGN gives students no
 * class_id at all. Both stay null for a child with no open enrolment, which is
 * a real state for a newly admitted pupil.
 */
export interface ChildSummary {
  id: string
  name: string
  admissionNo: string
  status: string
  enrolledDate: string
  avatarColor: string
  classId: string | null
  className: string | null
}

export function toChildSummary(
  student: StudentRow,
  enrolledClass?: { id: string; name: string } | null,
): ChildSummary {
  return {
    id: student.id,
    name: student.full_name,
    admissionNo: student.admission_no,
    status: student.status,
    enrolledDate: student.enrolled_date,
    avatarColor: avatarColorForId(student.id),
    classId: enrolledClass?.id ?? null,
    className: enrolledClass?.name ?? null,
  }
}

/**
 * The open class enrolment for each of the given students, as id -> class.
 *
 * Phase 8 batch 4. This is what closed the gap batch 3 left: a parent could see
 * their child but not the child's class, because a class is reached through
 * class_enrollments rather than a column on students.
 *
 * `left_on IS NULL` is the available "still enrolled" signal. Plan section A.2
 * records that it is not a complete definition of "current", since rows can stay
 * open across academic years; tightening it needs the decision recorded there
 * and is not invented here. A student with no open enrolment resolves to null
 * rather than to a guessed class.
 */
export async function fetchEnrolledClasses(
  schoolId: string,
  studentIds: string[],
): Promise<Map<string, { id: string; name: string }>> {
  const result = new Map<string, { id: string; name: string }>()
  if (studentIds.length === 0) return result

  const { data: enrolments, error: enrolError } = await supabase
    .from('class_enrollments')
    .select('student_id, class_id')
    .eq('school_id', schoolId)
    .in('student_id', studentIds)
    .is('left_on', null)

  if (enrolError) throw enrolError
  const rows = (enrolments ?? []) as { student_id: string; class_id: string }[]
  if (rows.length === 0) return result

  const classIds = Array.from(new Set(rows.map((r) => r.class_id)))
  const { data: classes, error: classError } = await supabase
    .from('classes')
    .select('id, name')
    .eq('school_id', schoolId)
    .in('id', classIds)

  if (classError) throw classError
  const byId = new Map<string, string>()
  for (const row of (classes ?? []) as { id: string; name: string }[]) byId.set(row.id, row.name)

  for (const row of rows) {
    const name = byId.get(row.class_id)
    if (name) result.set(row.student_id, { id: row.class_id, name })
  }
  return result
}

/** The signed-in guardian's own guardians row. */
export async function fetchGuardian(schoolId: string, guardianId: string): Promise<GuardianRow | null> {
  const { data, error } = await supabase
    .from('guardians')
    .select('*')
    .eq('school_id', schoolId)
    .eq('id', guardianId)
    .maybeSingle()

  if (error) throw error
  return (data as GuardianRow | null) ?? null
}

/**
 * The students linked to a guardian through student_guardians.
 *
 * Returns [] when the guardian has no links, which is a real and valid state:
 * a guardian account can exist before an administrator attaches a child to it.
 * The caller must render that as `empty`, never as `denied`.
 */
export async function fetchLinkedStudents(schoolId: string, guardianId: string): Promise<StudentRow[]> {
  const { data: links, error: linkError } = await supabase
    .from('student_guardians')
    .select('student_id')
    .eq('school_id', schoolId)
    .eq('guardian_id', guardianId)

  if (linkError) throw linkError

  const studentIds = (links ?? []).map((row) => (row as { student_id: string }).student_id)
  if (studentIds.length === 0) return []

  const { data: students, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('school_id', schoolId)
    .in('id', studentIds)
    .order('full_name', { ascending: true })

  if (studentError) throw studentError
  return (students ?? []) as StudentRow[]
}
