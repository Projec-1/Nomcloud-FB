import { Megaphone } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import ResourceGate from '@/components/ui/ResourceGate'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import { useData } from '@/context/DataContext'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import AnnouncementBoard from '@/components/dashboard/AnnouncementBoard'

const audienceOptions = [{ value: 'class' as const, label: 'My Class' }]

export default function TeacherAnnouncements() {
  const { profile, activeMembership } = useAuth()
  const { announcements } = useData()
  const { state, classes: myClasses } = useTeacherClasses()
  const myClassIds = myClasses.map((c) => c.id)

  const visible = announcements.filter(
    (a) => a.audience === 'all' || a.audience === 'teachers' || (a.audience === 'class' && myClassIds.includes(a.classId ?? '')),
  )

  return (
    <div>
      <PageHeader title="Announcements" description="Post updates to your class and stay informed on school-wide news." />
      {<ResourceGate
          state={state}
          empty={{ icon: Megaphone, title: "No classes assigned yet", description: "You'll be able to post announcements once a class is assigned to you." }}
          deniedHint="Class records are available to an assigned teacher."
        >
          {() => <AnnouncementBoard
          audienceOptions={audienceOptions}
          classes={myClasses}
          authorName={profile?.full_name ?? 'Teacher'}
          authorRole="teacher"
          visibleAnnouncements={visible}
          canManage={(a) => a.createdBy === profile?.full_name}
        />}
        </ResourceGate>}
    </div>
  )
}
