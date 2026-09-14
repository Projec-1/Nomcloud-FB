import { ClipboardList } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import ResourceGate from '@/components/ui/ResourceGate'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import GradeBook from '@/components/dashboard/GradeBook'

export default function TeacherGrades() {
  const { activeMembership } = useAuth()
  const { state, classes: myClasses } = useTeacherClasses()

  return (
    <div>
      <PageHeader title="Grades" description="Record assessment scores for your assigned classes." />
      {<ResourceGate
          state={state}
          empty={{ icon: ClipboardList, title: "No classes assigned yet", description: "You'll be able to record grades once a class is assigned to you." }}
          deniedHint="Class records are available to an assigned teacher."
        >
          {() => <GradeBook classes={myClasses} recordedBy={activeMembership?.teacher_id ?? ''} />}
        </ResourceGate>}
    </div>
  )
}
