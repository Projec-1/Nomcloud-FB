import { ClipboardCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import ResourceGate from '@/components/ui/ResourceGate'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import HomeworkBoard from '@/components/dashboard/HomeworkBoard'

export default function TeacherHomework() {
  const { activeMembership } = useAuth()
  const { state, classes: myClasses } = useTeacherClasses()

  return (
    <div>
      <PageHeader title="Homework" description="Assign and track homework for your classes." />
      {<ResourceGate
          state={state}
          empty={{ icon: ClipboardCheck, title: "No classes assigned yet", description: "You'll be able to assign homework once a class is assigned to you." }}
          deniedHint="Class records are available to an assigned teacher."
        >
          {() => <HomeworkBoard classes={myClasses} createdBy={activeMembership?.teacher_id ?? ''} />}
        </ResourceGate>}
    </div>
  )
}
