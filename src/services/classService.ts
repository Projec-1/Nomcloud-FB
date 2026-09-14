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
export async function fetchManagedClasses(schoolId: string): Promise<ClassSummary[]> {
  const { data: classRows, error: classError } = await supabase
    .from('classes')
    .select('id, name, grade, section, room, capacity, class_teacher_id')
    .eq('school_id', schoolId)
    .order('name', { ascending: true })

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
