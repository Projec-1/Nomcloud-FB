import { Pulse as Activity } from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import AccessDenied from '@/components/ui/AccessDenied'
import EmptyState from '@/components/ui/EmptyState'
import { useAuth } from '@/context/AuthContext'

// ---------------------------------------------------------------------------
// Teacher activity — not available yet, and honest about it.
//
// This page used to show a feed of teacher actions with times, classes and
// counts, all of it invented. There is no data source for it: the audit_logs
// table exists and has exactly the right shape for this, but nothing writes to
// it, so it holds no rows. Deriving a feed from attendance, grade and homework
// timestamps instead is a real possibility but a design decision, not wiring.
//
// Rather than keep a page that looks functional and reports figures no school
// could act on, it states plainly that the feature is not ready. The route and
// the navigation entry stay, so the work can continue here later.
// ---------------------------------------------------------------------------

export default function AdminTeacherActivity() {
  const { activeRole } = useAuth()

  if (activeRole !== 'admin') {
    return <AccessDenied hint="Teacher activity is available to school management." />
  }

  return (
    <div>
      <PageHeader
        title="Teacher Activity"
        description="What your teaching staff have been doing across the school."
      />
      <EmptyState
        icon={Activity}
        title="Teacher activity is not available yet"
        description="Nom Cloud does not record a teacher activity history yet, so there is nothing to show here. Attendance, grades, homework and announcements are all live on their own pages, and each one already shows who recorded it and when."
      />
    </div>
  )
}
