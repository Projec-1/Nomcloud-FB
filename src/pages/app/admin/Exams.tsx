import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, BarChart3, Clock, MapPin } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import PageHeader from '@/components/ui/PageHeader'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import type { Exam } from '@/types'
import type { FieldErrors } from '@/utils/validators'
import { minLength } from '@/utils/validators'
import { formatDate } from '@/utils/format'

const emptyForm = { name: '', classId: '', subject: '', date: '', startTime: '08:00', duration: '90', maxScore: '100', room: '' }

export default function AdminExams() {
  const { classes, exams, addExam, updateExam, deleteExam, currentTerm } = useData()
  const { showToast } = useToast()

  const [classFilter, setClassFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Exam | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null)

  const filtered = useMemo(
    () => exams.filter((e) => classFilter === 'all' || e.classId === classFilter).sort((a, b) => (a.date < b.date ? -1 : 1)),
    [exams, classFilter],
  )

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm, classId: classes[0]?.id ?? '', subject: classes[0]?.subject[0] ?? '' })
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (exam: Exam) => {
    setEditing(exam)
    setForm({
      name: exam.name,
      classId: exam.classId,
      subject: exam.subject,
      date: exam.date,
      startTime: exam.startTime,
      duration: String(exam.duration),
      maxScore: String(exam.maxScore),
      room: exam.room,
    })
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const next: FieldErrors = {}
    if (!minLength(form.name, 2)) next.name = 'Enter an exam name.'
    if (!form.classId) next.classId = 'Select a class.'
    if (!minLength(form.subject, 2)) next.subject = 'Enter a subject.'
    if (!form.date) next.date = 'Select a date.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    const payload = {
      name: form.name,
      classId: form.classId,
      subject: form.subject,
      date: form.date,
      startTime: form.startTime,
      duration: Number(form.duration) || 60,
      maxScore: Number(form.maxScore) || 100,
      term: currentTerm,
      status: new Date(form.date) < new Date() ? ('completed' as const) : ('scheduled' as const),
      room: form.room,
    }
    if (editing) {
      updateExam(editing.id, payload)
      showToast({ type: 'success', title: 'Exam updated' })
    } else {
      addExam(payload)
      showToast({ type: 'success', title: 'Exam scheduled', description: `${form.name} was added to the calendar.` })
    }
    setModalOpen(false)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteExam(deleteTarget.id)
    showToast({ type: 'success', title: 'Exam removed' })
    setDeleteTarget(null)
  }

  return (
    <div>
      <PageHeader
        title="Exams"
        description="Schedule and manage exams across all classes."
        actions={
          <Button onClick={openAdd} icon={<Plus className="h-4 w-4" />}>
            Schedule Exam
          </Button>
        }
      />

      <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="mb-6 sm:w-56">
        <option value="all">All Classes</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      {filtered.length === 0 ? (
        <EmptyState icon={BarChart3} title="No exams scheduled" description="Schedule your first exam to see it here." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-ink/5 text-left text-xs text-graphite dark:border-white/10">
                <th className="px-5 py-3.5 font-medium">Exam</th>
                <th className="px-5 py-3.5 font-medium">Class</th>
                <th className="px-5 py-3.5 font-medium">Date &amp; Time</th>
                <th className="px-5 py-3.5 font-medium">Room</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
                <th className="px-5 py-3.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exam) => {
                const cls = classes.find((c) => c.id === exam.classId)
                return (
                  <tr key={exam.id} className="border-b border-ink/5 last:border-b-0 dark:border-white/5">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink dark:text-white">{exam.name}</p>
                      <p className="text-xs text-graphite">{exam.subject}</p>
                    </td>
                    <td className="px-5 py-3.5 text-graphite">{cls?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-graphite">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> {formatDate(exam.date)} · {exam.startTime}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-graphite">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" /> {exam.room}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={exam.status === 'completed' ? 'neutral' : exam.status === 'cancelled' ? 'danger' : 'success'}>{exam.status}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openEdit(exam)} className="rounded-lg p-2 text-graphite hover:bg-ink/5 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(exam)} className="rounded-lg p-2 text-graphite hover:bg-red-500/10 hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Exam' : 'Schedule Exam'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>{editing ? 'Save Changes' : 'Schedule Exam'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Exam name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} placeholder="Mathematics — End of Term Exam" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Class" required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} error={errors.classId}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input label="Subject" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} error={errors.subject} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} error={errors.date} />
            <Input label="Start time" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            <Input label="Duration (min)" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            <Input label="Max score" type="number" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Cancel ${deleteTarget?.name}?`}
        description="This exam will be removed from the schedule."
        confirmLabel="Delete Exam"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
