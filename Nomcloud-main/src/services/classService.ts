// ---------------------------------------------------------------------------
// School-wide class reads for management. Phase 8 batch 5.
//
// The management counterpart of teacherService.fetchTeacherWorkspace. An
// administrator marking attendance or recording grades works across every class
// in the school, not an assigned subset, so "which classes" is a different
// question on this side and gets its own query rather than a flag on the other.
//
// WHY writableSubjects IS EVERY SUBJECT HERE. The policies management reaches
// these records through are can_manage_class(school_id, class_id) — CLASS-level.
// Only the teacher policies are subject-exact via teaches_class_subject. So an
// administrator may legitimately record a mark in any subject of any class they
// manage, and narrowing their selector the way a teacher's is narrowed would
// withhold something the database would have accepted. Same field, same meaning
// on both sides — what you may write here — different correct answer.
//
// CAMPUS SCOPE IS DELIBERATELY NOT EXPRESSED. Locked decision 2 of the Phase 8
// plan: the frontend does not become campus-aware in this phase. A principal
// with scope_mode='selected' can manage only classes inside their campus scope,
// and the classes policies from RLS batch 3 already enforce that on the read, so
// a principal's result arrives correctly narrowed. This query is scoped to the
// caller's own school explicitly, which is the scope the frontend knows how to
// state; the campus narrowing on top is RLS doing its own job, not this code
// leaning on RLS to make a broad query safe.
// ---------------------------------------------------------------------------

import { supabase } from '@/lib/supabase'
import type { ClassSummary } from '@/services/teacherService'

/**
 * Every class in the school, with roster and subjects, ordered by name.
 *
 * Shapes ClassSummary so the attendance, grading and homework screens are the
 * same components for management as for a teacher.
 */
export async function fetchManagedClasses(
  schoolId: string,
  /**
   * K6: the academic year to show. A year id narrows to that year's classes;
   * null shows every year, which is how history stays reachable. Callers
   * default this to the active year so screens stop mixing years together.
   */
  academicYearId: string | null = null,
): Promise<ClassSummary[]> {
  let query = supabase
    .from('classes')
    .select('id, name, grade, section, room, capacity, class_teacher_id')
    .eq('school_id', schoolId)
  if (academicYearId) query = query.eq('academic_year_id', academicYearId)
  const { data: classRows, error: classError } = await query.order('name', { ascending: true })

  if (classError) throw classError

  const rows = (classRows ?? []) as {
    id: string
    name: string
    grade: string
    section: string | null
    room: string | null
    capacity: number | null
    class_teacher_id: string | null
  }[]
  if (rows.length === 0) return []

  const classIds = rows.map((c) => c.id)

  const [enrolments, classSubjects] = await Promise.all([
    // left_on IS NULL is the available "still enrolled" signal. Plan section A.2
    // records that it is not a complete definition of "current"; tightening it
    // needs that decision and is not invented here.
    supabase
      .from('class_enrollments')
      .select('class_id, student_id')
      .eq('school_id', schoolId)
      .in('class_id', classIds)
      .is('left_on', null),
    supabase.from('class_subjects').select('class_id, subject_id').eq('school_id', schoolId).in('class_id', classIds),
  ])

  if (enrolments.error) throw enrolments.error
  if (classSubjects.error) throw classSubjects.error

  const subjectIds = Array.from(
    new Set((classSubjects.data ?? []).map((r) => (r as { subject_id: string }).subject_id)),
  )
  const subjectNames = new Map<string, string>()
  if (subjectIds.length > 0) {
    const { data, error } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('school_id', schoolId)
      .in('id', subjectIds)
    if (error) throw error
    for (const s of (data ?? []) as { id: string; name: string }[]) subjectNames.set(s.id, s.name)
  }

  const rosterByClass = new Map<string, string[]>()
  for (const row of (enrolments.data ?? []) as { class_id: string; student_id: string }[]) {
    rosterByClass.set(row.class_id, [...(rosterByClass.get(row.class_id) ?? []), row.student_id])
  }

  const subjectsByClass = new Map<string, { id: string; name: string }[]>()
  for (const row of (classSubjects.data ?? []) as { class_id: string; subject_id: string }[]) {
    const name = subjectNames.get(row.subject_id)
    if (!name) continue
    subjectsByClass.set(row.class_id, [
      ...(subjectsByClass.get(row.class_id) ?? []),
      { id: row.subject_id, name },
    ])
  }

  return rows.map((c) => {
    const subjects = (subjectsByClass.get(c.id) ?? []).sort((x, y) => x.name.localeCompare(y.name))
    return {
      id: c.id,
      name: c.name,
      grade: c.grade,
      section: c.section,
      room: c.room,
      capacity: c.capacity,
      teacherId: c.class_teacher_id,
      studentIds: rosterByClass.get(c.id) ?? [],
      subject: subjects.map((s) => s.name),
      // Class-level authority: every subject of the class is writable.
      writableSubjects: subjects,
    }
  })
}

// ===========================================================================
// MANAGEMENT WRITES. Phase 8 batch 8.
// ===========================================================================
// classes gates writes on has_campus_scoped_management(school_id, campus_id),
// which is the one place campus genuinely bites. Locked decision 2 keeps the
// frontend campus-unaware, so these functions never send a campus_id: a class
// created here has campus_id NULL, and RLS batch 3 settled that an unassigned
// class is visible and manageable by every principal. Assigning a class to a
// campus is a feature that arrives with campus awareness, not before it.
//
// timetable_slots gates INSERT/UPDATE/DELETE on can_manage_class — management
// only. A TEACHER CANNOT EDIT A TIMETABLE, which closes the other half of open
// decision 6.

export interface ClassInput {
  name: string
  grade: string
  section: string | null
  room: string | null
  capacity: number | null
  academicYearId: string
  classTeacherId: string | null
}

export async function createClass(schoolId: string, input: ClassInput): Promise<string> {
  const { data, error } = await supabase
    .from('classes')
    .insert({
      school_id: schoolId,
      academic_year_id: input.academicYearId,
      name: input.name,
      grade: input.grade,
      section: input.section,
      room: input.room,
      capacity: input.capacity,
      class_teacher_id: input.classTeacherId,
      // campus_id deliberately omitted. See the header.
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('A class with that name already exists for this academic year.')
    throw error
  }
  return (data as { id: string }).id
}

/**
 * Edits a class. Its ACADEMIC YEAR IS NOT EDITABLE and is deliberately not sent:
 * a class belongs to the year it was created in. The form used to send the
 * active year on every edit, which silently moved a historical class into the
 * current year the moment anyone corrected its room (found in the calendar
 * batch, SYSTEM_ISSUES_LIST K6).
 */
export async function updateClass(schoolId: string, id: string, input: ClassInput): Promise<void> {
  const { error } = await supabase
    .from('classes')
    .update({
      name: input.name,
      grade: input.grade,
      section: input.section,
      room: input.room,
      capacity: input.capacity,
      class_teacher_id: input.classTeacherId,
    })
    .eq('school_id', schoolId)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') throw new Error('A class with that name already exists for this academic year.')
    throw error
  }
}

/**
 * Removes a class.
 *
 * Refused by the database (23503) while the class has attendance, grades,
 * homework, exams or enrolments, current or past: migration
 * 20260915000005_class_records_restrict made those foreign keys RESTRICT so
 * academic history cannot disappear with its class (SYSTEM_ISSUES_LIST S1).
 * Its timetable, subject assignments and class announcements are configuration
 * and are still removed with it.
 */
export async function deleteClass(schoolId: string, id: string): Promise<void> {
  const { error } = await supabase.from('classes').delete().eq('school_id', schoolId).eq('id', id)
  if (error) {
    if (error.code === '23503') {
      throw new Error(
        'This class has attendance, grades, homework, exams or enrolled students, so it cannot be removed. Those records are kept as academic history.',
      )
    }
    throw error
  }
}

/** Assigns the homeroom teacher of a class. */
export async function assignClassTeacher(schoolId: string, classId: string, teacherId: string | null): Promise<void> {
  const { error } = await supabase
    .from('classes')
    .update({ class_teacher_id: teacherId })
    .eq('school_id', schoolId)
    .eq('id', classId)
  if (error) throw error
}

export interface TimetableSlotInput {
  classId: string
  subjectId: string | null
  teacherId: string | null
  dayOfWeek: number
  period: number
  startTime: string
  endTime: string
  room: string | null
}

/** Adds a timetable slot. Management only, per can_manage_class. */
export async function createTimetableSlot(schoolId: string, input: TimetableSlotInput): Promise<void> {
  if (input.teacherId) {
    const { data: conflict, error: conflictError } = await supabase
      .from('timetable_slots')
      .select('id, class_id')
      .eq('school_id', schoolId)
      .eq('teacher_id', input.teacherId)
      .eq('day_of_week', input.dayOfWeek)
      .eq('period', input.period)
      .maybeSingle()
    if (conflictError) throw conflictError
    if (conflict && conflict.class_id !== input.classId) {
      throw new Error('This teacher is already scheduled for another class at that time.')
    }
  }
  const { error } = await supabase.from('timetable_slots').insert({
    school_id: schoolId,
    class_id: input.classId,
    subject_id: input.subjectId,
    teacher_id: input.teacherId,
    day_of_week: input.dayOfWeek,
    period: input.period,
    start_time: input.startTime,
    end_time: input.endTime,
    room: input.room,
  })
  if (error) {
    if (error.code === '23505') throw new Error('That class already has a slot in this period.')
    throw error
  }
}

export async function deleteTimetableSlot(schoolId: string, id: string): Promise<void> {
  const { error } = await supabase.from('timetable_slots').delete().eq('school_id', schoolId).eq('id', id)
  if (error) throw error
}

/** Updates a lesson or break while keeping the same class and slot identity. */
export async function updateTimetableSlot(schoolId: string, id: string, input: TimetableSlotInput): Promise<void> {
  if (input.teacherId) {
    const { data: conflict, error: conflictError } = await supabase
      .from('timetable_slots')
      .select('id, class_id')
      .eq('school_id', schoolId)
      .eq('teacher_id', input.teacherId)
      .eq('day_of_week', input.dayOfWeek)
      .eq('period', input.period)
      .neq('id', id)
      .maybeSingle()
    if (conflictError) throw conflictError
    if (conflict && conflict.class_id !== input.classId) {
      throw new Error('This teacher is already scheduled for another class at that time.')
    }
  }
  const { error } = await supabase
    .from('timetable_slots')
    .update({
      subject_id: input.subjectId,
      teacher_id: input.teacherId,
      day_of_week: input.dayOfWeek,
      period: input.period,
      start_time: input.startTime,
      end_time: input.endTime,
      room: input.room,
    })
    .eq('school_id', schoolId)
    .eq('id', id)
  if (error) throw error
}
