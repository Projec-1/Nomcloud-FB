import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/ui/PageHeader'
import AttendanceMarker from '@/components/dashboard/AttendanceMarker'

export default function AdminAttendance() {
  const { classes } = useData()
  const { authUser } = useAuth()

  return (
    <div>
      <PageHeader title="Attendance" description="Mark or review attendance for any class across the school." />
      <AttendanceMarker classes={classes} markedBy={authUser?.id ?? 'admin'} />
    </div>
  )
}
