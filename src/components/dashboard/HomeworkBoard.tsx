import { useMemo, useState } from 'react'
import type { ClassSummary } from '@/services/teacherService'
import { Plus, Paperclip, Calendar, Users, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import Avatar from '@/components/ui/Avatar'
import type { Homework, SchoolClass } from '@/types'
import type { FieldErrors } from '@/utils/validators'
import { minLength } from '@/utils/validators'
import { formatDate, percentage } from '@/utils/format'

const emptyForm = { classId: '', subject: '', title: '', description: '', dueDate: '', attachments: '0' }

export default function HomeworkBoard({ classes, createdBy }: { classes: ClassSummary[]; createdBy: string }) {
  const { students, homework, addHomework, deleteHomework, updateSubmission } = useData()
  const { showToast } = useToast()

  const [classFilter, setClassFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [deleteTarget, setDeleteTarget] = useState<Homework | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const visibleClassIds = classes.map((c) => c.id)
  const filtered = useMemo(
    () =>
      homework
        .filter((h) => visibleClassIds.includes(h.classId))
        .filter((h) => classFilter === 'all' || h.classId === classFilter)
        .sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [homework, classFilter],
  )

  const openAdd = () => {
    setForm({ ...emptyForm, classId: classes[0]?.id ?? '', subject: classes[0]?.subject[0] ?? '' })
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const next: FieldErrors = {}
    if (!form.classId) next.classId = 'Select a class.'
    if (!minLength(form.subject, 2)) next.subject = 'Enter a subject.'
    if (!minLength(form.title, 3)) next.title = 'Enter a homework title.'
    if (!form.dueDate) next.dueDate = 'Select a due date.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    addHomework({
      classId: form.classId,
      subject: form.subject,
      title: form.title,
      description: form.description || 'No additional details provided.',
      assignedDate: new Date().toISOString().slice(0, 10),
      dueDate: form.dueDate,
      attachments: Number(form.attachments) || 0,
      createdBy,
    })
    showToast({ type: 'success', title: 'Homework assigned', description: `${form.title} was sent to the class.` })
    setModalOpen(false)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteHomework(deleteTarget.id)
    showToast({ type: 'success', title: 'Homework removed' })
    setDeleteTarget(null)
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="sm:w-56">
          <option value="all">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button onClick={openAdd} icon={<Plus className="h-4 w-4" />}>
          Assign Homework
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No homework assigned" description="Assign your first homework to get started." />
      ) : (
        <div className="space-y-4">
          {filtered.map((hw) => {
            const cls = classes.find((c) => c.id === hw.classId)
            const submitted = hw.submissions.filter((s) => s.status !== 'pending').length
            const isOpen = expanded === hw.id
            return (
              <div key={hw.id} className="card overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : hw.id)} className="flex w-full items-center justify-between gap-4 p-5 text-left">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone="info">{hw.subject}</Badge>
                      <Badge tone="neutral">{cls?.name}</Badge>
                    </div>
                    <p className="truncate font-medium text-ink dark:text-white">{hw.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-graphite">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Due {formatDate(hw.dueDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {submitted}/{hw.submissions.length} submitted
                      </span>
                      {hw.attachments > 0 && (
                        <span className="flex items-center gap-1">
                          <Paperclip className="h-3 w-3" /> {hw.attachments}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(hw)
                      }}
                      className="rounded-lg p-2 text-graphite hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-graphite" /> : <ChevronDown className="h-4 w-4 text-graphite" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-ink/5 px-5 py-4 dark:border-white/10">
                    <p className="mb-4 text-sm leading-relaxed text-graphite">{hw.description}</p>
                    <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-ink/5 dark:bg-white/10">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${percentage(submitted, hw.submissions.length)}%` }} />
                    </div>
                    <div className="space-y-2">
                      {hw.submissions.map((sub) => {
                        const student = students.find((s) => s.id === sub.studentId)
                        if (!student) return null
                        return (
                          <div key={sub.studentId} className="flex items-center justify-between rounded-xl bg-mist px-3 py-2.5 dark:bg-white/5">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={student.name} color={student.avatarColor} size="xs" />
                              <span className="text-sm text-ink dark:text-white">{student.name}</span>
                            </div>
                            <select
                              value={sub.status}
                              onChange={(e) => updateSubmission(hw.id, sub.studentId, { status: e.target.value as typeof sub.status })}
                              className="rounded-lg border border-ink/10 bg-white px-2.5 py-1 text-xs dark:border-white/10 dark:bg-white/10"
                            >
                              <option value="pending">Pending</option>
                              <option value="submitted">Submitted</option>
                              <option value="late">Late</option>
                              <option value="graded">Graded</option>
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Assign Homework"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Assign to Class</Button>
          </>
        }
      >
        <div className="space-y-4">
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
          <Input label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Due date" type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} error={errors.dueDate} />
            <Input label="Attachments" type="number" min={0} value={form.attachments} onChange={(e) => setForm({ ...form, attachments: e.target.value })} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.title}"?`}
        description="Students and parents will no longer see this homework."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
