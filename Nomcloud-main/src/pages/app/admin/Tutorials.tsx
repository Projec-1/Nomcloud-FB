import TutorialsPage, { type TutorialVideo } from '@/components/dashboard/TutorialsPage'

const videos: TutorialVideo[] = [
  { title: 'Setting up your school', description: 'Configure academic years, terms and school branding in your first 10 minutes.', duration: '4:12', tint: '#0071E3' },
  { title: 'Enrolling students & assigning classes', description: 'Add students individually or in bulk, and organize them into classes.', duration: '6:03', tint: '#FF5A1F' },
  { title: 'Managing teachers & permissions', description: 'Invite teaching staff and assign them to the right classes.', duration: '3:45', tint: '#34A853' },
  { title: 'Fees & payment reminders', description: 'Track collections, record payments, and message unpaid parents.', duration: '5:20', tint: '#A855F7' },
  { title: 'Announcements that get read', description: 'Target the right audience and priority for every message.', duration: '2:58', tint: '#14B8A6' },
  { title: 'Reading your reports', description: 'Understand attendance, academic and financial reports at a glance.', duration: '4:40', tint: '#EC4899' },
]

export default function AdminTutorials() {
  return (
    <TutorialsPage
      title="Tutorials"
      description="Short walkthroughs to help you get the most out of Nom Cloud."
      videos={videos}
    />
  )
}
