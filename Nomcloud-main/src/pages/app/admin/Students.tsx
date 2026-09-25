import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Users, Plus, Pencil, Trash2, Upload, FileSpreadsheet, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import PageHeader from '@/components/ui/PageHeader'
import SearchInput from '@/components/ui/SearchInput'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import Avatar from '@/components/ui/Avatar'
import ResourceGate from '@/components/ui/ResourceGate'
import RequestProcessing from '@/components/ui/RequestProcessing'
import { deriveResourceState } from '@/lib/resourceState'
import { useRecordableClasses } from '@/hooks/useRecordableClasses'
import { useAcademicStructure } from '@/hooks/useAcademicStructure'
import {
  createStudent,
  deleteStudent,
  endEnrolment,
  enrolStudent,
  fetchStudentDirectory,
  updateStudent,
  STUDENT_STATUSES,
  type DirectoryStudent,
  type StudentGender,
} from '@/services/studentService'
import {
  createAndLinkGuardian,
  fetchSchoolGuardians,
  GUARDIAN_RELATIONSHIPS,
  linkGuardianToStudent,
  type GuardianRelationship,
  type GuardianRow,
} from '@/services/guardianService'
import { isValidEmail, minLength, type FieldErrors } from '@/utils/validators'
import { sendInvitation } from '@/services/invitationService'
import { todayInTimeZone, DEFAULT_TIME_ZONE } from '@/utils/schoolCalendar'
import { IMAGE_ACCEPT, prepareImage } from '@/lib/imageUpload'
import { BUCKETS, createSignedImageUrls, removeStudentPhoto, replaceStudentPhoto } from '@/services/storageService'
import { errorMessage, toError } from '@/utils/errorMessage'
import * as XLSX from 'xlsx'

// ---------------------------------------------------------------------------
// Phase 8 batch 8. Real students, enrolments and guardian links.
//
// A STUDENT HAS NO CLASS COLUMN. The prototype stored `classId` on the student
// and filtered on it. SCHEMA_DESIGN gives students no such column because
// enrolment is a time-scoped relation: changing a student's class writes
// class_enrollments, closing the open row with `left_on` and opening a new one.
// That is what the form does, and it is why the class field needs an academic
// year to write against.
//
// A STUDENT HAS MANY GUARDIANS. The prototype carried a single `parentId`.
// student_guardians is many-to-many by design, so the table shows every linked
// guardian and the form adds one rather than replacing the set.
//
// THE CLASS-SIZE CAP IS GONE. The prototype enforced a 50-student limit in the
// browser. classes.capacity is a real nullable column and is shown, but nothing
// in the database enforces it, so pretending otherwise in the client would be a
// rule that only exists where it cannot be relied on.
//
// PHOTOS. File storage build. students.photo_path names an object in the private
// student-photos bucket; the list shows it through signed URLs fetched in one
// request per load. Upload is offered only when editing an existing student,
// because the object path contains the student's id, and it is saved at once
// rather than with the form: once the file is in Storage, leaving the form
// unsaved would orphan it.
// ---------------------------------------------------------------------------

const emptyForm = {
  name: '',
  admissionNo: '',
  classId: '',
  // Database values, lower-case: students_gender_check allows exactly
  // 'male', 'female' and 'other'. The prototype's 'Male'/'Female' were
  // rejected by that constraint, which is what "Student not added" hid.
  gender: 'male',
  dateOfBirth: '',
  status: 'active',
  guardianId: '',
  guardianIsPrimary: false,
  // C2: '' until chosen; required whenever a guardian is linked.
  guardianRelationship: '' as GuardianRelationship | '',
  newGuardianName: '',
  newGuardianEmail: '',
  newGuardianPhone: '',
  // B1: invite the guardian as soon as they exist, without a second trip to
  // the Guardians page. Only meaningful when there is an address to send to.
  inviteGuardian: false,
}

type BulkStudentRow = {
  name: string
  admissionNo: string
  className: string
  gender: string
  dateOfBirth: string
  guardian: string
  relationship: string
  parentPhone: string
  studentPhone: string
  attendance: string
  averageGrade: string
  homeworkStatus: string
  accountStatus: string
  valid: boolean
  error?: string
}

const MOCK_IMPORT_KEY = 'nomcloud_mock_imported_students'

function importedStudentsForSchool(schoolId: string): DirectoryStudent[] {
  try {
    return JSON.parse(localStorage.getItem(`${MOCK_IMPORT_KEY}:${schoolId}`) ?? '[]') as DirectoryStudent[]
  } catch {
    return []
  }
}

function normalizeHeader(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function cell(row: Record<string, unknown>, aliases: string[]) {
  const key = Object.keys(row).find((candidate) => aliases.includes(normalizeHeader(candidate)))
  return key ? String(row[key] ?? '').trim() : ''
}

function semanticCell(row: Record<string, unknown>, aliases: string[], matcher: (header: string) => boolean) {
  const exact = cell(row, aliases)
  if (exact) return exact
  const key = Object.keys(row).find((candidate) => matcher(normalizeHeader(candidate)))
  return key ? String(row[key] ?? '').trim() : ''
}

/** "Amina Yusuf (Mother)", or just the name when no relationship is recorded. */
function guardianLabel(g: DirectoryStudent['guardians'][number]): string {
  return g.relationship ? `${g.name} (${g.relationship})` : g.name
}

export default function AdminStudents() {
  const { school } = useAuth()
  const { showToast } = useToast()
  const { classes } = useRecordableClasses()
  const { state: academicState } = useAcademicStructure()

  const schoolId = school?.id ?? null
  const timeZone = school?.timezone ?? DEFAULT_TIME_ZONE
  const activeYearId = academicState.status === 'ready' ? (academicState.data.activeYear?.id ?? '') : ''

  const [students, setStudents] = useState<DirectoryStudent[]>([])
  const [guardians, setGuardians] = useState<GuardianRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)

  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DirectoryStudent | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [guardianMode, setGuardianMode] = useState<'existing' | 'new' | 'none'>('none')
  const [deleteTarget, setDeleteTarget] = useState<DirectoryStudent | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map())
  const [photoBusy, setPhotoBusy] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)
  const bulkInput = useRef<HTMLInputElement>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkRows, setBulkRows] = useState<BulkStudentRow[]>([])
  const [bulkError, setBulkError] = useState('')
  const [bulkSearch, setBulkSearch] = useState('')
  const [bulkClassFilter, setBulkClassFilter] = useState('all')
  const [bulkPage, setBulkPage] = useState(1)
  const [bulkImporting, setBulkImporting] = useState(false)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    if (!schoolId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    Promise.all([fetchStudentDirectory(schoolId), fetchSchoolGuardians(schoolId)])
      .then(([rows, gs]) => {
        if (cancelled) return
        setStudents([...rows, ...(schoolId ? importedStudentsForSchool(schoolId) : [])])
        setGuardians(gs)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toError(err))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [schoolId, nonce])

  useEffect(() => {
    let cancelled = false
    const paths = students.map((s) => s.photoPath).filter((p): p is string => p !== null)
    createSignedImageUrls(BUCKETS.studentPhotos, paths).then((urls) => {
      if (!cancelled) setPhotoUrls(urls)
    })
    return () => {
      cancelled = true
    }
  }, [students])

  const applyPhotoPath = (studentId: string, photoPath: string | null) => {
    setStudents((rows) => rows.map((r) => (r.id === studentId ? { ...r, photoPath } : r)))
    setEditing((current) => (current && current.id === studentId ? { ...current, photoPath } : current))
  }

  const handlePhotoChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !editing || !schoolId) return
    setPhotoBusy(true)
    try {
      const image = await prepareImage(file, 'studentPhoto')
      const path = await replaceStudentPhoto(schoolId, editing.id, editing.photoPath, image)
      applyPhotoPath(editing.id, path)
      showToast({ type: 'success', title: 'Photo updated' })
    } catch (err: unknown) {
      showToast({ type: 'error', title: 'Photo not uploaded', description: errorMessage(err) })
    } finally {
      setPhotoBusy(false)
    }
  }

  const handlePhotoRemoved = async () => {
    if (!editing || !schoolId) return
    setPhotoBusy(true)
    try {
      await removeStudentPhoto(schoolId, editing.id, editing.photoPath)
      applyPhotoPath(editing.id, null)
      showToast({ type: 'success', title: 'Photo removed' })
    } catch (err: unknown) {
      showToast({ type: 'error', title: 'Photo not removed', description: errorMessage(err) })
    } finally {
      setPhotoBusy(false)
    }
  }

  const state = deriveResourceState<DirectoryStudent[]>({
    isLoading,
    canAccess: schoolId !== null,
    error,
    data: students,
    retry: reload,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return students.filter((s) => {
      const matchesSearch =
        q === '' || s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q)
      const matchesClass = classFilter === 'all' || s.classId === classFilter
      return matchesSearch && matchesClass
    })
  }, [students, search, classFilter])

  const filteredBulkRows = useMemo(() => {
    const query = bulkSearch.trim().toLowerCase()
    return bulkRows.filter((row) => {
      const matchesSearch = !query || `${row.name} ${row.admissionNo} ${row.className}`.toLowerCase().includes(query)
      const matchesClass = bulkClassFilter === 'all' || row.className.toLowerCase() === bulkClassFilter.toLowerCase()
      return matchesSearch && matchesClass
    })
  }, [bulkRows, bulkSearch, bulkClassFilter])
  const bulkPageSize = 25
  const bulkPageCount = Math.max(1, Math.ceil(filteredBulkRows.length / bulkPageSize))
  const visibleBulkRows = filteredBulkRows.slice((bulkPage - 1) * bulkPageSize, bulkPage * bulkPageSize)

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm, classId: classes[0]?.id ?? '', guardianIsPrimary: true })
    setGuardianMode('none')
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (student: DirectoryStudent) => {
    setEditing(student)
    setForm({
      name: student.name,
      admissionNo: student.admissionNo,
      classId: student.classId ?? '',
      gender: student.gender ?? 'male',
      dateOfBirth: student.dateOfBirth ?? '',
      status: student.status,
      guardianId: '',
      // Primary is offered, not assumed: ticked only when the student has none,
      // and when it is ticked the swap is explicit (SYSTEM_ISSUES_LIST S2).
      guardianIsPrimary: !student.guardians.some((g) => g.isPrimary),
      guardianRelationship: '',
      newGuardianName: '',
      newGuardianEmail: '',
      newGuardianPhone: '',
      inviteGuardian: false,
    })
    setGuardianMode('none')
    setErrors({})
    setModalOpen(true)
  }

  const currentPrimaryName = editing?.guardians.find((g) => g.isPrimary)?.name ?? null

  const validate = () => {
    const next: FieldErrors = {}
    if (!minLength(form.name, 2)) next.name = "Enter the student's full name."
    if (!minLength(form.admissionNo, 2)) next.admissionNo = 'Enter an admission number.'
    // students_date_of_birth_check requires a date before today. ISO dates
    // compare correctly as strings.
    if (form.dateOfBirth && form.dateOfBirth >= todayInTimeZone(timeZone)) {
      next.dateOfBirth = 'Date of birth must be before today.'
    }
    if (form.classId && !activeYearId) {
      next.classId = 'Set an active academic year before enrolling a student in a class.'
    }
    if (guardianMode === 'existing' && !form.guardianId) next.guardianId = 'Select a guardian.'
    if (guardianMode !== 'none' && !form.guardianRelationship) {
      next.guardianRelationship = "Choose the guardian's relationship to the student."
    }
    if (guardianMode === 'new') {
      if (!minLength(form.newGuardianName, 2)) next.newGuardianName = "Enter the guardian's name."
      if (!minLength(form.newGuardianPhone, 6)) next.newGuardianPhone = 'Enter a phone number.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate() || !schoolId) return
    setIsSaving(true)

    const input = {
      fullName: form.name,
      admissionNo: form.admissionNo,
      gender: (form.gender || null) as StudentGender | null,
      dateOfBirth: form.dateOfBirth || null,
      status: form.status,
    }

    try {
      let studentId = editing?.id ?? ''
      if (editing) {
        await updateStudent(schoolId, editing.id, input)
        // A class change is an enrolment change, not a column edit.
        if (form.classId !== (editing.classId ?? '')) {
          await endEnrolment(schoolId, editing.id, todayInTimeZone(timeZone))
          if (form.classId && activeYearId) {
            await enrolStudent(schoolId, editing.id, form.classId, activeYearId)
          }
        }
      } else {
        studentId = await createStudent(schoolId, input)
        if (form.classId && activeYearId) {
          await enrolStudent(schoolId, studentId, form.classId, activeYearId)
        }
      }

      // Both paths now report what actually happened. Nothing is swallowed: a
      // refusal throws and lands in the catch below (SYSTEM_ISSUES_LIST S2).
      let guardianNote: string | undefined
      // Which guardian the invitation, if asked for, should go to.
      let guardianId: string | null = null
      let guardianEmail: string | null = null
      if (guardianMode === 'existing' && form.guardianId) {
        const relationship = form.guardianRelationship || null
        const outcome = await linkGuardianToStudent(
          schoolId,
          studentId,
          form.guardianId,
          form.guardianIsPrimary,
          relationship,
        )
        const chosen = guardians.find((g) => g.id === form.guardianId)
        guardianId = form.guardianId
        guardianEmail = chosen?.email ?? null
        const name = chosen?.full_name ?? 'The guardian'
        guardianNote =
          outcome === 'already_linked'
            ? `${name} was already linked to this student.`
            : outcome === 'relationship_updated'
              ? `${name}'s relationship is now ${relationship}.`
              : outcome === 'linked'
                ? `${name} was linked as ${relationship}.`
                : `${name} is now the primary contact.`
      } else if (guardianMode === 'new') {
        guardianId = await createAndLinkGuardian(
          schoolId,
          studentId,
          {
            fullName: form.newGuardianName,
            email: form.newGuardianEmail || null,
            phone: form.newGuardianPhone,
          },
          form.guardianIsPrimary,
          form.guardianRelationship || null,
        )
        guardianEmail = form.newGuardianEmail || null
        guardianNote = form.guardianIsPrimary
          ? `${form.newGuardianName} was added as the primary contact.`
          : `${form.newGuardianName} was added as a guardian.`
      }

      // The invitation goes through send-invitation, exactly as the Guardians
      // page does — no second sending path. The student is already saved, so a
      // refused invitation is reported on its own and never undoes the save.
      let inviteNote: string | undefined
      if (form.inviteGuardian && guardianId && schoolId) {
        try {
          const outcome = await sendInvitation({ schoolId, role: 'guardian', personId: guardianId })
          inviteNote =
            outcome.status === 'sent'
              ? `Invitation sent to ${outcome.email ?? guardianEmail ?? 'their email'}.`
              : `Not invited: ${outcome.message ?? 'the invitation could not be sent.'}`
        } catch (inviteError: unknown) {
          inviteNote = `Not invited: ${errorMessage(inviteError)}`
        }
      }

      showToast({
        type: 'success',
        title: editing ? 'Student updated' : 'Student added',
        description: [guardianNote, inviteNote].filter(Boolean).join(' ') || undefined,
      })
      setModalOpen(false)
      reload()
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: editing ? 'Student not updated' : 'Student not added',
        description: errorMessage(err),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || !schoolId) return
    try {
      await deleteStudent(schoolId, deleteTarget.id)
      showToast({ type: 'success', title: 'Student removed' })
      reload()
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Student not removed',
        description: errorMessage(err),
      })
    } finally {
      setDeleteTarget(null)
    }

  }

  const processBulkFile = async (file: File) => {
    if (!file) return
    setBulkError('')
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      if (sourceRows.length === 0) {
        setBulkError('Add a header row and at least one student.')
        setBulkRows([])
        return
      }

      const seen = new Set<string>()
      const existingIds = new Set(students.map((student) => student.admissionNo.toLowerCase()))
      const rows = sourceRows.map((source) => {
        const name = cell(source, ['name', 'fullname', 'studentname'])
        const admissionNo = cell(source, ['studentid', 'admissionnumber', 'admissionno', 'admissionid', 'id'])
        const className = cell(source, ['class', 'classname', 'section', 'classsection'])
        const guardian = semanticCell(
          source,
          ['parent', 'parentguardian', 'guardian', 'parentname', 'guardianname', 'parentguardianname', 'parentsguardians'],
          (header) => (header.includes('parent') || header.includes('guardian')) && !header.includes('phone') && !header.includes('mobile') && !header.includes('email'),
        )
        const parentPhone = semanticCell(
          source,
          ['phone', 'phonenumber', 'parentphone', 'parentphonenumber', 'guardianphone', 'guardianphonenumber', 'parentguardianphone'],
          (header) => (header.includes('phone') || header.includes('mobile') || header.includes('contact')) && (header.includes('parent') || header.includes('guardian')),
        )
        const duplicate = Boolean(admissionNo) && (seen.has(admissionNo.toLowerCase()) || existingIds.has(admissionNo.toLowerCase()))
        if (admissionNo) seen.add(admissionNo.toLowerCase())
        const errors = [
          !name ? 'Missing student name' : '',
          !guardian ? 'Missing parent/guardian' : '',
          !parentPhone ? 'Missing parent phone number' : '',
          duplicate ? 'Duplicate student ID' : '',
        ].filter(Boolean)
        return {
          name,
          admissionNo,
          className,
          gender: cell(source, ['gender', 'sex']),
          dateOfBirth: cell(source, ['dateofbirth', 'dob', 'birthdate']),
          guardian,
          relationship: cell(source, ['relationship', 'guardianrelationship']),
          parentPhone,
          studentPhone: cell(source, ['studentphone', 'mobile']),
          attendance: cell(source, ['attendance', 'attendancerate']),
          averageGrade: cell(source, ['averagegrade', 'average', 'grade']),
          homeworkStatus: cell(source, ['homeworkstatus', 'homework']),
          accountStatus: cell(source, ['accountstatus', 'status']) || 'Active',
          valid: errors.length === 0,
          error: errors.join(', '),
        }
      })
      setBulkRows(rows)
      setBulkPage(1)
      setBulkSearch('')
      setBulkClassFilter('all')
    } catch {
      setBulkError(`Could not read ${file.name}. Please choose a valid XLSX, XLS, or CSV file.`)
      setBulkRows([])
    }
  }

  const handleBulkFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) await processBulkFile(file)
  }

  const importBulkRows = async () => {
    if (!schoolId) return
    const validRows = bulkRows.filter((row) => row.valid)
    setBulkImporting(true)
    await new Promise((resolve) => window.setTimeout(resolve, 700))
    const imported = validRows.map((row, index): DirectoryStudent => {
      const classMatch = classes.find((item) => item.name.toLowerCase() === row.className.toLowerCase() || item.id.toLowerCase() === row.className.toLowerCase())
      return {
        id: `mock-import-${Date.now()}-${index}`,
        name: row.name,
        admissionNo: row.admissionNo || `IMPORT-${Date.now()}-${index + 1}`,
        gender: row.gender.toLowerCase() || null,
        dateOfBirth: row.dateOfBirth || null,
        status: row.accountStatus.toLowerCase() || 'active',
        enrolledDate: new Date().toISOString().slice(0, 10),
        avatarColor: '#FF5A1F',
        photoPath: null,
        classId: classMatch?.id ?? null,
        className: classMatch?.name ?? row.className,
        guardians: row.guardian ? [{ id: `mock-guardian-${Date.now()}-${index}`, name: row.guardian, isPrimary: true, relationship: row.relationship || null }] : [],
      }
    })
    const existingImported = importedStudentsForSchool(schoolId)
    const importedByKey = new Map(existingImported.map((student) => [student.admissionNo.toLowerCase() || student.name.toLowerCase(), student]))
    imported.forEach((student) => importedByKey.set(student.admissionNo.toLowerCase() || student.name.toLowerCase(), student))
    const stored = Array.from(importedByKey.values())
    localStorage.setItem(`${MOCK_IMPORT_KEY}:${schoolId}`, JSON.stringify(stored))
    setStudents((current) => {
      const importedKeys = new Set(stored.map((student) => student.admissionNo.toLowerCase() || student.name.toLowerCase()))
      return [...current.filter((student) => !importedKeys.has(student.admissionNo.toLowerCase() || student.name.toLowerCase())), ...stored]
    })
    setBulkImporting(false)
    setBulkOpen(false)
    setBulkRows([])
    showToast({ type: 'success', title: `Successfully imported ${imported.length} students`, description: 'Imported students are now available in the Student Directory.' })
  }

  return (
    <div>
      <PageHeader
        title="Students"
        description="Every student enrolled at your school."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)} icon={<FileSpreadsheet className="h-4 w-4" />}>
              Bulk Import
            </Button>
            <Button onClick={openAdd} icon={<Plus className="h-4 w-4" />}>Add Student</Button>
          </div>
        }
      />

      <ResourceGate
        state={state}
        empty={{ icon: Users, title: 'No students yet', description: 'Add your first student to get started.' }}
        deniedHint="Student records are available to school staff."
      >
        {() => (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput value={search} onChange={setSearch} placeholder="Search by name or admission number…" className="sm:w-80" />
              <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="sm:w-52">
                <option value="all">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            {filtered.length === 0 ? (
              <EmptyState icon={Users} title="No students found" description="Try adjusting your search or filters." />
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-ink/5 text-left text-xs text-graphite dark:border-white/10">
                      <th className="px-5 py-3.5 font-medium">Student</th>
                      <th className="px-5 py-3.5 font-medium">Admission No.</th>
                      <th className="px-5 py-3.5 font-medium">Class</th>
                      <th className="px-5 py-3.5 font-medium">Guardians</th>
                      <th className="px-5 py-3.5 font-medium">Status</th>
                      <th className="px-5 py-3.5 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.id} className="border-b border-ink/5 last:border-b-0 dark:border-white/5">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={s.name}
                              color={s.avatarColor}
                              size="sm"
                              src={s.photoPath ? photoUrls.get(s.photoPath) : null}
                            />
                            <p className="font-medium text-ink dark:text-white">{s.name}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-graphite">{s.admissionNo}</td>
                        <td className="px-5 py-3.5 text-graphite">{s.className ?? '—'}</td>
                        <td className="px-5 py-3.5 text-graphite">
                          {s.guardians.length === 0 ? '—' : s.guardians.map(guardianLabel).join(', ')}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={s.status === 'active' ? 'success' : 'neutral'}>{s.status}</Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(s)}
                              aria-label={`Edit ${s.name}`}
                              className="rounded-lg p-2 text-graphite hover:bg-ink/5 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(s)}
                              aria-label={`Remove ${s.name}`}
                              className="rounded-lg p-2 text-graphite hover:bg-red-500/10 hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </ResourceGate>

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk import students"
        description="1 Upload → 2 Review → 3 Import. Everything is processed in your browser."
        size="xl"
        footer={
          bulkImporting ? <RequestProcessing compact title="Importing students…" description="Adding valid rows to the local Student Directory…" /> :
          <>
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>Close</Button>
            <Button disabled={bulkRows.length === 0 || bulkRows.every((row) => !row.valid) || bulkImporting} onClick={importBulkRows}>
              Import {bulkRows.filter((row) => row.valid).length} valid students
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-graphite"><span className="rounded-full bg-brand px-2 py-1 text-white">1 Upload</span><span>→</span><span className={bulkRows.length ? 'rounded-full bg-brand px-2 py-1 text-white' : ''}>2 Review</span><span>→</span><span className={bulkRows.length && !bulkRows.some((row) => !row.valid) ? 'rounded-full bg-brand px-2 py-1 text-white' : ''}>3 Import</span></div>
          <input ref={bulkInput} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleBulkFile} />
          <button
            type="button"
            onClick={() => bulkInput.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const file = event.dataTransfer.files[0]
              if (file) void processBulkFile(file)
            }}
            className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink/10 px-6 py-10 text-center hover:border-accent dark:border-white/10"
          >
            <Upload className="h-7 w-7 text-accent" />
            <span className="mt-3 text-sm font-semibold text-ink dark:text-white">Upload Student File</span>
            <span className="mt-1 text-xs text-graphite">Drop a file here or choose Excel File</span>
            <span className="mt-2 text-[11px] text-graphite">Supported formats: XLSX, XLS, CSV</span>
          </button>
          {bulkError && <p className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-xs text-red-500"><AlertTriangle className="h-4 w-4" />{bulkError}</p>}
          {bulkRows.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div><p className="text-sm font-semibold text-ink dark:text-white">{bulkRows.length} students detected</p><p className="text-xs text-graphite">{bulkRows.filter((row) => row.valid).length} valid · {bulkRows.filter((row) => !row.valid).length} errors</p></div>
                <div className="flex gap-2"><input className="input h-9 w-40 text-xs" value={bulkSearch} onChange={(event) => { setBulkSearch(event.target.value); setBulkPage(1) }} placeholder="Search preview" /><select className="input h-9 w-36 text-xs" value={bulkClassFilter} onChange={(event) => { setBulkClassFilter(event.target.value); setBulkPage(1) }}><option value="all">All classes</option>{Array.from(new Set(bulkRows.map((row) => row.className).filter(Boolean))).map((name) => <option key={name} value={name}>{name}</option>)}</select></div>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-ink/5 dark:border-white/10">
                <table className="w-full min-w-[1100px] text-left text-xs"><thead className="sticky top-0 bg-mist/95 text-graphite"><tr>{['Student ID', 'Student Name', 'Class', 'Gender', 'Date of Birth', 'Parent/Guardian', 'Relationship', 'Parent Phone', 'Student Phone', 'Attendance', 'Average Grade', 'Homework', 'Status', 'Validation'].map((heading) => <th key={heading} className="px-3 py-2 font-semibold">{heading}</th>)}</tr></thead><tbody>{visibleBulkRows.map((row, index) => <tr key={`${row.admissionNo}-${index}`} className="border-t border-ink/5 align-top"><td className="px-3 py-2">{row.admissionNo || '—'}</td><td className="px-3 py-2 font-medium">{row.name || '—'}</td><td className="px-3 py-2">{row.className || '—'}</td><td className="px-3 py-2">{row.gender || '—'}</td><td className="px-3 py-2">{row.dateOfBirth || '—'}</td><td className="px-3 py-2">{row.guardian || '—'}</td><td className="px-3 py-2">{row.relationship || '—'}</td><td className="px-3 py-2">{row.parentPhone || '—'}</td><td className="px-3 py-2">{row.studentPhone || '—'}</td><td className="px-3 py-2">{row.attendance || '—'}</td><td className="px-3 py-2">{row.averageGrade || '—'}</td><td className="px-3 py-2">{row.homeworkStatus || '—'}</td><td className="px-3 py-2">{row.accountStatus}</td><td className={`px-3 py-2 font-semibold ${row.valid ? 'text-emerald-600' : 'text-red-500'}`}>{row.valid ? 'Valid' : row.error}</td></tr>)}</tbody></table>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-graphite"><span>{filteredBulkRows.length ? `${(bulkPage - 1) * bulkPageSize + 1}–${Math.min(bulkPage * bulkPageSize, filteredBulkRows.length)} of ${filteredBulkRows.length}` : '0 students'}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={bulkPage === 1} onClick={() => setBulkPage((page) => page - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={bulkPage >= bulkPageCount} onClick={() => setBulkPage((page) => page + 1)}>Next</Button></div></div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Student' : 'Add Student'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? 'Saving…' : editing ? 'Save Changes' : 'Add Student'}
            </Button>
          </>
        }
      >
        {isSaving ? <RequestProcessing title={editing ? 'Updating student' : 'Creating student'} description="Your student details are being saved securely." /> : <div className="space-y-4">
          {editing && (
            <div className="flex flex-wrap items-center gap-3">
              <Avatar
                name={editing.name}
                color={editing.avatarColor}
                size="lg"
                src={editing.photoPath ? photoUrls.get(editing.photoPath) : null}
              />
              <input
                ref={photoInput}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                aria-label="Choose student photo"
                onChange={handlePhotoChosen}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={photoBusy}
                onClick={() => photoInput.current?.click()}
                icon={<Upload className="h-4 w-4" />}
              >
                {photoBusy ? 'Working…' : editing.photoPath ? 'Replace photo' : 'Upload photo'}
              </Button>
              {editing.photoPath && (
                <Button variant="ghost" size="sm" disabled={photoBusy} onClick={handlePhotoRemoved}>
                  Remove photo
                </Button>
              )}
              <p className="w-full text-xs text-graphite">PNG, JPEG or WebP, up to 2 MB. Saved immediately.</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
            <Input
              label="Admission number"
              required
              value={form.admissionNo}
              onChange={(e) => setForm({ ...form, admissionNo: e.target.value })}
              error={errors.admissionNo}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Class" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} error={errors.classId}>
              <option value="">Not enrolled</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select id="student-status" label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STUDENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
              {/* A saved value the list does not know is still shown as itself,
                  never as the first option (C1). */}
              {!STUDENT_STATUSES.some((s) => s.value === form.status) && (
                <option value={form.status}>{form.status}</option>
              )}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
            <Input
              label="Date of birth"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              error={errors.dateOfBirth}
            />
          </div>

          <div>
            <p className="label mb-2">Link a guardian</p>
            <div className="mb-3 inline-flex rounded-full bg-ink/5 p-1 dark:bg-white/10">
              {(['none', 'existing', 'new'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGuardianMode(mode)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
                    guardianMode === mode ? 'bg-white shadow-soft dark:bg-white/10' : 'text-graphite'
                  }`}
                >
                  {mode === 'none' ? 'Skip' : mode === 'existing' ? 'Existing' : 'New'}
                </button>
              ))}
            </div>
            {guardianMode === 'existing' && (
              <Select
                aria-label="Guardian"
                value={form.guardianId}
                onChange={(e) => {
                  const guardianId = e.target.value
                  // Re-linking someone already linked starts from their saved relationship.
                  const saved = editing?.guardians.find((g) => g.id === guardianId)?.relationship
                  const known = GUARDIAN_RELATIONSHIPS.find((r) => r === saved)
                  setForm({ ...form, guardianId, guardianRelationship: known ?? form.guardianRelationship })
                }}
                error={errors.guardianId}
              >
                <option value="">Select a guardian…</option>
                {guardians.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.full_name} · {g.phone}
                  </option>
                ))}
              </Select>
            )}
            {guardianMode === 'new' && (
              <div className="space-y-3">
                <Input
                  placeholder="Guardian full name"
                  value={form.newGuardianName}
                  onChange={(e) => setForm({ ...form, newGuardianName: e.target.value })}
                  error={errors.newGuardianName}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Guardian email (optional)"
                    type="email"
                    value={form.newGuardianEmail}
                    onChange={(e) => setForm({ ...form, newGuardianEmail: e.target.value })}
                  />
                  <Input
                    placeholder="Guardian phone"
                    value={form.newGuardianPhone}
                    onChange={(e) => setForm({ ...form, newGuardianPhone: e.target.value })}
                    error={errors.newGuardianPhone}
                  />
                </div>
              </div>
            )}
            {guardianMode !== 'none' && (() => {
              // Enabled only when there is somewhere to send it: the address
              // being typed for a new guardian, or the saved one for an
              // existing guardian.
              const targetEmail =
                guardianMode === 'new'
                  ? form.newGuardianEmail.trim()
                  : (guardians.find((g) => g.id === form.guardianId)?.email ?? '')
              const canInvite = isValidEmail(targetEmail)
              return (
                <label
                  className={`mt-3 flex items-start gap-2.5 rounded-xl px-3 py-2.5 ${canInvite ? 'bg-brand/5' : 'bg-ink/5 dark:bg-white/5'}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-ink/20 accent-brand"
                    checked={form.inviteGuardian && canInvite}
                    disabled={!canInvite}
                    onChange={(e) => setForm({ ...form, inviteGuardian: e.target.checked })}
                  />
                  <span className="text-sm">
                    <span className={canInvite ? 'text-ink dark:text-white' : 'text-graphite'}>
                      Invite this guardian to Nom Cloud
                    </span>
                    <span className="block text-xs text-graphite">
                      {canInvite
                        ? `They will be emailed a single-use link at ${targetEmail} to choose their own password.`
                        : 'Add an email address for this guardian to invite them.'}
                    </span>
                  </span>
                </label>
              )
            })()}
            {guardianMode !== 'none' && (
              <div className="mt-3">
                <Select
                  id="guardian-relationship"
                  label="Relationship to student"
                  required
                  value={form.guardianRelationship}
                  onChange={(e) => setForm({ ...form, guardianRelationship: e.target.value as GuardianRelationship | '' })}
                  error={errors.guardianRelationship}
                >
                  <option value="">Select a relationship…</option>
                  {GUARDIAN_RELATIONSHIPS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {guardianMode !== 'none' && (
              <div className="mt-3">
                <label className="flex items-start gap-2.5 text-sm text-ink dark:text-white">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-ink/20 text-brand focus:ring-brand"
                    checked={form.guardianIsPrimary}
                    onChange={(e) => setForm({ ...form, guardianIsPrimary: e.target.checked })}
                  />
                  <span>
                    Primary contact
                    <span className="block text-xs text-graphite">
                      {currentPrimaryName
                        ? form.guardianIsPrimary
                          ? `${currentPrimaryName} will stop being the primary contact.`
                          : `${currentPrimaryName} stays the primary contact.`
                        : 'A student has one primary contact, reached first.'}
                    </span>
                  </span>
                </label>
              </div>
            )}
            {editing && editing.guardians.length > 0 && (
              <p className="mt-2 text-xs text-graphite">
                Already linked:{' '}
                {editing.guardians.map((g) => `${guardianLabel(g)}${g.isPrimary ? ' (primary)' : ''}`).join(', ')}
              </p>
            )}
            <p className="mt-2 text-xs text-graphite">
              Creating a guardian does not give them an account. Invite them separately so they can sign in.
            </p>
          </div>
        </div>}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Remove ${deleteTarget?.name}?`}
        description="A student with fee payments on record cannot be removed: payment history must be kept for the school's financial records, so set their status to Inactive or Transferred instead. For any other student, this permanently deletes their record together with their attendance, grades, homework submissions, class enrolments, guardian links and unpaid fee records. This cannot be undone."
        confirmLabel="Remove Student"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
