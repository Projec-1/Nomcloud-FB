import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Users, Plus, Pencil, Trash as Trash2, Upload, FileXls as FileSpreadsheet } from '@phosphor-icons/react'
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
import ImportDialog from '@/components/import/ImportDialog'
import { studentsImport } from '@/services/import/kinds'
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
  const [bulkOpen, setBulkOpen] = useState(false)

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
        setStudents(rows)
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

      <ImportDialog kind={studentsImport} open={bulkOpen} onClose={() => setBulkOpen(false)} onImported={reload} />

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
