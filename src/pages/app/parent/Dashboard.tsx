import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, BookOpen, Wallet, ClipboardText as ClipboardCheck, ArrowRight, Users } from '@phosphor-icons/react'
import { useAuth } from '@/context/AuthContext'
import { useSelectedChild } from '@/hooks/useSelectedChild'
import { useAnnouncements } from '@/hooks/useCommunications'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import ChildSwitcher from '@/components/dashboard/ChildSwitcher'
import ResourceGate from '@/components/ui/ResourceGate'
import Badge from '@/components/ui/Badge'
import { formatDate, formatMoney, percentage } from '@/utils/format'
import { DEFAULT_TIME_ZONE } from '@/utils/schoolCalendar'
import {
  fetchChildAttendance,
  fetchChildGrades,
  fetchChildHomework,
  type ChildHomeworkItem,
} from '@/services/teachingRecordsService'
import { fetchChildFeeRecords } from '@/services/financeService'

// Phase 8 batch 8. The parent landing page, on real data throughout.
//
// Every figure here is read through the services batches 5, 6 and 7 built, so
// this screen introduces no new access model. The announcement list in
// particular applies NO audience filter of its own: the prototype included the
// 'students' audience, which migration 14 is explicit is management-only. The
// guardian policies decide readership now.

export default function ParentDashboard() {
  const { profile, school } = useAuth()
  const { children, selectedChild, selectChild, state } = useSelectedChild()
  const { announcements } = useAnnouncements()

  const schoolId = school?.id ?? null
  const timeZone = school?.timezone ?? DEFAULT_TIME_ZONE
  const currency = school?.currency ?? 'USD'

  const [summary, setSummary] = useState<{
    attendanceRate: number | null
    averageGrade: number | null
    balance: number
    pending: ChildHomeworkItem[]
  }>({ attendanceRate: null, averageGrade: null, balance: 0, pending: [] })

  useEffect(() => {
    let cancelled = false
    if (!schoolId || !selectedChild) return

    Promise.all([
      fetchChildAttendance(schoolId, selectedChild.id),
      fetchChildGrades(schoolId, selectedChild.id),
      fetchChildFeeRecords(schoolId, selectedChild.id, timeZone),
      selectedChild.classId
        ? fetchChildHomework(schoolId, selectedChild.classId, selectedChild.id)
        : Promise.resolve([] as ChildHomeworkItem[]),
    ])
      .then(([attendance, grades, fees, homework]) => {
        if (cancelled) return
        const present = attendance.filter((a) => a.status === 'present' || a.status === 'late').length
        const graded = grades.filter((g) => g.maxScore > 0)
        setSummary({
          attendanceRate: attendance.length ? percentage(present, attendance.length) : null,
          averageGrade: graded.length
            ? Math.round(graded.reduce((sum, g) => sum + (g.score / g.maxScore) * 100, 0) / graded.length)
            : null,
          balance: fees.reduce((sum, f) => sum + f.balance, 0),
          pending: homework.filter((h) => h.status === 'pending'),
        })
      })
      .catch(() => {
        // Summary only. The page still renders its shell.
      })

    return () => {
      cancelled = true
    }
  }, [schoolId, selectedChild, timeZone])

  if (!selectedChild) {
    return (
      <div>
        <PageHeader
          title={`Welcome, ${profile?.full_name.split(' ')[0] ?? ''}`}
          description="Your children's information will appear here."
        />
        <ResourceGate
          state={state}
          empty={{
            icon: Users,
            title: 'No children linked to your account yet',
            description: "Contact your school administrator to have your child's record linked to this account.",
          }}
          deniedHint="Child records are available to a linked parent or guardian."
        >
          {() => null}
        </ResourceGate>
      </div>
    )
  }

  const recent = announcements.slice(0, 4)

  return (
    <div>
      <PageHeader
        title={`Welcome, ${profile?.full_name.split(' ')[0] ?? ''}`}
        description={`Here's how ${selectedChild.name.split(' ')[0]} is doing at ${selectedChild.className ?? 'school'}.`}
        actions={
          <ChildSwitcher
            children={children}
            selectedId={selectedChild.id}
            onSelect={selectChild}
            classLabel={(c) => c.className ?? ''}
          />
        }
      />

      <div className="parent-dashboard__stats grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Attendance"
          value={summary.attendanceRate === null ? '—' : `${summary.attendanceRate}%`}
          icon={CalendarCheck}
          tint="#34A853"
        />
        <StatCard
          label="Average Grade"
          value={summary.averageGrade === null ? '—' : `${summary.averageGrade}%`}
          icon={BookOpen}
          tint="#0071E3"
        />
        <StatCard
          label="Fee Balance"
          value={formatMoney(summary.balance, currency)}
          icon={Wallet}
          tint={summary.balance > 0 ? '#F59E0B' : '#34A853'}
        />
        <StatCard label="Pending Homework" value={summary.pending.length} icon={ClipboardCheck} tint="#FF5A1F" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-semibold text-ink dark:text-white">Recent Announcements</h3>
            <Link
              to="/app/parent/announcements"
              className="link-underline flex items-center gap-1 text-xs font-medium text-accent"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-4">
            {recent.length === 0 ? (
              <p className="text-sm text-graphite">No announcements yet.</p>
            ) : (
              recent.map((a) => (
                <div key={a.id} className="border-b border-ink/5 pb-4 last:border-b-0 last:pb-0 dark:border-white/10">
                  <div className="mb-1.5 flex items-center justify-between">
                    <Badge tone={a.priority === 'urgent' ? 'danger' : a.priority === 'important' ? 'warning' : 'neutral'}>
                      {a.priority}
                    </Badge>
                    <span className="text-[11px] text-graphite">{formatDate(a.publishedAt ?? a.createdAt)}</span>
                  </div>
                  <p className="text-sm font-medium text-ink dark:text-white">{a.title}</p>
                  <p className="mt-1 text-xs text-graphite">{a.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="card p-6">
          <h3 className="mb-5 font-semibold text-ink dark:text-white">Upcoming Homework</h3>
          <div className="space-y-4">
            {summary.pending.slice(0, 4).map((h) => (
              <div key={h.id} className="border-b border-ink/5 pb-4 last:border-b-0 last:pb-0 dark:border-white/10">
                <p className="text-sm font-medium text-ink dark:text-white">{h.title}</p>
                <p className="text-xs text-graphite">Due {formatDate(h.dueDate)}</p>
              </div>
            ))}
            {summary.pending.length === 0 && (
              <p className="text-sm text-graphite">All caught up — no pending homework.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
