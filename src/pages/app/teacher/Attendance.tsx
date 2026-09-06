import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import AttendanceMarker from '@/components/dashboard/AttendanceMarker'
import { CalendarCheck } from 'lucide-react'

export default function TeacherAttendance() {
  const { activeMembership } = useAuth()
  const { classes } = useData()
  const myClasses = classes.filter((c) => c.teacherId === activeMembership?.teacher_id)

  return (
    <div>
      <PageHeader title="Attendance" description="Mark daily attendance for your assigned classes." />
      {myClasses.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No classes assigned yet" description="You'll be able to mark attendance once a class is assigned to you." />
      ) : (
        <AttendanceMarker classes={myClasses} markedBy={activeMembership?.teacher_id ?? ''} />
      )}
    </div>
  )
}
