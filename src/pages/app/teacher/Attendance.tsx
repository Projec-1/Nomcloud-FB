import { useAuth } from '@/context/AuthContext'
import ResourceGate from '@/components/ui/ResourceGate'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import AttendanceMarker from '@/components/dashboard/AttendanceMarker'
import { CalendarCheck } from 'lucide-react'

export default function TeacherAttendance() {
  const { activeMembership } = useAuth()
  const { state, classes: myClasses } = useTeacherClasses()

  return (
    <div>
      <PageHeader title="Attendance" description="Mark daily attendance for your assigned classes." />
      {<ResourceGate
          state={state}
          empty={{ icon: CalendarCheck, title: "No classes assigned yet", description: "You'll be able to mark attendance once a class is assigned to you." }}
          deniedHint="Class records are available to an assigned teacher."
        >
          {() => <AttendanceMarker classes={myClasses} markedBy={activeMembership?.teacher_id ?? ''} />}
        </ResourceGate>}
    </div>
  )
}
