import { useAuth } from '@/context/AuthContext'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import { useData } from '@/context/DataContext'
import PageHeader from '@/components/ui/PageHeader'
import MessagesPanel from '@/components/dashboard/MessagesPanel'

export default function TeacherMessages() {
  const { profile, activeMembership } = useAuth()
  const { students, parents, messageThreads } = useData()
  const { classes: myClasses } = useTeacherClasses()

  const teacherId = activeMembership?.teacher_id ?? ''
  const myStudentIds = new Set(myClasses.flatMap((c) => c.studentIds))
  const myThreads = messageThreads.filter((t) => t.participantIds.includes(teacherId))

  const recipients = parents
    .filter((p) => p.studentIds.some((sid) => myStudentIds.has(sid)))
    .map((p) => {
      const child = students.find((s) => p.studentIds.includes(s.id) && myStudentIds.has(s.id))
      return { id: p.id, name: p.name, subLabel: child ? `Parent of ${child.name}` : undefined, studentId: child?.id }
    })

  return (
    <div>
      <PageHeader title="Messages" description="Communicate directly with parents of your students." />
      <MessagesPanel
        currentId={teacherId}
        currentName={profile?.full_name ?? ''}
        threads={myThreads}
        recipients={recipients}
        recipientLabel="Parent"
      />
    </div>
  )
}
