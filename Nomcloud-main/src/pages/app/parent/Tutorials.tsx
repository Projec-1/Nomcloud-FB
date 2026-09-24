import TutorialsPage, { type TutorialVideo } from '@/components/dashboard/TutorialsPage'

const videos: TutorialVideo[] = [
  { title: 'Getting started with the parent app', description: 'A quick tour of your dashboard, and where to find everything.', duration: '2:30', tint: '#0071E3' },
  { title: 'Switching between your children', description: 'See attendance, grades and homework for each of your children.', duration: '1:45', tint: '#FF5A1F' },
  { title: 'Paying school fees', description: 'Pay by card, mobile money, bank transfer, eDahab or EVC Plus — and keep your receipt.', duration: '3:05', tint: '#34A853' },
  { title: 'Messaging your child\'s teacher', description: 'Start a private conversation directly from any subject or announcement.', duration: '2:00', tint: '#A855F7' },
]

export default function ParentTutorials() {
  return (
    <TutorialsPage
      title="Tutorials"
      description="Everything you need to make the most of Nom Cloud."
      videos={videos}
    />
  )
}
