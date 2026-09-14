import { CalendarCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/ui/PageHeader'
import ResourceGate from '@/components/ui/ResourceGate'
import AttendanceMarker from '@/components/dashboard/AttendanceMarker'
import { useRecordableClasses } from '@/hooks/useRecordableClasses'
import { DEFAULT_TIME_ZONE } from '@/utils/schoolCalendar'

// Phase 8 batch 5. Real school-wide classes, replacing the mock `classes` array
// whose ids were 'c1'..'c6'. Those ids were never going to satisfy the composite
// foreign key on attendance_records, so every save from this page would have
// failed once the write path became real.

export default function AdminAttendance() {
  const { school } = useAuth()
  const { state, classes, schoolId } = useRecordableClasses()

  return (
    <div>
      <PageHeader title="Attendance" description="Mark or review attendance for any class across the school." />
      <ResourceGate
        state={state}
        empty={{
          icon: CalendarCheck,
          title: 'No classes yet',
          description: 'Create a class and enrol students to begin marking attendance.',
        }}
        deniedHint="Attendance records are available to school staff."
      >
        {(visibleClasses) => (
          <AttendanceMarker
            classes={visibleClasses}
            schoolId={schoolId as string}
            timeZone={school?.timezone ?? DEFAULT_TIME_ZONE}
          />
        )}
      </ResourceGate>
    </div>
  )
}
