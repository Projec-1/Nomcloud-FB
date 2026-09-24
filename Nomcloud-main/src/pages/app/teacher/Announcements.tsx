import { Megaphone } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import ResourceGate from '@/components/ui/ResourceGate'
import AnnouncementBoard from '@/components/dashboard/AnnouncementBoard'
import { useAnnouncements } from '@/hooks/useCommunications'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'

// Teachers can publish announcements for classes they actually teach.
//
// What a teacher DOES see is decided server-side: 'all', 'teachers', and class
// notices for classes they teach. This page applies no audience filter of its
// own, because restating that matrix client-side is how it drifts.

export default function TeacherAnnouncements() {
  const { state, schoolId, reload } = useAnnouncements()
  const { classes: myClasses } = useTeacherClasses()

  return (
    <div>
      <PageHeader title="Announcements" description="School news and updates relevant to you and your classes." />
      <ResourceGate
        state={state}
        empty={{
          icon: Megaphone,
          title: 'No announcements yet',
          description: 'School news relevant to you will appear here.',
        }}
        deniedHint="Announcements are available to school members."
      >
        {(rows) => (
          <AnnouncementBoard
            announcements={rows}
            classes={myClasses}
            schoolId={schoolId as string}
            canManage={false}
            canPublish={myClasses.length > 0}
            audienceOptions={[{ value: 'class', label: 'Specific Class' }]}
            onChanged={reload}
          />
        )}
      </ResourceGate>
    </div>
  )
}
