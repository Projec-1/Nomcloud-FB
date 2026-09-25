import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, ArrowRight, Clock, ArrowUpRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import ResourceGate from '@/components/ui/ResourceGate'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import { isoDayOfWeek, todayInTimeZone, DEFAULT_TIME_ZONE } from '@/utils/schoolCalendar'
import { formatDate, percentage } from '@/utils/format'
import { fetchRosterStudents, type RosterStudent } from '@/services/studentService'
import { fetchAttendance, fetchHomework, type HomeworkView } from '@/services/teachingRecordsService'

// ---------------------------------------------------------------------------
// Phase 8 batch 8. The teacher landing page, on real data throughout.
//
// The prototype counted attendance and homework over a hardcoded `schoolDays`
// week from the mock seed. Both now come from the real tables, and "today" is
// the school's today rather than the browser's, which batch 0 established after
// proving a UTC date reports the wrong day for Mogadishu after 21:00 local.
//
// The message count is real participation, not a mock filter comparing a
// teachers.id against thread participant ids. A teacher sees the threads they
// are actually in.
//
// The attendance sparkline is gone. It plotted a fixed mock week, and rebuilding
// it against real data means one query per day per class for a decorative
// element. "Present today" carries the same information honestly.
// ---------------------------------------------------------------------------

export default function TeacherDashboard() {
  const { profile, school } = useAuth()
  const { state, classes: myClasses, timetable: timetables } = useTeacherClasses()
  const [studentsModalOpen, setStudentsModalOpen] = useState(false)

  const schoolId = school?.id ?? null
  const timeZone = school?.timezone ?? DEFAULT_TIME_ZONE
  const today = todayInTimeZone(timeZone)

  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [homework, setHomework] = useState<HomeworkView[]>([])
  const [todayPresent, setTodayPresent] = useState<{ present: number; marked: number } | null>(null)

  const myClassIds = useMemo(() => myClasses.map((c) => c.id), [myClasses])
  const classNameById = useMemo(() => new Map(myClasses.map((c) => [c.id, c.name])), [myClasses])

  useEffect(() => {
    let cancelled = false
    if (!schoolId || myClasses.length === 0) return

    const studentIds = Array.from(new Set(myClasses.flatMap((c) => c.studentIds)))

    Promise.all([
      fetchRosterStudents(schoolId, studentIds),
      fetchHomework(schoolId, myClassIds),
      Promise.all(myClasses.map((c) => fetchAttendance(schoolId, c.id, today))),
    ])
      .then(([students, hw, attendanceByClass]) => {
        if (cancelled) return
        setRoster(students)
        setHomework(hw)
        let present = 0
        let marked = 0
        for (const map of attendanceByClass) {
          for (const entry of map.values()) {
            marked += 1
            if (entry.status === 'present' || entry.status === 'late') present += 1
          }
        }
        setTodayPresent({ present, marked })
      })
      .catch(() => {
        // Summary figures only. The shell still renders.
      })

    return () => {
      cancelled = true
    }
  }, [schoolId, myClasses, myClassIds, today])

  // A student with no submission row is pending, the same rule the homework
  // board uses. Absence means pending because nothing creates those rows.
  const pendingByStudent = useMemo(() => {
    const counts = new Map<string, number>()
    for (const hw of homework) {
      const submitted = new Set(
        hw.submissions.filter((s) => s.status !== 'pending').map((s) => s.studentId),
      )
      const cls = myClasses.find((c) => c.id === hw.classId)
      for (const studentId of cls?.studentIds ?? []) {
        if (!submitted.has(studentId)) counts.set(studentId, (counts.get(studentId) ?? 0) + 1)
      }
    }
    return counts
  }, [homework, myClasses])

  const pendingTotal = Array.from(pendingByStudent.values()).reduce((a, b) => a + b, 0)

  // Is there a lecture in progress? ISO 1-7 computed in the school's timezone,
  // matching timetable_slots.day_of_week.
  const now = new Date()
  const todayIso = isoDayOfWeek(now, timeZone)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const todaySlots = timetables.filter((t) => t.day === todayIso)
  const liveSlot = todaySlots.find(
    (t) => currentMinutes >= toMinutes(t.startTime) && currentMinutes < toMinutes(t.endTime),
  )
  const nextSlot = todaySlots
    .filter((t) => toMinutes(t.startTime) > currentMinutes)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))[0]

  // The four-state contract. loading, denied and error render through
  // ResourceGate exactly as every other connected screen does; `denied` comes
  // from the caller's role via the classes hook, never from a row count. The
  // `ready` and `empty` cases fall through to the page below, which already
  // handles a school with no classes.
  if (state.status === 'loading' || state.status === 'denied' || state.status === 'error') {
    return (
      <div className="teacher-dashboard">
        <PageHeader title="Dashboard" />
        <ResourceGate state={state} empty={{ title: '' }} deniedHint="The teacher workspace is available to teaching staff.">
          {() => null}
        </ResourceGate>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${profile?.full_name.split(' ')[0] ?? ''}`}
        description={
          myClasses.length
            ? `You're teaching ${myClasses.length} class${myClasses.length === 1 ? '' : 'es'} this term.`
            : 'No classes assigned yet.'
        }
      />

      <div className="teacher-insights grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button type="button" aria-label="View my students" onClick={() => setStudentsModalOpen(true)} className="w-full text-left">
          <TeacherInsightCard
            label="My Students"
            metricLabel="Students in your classes"
            value={roster.length}
            tone="orange"
            caption="Students assigned across your active classes."
            chart="line"
          />
        </button>
        <TeacherInsightCard
          label="Attendance"
          metricLabel="Present today"
          value={todayPresent && todayPresent.marked > 0 ? `${percentage(todayPresent.present, todayPresent.marked)}%` : '—'}
          tone="blue"
          caption={todayPresent?.marked ? `${todayPresent.present} of ${todayPresent.marked} students marked present.` : 'Attendance has not been marked yet.'}
          chart="curve"
        />
        <TeacherInsightCard
          label="Homework"
          metricLabel="Pending submissions"
          value={pendingTotal}
          tone="green"
          caption={pendingTotal ? 'Follow up with students who still have work to submit.' : 'All student submissions are up to date.'}
          chart="ring"
        />
      </div>

      {myClasses.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Users}
            title="No classes assigned yet"
            description="Once a school administrator assigns you to a class, it will appear here along with your students."
          />
        </div>
      ) : (
        <>
          <div className="teacher-dashboard__status card mt-6 p-5">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                  liveSlot ? 'bg-emerald-500/10 text-emerald-600' : 'bg-ink/5 text-graphite dark:bg-white/10'
                }`}
              >
                <Clock className="h-4 w-4" />
              </span>
              <div>
                {liveSlot ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-600">You have a lecture right now</p>
                    <p className="text-xs text-graphite">
                      {liveSlot.subject} · {classNameById.get(liveSlot.classId)} · {liveSlot.room} · until{' '}
                      {liveSlot.endTime}
                    </p>
                  </>
                ) : nextSlot ? (
                  <>
                    <p className="text-sm font-semibold text-ink dark:text-white">No lecture right now</p>
                    <p className="text-xs text-graphite">
                      Next: {nextSlot.subject} · {classNameById.get(nextSlot.classId)} at {nextSlot.startTime}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-ink dark:text-white">No lecture right now</p>
                    <p className="text-xs text-graphite">Nothing further scheduled for today.</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="teacher-dashboard__panels mt-6 grid gap-6 lg:grid-cols-3">
            <div className="teacher-dashboard__panel card p-6 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-ink dark:text-white">My Classes</h3>
                <Link
                  to="/app/teacher/classes"
                  className="link-underline flex items-center gap-1 text-xs font-medium text-accent"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-3">
                {myClasses.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-ink/5 px-4 py-3 dark:border-white/10"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink dark:text-white">{c.name}</p>
                      <p className="text-xs text-graphite">{c.room ?? 'No room set'}</p>
                    </div>
                    <Badge tone="neutral">
                      {c.studentIds.length}
                      {c.capacity ? `/${c.capacity}` : ''} students
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            <div className="teacher-dashboard__panel card p-6">
              <h3 className="mb-3 font-semibold text-ink dark:text-white">Upcoming Homework</h3>
              <div className="space-y-3">
                {homework.slice(0, 5).map((h) => (
                  <div key={h.id} className="border-b border-ink/5 pb-3 last:border-b-0 last:pb-0 dark:border-white/10">
                    <p className="text-sm font-medium text-ink dark:text-white">{h.title}</p>
                    <p className="text-xs text-graphite">
                      {h.subjectName} · due {formatDate(h.dueDate)}
                    </p>
                  </div>
                ))}
                {homework.length === 0 && <p className="text-sm text-graphite">No homework assigned yet.</p>}
              </div>
            </div>
          </div>
        </>
      )}

      <Modal
        open={studentsModalOpen}
        onClose={() => setStudentsModalOpen(false)}
        title="My Students"
        description={`${roster.length} students across your classes`}
        size="lg"
      >
        <div className="space-y-2">
          {roster.map((s) => {
            const pending = pendingByStudent.get(s.id) ?? 0
            return (
              <div key={s.id} className="flex items-center justify-between rounded-xl bg-mist px-4 py-3 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} color={s.avatarColor} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-ink dark:text-white">{s.name}</p>
                    <p className="text-xs text-graphite">{s.admissionNo}</p>
                  </div>
                </div>
                {pending > 0 ? (
                  <Badge tone="warning">{pending} pending homework</Badge>
                ) : (
                  <Badge tone="success">Up to date</Badge>
                )}
              </div>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}

function TeacherInsightCard({
  label,
  metricLabel,
  value,
  tone,
  caption,
  chart,
}: {
  label: string
  metricLabel: string
  value: string | number
  tone: 'orange' | 'blue' | 'green'
  caption: string
  chart: 'line' | 'curve' | 'ring'
}) {
  return (
    <div className={`teacher-insight-card teacher-insight-card--${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink dark:text-white">{label}</p>
        <span className="teacher-insight-card__period">Weekly <span aria-hidden>⌄</span></span>
      </div>
      <p className="teacher-insight-card__label">{metricLabel}</p>
      <p className="teacher-insight-card__value">{value}</p>
      <div className="teacher-insight-card__chart" aria-hidden="true">
        {chart === 'line' && (
          <svg viewBox="0 0 220 72" preserveAspectRatio="none">
            <path className="teacher-insight-card__area" d="M0 60 L42 42 L78 42 L112 25 L145 25 L180 25 L220 25 L220 72 L0 72 Z" />
            <path d="M0 60 L42 42 L78 42 L112 25 L145 25 L180 25 L220 25" />
            <circle cx="220" cy="25" r="3.5" />
          </svg>
        )}
        {chart === 'curve' && (
          <svg viewBox="0 0 220 72" preserveAspectRatio="none">
            <path className="teacher-insight-card__area" d="M0 60 C30 50 42 68 70 52 S105 8 130 22 S170 64 220 28 L220 72 L0 72 Z" />
            <path d="M0 60 C30 50 42 68 70 52 S105 8 130 22 S170 64 220 28" />
            <circle cx="130" cy="22" r="7" />
          </svg>
        )}
        {chart === 'ring' && <span className="teacher-insight-card__ring" />}
      </div>
      <p className="teacher-insight-card__caption">{caption}</p>
      <span className="teacher-insight-card__arrow"><ArrowUpRight className="h-3.5 w-3.5" /></span>
    </div>
  )
}
