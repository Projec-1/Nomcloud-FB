import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/ui/PageHeader'
import AnnouncementBoard from '@/components/dashboard/AnnouncementBoard'

const audienceOptions = [
  { value: 'all' as const, label: 'Entire School' },
  { value: 'teachers' as const, label: 'All Teachers' },
  { value: 'parents' as const, label: 'All Parents' },
  { value: 'students' as const, label: 'All Students' },
  { value: 'class' as const, label: 'Specific Class' },
]

export default function AdminAnnouncements() {
  const { classes, announcements } = useData()
  const { profile } = useAuth()

  return (
    <div>
      <PageHeader title="Announcements" description="Reach the whole school, specific groups, or a single class." />
      <AnnouncementBoard
        audienceOptions={audienceOptions}
        classes={classes}
        authorName={profile?.full_name ?? 'School Administration'}
        authorRole="admin"
        visibleAnnouncements={announcements}
      />
    </div>
  )
}
