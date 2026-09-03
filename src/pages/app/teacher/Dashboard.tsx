import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, CalendarCheck, ClipboardCheck, MessageSquare, ArrowRight, TrendingUp, Clock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import Avatar from '@/components/ui/Avatar'
import { WEEKDAYS } from '@/components/dashboard/TimetableGrid'
import { schoolDays } from '@/utils/schoolCalendar'
import { formatDate, percentage } from '@/utils/format'
import type { Weekday } from '@/types'

export default function TeacherDashboard() {
  const { currentUser } = useAuth()
  const { classes, students, attendance, homework, messageThreads, timetables } = useData()
  const [studentsModalOpen, setStudentsModalOpen] = useState(false)

  const myClasses = classes.filter((c) => c.teacherId === currentUser?.teacherId)
  const myClassIds = myClasses.map((c) => c.id)
  const myStudentIds = myClasses.flatMap((c) => c.studentIds)
  const latestDay = schoolDays[schoolDays.length - 1]
  const todayAttendance = attendance.filter((a) => myClassIds.includes(a.classId) && a.date === latestDay)
  const presentCount = todayAttendance.filter((a) => a.status === 'present' || a.status === 'late').length
  const myHomework = homework.filter((h) => myClassIds.includes(h.classId))
  const pendingSubmissions = myHomework.reduce((sum, h) => sum + h.submissions.filter((s) => s.status === 'pending').length, 0)
  const myThreads = messageThreads.filter((t) => t.participantIds.includes(currentUser?.teacherId ?? ''))

  // Weekly homework load — assignments due each of the last 7 school days.
  const weeklyHomework = useMemo(
    () => schoolDays.slice(-7).map((day) => ({ day, count: myHomework.filter((h) => h.dueDate === day).length })),
    [schoolDays, myHomework],
  )

  const attendanceTrend = useMemo(
    () =>
      schoolDays.map((day) => {
        const records = attendance.filter((a) => myClassIds.includes(a.classId) && a.date === day)
        const present = records.filter((a) => a.status === 'present' || a.status === 'late').length
        return records.length ? percentage(present, records.length) : 0
      }),
    [attendance, myClassIds],
  )
  const trendPath = attendanceTrend
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * (240 / (attendanceTrend.length - 1))).toFixed(1)} ${(56 - (v / 100) * 56).toFixed(1)}`)
    .join(' ')

  const studentsWithPending = useMemo(
    () =>
      students
        .filter((s) => myStudentIds.includes(s.id))
        .map((s) => {
          const pending = myHomework.reduce(
            (sum, h) => sum + h.submissions.filter((sub) => sub.studentId === s.id && sub.status === 'pending').length,
            0,
          )
          return { ...s, pending }
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [students, myStudentIds, myHomework],
  )

  // "Right now" — is there a lecture in progress for one of this teacher's classes?
  const now = new Date()
  const todayName = WEEKDAYS[now.getDay() - 1] as Weekday | undefined
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const liveSlot = todayName
    ? timetables.find(
        (t) =>
          myClassIds.includes(t.classId) &&
          t.day === todayName &&
          currentMinutes >= toMinutes(t.startTime) &&
          currentMinutes < toMinutes(t.endTime),
      )
    : undefined
  const nextSlot = todayName
    ? timetables
        .filter((t) => myClassIds.includes(t.classId) && t.day === todayName && toMinutes(t.startTime) > currentMinutes)
        .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))[0]
    : undefined

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${currentUser?.name.split(' ')[0]}`}
        description={myClasses.length ? `You're teaching ${myClasses.length} class${myClasses.length === 1 ? '' : 'es'} this term.` : 'No classes assigned yet.'}
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <button onClick={() => setStudentsModalOpen(true)} className="w-full text-left">
          <StatCard label="My Students" value={myStudentIds.length} icon={Users} tint="#0071E3" />
        </button>
        <StatCard label="Present Today" value={todayAttendance.length ? `${percentage(presentCount, todayAttendance.length)}%` : '—'} icon={CalendarCheck} tint="#34A853" />
        <StatCard label="Pending Homework" value={pendingSubmissions} icon={ClipboardCheck} tint="#FF5A1F" />
        <StatCard label="Message Threads" value={myThreads.length} icon={MessageSquare} tint="#A855F7" />
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
          <div className="mt-6 card p-5">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${liveSlot ? 'bg-emerald-500/10 text-emerald-600' : 'bg-ink/5 text-graphite dark:bg-white/10'}`}>
                <Clock className="h-4 w-4" />
              </span>
              <div>
                {liveSlot ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-600">You have a lecture right now</p>
                    <p className="text-xs text-graphite">{liveSlot.subject} · {classes.find((c) => c.id === liveSlot.classId)?.name} · {liveSlot.room} · until {liveSlot.endTime}</p>
                  </>
                ) : nextSlot ? (
                  <>
                    <p className="text-sm font-semibold text-ink dark:text-white">No lecture right now</p>
                    <p className="text-xs text-graphite">Next: {nextSlot.subject} · {classes.find((c) => c.id === nextSlot.classId)?.name} at {nextSlot.startTime}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-ink dark:text-white">No lecture right now</p>
                    <p className="text-xs text-graphite">
                      Nothing scheduled for the rest of today —{' '}
                      <Link to="/app/teacher/classes" className="text-accent hover:underline">set up your timetable</Link>.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="card p-6 lg:col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold text-ink dark:text-white">My Classes</h3>
                <Link to="/app/teacher/classes" className="link-underline flex items-center gap-1 text-xs font-medium text-accent">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <p className="mb-4 flex items-center gap-1.5 text-xs text-graphite">
                <TrendingUp className="h-3 w-3 text-emerald-500" /> Attendance % — last {schoolDays.length} school days
              </p>
              <div className="relative mb-5 h-16 w-full overflow-hidden rounded-xl bg-mist p-2 dark:bg-white/5">
                <svg viewBox="0 0 240 56" preserveAspectRatio="none" className="h-full w-full">
                  <defs>
                    <linearGradient id="teacherTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0071E3" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#0071E3" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${trendPath} L 240 56 L 0 56 Z`} fill="url(#teacherTrendFill)" />
                  <path d={trendPath} fill="none" stroke="#0071E3" strokeWidth="2" strokeLinecap="round" strokeDasharray="500" className="animate-draw-line" />
                </svg>
              </div>
              <div className="space-y-3">
                {myClasses.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-ink/5 px-4 py-3 dark:border-white/10">
                    <div>
                      <p className="text-sm font-medium text-ink dark:text-white">{c.name}</p>
                      <p className="text-xs text-graphite">{c.room}</p>
                    </div>
                    <Badge tone="neutral">{c.studentIds.length}/50 students</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-6">
              <h3 className="mb-4 font-semibold text-ink dark:text-white">Weekly Homework Load</h3>
              <div className="flex h-32 items-end gap-2">
                {weeklyHomework.map((d) => {
                  const max = Math.max(...weeklyHomework.map((w) => w.count), 1)
                  return (
                    <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="text-[10px] font-medium text-ink dark:text-white">{d.count}</span>
                      <div className="flex w-full flex-1 items-end">
                        <div className="w-full rounded-t-md bg-gradient-to-t from-brand/60 to-brand" style={{ height: `${(d.count / max) * 100}%` }} />
                      </div>
                      <span className="text-[9px] text-graphite">{d.day.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
              <h3 className="mb-3 mt-6 font-semibold text-ink dark:text-white">Upcoming Homework</h3>
              <div className="space-y-3">
                {myHomework.slice(0, 3).map((h) => (
                  <div key={h.id} className="border-b border-ink/5 pb-3 last:border-b-0 last:pb-0 dark:border-white/10">
                    <p className="text-sm font-medium text-ink dark:text-white">{h.title}</p>
                    <p className="text-xs text-graphite">Due {formatDate(h.dueDate)}</p>
                  </div>
                ))}
                {myHomework.length === 0 && <p className="text-sm text-graphite">No homework assigned yet.</p>}
              </div>
            </div>
          </div>
        </>
      )}

      <Modal open={studentsModalOpen} onClose={() => setStudentsModalOpen(false)} title="My Students" description={`${studentsWithPending.length} students across your classes`} size="lg">
        <div className="space-y-2">
          {studentsWithPending.map((s) => {
            const cls = classes.find((c) => c.id === s.classId)
            return (
              <div key={s.id} className="flex items-center justify-between rounded-xl bg-mist px-4 py-3 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} color={s.avatarColor} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-ink dark:text-white">{s.name}</p>
                    <p className="text-xs text-graphite">{cls?.name}</p>
                  </div>
                </div>
                {s.pending > 0 ? (
                  <Badge tone="warning">{s.pending} pending homework</Badge>
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
