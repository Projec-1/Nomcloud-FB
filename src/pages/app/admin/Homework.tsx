import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/ui/PageHeader'
import HomeworkBoard from '@/components/dashboard/HomeworkBoard'

export default function AdminHomework() {
  const { classes } = useData()
  const { profile } = useAuth()

  return (
    <div>
      <PageHeader title="Homework" description="Assign and track homework completion across every class." />
      <HomeworkBoard classes={classes} createdBy={profile?.full_name ?? 'School Administration'} />
    </div>
  )
}
