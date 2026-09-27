import { supabase } from '@/lib/supabase'
import { createTeacher, fetchSchoolTeachers, type TeacherRow } from '@/services/teacherService'
import { createClass } from '@/services/classService'
import { createStudent, enrolStudent, type StudentGender } from '@/services/studentService'
import { createGuardian, linkGuardianToStudent, GUARDIAN_RELATIONSHIPS, type GuardianRelationship } from '@/services/guardianService'
import { fetchAcademicYears, fetchSubjects, activeAcademicYear, type AcademicYearRow } from '@/services/academicService'
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
//
// WHAT IS REQUIRED IS WHAT THE DATABASE REQUIRES, verified against the live
// schema rather than assumed:
//   students.full_name, students.admission_no  NOT NULL
//   students.gender, students.date_of_birth    nullable, so genuinely optional
//   students.status                            NOT NULL but defaulted 'active'
//   guardians.full_name, guardians.phone       NOT NULL
//   guardians.email                            nullable
//   student_guardians.relationship             nullable
//   teachers.full_name                         NOT NULL
//   teachers.email, phone, staff_no            nullable
// admission_no is the one NOT NULL column with no default, which is why a
// missing one is generated rather than refused. teachers.email is nullable in the
// database but required here, because it is the only way to invite a teacher to
// sign in and a staff list without it cannot be acted on.
// ---------------------------------------------------------------------------

const GENDERS = ['male', 'female', 'other'] as const
const STUDENT_STATUSES = ['active', 'inactive', 'graduated', 'transferred'] as const
const TEACHER_STATUSES = ['active', 'inactive'] as const

// ---------------------------------------------------------------------------
// HEADER ALIASES — the names real school spreadsheets actually use.
//
// Compared with case, spaces, underscores and punctuation removed, so one entry
// covers "Full Name", "full_name" and "FULL-NAME", and "dob" also matches
// "D.O.B". Only genuinely distinct words need listing.
//
// Shared lists are declared once because the same human word means the same
// field in all three imports. Where a word is ambiguous BETWEEN kinds it is left
// out of the shared list and put on the one column it belongs to: "grade" is a
// class's year group in the classes import but the pupil's class in the students
// import, so it is not shared.
// ---------------------------------------------------------------------------

const NAME_ALIASES = ['name', 'full names', 'fullnames', 'names', 'student name', 'pupil name', 'learner name', 'teacher name', 'staff name', 'first name and surname'] as const
const EMAIL_ALIASES = ['e-mail', 'email address', 'e-mail address', 'mail', 'email id'] as const
const PHONE_ALIASES = ['mobile', 'contact', 'phone number', 'tel', 'telephone', 'mobile number', 'cell', 'contact number', 'msisdn'] as const
const STAFF_NO_ALIASES = ['staff id', 'staff no', 'staff number', 'employee id', 'employee no', 'employee number', 'teacher id', 'payroll no', 'payroll number'] as const
const ADMISSION_ALIASES = ['admission no', 'admission number', 'adm no', 'adm number', 'admno', 'reg no', 'reg number', 'registration no', 'registration number', 'student id', 'student no', 'student number', 'pupil id', 'index number', 'index no', 'roll no', 'roll number'] as const
const GENDER_ALIASES = ['sex', 'm/f', 'gender (m/f)'] as const
const DOB_ALIASES = ['dob', 'd.o.b', 'date of birth', 'birth date', 'birthdate', 'birthday', 'born', 'date born'] as const
const STUDENT_CLASS_ALIASES = ['class name', 'grade', 'form', 'stream', 'section', 'class/section', 'current class', 'classroom', 'standard'] as const
const GUARDIAN_NAME_ALIASES = ['parent name', 'guardian name', 'parent', 'guardian', 'father name', 'mother name', "father's name", "mother's name", 'next of kin', 'next of kin name', 'parent/guardian', 'parent guardian name', 'contact person'] as const
const GUARDIAN_PHONE_ALIASES = ['parent phone', 'guardian phone', 'parent mobile', 'guardian mobile', 'parent contact', 'guardian contact', 'mobile', 'contact', 'phone number', 'phone', 'tel', 'telephone', 'parent tel', 'next of kin phone', 'contact number', 'parent phone number'] as const
const GUARDIAN_EMAIL_ALIASES = ['parent email', 'guardian email', 'parent e-mail', 'guardian e-mail', 'email', 'e-mail', 'email address', 'parent email address'] as const
const GUARDIAN_RELATIONSHIP_ALIASES = ['relationship', 'relation', 'parent relationship', 'guardian relationship', 'relationship to student', 'relationship to pupil', 'parent type'] as const

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

/**
 * Phone numbers compare as "identical" ignoring only the punctuation people type
 * inside them.
 *
 * "+252 61 234 5678" and "+252-612345678" are the same number. "0612345678" is
 * NOT treated as the same as "+252612345678": guessing at country codes would
 * merge two people on a hunch, and this comparison is used to decide that two
 * pupils share a parent.
 */
const normPhone = (value: string) => value.replace(/[\s\-().]/g, '')

/** "AHS" + 2026 + 7 -> "AHS-2026-007". Sequences past 999 simply grow. */
const admissionNumber = (shortcode: string, year: number, sequence: number) =>
  `${shortcode.toUpperCase()}-${year}-${String(sequence).padStart(3, '0')}`

/**
 * The highest sequence already issued in the SHORTCODE-YEAR-NNN form, so
 * generated numbers continue the school's own series instead of colliding with
 * it. Anything not in that form — a school's own "2026-014" — is ignored here,
 * and is still protected by the unique index and the duplicate check.
 */
function highestAdmissionSequence(existing: string[], shortcode: string, year: number): number {
  const pattern = new RegExp(`^${shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-${year}-(\\d+)$`, 'i')
  let highest = 0
  for (const value of existing) {
    const match = value.trim().match(pattern)
    if (!match) continue
    const sequence = Number(match[1])
    if (Number.isFinite(sequence) && sequence > highest) highest = sequence
  }
  return highest
}

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
  primarySubjectId: string | null
}

interface TeacherContext {
  byEmail: Map<string, TeacherRow>
  byStaffNo: Map<string, TeacherRow>
  /** Lower-cased subject name -> id, for the optional Primary subject column. */
  subjectsByName: Map<string, string>
}

const teacherColumns: ColumnSpec[] = [
  { key: 'fullName', header: 'Full name', aliases: NAME_ALIASES, required: true, example: 'Amina Yusuf Hassan' },
  { key: 'email', header: 'Email', aliases: EMAIL_ALIASES, required: true, example: 'amina.yusuf@example.com', hint: 'Needed to invite them later. Must be unique in the school.' },
  { key: 'phone', header: 'Phone', aliases: PHONE_ALIASES, required: false, example: '+252612345678' },
  { key: 'staffNo', header: 'Staff number', aliases: STAFF_NO_ALIASES, required: false, example: 'T-2026-014', hint: 'Must be unique in the school.' },
  { key: 'status', header: 'Status', aliases: ['employment status', 'state'], required: false, example: 'active', options: TEACHER_STATUSES },
  // No Date of birth or Gender column: the teachers table has nowhere to put
  // them (see the report). A school's own DOB column is simply left unmapped and
  // ignored, rather than shown here as though it were being stored.
  { key: 'primarySubject', header: 'Primary subject', aliases: ['subject', 'main subject', 'teaching subject', 'specialisation', 'specialization'], required: false, example: '', hint: 'Matched by subject name. Reported as a problem when it names a subject the school does not have.' },
]

export const teachersImport: ImportKind<TeacherImportValue, TeacherContext> = {
  id: 'teachers',
  title: 'Import teachers',
  fileName: 'Nom Cloud - Teachers template',
  maxRows: 1000,
  columns: teacherColumns,
  notes: [
    'Import your own staff list. Nom Cloud recognises headers such as "Teacher Name", "Staff ID" or "E-mail"; anything it cannot place, you point at yourself before importing.',
    'Only the name and the email address are needed. Phone, staff number, status and primary subject can all be missing, and are left empty.',
    'The email address is required because it is the only way to invite them to sign in later.',
    'A teacher imported here does not get a login. Invite them afterwards from the Teachers page.',
    'Email and staff number must each be unique within the school. A row repeating one that already exists is reported as already existing and is skipped.',
  ],
  loadContext: async (schoolId) => {
    const [teachers, subjects] = await Promise.all([fetchSchoolTeachers(schoolId), fetchSubjects(schoolId)])
    return {
      byEmail: new Map(teachers.filter((t) => t.email).map((t) => [norm(t.email as string), t])),
      byStaffNo: new Map(teachers.filter((t) => t.staff_no).map((t) => [norm(t.staff_no as string), t])),
      subjectsByName: new Map(subjects.map((subject) => [norm(subject.name), subject.id])),
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
      if (!email) problems.push('email is required — it is how they are invited to sign in')
      else if (!isValidEmail(email)) problems.push(`'${email}' is not a valid email address`)
      if (!TEACHER_STATUSES.includes(status as (typeof TEACHER_STATUSES)[number])) {
        problems.push(`status must be ${TEACHER_STATUSES.join(' or ')}`)
      }

      const subjectName = raw.primarySubject?.trim() ?? ''
      let primarySubjectId: string | null = null
      if (subjectName) {
        const found = context.subjectsByName.get(norm(subjectName))
        if (!found) problems.push(`subject '${subjectName}' does not exist in this school`)
        else primarySubjectId = found
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
        value: problems.length
          ? null
          : { fullName, email: orNull(email), phone: orNull(raw.phone ?? ''), staffNo: orNull(staffNo), status, primarySubjectId },
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
      await createTeacher(schoolId, value)
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
  { key: 'name', header: 'Class name', aliases: ['class', 'classname', 'name', 'stream', 'class/stream'], required: true, example: 'Grade 5A' },
  { key: 'grade', header: 'Grade', aliases: ['form', 'level', 'year group', 'standard', 'grade level'], required: true, example: 'Grade 5' },
  { key: 'section', header: 'Section', aliases: ['stream letter', 'division'], required: false, example: 'A' },
  { key: 'academicYear', header: 'Academic year', aliases: ['year', 'school year', 'session', 'academic session'], required: true, example: '2026/2027', hint: 'Must match an academic year that already exists, exactly.' },
  { key: 'campus', header: 'Campus', aliases: ['branch', 'site', 'school branch'], required: false, example: '', hint: 'Leave blank for a single-campus school. If filled, must match a campus name exactly.' },
  { key: 'homeroomTeacher', header: 'Homeroom teacher', aliases: ['class teacher', 'classteacher', 'form teacher', 'teacher', 'homeroom'], required: false, example: 'Amina Yusuf Hassan', hint: 'Matched by staff number, then email, then full name. Import teachers first.' },
  { key: 'capacity', header: 'Capacity', aliases: ['max students', 'maximum students', 'seats', 'class size'], required: false, example: '35', hint: 'A whole number above zero.' },
  { key: 'room', header: 'Room', aliases: ['classroom', 'room no', 'room number', 'venue'], required: false, example: 'Block B, Room 12' },
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
  /**
   * Narrowed to the app's own list while checking, so the writer cannot widen
   * it. Null when their file has no relationship column — student_guardians
   * .relationship is nullable and the Students page already renders a guardian
   * with none as just their name.
   */
  relationship: GuardianRelationship | null
  phone: string
  email: string | null
  /**
   * The identity two rows must share to become ONE guardian record.
   *
   *   "email:<address>"  matched against this file AND the database
   *   "phone:<number>"   matched against this file ONLY — never the database
   *   null               always its own record
   *
   * Decided here rather than in the writer so the preview reports exactly the
   * merges that will happen, and so a school can correct them first.
   */
  mergeKey: string | null
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
  /**
   * Existing guardians by lower-cased email — the ONLY key matched against the
   * DATABASE. Phone is deliberately absent: a mother and a father commonly
   * answer one family number, and merging them would give one of them sight of
   * records that are not theirs.
   */
  guardiansByEmail: Map<string, string>
  /**
   * Guardians created while writing THIS file, by merge key. Starts empty on
   * every upload and is never seeded from the database, which is what confines
   * phone matching to a single import.
   */
  createdThisRun: Map<string, string>
  /** The school's shortcode, for generating admission numbers. */
  shortcode: string
  /** Year used in a generated admission number: the active academic year's start. */
  admissionYear: number
  /** Highest sequence already issued for that shortcode and year. */
  lastAdmissionSeq: number
}

const studentColumns: ColumnSpec[] = [
  { key: 'fullName', header: 'Full name', aliases: NAME_ALIASES, required: true, example: 'Ayaan Mohamed Ali' },
  { key: 'className', header: 'Class', aliases: STUDENT_CLASS_ALIASES, required: true, example: 'Grade 5A', hint: 'Must match a class that already exists in the active academic year.' },
  { key: 'g1Name', header: 'Guardian 1 name', aliases: GUARDIAN_NAME_ALIASES, required: true, example: 'Amina Hassan' },
  { key: 'g1Phone', header: 'Guardian 1 phone', aliases: GUARDIAN_PHONE_ALIASES, required: true, example: '+252612345678' },
  { key: 'admissionNo', header: 'Admission number', aliases: ADMISSION_ALIASES, required: false, example: '2026-014', hint: 'Must be unique in the school. Leave the column out and Nom Cloud generates one per pupil, shown in the preview before anything is written.' },
  { key: 'g1Relationship', header: 'Guardian 1 relationship', aliases: GUARDIAN_RELATIONSHIP_ALIASES, required: false, example: 'Mother', options: GUARDIAN_RELATIONSHIPS, hint: 'Left unrecorded when the column is missing, which is how the Guardians page already shows a guardian with no stated relationship.' },
  { key: 'g1Email', header: 'Guardian 1 email', aliases: GUARDIAN_EMAIL_ALIASES, required: false, example: 'amina.hassan@example.com', hint: 'The only thing that links a guardian to records already in Nom Cloud. Without it, matching happens only inside this one file.' },
  { key: 'gender', header: 'Gender', aliases: GENDER_ALIASES, required: false, example: 'female', options: GENDERS },
  { key: 'dateOfBirth', header: 'Date of birth', aliases: DOB_ALIASES, required: false, example: '2015-04-23', hint: 'yyyy-mm-dd or dd/mm/yyyy. Must be in the past.' },
  { key: 'status', header: 'Status', aliases: ['student status', 'state', 'enrolment status', 'enrollment status'], required: false, example: 'active', options: STUDENT_STATUSES },
  { key: 'campus', header: 'Campus', aliases: ['branch', 'site', 'school branch'], required: false, example: '', hint: 'Only needed when two campuses use the same class name.' },
  { key: 'g2Name', header: 'Guardian 2 name', aliases: ['second guardian name', 'second parent name', 'guardian 2', 'parent 2 name', 'other parent name'], required: false, example: '' },
  { key: 'g2Relationship', header: 'Guardian 2 relationship', aliases: ['second guardian relationship', 'parent 2 relationship'], required: false, example: '', options: GUARDIAN_RELATIONSHIPS },
  { key: 'g2Phone', header: 'Guardian 2 phone', aliases: ['second guardian phone', 'second parent phone', 'parent 2 phone', 'alternate phone', 'other phone'], required: false, example: '' },
  { key: 'g2Email', header: 'Guardian 2 email', aliases: ['second guardian email', 'parent 2 email'], required: false, example: '' },
  { key: 'primaryContact', header: 'Primary contact', aliases: ['main contact', 'primary guardian'], required: false, example: 'Guardian 1', options: ['Guardian 1', 'Guardian 2'] },
]

export const studentsImport: ImportKind<StudentImportValue, StudentContext> = {
  id: 'students',
  title: 'Import students',
  fileName: 'Nom Cloud - Students template',
  maxRows: 2000,
  columns: studentColumns,
  notes: [
    'Import your own pupil list. Nom Cloud recognises headers such as "Student Name", "Adm No", "Parent Name" and "Parent Mobile"; anything it cannot place, you point at yourself before importing.',
    'Only the pupil name, the class, and one guardian name and phone are needed. Everything else can be missing.',
    'Import teachers and classes before students: the class must already exist.',
    'No admission number column? Nom Cloud generates one per pupil as SHORTCODE-YEAR-NNN, continuing from the highest it has already issued. A number you supply is never changed. The generated numbers appear in the preview before anything is written.',
    'Guardians already in Nom Cloud are matched by EMAIL ONLY. A phone number is never matched against the database, because a mother and a father commonly answer one family number.',
    'Inside ONE uploaded file, rows sharing an identical guardian phone are treated as the same guardian, so siblings do not create three copies of one parent. Every such merge is listed in the preview. This never applies across two separate imports.',
    'No invitation is sent by importing. Invite guardians afterwards from the Guardians page.',
  ],
  loadContext: async (schoolId) => {
    const years = await fetchAcademicYears(schoolId)
    const activeYear = activeAcademicYear(years)
    const [classes, campuses, students, guardians, school] = await Promise.all([
      activeYear
        ? supabase.from('classes').select('id, name, campus_id').eq('school_id', schoolId).eq('academic_year_id', activeYear.id)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('campuses').select('id, name').eq('school_id', schoolId),
      supabase.from('students').select('admission_no').eq('school_id', schoolId),
      supabase.from('guardians').select('id, email').eq('school_id', schoolId).not('email', 'is', null),
      supabase.from('schools').select('shortcode').eq('id', schoolId).single(),
    ])
    if (classes.error) throw classes.error
    if (campuses.error) throw campuses.error
    if (students.error) throw students.error
    if (guardians.error) throw guardians.error
    if (school.error) throw school.error

    const admissionValues = ((students.data ?? []) as { admission_no: string }[]).map((s) => s.admission_no)
    const shortcode = (school.data as { shortcode: string }).shortcode
    // The academic year's start, not today's date, so importing the same intake
    // in January does not begin a second series for the same school year.
    const admissionYear = activeYear
      ? new Date(`${activeYear.start_date}T00:00:00Z`).getUTCFullYear()
      : new Date().getUTCFullYear()

    return {
      activeYear,
      classes: (classes.data ?? []) as { id: string; name: string; campus_id: string | null }[],
      campuses: (campuses.data ?? []) as CampusRow[],
      admissionNos: new Set(admissionValues.map((value) => norm(value))),
      guardiansByEmail: new Map(
        ((guardians.data ?? []) as { id: string; email: string }[]).map((g) => [norm(g.email), g.id]),
      ),
      createdThisRun: new Map(),
      shortcode,
      admissionYear,
      lastAdmissionSeq: highestAdmissionSequence(admissionValues, shortcode, admissionYear),
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
    /** merge key -> the rows that share it, for the "links to N pupils" notices. */
    const mergeRows = new Map<string, { name: string; phone: string; byEmail: boolean; rows: number[] }>()
    /** lower-cased name -> rows sharing it with neither an email nor a shared phone. */
    const unmatchableByName = new Map<string, { display: string; rows: number[] }>()

    /** Sequence for generated admission numbers, continuing the school's series. */
    let nextSequence = context.lastAdmissionSeq
    let generatedCount = 0
    let firstGenerated = ''
    let lastGenerated = ''

    for (const raw of raws) {
      const row = rowNumber(raw)
      const problems: string[] = []
      const fullName = raw.fullName?.trim() ?? ''
      const genderRaw = raw.gender?.trim() ?? ''
      const statusRaw = raw.status?.trim() ?? ''
      const className = raw.className?.trim() ?? ''
      const campusName = raw.campus?.trim() ?? ''

      if (!fullName) problems.push('full name is required')

      // ---- admission number: theirs if supplied, otherwise generated
      //
      // Generated only for a row that could otherwise be written. Numbering a
      // row that is about to be refused would burn a number and leave a gap in
      // the school's own series for no reason.
      let admissionNo = raw.admissionNo?.trim() ?? ''
      let generatedAdmissionNo = false
      if (!admissionNo && fullName) {
        do {
          nextSequence += 1
          admissionNo = admissionNumber(context.shortcode, context.admissionYear, nextSequence)
        } while (context.admissionNos.has(norm(admissionNo)) || seenAdmission.has(norm(admissionNo)))
        generatedAdmissionNo = true
        generatedCount += 1
        if (!firstGenerated) firstGenerated = admissionNo
        lastGenerated = admissionNo
        // Written back so the school SEES the number in the preview, which was
        // the condition for generating them at all.
        raw.admissionNo = admissionNo
      }

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
      /** Phones already claimed by an earlier guardian ON THIS ROW. */
      const phonesThisRow = new Set<string>()

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
        // A stated relationship must be one Nom Cloud knows. A MISSING one is
        // accepted and stored as unrecorded: most school spreadsheets have a
        // "Parent Name" column and no relationship column at all, and refusing
        // those files would defeat the point of reading their own file.
        if (relationship && !GUARDIAN_RELATIONSHIPS.some((r) => norm(r) === norm(relationship))) {
          problems.push(`${label} relationship must be ${GUARDIAN_RELATIONSHIPS.join(', ')}`)
        }
        // guardians.phone is NOT NULL in the database, so this one genuinely
        // cannot be left out.
        if (!phone) problems.push(`${label} phone is required`)
        if (email && !isValidEmail(email)) problems.push(`${label} email '${email}' is not a valid email address`)

        const validEmail = email && isValidEmail(email) ? email : null
        const canonical = GUARDIAN_RELATIONSHIPS.find((r) => norm(r) === norm(relationship)) ?? null

        // Merge identity. Email wins, because it is the only evidence strong
        // enough to match against records already in the database. Otherwise the
        // phone merges rows WITHIN this file — but never two guardians on the
        // same row, who are two named people however one family phone is shared.
        let mergeKey: string | null = null
        if (validEmail) {
          mergeKey = `email:${norm(validEmail)}`
        } else if (phone && !phonesThisRow.has(normPhone(phone))) {
          mergeKey = `phone:${normPhone(phone)}`
        }
        if (phone) phonesThisRow.add(normPhone(phone))

        guardians.push({ fullName: name, relationship: canonical, phone, email: validEmail, mergeKey })

        if (mergeKey) {
          const entry = mergeRows.get(mergeKey) ?? { name, phone, byEmail: Boolean(validEmail), rows: [] }
          entry.rows.push(row)
          mergeRows.set(mergeKey, entry)
        } else if (!validEmail) {
          const key = norm(name)
          const entry = unmatchableByName.get(key) ?? { display: name, rows: [] }
          entry.rows.push(row)
          unmatchableByName.set(key, entry)
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
      if (generatedAdmissionNo) notes.push(`admission number ${admissionNo} generated`)
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

    if (generatedCount > 0) {
      notices.push(
        generatedCount === 1
          ? `No admission number was supplied for 1 pupil. ${firstGenerated} will be used.`
          : `No admission number was supplied for ${generatedCount} pupils. ${firstGenerated} to ${lastGenerated} will be used — check them in the table below before importing.`,
      )
    }

    // Every merge, so it can be corrected before anything is written.
    for (const [, entry] of mergeRows) {
      if (entry.rows.length < 2) continue
      notices.push(
        entry.byEmail
          ? `${entry.name} links to ${entry.rows.length} pupils (rows ${entry.rows.join(', ')}) — one guardian record will be used.`
          : `${entry.name} (${entry.phone}) links to ${entry.rows.length} pupils (rows ${entry.rows.join(', ')}) — one guardian record will be used, matched on the phone number inside this file.`,
      )
    }

    // Same name, no email, and no shared phone either: genuinely two records.
    for (const [, entry] of unmatchableByName) {
      if (entry.rows.length < 2) continue
      notices.push(
        `Rows ${entry.rows.join(', ')}: guardians named ${entry.display} with no email and different phone numbers — they will be created separately. Give them the same phone number or an email to link them.`,
      )
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
        const emailKey = guardian.email ? norm(guardian.email) : null
        let guardianId: string

        // 1. Already in the database, matched on email alone.
        const inDatabase = emailKey ? context.guardiansByEmail.get(emailKey) : undefined
        // 2. Created earlier in THIS file, matched on email or — only here — phone.
        const inThisRun = guardian.mergeKey ? context.createdThisRun.get(guardian.mergeKey) : undefined

        if (inDatabase) {
          guardianId = inDatabase
          linked.push(`${guardian.fullName} (existing)`)
        } else if (inThisRun) {
          guardianId = inThisRun
          linked.push(`${guardian.fullName} (shared with an earlier row)`)
        } else {
          guardianId = await createGuardian(schoolId, { fullName: guardian.fullName, email: guardian.email, phone: guardian.phone })
          // Remembered immediately so the next sibling links rather than duplicates.
          if (emailKey) context.guardiansByEmail.set(emailKey, guardianId)
          if (guardian.mergeKey) context.createdThisRun.set(guardian.mergeKey, guardianId)
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
