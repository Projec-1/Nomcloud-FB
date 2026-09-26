import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarBlank as CalendarRange, Clock, Pencil, Plus, Trash as Trash2 } from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import ResourceGate from '@/components/ui/ResourceGate'
import { useAuth } from '@/context/AuthContext'
import { useRecordableClasses } from '@/hooks/useRecordableClasses'
import { createTimetableSlot, deleteTimetableSlot, fetchManagedTimetable, updateTimetableSlot, type TimetableSlotInput } from '@/services/classService'
import { fetchSchoolTeachers, type TeacherRow } from '@/services/teacherService'
import type { TimetableSlotView } from '@/services/teacherService'
import { isoWeekdayLabel, schoolWeekdays } from '@/utils/schoolCalendar'
import { toError } from '@/utils/errorMessage'
import { useToast } from '@/context/ToastContext'

type SlotForm = {
  day: string
  period: string
  subjectId: string
  teacherId: string
  startTime: string
  endTime: string
  room: string
}

const emptyForm: SlotForm = {
  day: '6',
  period: '1',
  subjectId: '',
  teacherId: '',
  startTime: '08:00',
  endTime: '08:40',
  room: '',
}

export default function AdminTimetables() {
  const { school } = useAuth()
  const { showToast } = useToast()
  const { state, classes, reload: reloadClasses } = useRecordableClasses()
  const [classId, setClassId] = useState('')
  const [slots, setSlots] = useState<TimetableSlotView[]>([])
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<TimetableSlotView | null>(null)
  const [form, setForm] = useState<SlotForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TimetableSlotView | null>(null)
  const [deleting, setDeleting] = useState(false)

  const schoolId = school?.id ?? null
  const selectedClass = classes.find((item) => item.id === classId) ?? classes[0] ?? null
  const weekdays = useMemo(() => schoolWeekdays(school?.weekend_days), [school?.weekend_days])
  const reload = useCallback(() => setReloadKey((value) => value + 1), [])

  useEffect(() => {
    if (!classId && classes[0]) setClassId(classes[0].id)
    if (classId && !classes.some((item) => item.id === classId)) setClassId(classes[0]?.id ?? '')
  }, [classId, classes])

  useEffect(() => {
    let cancelled = false
    if (!schoolId) {
      setLoadingSlots(false)
      setSlots([])
      return
    }
    setLoadingSlots(true)
    setError(null)
    Promise.all([
      classId ? fetchManagedTimetable(schoolId, classId) : Promise.resolve([]),
      fetchSchoolTeachers(schoolId),
    ])
      .then(([timetable, schoolTeachers]) => {
        if (cancelled) return
        setSlots(timetable)
        setTeachers(schoolTeachers)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(toError(cause))
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })
    return () => {
      cancelled = true
    }
  }, [schoolId, classId, reloadKey])

  const openNew = (day?: number) => {
    setEditing(null)
    const nextPeriod = Math.max(0, ...slots.filter((slot) => slot.day === (day ?? weekdays[0] ?? 6)).map((slot) => slot.period)) + 1
    setForm({ ...emptyForm, day: String(day ?? weekdays[0] ?? 6), period: String(nextPeriod) })
    setEditorOpen(true)
  }

  const openEdit = (slot: TimetableSlotView) => {
    setEditing(slot)
    setForm({
      day: String(slot.day),
      period: String(slot.period),
      subjectId: selectedClass?.writableSubjects.find((subject) => subject.name === slot.subject)?.id ?? '',
      teacherId: slot.teacherId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room,
    })
    setEditorOpen(true)
  }

  const saveSlot = async () => {
    if (!schoolId || !selectedClass) return
    if (!form.startTime || !form.endTime || form.endTime <= form.startTime || Number(form.period) < 1) {
      showToast({ type: 'error', title: 'Check the lesson details', description: 'Enter a valid period and an end time later than the start time.' })
      return
    }
    const input: TimetableSlotInput = {
      classId: selectedClass.id,
      subjectId: form.subjectId || null,
      teacherId: form.teacherId || null,
      dayOfWeek: Number(form.day),
      period: Number(form.period),
      startTime: form.startTime,
      endTime: form.endTime,
      room: form.room.trim() || null,
    }
    setSaving(true)
    try {
      if (editing) await updateTimetableSlot(schoolId, editing.id, input)
      else await createTimetableSlot(schoolId, input)
      showToast({ type: 'success', title: editing ? 'Timetable slot updated' : 'Timetable slot added' })
      setEditorOpen(false)
      reload()
    } catch (cause: unknown) {
      showToast({ type: 'error', title: 'Timetable was not saved', description: cause instanceof Error ? cause.message : String(cause) })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!schoolId || !deleteTarget) return
    setDeleting(true)
    try {
      await deleteTimetableSlot(schoolId, deleteTarget.id)
      showToast({ type: 'success', title: 'Timetable slot removed' })
      setDeleteTarget(null)
      reload()
    } catch (cause: unknown) {
      showToast({ type: 'error', title: 'Timetable slot was not removed', description: cause instanceof Error ? cause.message : String(cause) })
    } finally {
      setDeleting(false)
    }
  }

  const byDay = (day: number) => slots.filter((slot) => slot.day === day).sort((a, b) => a.period - b.period)

  return (
    <div>
      <PageHeader title="Timetables" description="Manage published lesson times for your school classes." actions={selectedClass && <Button onClick={() => openNew()} icon={<Plus className="h-4 w-4" />}>Add lesson</Button>} />
      <ResourceGate state={state} empty={{ icon: CalendarRange, title: 'No classes available', description: 'Create a class and assign an academic year before adding timetable slots.' }} deniedHint="Timetable management is available to school administrators.">
        {() => selectedClass ? (
          <section className="space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl border border-ink/5 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03] sm:flex-row sm:items-end sm:justify-between">
              <Select label="Class" value={selectedClass.id} onChange={(event) => setClassId(event.target.value)} className="sm:max-w-sm">
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
              <p className="text-sm text-graphite">{selectedClass.subject.length} subjects assigned</p>
            </div>
            {error ? <div role="alert" className="rounded-xl border border-red-500/20 p-4 text-sm text-red-700 dark:text-red-300">{error.message}<Button variant="outline" size="sm" className="ml-3" onClick={reload}>Retry</Button></div> : loadingSlots ? <p className="py-12 text-center text-sm text-graphite">Loading timetable…</p> : slots.length === 0 ? (
              <EmptyState icon={CalendarRange} title="No lessons scheduled" description={`Add the first timetable slot for ${selectedClass.name}.`} action={<Button onClick={() => openNew()}>Add lesson</Button>} />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {weekdays.map((day) => {
                  const daySlots = byDay(day)
                  return <section key={day} className="overflow-hidden rounded-2xl border border-ink/5 bg-white dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex items-center justify-between border-b border-ink/5 px-5 py-4 dark:border-white/10">
                      <div><p className="text-xs font-semibold uppercase tracking-wider text-accent">{isoWeekdayLabel(day)}</p><h2 className="mt-1 font-semibold text-ink dark:text-white">{daySlots.length} scheduled periods</h2></div>
                      <Button variant="outline" size="sm" onClick={() => openNew(day)} icon={<Plus className="h-4 w-4" />}>Add</Button>
                    </div>
                    <div className="space-y-2 p-3">
                      {daySlots.map((slot) => <article key={slot.id} className="flex min-w-0 items-center gap-3 rounded-xl bg-mist/70 p-3 dark:bg-white/[0.04]">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><Clock className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink dark:text-white">{slot.subject}</p><p className="text-xs text-graphite">{slot.startTime}–{slot.endTime} · Period {slot.period}</p><p className="truncate text-xs text-graphite">{slot.teacherName ?? 'Teacher unassigned'}{slot.room ? ` · ${slot.room}` : ''}</p></div>
                        <button type="button" aria-label={`Edit period ${slot.period}`} className="rounded-lg p-2 text-graphite hover:bg-white dark:hover:bg-white/10" onClick={() => openEdit(slot)}><Pencil className="h-4 w-4" /></button>
                        <button type="button" aria-label={`Remove period ${slot.period}`} className="rounded-lg p-2 text-red-600 hover:bg-white dark:text-red-400 dark:hover:bg-white/10" onClick={() => setDeleteTarget(slot)}><Trash2 className="h-4 w-4" /></button>
                      </article>)}
                      {daySlots.length === 0 && <p className="px-2 py-6 text-center text-sm text-graphite">No lessons scheduled.</p>}
                    </div>
                  </section>
                })}
              </div>
            )}
          </section>
        ) : null}
      </ResourceGate>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editing ? 'Edit timetable slot' : 'Add timetable slot'} footer={<><Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button><Button onClick={() => void saveSlot()} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add lesson'}</Button></>}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Day" value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value })}>{weekdays.map((day) => <option key={day} value={day}>{isoWeekdayLabel(day)}</option>)}</Select>
            <Input label="Period number" type="number" min="1" value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value })} />
            <Select label="Subject" value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })}><option value="">Break / unassigned</option>{selectedClass?.writableSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</Select>
            <Select label="Teacher" value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: event.target.value })}><option value="">Unassigned</option>{teachers.filter((teacher) => teacher.status === 'active').map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}</Select>
            <Input label="Start time" type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
            <Input label="End time" type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
          </div>
          <Input label="Room (optional)" value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} />
        </div>
      </Modal>
      <ConfirmDialog open={Boolean(deleteTarget)} title="Remove timetable slot?" description="This removes the selected lesson from the school's published timetable." confirmLabel={deleting ? 'Removing…' : 'Remove slot'} danger loading={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />
    </div>
  )
}
