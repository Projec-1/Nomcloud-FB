import { supabase } from '@/lib/supabase'
import { createTeacher, fetchSchoolTeachers, type TeacherRow } from '@/services/teacherService'
import { createClass } from '@/services/classService'
import { createStudent, enrolStudent, type StudentGender } from '@/services/studentService'
import { createGuardian, linkGuardianToStudent, GUARDIAN_RELATIONSHIPS, type GuardianRelationship } from '@/services/guardianService'
import { fetchAcademicYears, activeAcademicYear, type AcademicYearRow } from '@/services/academicService'
import { isValidEmail } from '@/utils/validators'
import type { ColumnSpec, ImportKind, ImportPlan, PreparedRow, RowOutcome } from '@/services/import/types'

// ---------------------------------------------------------------------------
// What each of the three imports accepts, refuses, and writes.
//
// EVERY WRITE GOES THROUGH THE FUNCTION THE FORMS ALREADY USE — createTeacher,
// createClass, createStudent, enrolStudent, createGuardian and
// linkGuardianToStudent. There is no import-only path into the database, so
// every RLS policy, RESTRICT guard and relationship rule applies here exactly as
// it does to a person typing one record in by hand.
//
// THE ALLOWED VALUES BELOW ARE THE DATABASE'S OWN, read from its CHECK
// constraints, not invented here:
//   students.gender  male | female | other
//   students.status  active | inactive | graduated | transferred
//   teachers.status  active | inactive
// student_guardians.relationship has NO database CHECK; the three values offered
// are the ones the app itself uses (GUARDIAN_RELATIONSHIPS).
// ---------------------------------------------------------------------------

const GENDERS = ['male', 'female', 'other'] as const
const STUDENT_STATUSES = ['active', 'inactive', 'graduated', 'transferred'] as const
const TEACHER_STATUSES = ['active', 'inactive'] as const

const norm = (value: string) => value.trim().toLowerCase()
const orNull = (value: string) => (value.trim() ? value.trim() : null)

/** Accepts yyyy-mm-dd, dd/mm/yyyy and the spreadsheet's own normalised dates. */
function parseDate(value: string): { date: string | null; bad: boolean } {
  const raw = value.trim()
  if (!raw) return { date: null, bad: false }
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return { date: raw, bad: false }
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return { date: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`, bad: false }
  }
  return { date: null, bad: true }
}

const isPast = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`) < new Date(new Date().toDateString())

function emptyPlan<T>(): ImportPlan<T> {
  return { rows: [], notices: [], counts: { total: 0, ready: 0, exists: 0, error: 0 } }
}

function finish<T>(rows: PreparedRow<T>[], notices: string[]): ImportPlan<T> {
  return {
    rows,
    notices,
    counts: {
      total: rows.length,
      ready: rows.filter((r) => r.status === 'ready').length,
      exists: rows.filter((r) => r.status === 'exists').length,
      error: rows.filter((r) => r.status === 'error').length,
    },
  }
}

const rowNumber = (raw: Record<string, string>) => Number(raw.__row ?? 0)

// ===========================================================================
// TEACHERS
// ===========================================================================

export interface TeacherImportValue {
  fullName: string
  email: string | null
  phone: string | null
  staffNo: string | null
  status: string
}

interface TeacherContext {
  byEmail: Map<string, TeacherRow>
  byStaffNo: Map<string, TeacherRow>
}

const teacherColumns: ColumnSpec[] = [
  { key: 'fullName', header: 'Full name', required: true, example: 'Amina Yusuf Hassan' },
  { key: 'email', header: 'Email', required: false, example: 'amina.yusuf@example.com', hint: 'Needed later to invite them. Must be unique in the school.' },
  { key: 'phone', header: 'Phone', required: false, example: '+252612345678' },
  { key: 'staffNo', header: 'Staff number', required: false, example: 'T-2026-014', hint: 'Must be unique in the school.' },
  { key: 'status', header: 'Status', required: false, example: 'active', options: TEACHER_STATUSES },
]

export const teachersImport: ImportKind<TeacherImportValue, TeacherContext> = {
  id: 'teachers',
  title: 'Import teachers',
  fileName: 'Nom Cloud - Teachers template',
  maxRows: 1000,
  columns: teacherColumns,
  notes: [
    'A teacher imported here does not get a login. Invite them afterwards from the Teachers page.',
    'Email and staff number must each be unique within the school. A row repeating one that already exists is reported as already existing and is skipped.',
  ],
  loadContext: async (schoolId) => {
    const teachers = await fetchSchoolTeachers(schoolId)
    return {
      byEmail: new Map(teachers.filter((t) => t.email).map((t) => [norm(t.email as string), t])),
      byStaffNo: new Map(teachers.filter((t) => t.staff_no).map((t) => [norm(t.staff_no as string), t])),
    }
  },
  precheck: () => null,
  prepare: (raws, context) => {
    const rows: PreparedRow<TeacherImportValue>[] = []
    const seenEmail = new Map<string, number>()
    const seenStaffNo = new Map<string, number>()

    for (const raw of raws) {
      const row = rowNumber(raw)
      const problems: string[] = []
      const fullName = raw.fullName?.trim() ?? ''
      const email = raw.email?.trim() ?? ''
      const staffNo = raw.staffNo?.trim() ?? ''
      const status = raw.status?.trim() ? norm(raw.status) : 'active'

      if (!fullName) problems.push('full name is required')
      if (email && !isValidEmail(email)) problems.push(`'${email}' is not a valid email address`)
      if (!TEACHER_STATUSES.includes(status as (typeof TEACHER_STATUSES)[number])) {
        problems.push(`status must be ${TEACHER_STATUSES.join(' or ')}`)
      }

      let exists = false
      if (email && isValidEmail(email)) {
        const key = norm(email)
        const earlier = seenEmail.get(key)
        if (earlier) problems.push(`email '${email}' is also on row ${earlier}`)
        else seenEmail.set(key, row)
        if (context.byEmail.has(key)) exists = true
      }
      if (staffNo) {
        const key = norm(staffNo)
        const earlier = seenStaffNo.get(key)
        if (earlier) problems.push(`staff number '${staffNo}' is also on row ${earlier}`)
        else seenStaffNo.set(key, row)
        if (context.byStaffNo.has(key)) exists = true
      }

      rows.push({
        row,
        raw,
        value: problems.length ? null : { fullName, email: orNull(email), phone: orNull(raw.phone ?? ''), staffNo: orNull(staffNo), status },
        problems,
        status: problems.length ? 'error' : exists ? 'exists' : 'ready',
        note: exists && !problems.length ? 'already in Nom Cloud — will be skipped' : undefined,
      })
    }
    return finish(rows, [])
  },
  importRow: async (schoolId, prepared): Promise<RowOutcome> => {
    const value = prepared.value as TeacherImportValue
    const label = value.fullName
    try {
      await createTeacher(schoolId, { ...value, primarySubjectId: null })
      return { row: prepared.row, label, status: 'created', detail: 'Teacher created.' }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      if (/duplicate|already exists|23505/i.test(message)) {
        return { row: prepared.row, label, status: 'skipped', detail: 'A teacher with that email or staff number already exists.' }
      }
      return { row: prepared.row, label, status: 'failed', detail: message }
    }
  },
}

// ===========================================================================
// CLASSES
// ===========================================================================

export interface ClassImportValue {
  name: string
  grade: string
  section: string | null
  room: string | null
  capacity: number | null
  academicYearId: string
  classTeacherId: string | null
  campusId: string | null
}

interface CampusRow {
  id: string
  name: string
}

interface ClassContext {
  years: AcademicYearRow[]
  activeYear: AcademicYearRow | null
  campuses: CampusRow[]
  teachers: TeacherRow[]
  /** Existing class names per "yearId|campusId" bucket, matching the unique index. */
  existing: Set<string>
}

const classKey = (yearId: string, campusId: string | null, name: string) => `${yearId}|${campusId ?? ''}|${norm(name)}`

const classColumns: ColumnSpec[] = [
  { key: 'name', header: 'Class name', required: true, example: 'Grade 5A' },
  { key: 'grade', header: 'Grade', required: true, example: 'Grade 5' },
  { key: 'section', header: 'Section', required: false, example: 'A' },
  { key: 'academicYear', header: 'Academic year', required: true, example: '2026/2027', hint: 'Must match an academic year that already exists, exactly.' },
  { key: 'campus', header: 'Campus', required: false, example: '', hint: 'Leave blank for a single-campus school. If filled, must match a campus name exactly.' },
  { key: 'homeroomTeacher', header: 'Homeroom teacher', required: false, example: 'Amina Yusuf Hassan', hint: 'Matched by staff number, then email, then full name. Import teachers first.' },
  { key: 'capacity', header: 'Capacity', required: false, example: '35', hint: 'A whole number above zero.' },
  { key: 'room', header: 'Room', required: false, example: 'Block B, Room 12' },
]

export const classesImport: ImportKind<ClassImportValue, ClassContext> = {
  id: 'classes',
  title: 'Import classes',
  fileName: 'Nom Cloud - Classes template',
  maxRows: 500,
  columns: classColumns,
  notes: [
    'Import teachers before classes: a homeroom teacher must already exist.',
    'The academic year must already exist. Create it under Academic years first.',
    'Setting the homeroom teacher is what lets that teacher mark attendance for the class.',
  ],
  loadContext: async (schoolId) => {
    const [years, campuses, teachers, classes] = await Promise.all([
      fetchAcademicYears(schoolId),
      supabase.from('campuses').select('id, name').eq('school_id', schoolId),
      fetchSchoolTeachers(schoolId),
      supabase.from('classes').select('name, academic_year_id, campus_id').eq('school_id', schoolId),
    ])
    if (campuses.error) throw campuses.error
    if (classes.error) throw classes.error
    const existing = new Set(
      ((classes.data ?? []) as { name: string; academic_year_id: string; campus_id: string | null }[]).map((c) =>
        classKey(c.academic_year_id, c.campus_id, c.name),
      ),
    )
    return {
      years,
      activeYear: activeAcademicYear(years),
      campuses: (campuses.data ?? []) as CampusRow[],
      teachers,
      existing,
    }
  },
  precheck: (context) =>
    context.years.length === 0
      ? 'This school has no academic year yet, and every class belongs to one. Create an academic year under Academic years, then import classes.'
      : null,
  prepare: (raws, context) => {
    const rows: PreparedRow<ClassImportValue>[] = []
    const seen = new Map<string, number>()

    for (const raw of raws) {
      const row = rowNumber(raw)
      const problems: string[] = []
      const name = raw.name?.trim() ?? ''
      const grade = raw.grade?.trim() ?? ''
      const yearLabel = raw.academicYear?.trim() ?? ''
      const campusName = raw.campus?.trim() ?? ''
      const teacherName = raw.homeroomTeacher?.trim() ?? ''
      const capacityRaw = raw.capacity?.trim() ?? ''

      if (!name) problems.push('class name is required')
      if (!grade) problems.push('grade is required')

      const year = context.years.find((y) => norm(y.label) === norm(yearLabel))
      if (!yearLabel) problems.push('academic year is required')
      else if (!year) problems.push(`academic year '${yearLabel}' does not exist`)

      let campusId: string | null = null
      if (campusName) {
        const matches = context.campuses.filter((c) => norm(c.name) === norm(campusName))
        if (matches.length === 0) problems.push(`campus '${campusName}' does not exist`)
        else if (matches.length > 1) problems.push(`campus '${campusName}' matches ${matches.length} campuses`)
        else campusId = matches[0].id
      }

      let classTeacherId: string | null = null
      if (teacherName) {
        const byStaff = context.teachers.filter((t) => t.staff_no && norm(t.staff_no) === norm(teacherName))
        const byEmail = context.teachers.filter((t) => t.email && norm(t.email) === norm(teacherName))
        const byName = context.teachers.filter((t) => norm(t.full_name) === norm(teacherName))
        const matches = byStaff.length ? byStaff : byEmail.length ? byEmail : byName
        if (matches.length === 0) problems.push(`homeroom teacher '${teacherName}' not found — import teachers first`)
        else if (matches.length > 1) problems.push(`homeroom teacher '${teacherName}' matches ${matches.length} teachers — use their staff number or email instead`)
        else classTeacherId = matches[0].id
      }

      let capacity: number | null = null
      if (capacityRaw) {
        const parsed = Number(capacityRaw)
        if (!Number.isInteger(parsed) || parsed <= 0) problems.push(`capacity '${capacityRaw}' must be a whole number above zero`)
        else capacity = parsed
      }

      let exists = false
      if (name && year) {
        const key = classKey(year.id, campusId, name)
        const earlier = seen.get(key)
        if (earlier) problems.push(`class '${name}' is also on row ${earlier} for the same year`)
        else seen.set(key, row)
        if (context.existing.has(key)) exists = true
      }

      rows.push({
        row,
        raw,
        value:
          problems.length || !year
            ? null
            : { name, grade, section: orNull(raw.section ?? ''), room: orNull(raw.room ?? ''), capacity, academicYearId: year.id, classTeacherId, campusId },
        problems,
        status: problems.length ? 'error' : exists ? 'exists' : 'ready',
        note: exists && !problems.length ? 'already in Nom Cloud — will be skipped' : undefined,
      })
    }
    return finish(rows, [])
  },
  importRow: async (schoolId, prepared): Promise<RowOutcome> => {
    const value = prepared.value as ClassImportValue
    try {
      await createClass(schoolId, value)
      return { row: prepared.row, label: value.name, status: 'created', detail: 'Class created.' }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      if (/already exists|duplicate|23505/i.test(message)) {
        return { row: prepared.row, label: value.name, status: 'skipped', detail: 'A class with that name already exists for that academic year.' }
      }
      return { row: prepared.row, label: value.name, status: 'failed', detail: message }
    }
  },
}

// ===========================================================================
// STUDENTS (with their guardians)
// ===========================================================================

interface GuardianSpec {
  fullName: string
  /** Narrowed to the app's own list while checking, so the writer cannot widen it. */
  relationship: GuardianRelationship
  phone: string
  email: string | null
}

export interface StudentImportValue {
  fullName: string
  admissionNo: string
  gender: StudentGender | null
  dateOfBirth: string | null
  status: string
  classId: string
  academicYearId: string
  guardians: GuardianSpec[]
  /** Index into `guardians` of the primary contact. */
  primaryIndex: number
}

interface StudentContext {
  activeYear: AcademicYearRow | null
  classes: { id: string; name: string; campus_id: string | null }[]
  campuses: CampusRow[]
  admissionNos: Set<string>
  /** Existing guardians by lower-cased email — the ONLY key used to match. */
  guardiansByEmail: Map<string, string>
}

const studentColumns: ColumnSpec[] = [
  { key: 'fullName', header: 'Full name', required: true, example: 'Ayaan Mohamed Ali' },
  { key: 'admissionNo', header: 'Admission number', required: true, example: '2026-014', hint: 'Must be unique in the school. This is what makes re-importing safe.' },
  { key: 'gender', header: 'Gender', required: false, example: 'female', options: GENDERS },
  { key: 'dateOfBirth', header: 'Date of birth', required: false, example: '2015-04-23', hint: 'yyyy-mm-dd or dd/mm/yyyy. Must be in the past.' },
  { key: 'status', header: 'Status', required: false, example: 'active', options: STUDENT_STATUSES },
  { key: 'className', header: 'Class', required: true, example: 'Grade 5A', hint: 'Must match a class that already exists in the active academic year.' },
  { key: 'campus', header: 'Campus', required: false, example: '', hint: 'Only needed when two campuses use the same class name.' },
  { key: 'g1Name', header: 'Guardian 1 name', required: true, example: 'Amina Hassan' },
  { key: 'g1Relationship', header: 'Guardian 1 relationship', required: true, example: 'Mother', options: GUARDIAN_RELATIONSHIPS },
  { key: 'g1Phone', header: 'Guardian 1 phone', required: true, example: '+252612345678' },
  { key: 'g1Email', header: 'Guardian 1 email', required: false, example: 'amina.hassan@example.com', hint: 'The ONLY way siblings are linked to one guardian. Without it, the same parent on two rows becomes two records.' },
  { key: 'g2Name', header: 'Guardian 2 name', required: false, example: '' },
  { key: 'g2Relationship', header: 'Guardian 2 relationship', required: false, example: '', options: GUARDIAN_RELATIONSHIPS },
  { key: 'g2Phone', header: 'Guardian 2 phone', required: false, example: '' },
  { key: 'g2Email', header: 'Guardian 2 email', required: false, example: '' },
  { key: 'primaryContact', header: 'Primary contact', required: false, example: 'Guardian 1', options: ['Guardian 1', 'Guardian 2'] },
]

export const studentsImport: ImportKind<StudentImportValue, StudentContext> = {
  id: 'students',
  title: 'Import students',
  fileName: 'Nom Cloud - Students template',
  maxRows: 2000,
  columns: studentColumns,
  notes: [
    'Import teachers and classes before students: the class must already exist.',
    'Guardians are matched by EMAIL ONLY. Two rows share one guardian record when the email is the same. A shared family phone is never used to merge two people, because a mother and a father often answer the same number.',
    'A guardian with no email cannot be matched. The same parent on two rows without an email becomes two separate records — the preview warns about this before anything is written.',
    'No invitation is sent by importing. Invite guardians afterwards from the Guardians page.',
  ],
  loadContext: async (schoolId) => {
    const years = await fetchAcademicYears(schoolId)
    const activeYear = activeAcademicYear(years)
    const [classes, campuses, students, guardians] = await Promise.all([
      activeYear
        ? supabase.from('classes').select('id, name, campus_id').eq('school_id', schoolId).eq('academic_year_id', activeYear.id)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('campuses').select('id, name').eq('school_id', schoolId),
      supabase.from('students').select('admission_no').eq('school_id', schoolId),
      supabase.from('guardians').select('id, email').eq('school_id', schoolId).not('email', 'is', null),
    ])
    if (classes.error) throw classes.error
    if (campuses.error) throw campuses.error
    if (students.error) throw students.error
    if (guardians.error) throw guardians.error
    return {
      activeYear,
      classes: (classes.data ?? []) as { id: string; name: string; campus_id: string | null }[],
      campuses: (campuses.data ?? []) as CampusRow[],
      admissionNos: new Set(((students.data ?? []) as { admission_no: string }[]).map((s) => norm(s.admission_no))),
      guardiansByEmail: new Map(
        ((guardians.data ?? []) as { id: string; email: string }[]).map((g) => [norm(g.email), g.id]),
      ),
    }
  },
  precheck: (context) =>
    !context.activeYear
      ? 'This school has no active academic year, and a student must be enrolled into one. Set the active academic year under Academic years, then import students.'
      : context.classes.length === 0
        ? 'This school has no classes in the active academic year yet. Import or create classes first, then import students.'
        : null,
  prepare: (raws, context) => {
    if (!context.activeYear) return emptyPlan<StudentImportValue>()
    const yearId = context.activeYear.id
    const rows: PreparedRow<StudentImportValue>[] = []
    const seenAdmission = new Map<string, number>()
    /** email -> first row that used it, for the "links to N students" notice. */
    const emailRows = new Map<string, { name: string; rows: number[] }>()
    /** lower-cased name -> rows where that name appeared WITHOUT an email. */
    const namelessRows = new Map<string, number[]>()

    for (const raw of raws) {
      const row = rowNumber(raw)
      const problems: string[] = []
      const fullName = raw.fullName?.trim() ?? ''
      const admissionNo = raw.admissionNo?.trim() ?? ''
      const genderRaw = raw.gender?.trim() ?? ''
      const statusRaw = raw.status?.trim() ?? ''
      const className = raw.className?.trim() ?? ''
      const campusName = raw.campus?.trim() ?? ''

      if (!fullName) problems.push('full name is required')
      if (!admissionNo) problems.push('admission number is required')

      const genderText = genderRaw ? norm(genderRaw) : null
      const genderValid = genderText === null || GENDERS.includes(genderText as StudentGender)
      if (!genderValid) problems.push(`gender must be ${GENDERS.join(', ')}`)
      const gender = (genderValid ? genderText : null) as StudentGender | null
      const status = statusRaw ? norm(statusRaw) : 'active'
      if (!STUDENT_STATUSES.includes(status as (typeof STUDENT_STATUSES)[number])) {
        problems.push(`status must be one of ${STUDENT_STATUSES.join(', ')}`)
      }

      const { date: dateOfBirth, bad } = parseDate(raw.dateOfBirth ?? '')
      if (bad) problems.push(`date of birth '${raw.dateOfBirth}' is not a date — use yyyy-mm-dd`)
      else if (dateOfBirth && !isPast(dateOfBirth)) problems.push('date of birth must be in the past')

      // ---- class, disambiguated by campus when the name is not unique
      let classId: string | null = null
      if (!className) problems.push('class is required')
      else {
        let matches = context.classes.filter((c) => norm(c.name) === norm(className))
        if (campusName) {
          const campus = context.campuses.filter((c) => norm(c.name) === norm(campusName))
          if (campus.length === 0) problems.push(`campus '${campusName}' does not exist`)
          else matches = matches.filter((c) => c.campus_id === campus[0].id)
        }
        if (matches.length === 0) problems.push(`class '${className}' does not exist`)
        else if (matches.length > 1) {
          problems.push(`class '${className}' exists on ${matches.length} campuses — add the Campus column to say which`)
        } else classId = matches[0].id
      }

      // ---- duplicates: inside the file, and against the database
      let exists = false
      if (admissionNo) {
        const key = norm(admissionNo)
        const earlier = seenAdmission.get(key)
        if (earlier) problems.push(`admission number '${admissionNo}' is also on row ${earlier}`)
        else seenAdmission.set(key, row)
        if (context.admissionNos.has(key)) exists = true
      }

      // ---- guardians
      const guardians: GuardianSpec[] = []
      const readGuardian = (prefix: 'g1' | 'g2', required: boolean) => {
        const name = raw[`${prefix}Name`]?.trim() ?? ''
        const relationship = raw[`${prefix}Relationship`]?.trim() ?? ''
        const phone = raw[`${prefix}Phone`]?.trim() ?? ''
        const email = raw[`${prefix}Email`]?.trim() ?? ''
        const label = prefix === 'g1' ? 'guardian 1' : 'guardian 2'

        if (!name) {
          if (required) problems.push(`${label} name is required`)
          else if (relationship || phone || email) problems.push(`${label} has details but no name`)
          return
        }
        if (!relationship) problems.push(`${label} relationship is required`)
        else if (!GUARDIAN_RELATIONSHIPS.some((r) => norm(r) === norm(relationship))) {
          problems.push(`${label} relationship must be ${GUARDIAN_RELATIONSHIPS.join(', ')}`)
        }
        if (!phone) problems.push(`${label} phone is required`)
        if (email && !isValidEmail(email)) problems.push(`${label} email '${email}' is not a valid email address`)

        // Only the app's own three values are ever stored. A row whose
        // relationship is not one of them has already been reported above, and
        // is recorded as 'Other' purely so the rest of the row can be checked —
        // it will not be written, because the row is in error.
        const canonical = GUARDIAN_RELATIONSHIPS.find((r) => norm(r) === norm(relationship)) ?? 'Other'
        guardians.push({ fullName: name, relationship: canonical, phone, email: email && isValidEmail(email) ? email : null })

        if (email && isValidEmail(email)) {
          const key = norm(email)
          const entry = emailRows.get(key) ?? { name, rows: [] }
          entry.rows.push(row)
          emailRows.set(key, entry)
        } else {
          const key = norm(name)
          namelessRows.set(key, [...(namelessRows.get(key) ?? []), row])
        }
      }
      readGuardian('g1', true)
      readGuardian('g2', false)

      if (guardians.length === 2 && guardians[0].email && guardians[1].email && norm(guardians[0].email) === norm(guardians[1].email)) {
        problems.push('guardian 1 and guardian 2 have the same email — they would be one person')
      }

      const primaryRaw = raw.primaryContact?.trim() ?? ''
      let primaryIndex = 0
      if (primaryRaw) {
        if (/2/.test(primaryRaw)) primaryIndex = 1
        else if (!/1/.test(primaryRaw)) problems.push(`primary contact must be 'Guardian 1' or 'Guardian 2'`)
      }
      if (primaryIndex === 1 && guardians.length < 2) {
        problems.push('primary contact is Guardian 2, but there is no guardian 2')
      }

      const notes: string[] = []
      for (const guardian of guardians) {
        if (guardian.email && context.guardiansByEmail.has(norm(guardian.email))) {
          notes.push(`${guardian.fullName} already exists and will be linked, not duplicated`)
        }
      }

      rows.push({
        row,
        raw,
        value:
          problems.length || !classId
            ? null
            : { fullName, admissionNo, gender, dateOfBirth, status, classId, academicYearId: yearId, guardians, primaryIndex },
        problems,
        status: problems.length ? 'error' : exists ? 'exists' : 'ready',
        note: exists && !problems.length ? 'admission number already in Nom Cloud — will be skipped' : notes.join('; ') || undefined,
      })
    }

    // ---- file-level notices
    const notices: string[] = []
    for (const [, entry] of emailRows) {
      if (entry.rows.length > 1) {
        notices.push(`Guardian ${entry.name} links to ${entry.rows.length} students (rows ${entry.rows.join(', ')}) — one guardian record will be used.`)
      }
    }
    for (const [, rowsWithName] of namelessRows) {
      if (rowsWithName.length > 1) {
        const name = raws.find((r) => rowNumber(r) === rowsWithName[0])
        const display = name?.g1Name?.trim() || name?.g2Name?.trim() || 'that guardian'
        notices.push(
          `Row ${rowsWithName.slice(0, -1).join(', Row ')} and Row ${rowsWithName[rowsWithName.length - 1]}: guardians with the same name (${display}) and no email — they will be created separately. Add an email to link them.`,
        )
      }
    }
    return finish(rows, notices)
  },
  importRow: async (schoolId, prepared, context): Promise<RowOutcome> => {
    const value = prepared.value as StudentImportValue
    const label = `${value.fullName} (${value.admissionNo})`
    try {
      const studentId = await createStudent(schoolId, {
        fullName: value.fullName,
        admissionNo: value.admissionNo,
        gender: value.gender,
        dateOfBirth: value.dateOfBirth,
        status: value.status,
      })
      await enrolStudent(schoolId, studentId, value.classId, value.academicYearId)

      const linked: string[] = []
      for (const [index, guardian] of value.guardians.entries()) {
        const key = guardian.email ? norm(guardian.email) : null
        const existingId = key ? context.guardiansByEmail.get(key) : undefined
        let guardianId: string
        if (existingId) {
          guardianId = existingId
          linked.push(`${guardian.fullName} (existing)`)
        } else {
          guardianId = await createGuardian(schoolId, { fullName: guardian.fullName, email: guardian.email, phone: guardian.phone })
          // Remember it immediately so the next sibling links rather than duplicates.
          if (key) context.guardiansByEmail.set(key, guardianId)
          linked.push(`${guardian.fullName} (new)`)
        }
        await linkGuardianToStudent(schoolId, studentId, guardianId, index === value.primaryIndex, guardian.relationship)
      }

      context.admissionNos.add(norm(value.admissionNo))
      return { row: prepared.row, label, status: 'created', detail: `Student created and enrolled. Guardians: ${linked.join(', ')}.` }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      if (/duplicate|already exists|23505/i.test(message)) {
        return { row: prepared.row, label, status: 'skipped', detail: 'A student with that admission number already exists.' }
      }
      return { row: prepared.row, label, status: 'failed', detail: message }
    }
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const IMPORT_KINDS: Record<string, ImportKind<any, any>> = {
  teachers: teachersImport,
  classes: classesImport,
  students: studentsImport,
}
