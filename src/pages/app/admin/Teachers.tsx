import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, GraduationCap, Mail, Phone, UserPlus, X } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/ui/PageHeader'
import SearchInput from '@/components/ui/SearchInput'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import type { Teacher } from '@/types'
import { createInvitation, listLiveInvitations, revokeInvitation, type InvitationRow } from '@/services/invitationService'
import type { MembershipRole } from '@/types/auth'
import type { FieldErrors } from '@/utils/validators'
import { isValidEmail, minLength } from '@/utils/validators'

const emptyForm = { name: '', email: '', phone: '', subject: '' }
const emptyInvitation = { email: '', role: 'teacher' as MembershipRole }

export default function AdminTeachers() {
  const { teachers, classes, addTeacher, updateTeacher, deleteTeacher } = useData()
  const { profile } = useAuth()
  const { showToast } = useToast()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null)
  const [invitationForm, setInvitationForm] = useState(emptyInvitation)
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [invitationError, setInvitationError] = useState('')
  const [invitationLoading, setInvitationLoading] = useState(false)

  const filtered = useMemo(
    () =>
      teachers.filter(
        (t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase()),
      ),
    [teachers, search],
  )

  useEffect(() => {
    if (!profile?.school_id) return
    void listLiveInvitations(profile.school_id)
      .then(setInvitations)
      .catch(() => setInvitationError('Unable to load live invitations.'))
  }, [profile?.school_id])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (teacher: Teacher) => {
    setEditing(teacher)
    setForm({ name: teacher.name, email: teacher.email, phone: teacher.phone, subject: teacher.subject })
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const next: FieldErrors = {}
    if (!minLength(form.name, 2)) next.name = 'Enter the teacher\'s full name.'
    if (!isValidEmail(form.email)) next.email = 'Enter a valid email address.'
    if (!minLength(form.subject, 2)) next.subject = 'Enter the subject taught.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    if (editing) {
      updateTeacher(editing.id, form)
      showToast({ type: 'success', title: 'Teacher updated', description: `${form.name}'s profile was saved.` })
    } else {
      addTeacher(form)
      showToast({ type: 'success', title: 'Teacher added', description: `${form.name} was added to the staff directory.` })
    }
    setModalOpen(false)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteTeacher(deleteTarget.id)
    showToast({ type: 'success', title: 'Teacher removed' })
    setDeleteTarget(null)
  }

  const handleCreateInvitation = async () => {
    if (!profile?.school_id) {
      setInvitationError('Your account is not assigned to a school.')
      return
    }
    if (!isValidEmail(invitationForm.email)) {
      setInvitationError('Enter a valid email address.')
      return
    }
    setInvitationError('')
    setInvitationLoading(true)
    try {
      const invitation = await createInvitation({
        schoolId: profile.school_id,
        email: invitationForm.email,
        role: invitationForm.role,
        invitedBy: profile.id,
      })
      setInvitations((current) => [invitation, ...current])
      setInvitationForm(emptyInvitation)
      showToast({ type: 'success', title: 'Invitation created', description: 'Email delivery is pending configuration.' })
    } catch (error) {
      setInvitationError(error instanceof Error ? error.message : 'Unable to create invitation.')
    } finally {
      setInvitationLoading(false)
    }
  }

  const handleRevokeInvitation = async (invitation: InvitationRow) => {
    if (!profile?.school_id) return
    try {
      await revokeInvitation(invitation.id, profile.school_id)
      setInvitations((current) => current.filter((item) => item.id !== invitation.id))
      showToast({ type: 'success', title: 'Invitation revoked' })
    } catch {
      setInvitationError('Unable to revoke invitation.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Teachers"
        description={`${teachers.length} teaching staff members`}
        actions={
          <Button onClick={openAdd} icon={<Plus className="h-4 w-4" />}>
            Add Teacher
          </Button>
        }
      />

      <section className="card mb-6 p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <UserPlus className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-ink dark:text-white">Invite a member</h2>
            <p className="mt-1 text-sm text-graphite">Creates a seven-day, single-use invitation. Email delivery is not configured yet.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <Input
            label="Email address"
            type="email"
            value={invitationForm.email}
            onChange={(e) => setInvitationForm({ ...invitationForm, email: e.target.value })}
            placeholder="person@school.example"
          />
          <Select
            label="Role"
            value={invitationForm.role}
            onChange={(e) => setInvitationForm({ ...invitationForm, role: e.target.value as MembershipRole })}
          >
            <option value="teacher">Teacher</option>
            <option value="parent">Parent</option>
            <option value="admin">School admin</option>
          </Select>
          <Button onClick={handleCreateInvitation} loading={invitationLoading} icon={<UserPlus className="h-4 w-4" />}>
            Create invite
          </Button>
        </div>
        {invitationError && <p className="mt-3 text-sm font-medium text-red-500">{invitationError}</p>}
        {invitations.length > 0 && (
          <div className="mt-6 space-y-2 border-t border-ink/5 pt-5 dark:border-white/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-graphite">Live invitations</p>
            {invitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-xl bg-ink/5 px-4 py-3 dark:bg-white/5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink dark:text-white">{invitation.email}</p>
                  <p className="text-xs text-graphite">
                    {invitation.role} · expires {new Date(invitation.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRevokeInvitation(invitation)}
                  className="flex-shrink-0 rounded-lg p-2 text-graphite hover:bg-red-500/10 hover:text-red-500"
                  aria-label={`Revoke invitation for ${invitation.email}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <SearchInput value={search} onChange={setSearch} placeholder="Search by name or subject…" className="mb-6 sm:w-80" />

      {filtered.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No teachers found" description="Try a different search, or add a new teacher." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const teacherClasses = classes.filter((c) => t.classIds.includes(c.id))
            return (
              <div key={t.id} className="card p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={t.name} color={t.avatarColor} />
                    <div>
                      <p className="font-medium text-ink dark:text-white">{t.name}</p>
                      <p className="text-xs text-graphite">{t.subject}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(t)} className="rounded-lg p-2 text-graphite hover:bg-ink/5 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleteTarget(t)} className="rounded-lg p-2 text-graphite hover:bg-red-500/10 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 text-xs text-graphite">
                  <p className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" /> {t.email}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" /> {t.phone}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {teacherClasses.length === 0 ? (
                    <Badge tone="neutral">No classes assigned</Badge>
                  ) : (
                    teacherClasses.map((c) => (
                      <Badge key={c.id} tone="info">
                        {c.name}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Teacher' : 'Add Teacher'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>{editing ? 'Save Changes' : 'Add Teacher'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <Input
            label="Email address"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={errors.email}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input
              label="Subject taught"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              error={errors.subject}
            />
          </div>
          {editing && (
            <p className="rounded-xl bg-ink/5 px-4 py-3 text-xs text-graphite dark:bg-white/5">
              Manage this teacher's class assignments from the Classes page.
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Remove ${deleteTarget?.name}?`}
        description="Their assigned classes will become unassigned. This action cannot be undone."
        confirmLabel="Remove Teacher"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
