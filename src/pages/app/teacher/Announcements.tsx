import { Megaphone } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import ResourceGate from '@/components/ui/ResourceGate'
import AnnouncementBoard from '@/components/dashboard/AnnouncementBoard'
import { useAnnouncements } from '@/hooks/useCommunications'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'

// Phase 8 batch 7. Real announcements, READ ONLY for a teacher.
//
// THIS CLOSES HALF OF OPEN DECISION 6. A teacher cannot publish an announcement
// of any audience: announcements has exactly two INSERT policies, one keyed on
// has_school_admin_role and one on can_manage_class, and a teacher satisfies
// neither, because can_manage_class covers management rather than teaching
// staff.
//
// The prototype's page was titled "Post updates to your class" and offered a
// compose control the database would have refused. The control is gone and the
// description now matches what the screen can do. Widening this later is one
// INSERT policy keyed on teaches_class, which is a product decision rather than
// a gap.
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
            audienceOptions={[]}
            onChanged={reload}
          />
        )}
      </ResourceGate>
    </div>
  )
}
