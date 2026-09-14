import { useMemo, useState } from 'react'
import { Plus, Pin, Trash2, Megaphone } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import type { Announcement, AnnouncementAudience, Role } from '@/types'
import type { ClassSummary } from '@/services/teacherService'
import { minLength, type FieldErrors } from '@/utils/validators'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'

interface AnnouncementBoardProps {
  audienceOptions: { value: AnnouncementAudience; label: string }[]
  classes: ClassSummary[]
  authorName: string
  authorRole: Role
  visibleAnnouncements: Announcement[]
  canManage?: (announcement: Announcement) => boolean
}

const priorityTone: Record<Announcement['priority'], 'neutral' | 'warning' | 'danger'> = {
  normal: 'neutral',
  important: 'warning',
  urgent: 'danger',
}

export default function AnnouncementBoard({
  audienceOptions,
  classes,
  authorName,
  authorRole,
  visibleAnnouncements,
  canManage = () => true,
}: AnnouncementBoardProps) {
  const { addAnnouncement, deleteAnnouncement, togglePin } = useData()
  const { showToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    body: '',
    audience: audienceOptions[0]?.value ?? 'all',
    classId: classes[0]?.id ?? '',
    priority: 'normal' as Announcement['priority'],
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)

  const sorted = useMemo(
    () => [...visibleAnnouncements].sort((a, b) => (a.pinned === b.pinned ? (a.date < b.date ? 1 : -1) : a.pinned ? -1 : 1)),
    [visibleAnnouncements],
  )

  const openAdd = () => {
    setForm({ title: '', body: '', audience: audienceOptions[0]?.value ?? 'all', classId: classes[0]?.id ?? '', priority: 'normal' })
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const next: FieldErrors = {}
    if (!minLength(form.title, 3)) next.title = 'Enter a title.'
    if (!minLength(form.body, 10)) next.body = 'Write a short message (10+ characters).'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    addAnnouncement({
      title: form.title,
      body: form.body,
      audience: form.audience,
      classId: form.audience === 'class' ? form.classId : undefined,
      priority: form.priority,
      createdBy: authorName,
      createdByRole: authorRole,
    })
    showToast({ type: 'success', title: 'Announcement posted', description: 'Notifications were sent to the selected audience.' })
    setModalOpen(false)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteAnnouncement(deleteTarget.id)
    showToast({ type: 'success', title: 'Announcement removed' })
    setDeleteTarget(null)
  }

  const canPost = audienceOptions.length > 0

  return (
    <div>
      {canPost && (
        <div className="mb-6 flex justify-end">
          <Button onClick={openAdd} icon={<Plus className="h-4 w-4" />}>
            New Announcement
          </Button>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" description="Post your first announcement to keep everyone informed." />
      ) : (
        <div className="space-y-4">
          {sorted.map((a) => (
            <div key={a.id} className={cn('card p-6', a.pinned && 'border-brand/30 ring-1 ring-brand/20')}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={priorityTone[a.priority]}>{a.priority}</Badge>
                  <Badge tone="neutral">{a.audience === 'class' ? classes.find((c) => c.id === a.classId)?.name ?? 'Class' : a.audience}</Badge>
                  {a.pinned && <Badge tone="brand">Pinned</Badge>}
                </div>
                {canManage(a) && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => togglePin(a.id)}
                      className={cn('rounded-lg p-2 hover:bg-ink/5 dark:hover:bg-white/10', a.pinned ? 'text-brand' : 'text-graphite')}
                    >
                      <Pin className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(a)} className="rounded-lg p-2 text-graphite hover:bg-red-500/10 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <h3 className="text-base font-semibold text-ink dark:text-white">{a.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-graphite">{a.body}</p>
              <p className="mt-4 text-xs text-graphite">
                {a.createdBy} · {formatDate(a.date)}
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Announcement"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Post Announcement</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} />
          <Textarea label="Message" required rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} error={errors.body} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Audience"
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value as AnnouncementAudience })}
            >
              {audienceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Announcement['priority'] })}>
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>
          {form.audience === 'class' && (
            <Select label="Class" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this announcement?"
        description="It will be removed for everyone it was sent to."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
