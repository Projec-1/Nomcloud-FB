import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, GraduationCap, CalendarCheck, Wallet, ArrowRight, Plus, Megaphone, BookOpen, ArrowUpRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import ResourceGate from '@/components/ui/ResourceGate'
import { useRecordableClasses } from '@/hooks/useRecordableClasses'
import { useAnnouncements } from '@/hooks/useCommunications'
import { useFinance } from '@/hooks/useFinance'
import { fetchSchoolStudents } from '@/services/studentService'
import { fetchSchoolTeachers } from '@/services/teacherService'
import { fetchAttendance } from '@/services/teachingRecordsService'
import { formatDate, formatMoney, percentage } from '@/utils/format'
import { todayInTimeZone, DEFAULT_TIME_ZONE } from '@/utils/schoolCalendar'

// ---------------------------------------------------------------------------
// Phase 8 batch 8. The management landing page, on real data throughout.
//
// THE THREE QUICK-ACTION FORMS ARE NOW LINKS. The prototype embedded miniature
// add-a-student, add-a-teacher and post-an-announcement forms here, each a
// simplified duplicate of the dedicated page's form. Against the real schema
// those shortcuts were actively misleading: the student one invented an
// admission number with Math.random and enrolled without an academic year, and
// neither could express the relations the real tables need. They are links to
// the pages that do it properly, which is one extra click and no duplicated
// write path.
//
// THE ATTENDANCE SPARKLINE IS GONE for the same reason as on the teacher
// dashboard: it plotted a fixed mock week, and reproducing it honestly means one
// query per day, which is a lot of round trips for decoration. Today's rate is
// real and carries the same message.
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const { profile, school } = useAuth()
  const { state, classes } = useRecordableClasses()
  const { announcements } = useAnnouncements()
  const { records: fees, canManageFinance } = useFinance()

  const schoolId = school?.id ?? null
  const timeZone = school?.timezone ?? DEFAULT_TIME_ZONE
  const currency = school?.currency ?? 'USD'
  const today = todayInTimeZone(timeZone)

  const [counts, setCounts] = useState({ students: 0, teachers: 0 })
  const [attendanceToday, setAttendanceToday] = useState<{ present: number; marked: number }>({ present: 0, marked: 0 })
  const [rateByClass, setRateByClass] = useState<Map<string, number | null>>(new Map())

  useEffect(() => {
    let cancelled = false
    if (!schoolId) return
    Promise.all([fetchSchoolStudents(schoolId), fetchSchoolTeachers(schoolId)])
      .then(([students, teachers]) => {
        if (!cancelled) setCounts({ students: students.length, teachers: teachers.length })
      })
      .catch(() => {
        // Counts only.
      })
    return () => {
      cancelled = true
    }
  }, [schoolId])

  useEffect(() => {
    let cancelled = false
    if (!schoolId || classes.length === 0) return
    Promise.all(classes.map((c) => fetchAttendance(schoolId, c.id, today)))
      .then((maps) => {
        if (cancelled) return
        let present = 0
        let marked = 0
        const byClass = new Map<string, number | null>()
        maps.forEach((map, i) => {
          let p = 0
          for (const e of map.values()) {
            if (e.status === 'present' || e.status === 'late') p += 1
          }
          present += p
          marked += map.size
          byClass.set(classes[i].id, map.size ? percentage(p, map.size) : null)
        })
        setAttendanceToday({ present, marked })
        setRateByClass(byClass)
      })
      .catch(() => {
        // Today's rate only.
      })
    return () => {
      cancelled = true
    }
  }, [schoolId, classes, today])

  const collected = useMemo(() => fees.reduce((sum, f) => sum + f.amountPaid, 0), [fees])
  const outstanding = useMemo(() => fees.reduce((sum, f) => sum + f.balance, 0), [fees])

  // The four-state contract. loading, denied and error render through
  // ResourceGate exactly as every other connected screen does; `denied` comes
  // from the caller's role via the classes hook, never from a row count. The
  // `ready` and `empty` cases fall through to the page below, which already
  // handles a school with no classes.
  if (state.status === 'loading' || state.status === 'denied' || state.status === 'error') {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <ResourceGate state={state} empty={{ title: '' }} deniedHint="The school dashboard is available to school staff.">
          {() => null}
        </ResourceGate>
      </div>
    )
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard__hero">
        <PageHeader
          title={`Welcome, ${profile?.full_name.split(' ')[0] ?? ''}`}
          description={`Today at ${school?.name ?? 'your school'}.`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link to="/app/admin/students" className="btn-outline px-4 py-2 text-sm">
                <Plus className="h-4 w-4" /> Student
              </Link>
              <Link to="/app/admin/announcements" className="btn-accent px-4 py-2 text-sm">
                <Megaphone className="h-4 w-4" /> Announce
              </Link>
            </div>
          }
        />
      </div>

      <div className="admin-dashboard__stats grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminInsightCard label="Students" value={counts.students} icon={Users} tone="orange" caption="Registered learners" chart="line" />
        <AdminInsightCard label="Teachers" value={counts.teachers} icon={GraduationCap} tone="blue" caption="Teaching staff" chart="curve" />
        <AdminInsightCard
          label="Present Today"
          value={attendanceToday.marked > 0 ? `${percentage(attendanceToday.present, attendanceToday.marked)}%` : '—'}
          icon={CalendarCheck}
          tone="green"
          caption={attendanceToday.marked > 0 ? `${attendanceToday.present} of ${attendanceToday.marked} marked present` : 'Attendance not marked yet'}
          chart="ring"
        />
        <AdminInsightCard
          label={canManageFinance ? 'Fees Outstanding' : 'Classes'}
          value={canManageFinance ? formatMoney(outstanding, currency) : classes.length}
          icon={canManageFinance ? Wallet : BookOpen}
          tone="brown"
          caption={canManageFinance ? 'Current balance' : 'Active classes'}
          chart="bars"
        />
      </div>

      {canManageFinance && (
        <p className="mt-3 text-xs text-graphite">
          {formatMoney(collected, currency)} collected so far this term.
        </p>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="admin-dashboard__panel card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-ink dark:text-white">Classes</h3>
            <Link to="/app/admin/classes" className="link-underline flex items-center gap-1 text-xs font-medium text-accent">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {classes.length === 0 ? (
            <EmptyState icon={BookOpen} title="No classes yet" description="Create a class to begin." />
          ) : (
            <div className="space-y-3">
              {classes.slice(0, 6).map((c) => {
                const rate = rateByClass.get(c.id)
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-ink/5 px-4 py-3 dark:border-white/10"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink dark:text-white">{c.name}</p>
                      <p className="text-xs text-graphite">
                        {c.studentIds.length} students · {c.room ?? 'No room set'}
                      </p>
                    </div>
                    <Badge tone={rate === null || rate === undefined ? 'neutral' : rate >= 90 ? 'success' : rate >= 75 ? 'warning' : 'danger'}>
                      {rate === null || rate === undefined ? 'Not marked' : `${rate}% present`}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="admin-dashboard__panel card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-ink dark:text-white">Announcements</h3>
            <Link
              to="/app/admin/announcements"
              className="link-underline flex items-center gap-1 text-xs font-medium text-accent"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-4">
            {announcements.length === 0 ? (
              <p className="text-sm text-graphite">Nothing published yet.</p>
            ) : (
              announcements.slice(0, 4).map((a) => (
                <div key={a.id} className="border-b border-ink/5 pb-4 last:border-b-0 last:pb-0 dark:border-white/10">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <Badge tone={a.priority === 'urgent' ? 'danger' : a.priority === 'important' ? 'warning' : 'neutral'}>
                      {a.priority}
                    </Badge>
                    <span className="text-[11px] text-graphite">{formatDate(a.publishedAt ?? a.createdAt)}</span>
                  </div>
                  <p className="text-sm font-medium text-ink dark:text-white">{a.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-graphite">{a.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminInsightCard({
  label,
  value,
  icon: Icon,
  tone,
  caption,
  chart,
}: {
  label: string
  value: string | number
  icon: typeof Users
  tone: 'orange' | 'blue' | 'green' | 'brown'
  caption: string
  chart: 'line' | 'curve' | 'ring' | 'bars'
}) {
  return (
    <div className={`admin-insight-card admin-insight-card--${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="admin-insight-card__icon"><Icon className="h-4 w-4" /></span>
          <p className="text-sm font-semibold text-ink dark:text-white">{label}</p>
        </div>
        <span className="admin-insight-card__period">Today <span aria-hidden>⌄</span></span>
      </div>
      <p className="admin-insight-card__label">{label === 'Present Today' ? 'Attendance rate' : label === 'Fees Outstanding' ? 'Outstanding balance' : `Total ${label.toLowerCase()}`}</p>
      <p className="admin-insight-card__value">{value}</p>
      <div className="admin-insight-card__chart" aria-hidden="true">
        {chart === 'line' && <svg viewBox="0 0 220 58" preserveAspectRatio="none"><path d="M0 48 L42 38 L78 40 L112 20 L146 28 L180 12 L220 20" /></svg>}
        {chart === 'curve' && <svg viewBox="0 0 220 58" preserveAspectRatio="none"><path d="M0 45 C35 58, 42 52, 72 42 S108 4, 132 20 S172 52, 220 16" /></svg>}
        {chart === 'ring' && <span className="admin-insight-card__ring" />}
        {chart === 'bars' && <div className="admin-insight-card__bars"><i /><i /><i /><i /><i /><i /><i /></div>}
      </div>
      <p className="mt-3 text-xs text-graphite">{caption}</p>
      <span className="admin-insight-card__arrow"><ArrowUpRight className="h-3.5 w-3.5" /></span>
    </div>
  )
}
