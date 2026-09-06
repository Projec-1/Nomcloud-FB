import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useSelectedChild } from '@/hooks/useSelectedChild'
import PageHeader from '@/components/ui/PageHeader'
import MessagesPanel from '@/components/dashboard/MessagesPanel'

export default function ParentMessages() {
  const { profile, activeMembership } = useAuth()
  const { classes, teachers, messageThreads } = useData()
  const { children } = useSelectedChild()

  const parentId = activeMembership?.guardian_id ?? ''
  const myClassIds = new Set(children.map((c) => c.classId))
  const myThreads = messageThreads.filter((t) => t.participantIds.includes(parentId))

  const recipients = teachers
    .filter((t) => t.classIds.some((cid) => myClassIds.has(cid)))
    .map((t) => {
      const cls = classes.find((c) => myClassIds.has(c.id) && t.classIds.includes(c.id))
      const child = children.find((c) => c.classId === cls?.id)
      return { id: t.id, name: t.name, subLabel: cls ? `${cls.name} · ${t.subject}` : t.subject, studentId: child?.id }
    })

  return (
    <div>
      <PageHeader title="Messages" description="Message your children's teachers directly." />
      <MessagesPanel
        currentId={parentId}
        currentName={profile?.full_name ?? ''}
        threads={myThreads}
        recipients={recipients}
        recipientLabel="Teacher"
      />
    </div>
  )
}
