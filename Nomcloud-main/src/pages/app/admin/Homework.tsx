import { BookOpen } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/ui/PageHeader'
import ResourceGate from '@/components/ui/ResourceGate'
import HomeworkBoard from '@/components/dashboard/HomeworkBoard'
import { useRecordableClasses } from '@/hooks/useRecordableClasses'
import { DEFAULT_TIME_ZONE } from '@/utils/schoolCalendar'

// Phase 8 batch 5. Real school-wide classes and real homework.
//
// The prototype passed `createdBy={profile?.full_name}` — a person's NAME into
// homework.created_by, which is a uuid foreign key to profiles. Attribution now
// comes from the live session inside the service, which is also the only value
// auth.uid() can match.

export default function AdminHomework() {
  const { school } = useAuth()
  const { state, classes, schoolId } = useRecordableClasses()

  return (
    <div>
      <PageHeader title="Homework" description="Assign and track homework completion across every class." />
      <ResourceGate
        state={state}
        empty={{
          icon: BookOpen,
          title: 'No classes yet',
          description: 'Create a class and enrol students before assigning homework.',
        }}
        deniedHint="Homework is available to school staff."
      >
        {(visibleClasses) => (
          <HomeworkBoard
            classes={visibleClasses}
            schoolId={schoolId as string}
            timeZone={school?.timezone ?? DEFAULT_TIME_ZONE}
          />
        )}
      </ResourceGate>
    </div>
  )
}
