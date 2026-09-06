import { ClipboardCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import HomeworkBoard from '@/components/dashboard/HomeworkBoard'

export default function TeacherHomework() {
  const { activeMembership } = useAuth()
  const { classes } = useData()
  const myClasses = classes.filter((c) => c.teacherId === activeMembership?.teacher_id)

  return (
    <div>
      <PageHeader title="Homework" description="Assign and track homework for your classes." />
      {myClasses.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No classes assigned yet" description="You'll be able to assign homework once a class is assigned to you." />
      ) : (
        <HomeworkBoard classes={myClasses} createdBy={activeMembership?.teacher_id ?? ''} />
      )}
    </div>
  )
}
