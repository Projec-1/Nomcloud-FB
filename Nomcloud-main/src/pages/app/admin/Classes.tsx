import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, Plus, Pencil, Trash2, Users, MapPin } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import PageHeader from '@/components/ui/PageHeader'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Input from '@/components/ui/Input'
import EmptyState from '@/components/ui/EmptyState'
import ResourceGate from '@/components/ui/ResourceGate'
import RequestProcessing from '@/components/ui/RequestProcessing'
import { useRecordableClasses } from '@/hooks/useRecordableClasses'
import { useAcademicStructure } from '@/hooks/useAcademicStructure'
import {
  createClass,
  deleteClass,
  updateClass,
} from '@/services/classService'
import { fetchSchoolTeachers, type ClassSummary, type TeacherRow } from '@/services/teacherService'
import { minLength, type FieldErrors } from '@/utils/validators'
import { errorMessage } from '@/utils/errorMessage'

// ---------------------------------------------------------------------------
// Phase 8 batch 8. Real classes and real timetable slots.
//
// TIMETABLE EDITING LIVES HERE AND NOWHERE ELSE. timetable_slots gates INSERT,
// UPDATE and DELETE on can_manage_class, which is management. The teacher screen
// lost its editing controls in this batch for exactly that reason, and this is
// where the capability actually exists.
//
// CAMPUS IS NOT SENT. classes writes gate on
// has_campus_scoped_management(school_id, campus_id), which is the one place
// campus genuinely bites. Locked decision 2 keeps the frontend campus-unaware,
// so a class created here has campus_id NULL, which RLS batch 3 settled is
// visible and manageable by every principal. Assigning a class to a campus
// arrives with campus awareness, not before it.
// ---------------------------------------------------------------------------

const emptyForm = {
  name: '',
  grade: '',
  section: '',
  room: '',
  capacity: '',
  classTeacherId: '',
}

export default function AdminClasses() {
  const { school } = useAuth()
  const { showToast } = useToast()
  // K6: the current year by default; any other year, or all of them, on request.
  const [yearScope, setYearScope] = useState<string>('active')
  const { state, classes, schoolId, reload } = useRecordableClasses(yearScope)
  const { state: academicState } = useAcademicStructure()

  const activeYearId = academicState.status === 'ready' ? (academicState.data.activeYear?.id ?? '') : ''
  const years = academicState.status === 'ready' ? academicState.data.years : []

  const [teachers, setTeachers] = useState<TeacherRow[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ClassSummary | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [deleteTarget, setDeleteTarget] = useState<ClassSummary | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!schoolId) return
    fetchSchoolTeachers(schoolId)
      .then((ts) => {
        if (cancelled) return
        setTeachers(ts)
      })
      .catch(() => {
        // Pickers degrade to empty; the class list still renders.
      })
    return () => {
      cancelled = true
    }
  }, [schoolId])

  const teacherNames = useMemo(() => new Map(teachers.map((t) => [t.id, t.full_name])), [teachers])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (c: ClassSummary) => {
    setEditing(c)
    setForm({
      name: c.name,
      grade: c.grade,
      section: c.section ?? '',
      room: c.room ?? '',
      capacity: c.capacity === null ? '' : String(c.capacity),
      classTeacherId: c.teacherId ?? '',
    })
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const next: FieldErrors = {}
    if (!minLength(form.grade, 1)) next.grade = 'Enter a grade.'
    // Only a NEW class needs the active year; an edit keeps the class's own year.
    if (!editing && !activeYearId) next.name = 'Set an active academic year before creating classes.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate() || !schoolId) return
    setIsSaving(true)
    const input = {
      name: editing?.name ?? `Grade ${form.grade.trim()}`,
      grade: form.grade,
      section: editing?.section ?? null,
      room: editing?.room ?? null,
      capacity: editing?.capacity ?? null,
      academicYearId: activeYearId,
      classTeacherId: form.classTeacherId || null,
    }
    try {
      if (editing) {
        await updateClass(schoolId, editing.id, input)
        showToast({ type: 'success', title: 'Class updated' })
      } else {
        await createClass(schoolId, input)
        showToast({ type: 'success', title: 'Class created' })
      }
      setModalOpen(false)
      reload()
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: editing ? 'Class not updated' : 'Class not created',
        description: errorMessage(err),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || !schoolId) return
    try {
      await deleteClass(schoolId, deleteTarget.id)
      showToast({ type: 'success', title: 'Class removed' })
      reload()
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Class not removed',
        description: errorMessage(err),
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Classes"
        description="Class groups and their homeroom teachers."
        actions={
          <Button onClick={openAdd} icon={<Plus className="h-4 w-4" />}>
            Add Class
          </Button>
        }
      />

      {years.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Select
            aria-label="Academic year"
            value={yearScope}
            onChange={(e) => setYearScope(e.target.value)}
            className="sm:w-64"
          >
            <option value="active">Current year{activeYearId ? '' : ' (none set)'}</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label} · {y.status}
              </option>
            ))}
            <option value="all">All years</option>
          </Select>
          <p className="text-xs text-graphite">
            {yearScope === 'active'
              ? 'Showing the current academic year. Earlier years stay available here.'
              : yearScope === 'all'
                ? 'Showing every academic year, including closed ones.'
                : 'Showing a single academic year. New classes are always created in the current year.'}
          </p>
        </div>
      )}

      <ResourceGate
        state={state}
        empty={{
          icon: BookOpen,
          title: yearScope === 'active' ? 'No classes in the current year yet' : 'No classes in this view',
          description:
            yearScope === 'active'
              ? 'Create your first class for this year to get started.'
              : 'Choose another year above, or return to the current year.',
        }}
        deniedHint="Class records are available to school staff."
      >
        {(rows) => (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((c) => (
                <div key={c.id} className="card p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink dark:text-white">{c.name}</p>
                      <p className="text-xs text-graphite">
                        Grade {c.grade}
                        {c.section ? ` · Section ${c.section}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        aria-label={`Edit ${c.name}`}
                        className="rounded-lg p-2 text-graphite hover:bg-ink/5 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(c)}
                        aria-label={`Remove ${c.name}`}
                        className="rounded-lg p-2 text-graphite hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 text-xs text-graphite">
                    <p className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" /> {c.studentIds.length}
                      {c.capacity ? ` / ${c.capacity}` : ''} students
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" /> {c.room ?? 'No room set'}
                    </p>
                    <p className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5" />
                      {c.teacherId ? (teacherNames.get(c.teacherId) ?? 'Homeroom set') : 'No homeroom teacher'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

          </>
        )}
      </ResourceGate>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Class' : 'Add Class'}
        footer={
          isSaving ? <RequestProcessing compact title={editing ? 'Updating class' : 'Creating class'} description="Saving your changes securely…" /> :
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? 'Saving…' : editing ? 'Save Changes' : 'Add Class'}
            </Button>
          </>
        }
      >
        {isSaving ? <RequestProcessing title={editing ? 'Updating class' : 'Creating class'} description="Your class details are being saved securely." /> : <div className="space-y-4">
          <Input
            label="Grade"
            required
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })}
            error={errors.grade}
            placeholder="e.g. 7 or Kindergarten"
          />
          <Select
            label="Foremaster / homeroom teacher"
            value={form.classTeacherId}
            onChange={(e) => setForm({ ...form, classTeacherId: e.target.value })}
          >
            <option value="">None</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </Select>
          {!editing && <p className="text-xs text-graphite">The class name will be generated from the selected grade.</p>}
          {!activeYearId && (
            <p className="text-xs text-red-500">
              No active academic year is set. A class belongs to an academic year, so one must exist first.
            </p>
          )}
        </div>}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Remove ${deleteTarget?.name}?`}
        description="Only a class with no attendance, grades, homework, exams or enrolled students (past or present) can be removed."
        confirmLabel="Remove Class"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
