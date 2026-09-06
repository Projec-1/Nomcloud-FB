import { Link } from 'react-router-dom'
import { CalendarCheck, BookOpen, Wallet, ClipboardCheck, ArrowRight, Users } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useSelectedChild } from '@/hooks/useSelectedChild'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import ChildSwitcher from '@/components/dashboard/ChildSwitcher'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import { schoolDays } from '@/utils/schoolCalendar'
import { formatCurrency, formatDate, percentage } from '@/utils/format'

export default function ParentDashboard() {
  const { profile } = useAuth()
  const { classes, attendance, grades, homework, fees, announcements } = useData()
  const { children, selectedChild, selectChild } = useSelectedChild()

  if (!selectedChild) {
    return (
      <div>
        <PageHeader title={`Welcome, ${profile?.full_name.split(' ')[0]}`} description="Your children's information will appear here." />
        <EmptyState
          icon={Users}
          title="No children linked to your account yet"
          description="Contact your school administrator to have your child's record linked to this account."
        />
      </div>
    )
  }

  const cls = classes.find((c) => c.id === selectedChild.classId)
  const childAttendance = attendance.filter((a) => a.studentId === selectedChild.id && schoolDays.includes(a.date))
  const present = childAttendance.filter((a) => a.status === 'present' || a.status === 'late').length
  const childGrades = grades.filter((g) => g.studentId === selectedChild.id)
  const avgGrade = childGrades.length ? Math.round(childGrades.reduce((sum, g) => sum + g.score, 0) / childGrades.length) : 0
  const childFees = fees.filter((f) => f.studentId === selectedChild.id)
  const balance = childFees.reduce((sum, f) => sum + (f.amount - f.amountPaid), 0)
  const childHomework = homework.filter((h) => h.classId === selectedChild.classId)
  const pendingHomework = childHomework.filter((h) => h.submissions.find((s) => s.studentId === selectedChild.id)?.status === 'pending')

  const relevantAnnouncements = announcements
    .filter((a) => a.audience === 'all' || a.audience === 'parents' || a.audience === 'students' || (a.audience === 'class' && a.classId === selectedChild.classId))
    .slice(0, 4)

  return (
    <div>
      <PageHeader
        title={`Welcome, ${profile?.full_name.split(' ')[0]}`}
        description={`Here's how ${selectedChild.name.split(' ')[0]} is doing at ${cls?.name ?? 'school'}.`}
        actions={<ChildSwitcher children={children} selectedId={selectedChild.id} onSelect={selectChild} classLabel={(c) => classes.find((cl) => cl.id === c.classId)?.name ?? ''} />}
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Attendance" value={childAttendance.length ? `${percentage(present, childAttendance.length)}%` : '—'} icon={CalendarCheck} tint="#34A853" />
        <StatCard label="Average Grade" value={childGrades.length ? `${avgGrade}%` : '—'} icon={BookOpen} tint="#0071E3" />
        <StatCard label="Fee Balance" value={formatCurrency(balance)} icon={Wallet} tint={balance > 0 ? '#F59E0B' : '#34A853'} />
        <StatCard label="Pending Homework" value={pendingHomework.length} icon={ClipboardCheck} tint="#FF5A1F" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-semibold text-ink dark:text-white">Recent Announcements</h3>
            <Link to="/app/parent/announcements" className="link-underline flex items-center gap-1 text-xs font-medium text-accent">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-4">
            {relevantAnnouncements.map((a) => (
              <div key={a.id} className="border-b border-ink/5 pb-4 last:border-b-0 last:pb-0 dark:border-white/10">
                <div className="mb-1.5 flex items-center justify-between">
                  <Badge tone={a.priority === 'urgent' ? 'danger' : a.priority === 'important' ? 'warning' : 'neutral'}>{a.priority}</Badge>
                  <span className="text-[11px] text-graphite">{formatDate(a.date)}</span>
                </div>
                <p className="text-sm font-medium text-ink dark:text-white">{a.title}</p>
                <p className="mt-1 text-xs text-graphite">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-6">
          <h3 className="mb-5 font-semibold text-ink dark:text-white">Upcoming Homework</h3>
          <div className="space-y-4">
            {pendingHomework.slice(0, 4).map((h) => (
              <div key={h.id} className="border-b border-ink/5 pb-4 last:border-b-0 last:pb-0 dark:border-white/10">
                <p className="text-sm font-medium text-ink dark:text-white">{h.title}</p>
                <p className="text-xs text-graphite">Due {formatDate(h.dueDate)}</p>
              </div>
            ))}
            {pendingHomework.length === 0 && <p className="text-sm text-graphite">All caught up — no pending homework.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
