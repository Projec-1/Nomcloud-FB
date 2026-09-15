import { useCallback, useEffect, useMemo, useState } from 'react'
import { GraduationCap, Plus, Pencil, Trash2 } from 'lucide-react'
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
import { deriveResourceState } from '@/lib/resourceState'
import { useRecordableClasses } from '@/hooks/useRecordableClasses'
import {
  createTeacher,
  deleteTeacher,
  fetchSchoolTeachers,
  updateTeacher,
  type TeacherRow,
} from '@/services/teacherService'
import { fetchSubjects, type SubjectRow } from '@/services/academicService'
import { minLength, type FieldErrors } from '@/utils/validators'
import { formatDate } from '@/utils/format'

// ---------------------------------------------------------------------------
// Phase 8 batch 8. Real teachers.
//
// A TEACHERS ROW IS NOT AN ACCOUNT. Creating one here records a member of
// staff; it does not let them sign in. The link between a teachers row and a
// user is memberships.teacher_id, written by accept_invitation when they redeem
// an invitation. The form says so, because the prototype's silence on this is
// how an administrator ends up wondering why a new teacher cannot log in.
//
// "Classes taught" is derived here rather than stored. The prototype carried a
// classIds array on the teacher; the real relation runs the other way, through
// classes.class_teacher_id and class_subjects.teacher_id — the same OR that
// defines "assigned to teach" everywhere else in this codebase.
// ---------------------------------------------------------------------------

const emptyForm = {
  fullName: '',
  email: '',
  phone: '',
  staffNo: '',
  primarySubjectId: '',
  status: 'active',
}

export default function AdminTeachers() {
  const { school } = useAuth()
  const { showToast } = useToast()
  const { classes } = useRecordableClasses()

  const schoolId = school?.id ?? null

  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TeacherRow | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [deleteTarget, setDeleteTarget] = useState<TeacherRow | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    if (!schoolId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    Promise.all([fetchSchoolTeachers(schoolId), fetchSubjects(schoolId)])
      .then(([rows, subs]) => {
        if (cancelled) return
        setTeachers(rows)
        setSubjects(subs)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [schoolId, nonce])

  const state = deriveResourceState<TeacherRow[]>({
    isLoading,
    canAccess: schoolId !== null,
    error,
    data: teachers,
    retry: reload,
  })

  const subjectNames = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects])

  // The same OR that defines "assigned to teach" everywhere else: homeroom on
  // classes, or a subject link on class_subjects. Both arms are already carried
  // by the class summaries.
  const classesByTeacher = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const c of classes) {
      if (c.teacherId) map.set(c.teacherId, [...(map.get(c.teacherId) ?? []), c.name])
    }
    return map
  }, [classes])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return teachers.filter(
      (t) =>
        q === '' ||
        t.full_name.toLowerCase().includes(q) ||
        (t.staff_no ?? '').toLowerCase().includes(q) ||
        (t.email ?? '').toLowerCase().includes(q),
    )
  }, [teachers, search])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (t: TeacherRow) => {
    setEditing(t)
    setForm({
      fullName: t.full_name,
      email: t.email ?? '',
      phone: t.phone ?? '',
      staffNo: t.staff_no ?? '',
      primarySubjectId: t.primary_subject_id ?? '',
      status: t.status,
    })
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const next: FieldErrors = {}
    if (!minLength(form.fullName, 2)) next.fullName = "Enter the teacher's full name."
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate() || !schoolId) return
    setIsSaving(true)
    const input = {
      fullName: form.fullName,
      email: form.email || null,
      phone: form.phone || null,
      staffNo: form.staffNo || null,
      primarySubjectId: form.primarySubjectId || null,
      status: form.status,
    }
    try {
      if (editing) {
        await updateTeacher(schoolId, editing.id, input)
        showToast({ type: 'success', title: 'Teacher updated' })
      } else {
        await createTeacher(schoolId, input)
        showToast({
          type: 'success',
          title: 'Teacher added',
          description: 'Invite them separately so they can sign in.',
        })
      }
      setModalOpen(false)
      reload()
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: editing ? 'Teacher not updated' : 'Teacher not added',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || !schoolId) return
    try {
      await deleteTeacher(schoolId, deleteTarget.id)
      showToast({ type: 'success', title: 'Teacher removed' })
      reload()
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Teacher not removed',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Teachers"
        description="Teaching staff at your school."
        actions={
          <Button onClick={openAdd} icon={<Plus className="h-4 w-4" />}>
            Add Teacher
          </Button>
        }
      />

      <ResourceGate
        state={state}
        empty={{ icon: GraduationCap, title: 'No teachers yet', description: 'Add your first member of teaching staff.' }}
        deniedHint="Staff records are available to school management."
      >
        {() => (
          <>
            <div className="mb-5">
              <SearchInput value={search} onChange={setSearch} placeholder="Search by name, staff number or email…" className="sm:w-80" />
            </div>

            {filtered.length === 0 ? (
              <EmptyState icon={GraduationCap} title="No teachers found" description="Try a different search." />
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-ink/5 text-left text-xs text-graphite dark:border-white/10">
                      <th className="px-5 py-3.5 font-medium">Teacher</th>
                      <th className="px-5 py-3.5 font-medium">Staff No.</th>
                      <th className="px-5 py-3.5 font-medium">Primary Subject</th>
                      <th className="px-5 py-3.5 font-medium">Homeroom Of</th>
                      <th className="px-5 py-3.5 font-medium">Status</th>
                      <th className="px-5 py-3.5 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr key={t.id} className="border-b border-ink/5 last:border-b-0 dark:border-white/5">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={t.full_name} size="sm" />
                            <div>
                              <p className="font-medium text-ink dark:text-white">{t.full_name}</p>
                              <p className="text-xs text-graphite">{t.email ?? t.phone ?? '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-graphite">{t.staff_no ?? '—'}</td>
                        <td className="px-5 py-3.5 text-graphite">
                          {t.primary_subject_id ? (subjectNames.get(t.primary_subject_id) ?? '—') : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-graphite">
                          {(classesByTeacher.get(t.id) ?? []).join(', ') || '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={t.status === 'active' ? 'success' : 'neutral'}>{t.status}</Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(t)}
                              aria-label={`Edit ${t.full_name}`}
                              className="rounded-lg p-2 text-graphite hover:bg-ink/5 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(t)}
                              aria-label={`Remove ${t.full_name}`}
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
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Teacher' : 'Add Teacher'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? 'Saving…' : editing ? 'Save Changes' : 'Add Teacher'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Full name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} error={errors.fullName} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Staff number" value={form.staffNo} onChange={(e) => setForm({ ...form, staffNo: e.target.value })} />
            <Select
              label="Primary subject"
              value={form.primarySubjectId}
              onChange={(e) => setForm({ ...form, primarySubjectId: e.target.value })}
            >
              <option value="">None</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          {editing && <p className="text-xs text-graphite">Joined {formatDate(editing.joined_date)}</p>}
          <p className="text-xs text-graphite">
            This records a member of staff. It does not create a login. Send them an invitation so they can sign in and
            see their classes.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Remove ${deleteTarget?.full_name}?`}
        description="A teacher still assigned to a class cannot be removed until they are unassigned."
        confirmLabel="Remove Teacher"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
