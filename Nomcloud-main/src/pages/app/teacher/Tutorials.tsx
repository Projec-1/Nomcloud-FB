import TutorialsPage, { type TutorialVideo } from '@/components/dashboard/TutorialsPage'

const videos: TutorialVideo[] = [
  { title: 'Marking attendance in under a minute', description: 'The fastest way to mark your class present, late or absent.', duration: '2:10', tint: '#34A853' },
  { title: 'Recording grades', description: 'Enter CATs, exams and assignments so report cards update instantly.', duration: '3:34', tint: '#0071E3' },
  { title: 'Assigning & grading homework', description: 'Create homework and review submissions without leaving the class view.', duration: '3:52', tint: '#A855F7' },
  { title: 'Building your weekly timetable', description: 'Set up your class schedule so everyone knows when lectures happen.', duration: '2:47', tint: '#FF5A1F' },
  { title: 'Messaging parents', description: 'Start a direct, private conversation about a specific student.', duration: '2:15', tint: '#14B8A6' },
]

export default function TeacherTutorials() {
  return (
    <TutorialsPage
      title="Tutorials"
      description="Quick guides for the tools you'll use every day."
      videos={videos}
    />
  )
}
