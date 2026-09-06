import { ClipboardList } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import GradeBook from '@/components/dashboard/GradeBook'

export default function TeacherGrades() {
  const { activeMembership } = useAuth()
  const { classes } = useData()
  const myClasses = classes.filter((c) => c.teacherId === activeMembership?.teacher_id)

  return (
    <div>
      <PageHeader title="Grades" description="Record assessment scores for your assigned classes." />
      {myClasses.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No classes assigned yet" description="You'll be able to record grades once a class is assigned to you." />
      ) : (
        <GradeBook classes={myClasses} recordedBy={activeMembership?.teacher_id ?? ''} />
      )}
    </div>
  )
}
