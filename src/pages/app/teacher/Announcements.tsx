import { Megaphone } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import AnnouncementBoard from '@/components/dashboard/AnnouncementBoard'

const audienceOptions = [{ value: 'class' as const, label: 'My Class' }]

export default function TeacherAnnouncements() {
  const { profile, activeMembership } = useAuth()
  const { classes, announcements } = useData()
  const myClasses = classes.filter((c) => c.teacherId === activeMembership?.teacher_id)
  const myClassIds = myClasses.map((c) => c.id)

  const visible = announcements.filter(
    (a) => a.audience === 'all' || a.audience === 'teachers' || (a.audience === 'class' && myClassIds.includes(a.classId ?? '')),
  )

  return (
    <div>
      <PageHeader title="Announcements" description="Post updates to your class and stay informed on school-wide news." />
      {myClasses.length === 0 ? (
        <EmptyState icon={Megaphone} title="No classes assigned yet" description="You'll be able to post announcements once a class is assigned to you." />
      ) : (
        <AnnouncementBoard
          audienceOptions={audienceOptions}
          classes={myClasses}
          authorName={profile?.full_name ?? 'Teacher'}
          authorRole="teacher"
          visibleAnnouncements={visible}
          canManage={(a) => a.createdBy === profile?.full_name}
        />
      )}
    </div>
  )
}
