import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, Plus, Pencil, Trash2, Users, MapPin, CalendarRange } from 'lucide-react'
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
import TimetableGrid, { PERIODS } from '@/components/dashboard/TimetableGrid'
import { useRecordableClasses } from '@/hooks/useRecordableClasses'
import { useAcademicStructure } from '@/hooks/useAcademicStructure'
import {
  createClass,
  createTimetableSlot,
  deleteClass,
  deleteTimetableSlot,
  updateClass,
} from '@/services/classService'
import { fetchSchoolTeachers, type ClassSummary, type TeacherRow, type TimetableSlotView } from '@/services/teacherService'
import { fetchSubjects, type SubjectRow } from '@/services/academicService'
import { supabase } from '@/lib/supabase'
import { minLength, type FieldErrors } from '@/utils/validators'
import type { IsoWeekday } from '@/types'
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
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [slots, setSlots] = useState<TimetableSlotView[]>([])
  const [slotNonce, setSlotNonce] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ClassSummary | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [deleteTarget, setDeleteTarget] = useState<ClassSummary | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [timetableClassId, setTimetableClassId] = useState('')
  const [slotDraft, setSlotDraft] = useState<{ day: IsoWeekday; period: number } | null>(null)
  const [slotSubjectId, setSlotSubjectId] = useState('')
  const [slotTeacherId, setSlotTeacherId] = useState('')
  const [slotRoom, setSlotRoom] = useState('')

  const activeClass = classes.find((c) => c.id === timetableClassId) ?? classes[0]

  useEffect(() => {
    let cancelled = false
    if (!schoolId) return
    Promise.all([fetchSchoolTeachers(schoolId), fetchSubjects(schoolId)])
      .then(([ts, ss]) => {
        if (cancelled) return
        setTeachers(ts)
        setSubjects(ss)
      })
      .catch(() => {
        // Pickers degrade to empty; the class list still renders.
      })
    return () => {
      cancelled = true
    }
  }, [schoolId])

  // Timetable slots for the selected class only, scoped explicitly.
  useEffect(() => {
    let cancelled = false
    if (!schoolId || !activeClass) {
      setSlots([])
      return
    }
    supabase
      .from('timetable_slots')
      .select('id, class_id, teacher_id, subject_id, day_of_week, period, start_time, end_time, room')
      .eq('school_id', schoolId)
      .eq('class_id', activeClass.id)
      .then(({ data, error }) => {
        if (cancelled || error) return
        const subjectNames = new Map(subjects.map((s) => [s.id, s.name]))
        setSlots(
          ((data ?? []) as {
            id: string
            class_id: string
            teacher_id: string | null
            subject_id: string | null
            day_of_week: number
            period: number
            start_time: string
            end_time: string
            room: string | null
          }[]).map((s) => ({
            id: s.id,
            classId: s.class_id,
            teacherId: s.teacher_id ?? '',
            day: s.day_of_week as TimetableSlotView['day'],
            period: s.period,
            startTime: s.start_time.slice(0, 5),
            endTime: s.end_time.slice(0, 5),
            subject: s.subject_id ? (subjectNames.get(s.subject_id) ?? '') : '',
            room: s.room ?? '',
          })),
        )
      })
    return () => {
      cancelled = true
    }
  }, [schoolId, activeClass, subjects, slotNonce])

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
    if (!minLength(form.name, 2)) next.name = 'Enter a class name.'
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
      name: form.name,
      grade: form.grade,
      section: form.section || null,
      room: form.room || null,
      capacity: form.capacity ? Number(form.capacity) : null,
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

  const openSlot = (day: IsoWeekday, period: number) => {
    setSlotDraft({ day, period })
    setSlotSubjectId(activeClass?.writableSubjects[0]?.id ?? '')
    setSlotTeacherId(activeClass?.teacherId ?? '')
    setSlotRoom(activeClass?.room ?? '')
  }

  const saveSlot = async () => {
    if (!schoolId || !activeClass || !slotDraft) return
    const periodInfo = PERIODS.find((p) => p.period === slotDraft.period)
    if (!periodInfo) return
    try {
      await createTimetableSlot(schoolId, {
        classId: activeClass.id,
        subjectId: slotSubjectId || null,
        teacherId: slotTeacherId || null,
        dayOfWeek: slotDraft.day,
        period: slotDraft.period,
        startTime: periodInfo.startTime,
        endTime: periodInfo.endTime,
        room: slotRoom || null,
      })
      showToast({ type: 'success', title: 'Timetable updated' })
      setSlotDraft(null)
      setSlotNonce((n) => n + 1)
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Slot not added',
        description: errorMessage(err),
      })
    }
  }

  const removeSlot = async (id: string) => {
    if (!schoolId) return
    try {
      await deleteTimetableSlot(schoolId, id)
      setSlotNonce((n) => n + 1)
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Slot not removed',
        description: errorMessage(err),
      })
    }
  }

  return (
    <div>
      <PageHeader
        title="Classes"
        description="Class groups, their homeroom teachers and weekly timetables."
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

            <div className="mt-10">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-accent/10 p-2.5 text-accent">
                    <CalendarRange className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold text-ink dark:text-white">Weekly Timetable</h3>
                </div>
                <Select
                  value={timetableClassId || rows[0]?.id}
                  onChange={(e) => setTimetableClassId(e.target.value)}
                  className="w-56"
                >
                  {rows.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="card p-5">
                <TimetableGrid slots={slots} editable onAddSlot={openSlot} onRemoveSlot={removeSlot} />
              </div>
            </div>
          </>
        )}
      </ResourceGate>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Class' : 'Add Class'}
        footer={
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
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Class name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
            <Input label="Grade" required value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} error={errors.grade} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
            <Input label="Room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Capacity"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
            <Select
              label="Homeroom teacher"
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
          </div>
          {!activeYearId && (
            <p className="text-xs text-red-500">
              No active academic year is set. A class belongs to an academic year, so one must exist first.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={!!slotDraft}
        onClose={() => setSlotDraft(null)}
        title={slotDraft ? `Day ${slotDraft.day} · Period ${slotDraft.period}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSlotDraft(null)}>
              Cancel
            </Button>
            <Button onClick={saveSlot}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Subject" value={slotSubjectId} onChange={(e) => setSlotSubjectId(e.target.value)}>
            <option value="">None</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select label="Teacher" value={slotTeacherId} onChange={(e) => setSlotTeacherId(e.target.value)}>
            <option value="">None</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </Select>
          <Input label="Room" value={slotRoom} onChange={(e) => setSlotRoom(e.target.value)} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Remove ${deleteTarget?.name}?`}
        description="Only a class with no attendance, grades, homework, exams or enrolled students (past or present) can be removed. Its timetable, subject assignments and class announcements are removed with it."
        confirmLabel="Remove Class"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
