import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/ui/PageHeader'
import GradeBook from '@/components/dashboard/GradeBook'

export default function AdminGrades() {
  const { classes } = useData()
  const { authUser } = useAuth()

  return (
    <div>
      <PageHeader title="Grades" description="Record and review assessment scores for any class." />
      <GradeBook classes={classes} recordedBy={authUser?.id ?? 'admin'} />
    </div>
  )
}
