import { useState } from 'react'
import { Plus, Pin, Trash2, Megaphone } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { minLength, type FieldErrors } from '@/utils/validators'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'
import {
  createAnnouncement,
  deleteAnnouncement,
  setAnnouncementPinned,
  type AnnouncementAudience,
  type AnnouncementPriority,
  type AnnouncementView,
} from '@/services/communicationService'
import { errorMessage } from '@/utils/errorMessage'

// ---------------------------------------------------------------------------
// Phase 8 batch 7. Real announcements.
//
// AUTHORING IS MANAGEMENT-ONLY, AND THAT CLOSES HALF OF DECISION 6.
//
// announcements has two INSERT policies, announcements_admin_insert keyed on
// has_school_admin_role and announcements_class_management_insert keyed on
// can_manage_class. A teacher satisfies neither: can_manage_class covers
// management, not teaching staff. So a teacher cannot publish an announcement
// of any audience, including to their own class.
//
// The prototype's teacher screen invited exactly that, with the description
// "Post updates to your class". The compose control is now shown only where the
// signed-in user can actually publish. This is the same treatment batch 1 gave
// logo upload, batch 5 gave guardian homework submission and batch 6 gave the
// parent payment button: a control the database refuses is removed rather than
// left to fail.
//
// READERSHIP IS NOT FILTERED HERE. The five SELECT policies decide who sees
// what by audience, and the service deliberately does not restate that matrix
// client-side. A guardian receives 'all' and 'parents' plus their own child's
// class notices; a teacher receives 'all' and 'teachers' plus classes they
// teach. The prototype showed guardians a 'students' audience; that audience no
// longer exists (SYSTEM_ISSUES_LIST M11), because students hold no logins and it
// reached nobody.
// ---------------------------------------------------------------------------

const priorityTone: Record<AnnouncementPriority, 'neutral' | 'warning' | 'danger'> = {
  normal: 'neutral',
  important: 'warning',
  urgent: 'danger',
}

const audienceLabels: Record<AnnouncementAudience, string> = {
  all: 'Entire School',
  teachers: 'All Teachers',
  parents: 'All Parents',
  class: 'Specific Class',
}

interface AnnouncementBoardProps {
  announcements: AnnouncementView[]
  /** Only id and name are read, for the "specific class" selector. */
  classes: { id: string; name: string }[]
  schoolId: string
  /** True only for owner, director and administrator. Gates every write control. */
  canManage: boolean
  audienceOptions: { value: AnnouncementAudience; label: string }[]
  onChanged: () => void
}

export default function AnnouncementBoard({
  announcements,
  classes,
  schoolId,
  canManage,
  audienceOptions,
  onChanged,
}: AnnouncementBoardProps) {
  const { showToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    body: '',
    audience: (audienceOptions[0]?.value ?? 'all') as AnnouncementAudience,
    classId: classes[0]?.id ?? '',
    priority: 'normal' as AnnouncementPriority,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementView | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const openAdd = () => {
    setForm({
      title: '',
      body: '',
      audience: (audienceOptions[0]?.value ?? 'all') as AnnouncementAudience,
      classId: classes[0]?.id ?? '',
      priority: 'normal',
    })
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const next: FieldErrors = {}
    if (!minLength(form.title, 3)) next.title = 'Enter a title.'
    if (!minLength(form.body, 5)) next.body = 'Write the announcement.'
    // announcements_audience_class_check enforces this pairing in the database,
    // in both directions. Checking here only produces a better message.
    if (form.audience === 'class' && !form.classId) next.classId = 'Select the class.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setIsSaving(true)
    try {
      await createAnnouncement(schoolId, {
        title: form.title,
        body: form.body,
        audience: form.audience,
        classId: form.audience === 'class' ? form.classId : null,
        priority: form.priority,
      })
      showToast({ type: 'success', title: 'Announcement published' })
      setModalOpen(false)
      onChanged()
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Announcement not published',
        description: errorMessage(err),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const togglePin = async (a: AnnouncementView) => {
    try {
      await setAnnouncementPinned(schoolId, a.id, !a.pinned)
      onChanged()
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Could not change the pin',
        description: errorMessage(err),
      })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteAnnouncement(schoolId, deleteTarget.id)
      showToast({ type: 'success', title: 'Announcement removed' })
      onChanged()
    } catch (err: unknown) {
      showToast({
        type: 'error',
        title: 'Announcement not removed',
        description: errorMessage(err),
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      {canManage && audienceOptions.length > 0 && (
        <div className="mb-6 flex justify-end">
          <Button onClick={openAdd} icon={<Plus className="h-4 w-4" />}>
            New Announcement
          </Button>
        </div>
      )}

      {announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          description="School news and updates will appear here."
        />
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={cn('card p-5', a.pinned && 'border-brand/30 ring-1 ring-brand/20')}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    {a.pinned && <Pin className="h-3.5 w-3.5 text-brand" />}
                    <Badge tone={priorityTone[a.priority]}>{a.priority}</Badge>
                    <Badge tone="neutral">
                      {a.audience === 'class'
                        ? classes.find((c) => c.id === a.classId)?.name ?? 'Class'
                        : audienceLabels[a.audience]}
                    </Badge>
                  </div>
                  <p className="font-medium text-ink dark:text-white">{a.title}</p>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-graphite">{a.body}</p>
                  <p className="mt-2.5 text-xs text-graphite">
                    {a.authorName} · {formatDate(a.publishedAt ?? a.createdAt)}
                  </p>
                </div>
                {canManage && (
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => togglePin(a)}
                      aria-label={a.pinned ? `Unpin ${a.title}` : `Pin ${a.title}`}
                      className={cn(
                        'rounded-lg p-2 hover:bg-ink/5 dark:hover:bg-white/10',
                        a.pinned ? 'text-brand' : 'text-graphite hover:text-ink dark:hover:text-white',
                      )}
                    >
                      <Pin className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(a)}
                      aria-label={`Delete ${a.title}`}
                      className="rounded-lg p-2 text-graphite hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
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
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? 'Publishing…' : 'Publish'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            error={errors.title}
          />
          <Textarea
            label="Announcement"
            required
            rows={5}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            error={errors.body}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Audience"
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value as AnnouncementAudience })}
            >
              {audienceOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as AnnouncementPriority })}
            >
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>
          {form.audience === 'class' && (
            <Select
              label="Class"
              required
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              error={errors.classId}
            >
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
        title={`Delete "${deleteTarget?.title}"?`}
        description="This announcement will no longer be visible to anyone."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
