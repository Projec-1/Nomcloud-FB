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
import { removeOrphanedStudentPhoto } from '@/services/storageService'

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

// ===========================================================================
// MANAGEMENT WRITES. Phase 8 batch 8.
// ===========================================================================
// students, guardians and student_guardians all gate INSERT/UPDATE/DELETE on
// has_school_management_role, so these are reachable by owner, director,
// administrator and principal. There is deliberately no teacher or guardian
// path: RLS batch 2 made student_guardians management-only precisely so a
// guardian cannot attach themselves to another family's child.

export interface StudentInput {
  fullName: string
  admissionNo: string
  gender: string | null
  dateOfBirth: string | null
  status: string
}

export async function createStudent(schoolId: string, input: StudentInput): Promise<string> {
  const { data, error } = await supabase
    .from('students')
    .insert({
      school_id: schoolId,
      full_name: input.fullName,
      admission_no: input.admissionNo,
      gender: input.gender,
      date_of_birth: input.dateOfBirth,
      status: input.status,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('That admission number is already used at this school.')
    throw error
  }
  return (data as { id: string }).id
}

export async function updateStudent(schoolId: string, id: string, input: StudentInput): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({
      full_name: input.fullName,
      admission_no: input.admissionNo,
      gender: input.gender,
      date_of_birth: input.dateOfBirth,
      status: input.status,
    })
    .eq('school_id', schoolId)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') throw new Error('That admission number is already used at this school.')
    throw error
  }
}

/**
 * Removes a student.
 *
 * Fees, attendance, grades and enrolments cascade with the student, which is
 * what SCHEMA_DESIGN intends for a record that was created in error. A student
 * who has simply left should be given status 'inactive' instead, which is why
 * status is an editable field on the form.
 */
export async function deleteStudent(schoolId: string, id: string): Promise<void> {
  const { data, error } = await supabase
    .from('students')
    .delete()
    .eq('school_id', schoolId)
    .eq('id', id)
    .select('photo_path')
  if (error) throw error
  // A Storage object has no foreign key to its row, so the photo is removed
  // here or it would outlive the student (FILE_STORAGE_PLAN section 3, rule 4).
  for (const row of (data ?? []) as { photo_path: string | null }[]) {
    await removeOrphanedStudentPhoto(row.photo_path)
  }
}

/** Enrols a student in a class for an academic year. */
export async function enrolStudent(
  schoolId: string,
  studentId: string,
  classId: string,
  academicYearId: string,
): Promise<void> {
  const { error } = await supabase.from('class_enrollments').insert({
    school_id: schoolId,
    class_id: classId,
    student_id: studentId,
    academic_year_id: academicYearId,
  })
  if (error) throw error
}

/**
 * Closes a student's open enrolments.
 *
 * `left_on` rather than a delete, because an enrolment is history. Plan section
 * A.2 records that `left_on IS NULL` is the available "still enrolled" signal.
 */
export async function endEnrolment(schoolId: string, studentId: string, leftOn: string): Promise<void> {
  const { error } = await supabase
    .from('class_enrollments')
    .update({ left_on: leftOn })
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .is('left_on', null)
  if (error) throw error
}

// ===========================================================================
// THE MANAGEMENT STUDENT DIRECTORY. Phase 8 batch 8.
// ===========================================================================

export interface DirectoryStudent {
  id: string
  name: string
  admissionNo: string
  gender: string | null
  dateOfBirth: string | null
  status: string
  enrolledDate: string
  avatarColor: string
  /** Object path in the private student-photos bucket, or null. */
  photoPath: string | null
  /** Resolved through class_enrollments, not a column. Null when unenrolled. */
  classId: string | null
  className: string | null
  /** Every linked guardian, through student_guardians. */
  guardians: { id: string; name: string }[]
}

/**
 * Every student in the school with their class and guardians.
 *
 * Four scoped reads rather than embedded selects, for the reason every batch
 * since 3 has given: these tables reach one another through COMPOSITE foreign
 * keys, and a silent PostgREST embedding failure would look like a school with
 * no students.
 */
export async function fetchStudentDirectory(schoolId: string): Promise<DirectoryStudent[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, admission_no, gender, date_of_birth, status, enrolled_date, photo_path')
    .eq('school_id', schoolId)
    .order('full_name', { ascending: true })

  if (error) throw error

  const rows = (data ?? []) as {
    id: string
    full_name: string
    admission_no: string
    gender: string | null
    date_of_birth: string | null
    status: string
    enrolled_date: string
    photo_path: string | null
  }[]
  if (rows.length === 0) return []

  const studentIds = rows.map((r) => r.id)

  const [enrolments, links] = await Promise.all([
    supabase
      .from('class_enrollments')
      .select('student_id, class_id')
      .eq('school_id', schoolId)
      .in('student_id', studentIds)
      .is('left_on', null),
    supabase
      .from('student_guardians')
      .select('student_id, guardian_id')
      .eq('school_id', schoolId)
      .in('student_id', studentIds),
  ])

  if (enrolments.error) throw enrolments.error
  if (links.error) throw links.error

  const enrolRows = (enrolments.data ?? []) as { student_id: string; class_id: string }[]
  const linkRows = (links.data ?? []) as { student_id: string; guardian_id: string }[]

  const classNames = new Map<string, string>()
  const classIds = Array.from(new Set(enrolRows.map((e) => e.class_id)))
  if (classIds.length > 0) {
    const { data: cls, error: clsErr } = await supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .in('id', classIds)
    if (clsErr) throw clsErr
    for (const c of (cls ?? []) as { id: string; name: string }[]) classNames.set(c.id, c.name)
  }

  const guardianNames = new Map<string, string>()
  const guardianIds = Array.from(new Set(linkRows.map((l) => l.guardian_id)))
  if (guardianIds.length > 0) {
    const { data: gs, error: gErr } = await supabase
      .from('guardians')
      .select('id, full_name')
      .eq('school_id', schoolId)
      .in('id', guardianIds)
    if (gErr) throw gErr
    for (const g of (gs ?? []) as { id: string; full_name: string }[]) guardianNames.set(g.id, g.full_name)
  }

  const classByStudent = new Map<string, string>()
  for (const e of enrolRows) classByStudent.set(e.student_id, e.class_id)

  const guardiansByStudent = new Map<string, { id: string; name: string }[]>()
  for (const l of linkRows) {
    guardiansByStudent.set(l.student_id, [
      ...(guardiansByStudent.get(l.student_id) ?? []),
      { id: l.guardian_id, name: guardianNames.get(l.guardian_id) ?? 'Guardian' },
    ])
  }

  return rows.map((r) => {
    const classId = classByStudent.get(r.id) ?? null
    return {
      id: r.id,
      name: r.full_name,
      admissionNo: r.admission_no,
      gender: r.gender,
      dateOfBirth: r.date_of_birth,
      status: r.status,
      enrolledDate: r.enrolled_date,
      avatarColor: avatarColorForId(r.id),
      photoPath: r.photo_path,
      classId,
      className: classId ? (classNames.get(classId) ?? null) : null,
      guardians: guardiansByStudent.get(r.id) ?? [],
    }
  })
}
