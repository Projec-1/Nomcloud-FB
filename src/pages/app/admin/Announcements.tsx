import { Megaphone } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import ResourceGate from '@/components/ui/ResourceGate'
import AnnouncementBoard from '@/components/dashboard/AnnouncementBoard'
import { useAnnouncements } from '@/hooks/useCommunications'
import { useRecordableClasses } from '@/hooks/useRecordableClasses'
import type { AnnouncementAudience } from '@/services/communicationService'

// Phase 8 batch 7. Real announcements for management.
//
// All five audiences are offered here, because announcements_admin_insert keys
// on has_school_admin_role and admits any audience. The class list comes from
// real classes so a class notice carries a real class_id, which the
// audience/class CHECK requires in both directions.

const audienceOptions: { value: AnnouncementAudience; label: string }[] = [
  { value: 'all', label: 'Entire School' },
  { value: 'teachers', label: 'All Teachers' },
  { value: 'parents', label: 'All Parents' },
  { value: 'students', label: 'All Students' },
  { value: 'class', label: 'Specific Class' },
]

export default function AdminAnnouncements() {
  const { state, canManage, schoolId, reload } = useAnnouncements()
  const { classes } = useRecordableClasses()

  return (
    <div>
      <PageHeader title="Announcements" description="Reach the whole school, specific groups, or a single class." />
      <ResourceGate
        state={state}
        empty={{
          icon: Megaphone,
          title: 'No announcements yet',
          description: 'Publish your first announcement to reach the school.',
        }}
        deniedHint="Announcements are available to school members."
      >
        {(rows) => (
          <AnnouncementBoard
            announcements={rows}
            classes={classes}
            schoolId={schoolId as string}
            canManage={canManage}
            audienceOptions={audienceOptions}
            onChanged={reload}
          />
        )}
      </ResourceGate>
    </div>
  )
}
