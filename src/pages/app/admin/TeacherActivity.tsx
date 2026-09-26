import { useMemo, useState } from 'react'
import { Pulse as Activity, Bell, BookOpen, CalendarCheck, CheckCircle as CheckCircle2, ClipboardText as ClipboardCheck, Clock as Clock3, GraduationCap, Users } from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import AccessDenied from '@/components/ui/AccessDenied'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { ACTIVITY_TYPE_LABELS, MOCK_TEACHER_ACTIVITY, type ActivityType } from '@/data/mockTeacherActivity'
import { MOCK_CLASSES, MOCK_TEACHERS } from '@/data/mockTimetable'

const icons: Record<ActivityType, typeof Activity> = {
  attendance: CalendarCheck,
  homework: ClipboardCheck,
  grades: GraduationCap,
  announcement: Bell,
  timetable: Clock3,
}

const tones: Record<ActivityType, string> = {
  attendance: 'bg-emerald-50 text-emerald-700',
  homework: 'bg-violet-50 text-violet-700',
  grades: 'bg-sky-50 text-sky-700',
  announcement: 'bg-orange-50 text-orange-700',
  timetable: 'bg-indigo-50 text-indigo-700',
}

export default function AdminTeacherActivity() {
  const { activeRole } = useAuth()
  const [teacherId, setTeacherId] = useState('all')
  const [classId, setClassId] = useState('all')
  const [type, setType] = useState<'all' | ActivityType>('all')
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday'>('all')
  const [selectedActivity, setSelectedActivity] = useState<(typeof MOCK_TEACHER_ACTIVITY)[number] | null>(null)

  const filtered = useMemo(
    () => MOCK_TEACHER_ACTIVITY.filter((item) =>
      (teacherId === 'all' || item.teacherId === teacherId) &&
      (classId === 'all' || item.classId === classId) &&
      (type === 'all' || item.type === type) &&
      (dateFilter === 'all' || (dateFilter === 'today' ? item.occurredAt.startsWith('Today') : item.occurredAt.startsWith('Yesterday'))) &&
      `${item.teacherName} ${item.action} ${item.detail} ${item.className} ${item.subject}`.toLowerCase().includes(search.trim().toLowerCase()),
    ),
    [teacherId, classId, type, dateFilter, search],
  )

  const selectedClass = MOCK_CLASSES.find((item) => item.id === classId)
  const selectedTeacher = MOCK_TEACHERS.find((item) => item.id === teacherId)
  const activeTeachers = new Set(filtered.map((item) => item.teacherId)).size
  const activeClasses = new Set(filtered.map((item) => item.classId)).size

  if (activeRole !== 'admin') {
    return <AccessDenied hint="Teacher activity is available to administrators only." />
  }

  return (
    <div>
      <PageHeader
        title="Teacher Activity"
        description="Understand what teachers and classes are working on without reading every individual record."
        actions={<div className="flex items-center gap-2 rounded-full bg-[#fff7f3] px-3 py-2 text-xs font-medium text-[#c94316]"><Activity className="h-4 w-4" /> Responsibility logs</div>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-wide text-graphite">Recent actions</p><Activity className="h-4 w-4 text-[#FF5A1F]" /></div><p className="mt-2 text-2xl font-semibold text-ink dark:text-white">{filtered.length}</p><p className="mt-1 text-xs text-graphite">Matching the selected view</p></div>
        <div className="card p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-wide text-graphite">Teachers active</p><Users className="h-4 w-4 text-[#FF5A1F]" /></div><p className="mt-2 text-2xl font-semibold text-ink dark:text-white">{activeTeachers}</p><p className="mt-1 text-xs text-graphite">With recent responsibility updates</p></div>
        <div className="card p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-wide text-graphite">Classes touched</p><BookOpen className="h-4 w-4 text-[#FF5A1F]" /></div><p className="mt-2 text-2xl font-semibold text-ink dark:text-white">{activeClasses}</p><p className="mt-1 text-xs text-graphite">Across the selected activity</p></div>
      </div>

      <div className="mb-6 rounded-2xl border border-ink/5 bg-white p-4 shadow-[0_12px_35px_rgba(20,20,20,0.04)] dark:border-white/10 dark:bg-[#161618]">
        <div className="mb-4 flex items-center gap-2"><Activity className="h-4 w-4 text-[#FF5A1F]" /><h2 className="font-semibold text-ink dark:text-white">Filter activity</h2></div>
        <div className="mb-4"><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search teacher, action, class, or subject" /></div>
        <div className="grid gap-4 md:grid-cols-4">
          <Select label="Teacher" value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
            <option value="all">All teachers</option>
            {MOCK_TEACHERS.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.subject}</option>)}
          </Select>
          <Select label="Class" value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="all">All classes</option>
            {MOCK_CLASSES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
          <Select label="Activity type" value={type} onChange={(event) => setType(event.target.value as 'all' | ActivityType)}>
            <option value="all">All activity</option>
            {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Select label="Date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value as typeof dateFilter)}>
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
          </Select>
        </div>
      </div>

      {(selectedTeacher || selectedClass) && (
        <div className="mb-6 rounded-2xl border border-[#FF5A1F]/15 bg-[#fffaf8] p-5 dark:bg-[#FF5A1F]/10">
          <div className="flex flex-wrap items-center gap-4">
            {selectedTeacher && <div className="flex items-center gap-3"><Avatar name={selectedTeacher.name} size="md" /><div><p className="text-xs text-graphite">Teacher</p><p className="font-semibold text-ink dark:text-white">{selectedTeacher.name}</p><p className="text-xs text-graphite">{selectedTeacher.subject} specialist</p></div></div>}
            {selectedClass && <div className="flex items-center gap-3 border-l border-[#FF5A1F]/15 pl-4"><div className="rounded-xl bg-white p-2.5 text-[#FF5A1F] shadow-sm dark:bg-white/10"><BookOpen className="h-4 w-4" /></div><div><p className="text-xs text-graphite">Class responsibility</p><p className="font-semibold text-ink dark:text-white">{selectedClass.name}</p><p className="text-xs text-graphite">Foremaster: {selectedClass.homeroomTeacher}</p></div></div>}
          </div>
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink/5 px-5 py-4 dark:border-white/10"><div><h2 className="font-semibold text-ink dark:text-white">{selectedClass ? `${selectedClass.name} activity` : 'Recent teacher activity'}</h2><p className="mt-1 text-xs text-graphite">Attendance, homework, results, announcements, and timetable changes.</p></div><CheckCircle2 className="h-5 w-5 text-emerald-500" /></div>
        {filtered.length ? (
          <div className="divide-y divide-ink/5 dark:divide-white/10">
            {filtered.map((item) => {
              const Icon = icons[item.type]
              return <button type="button" key={item.id} onClick={() => setSelectedActivity(item)} className="flex w-full flex-col gap-3 px-5 py-5 text-left transition-colors hover:bg-ink/[0.015] dark:hover:bg-white/[0.02] sm:flex-row sm:gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[item.type]}`}><Icon className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-ink dark:text-white">{item.action}</p><Badge tone="neutral">{ACTIVITY_TYPE_LABELS[item.type]}</Badge></div><p className="mt-1 text-sm text-graphite">{item.teacherName} · {item.className} · {item.subject}</p><p className="mt-1 text-sm text-ink/75 dark:text-white/70">{item.detail}</p></div>
                <div className="flex shrink-0 items-center gap-1 text-xs text-graphite sm:items-start"><Clock3 className="h-3.5 w-3.5" />{item.occurredAt}</div>
              </button>
            })}
          </div>
        ) : <div className="px-5 py-14 text-center text-sm text-graphite">No activity matches these filters.</div>}
      </section>
      <Modal open={Boolean(selectedActivity)} onClose={() => setSelectedActivity(null)} title={selectedActivity?.action ?? 'Activity details'} description={selectedActivity ? `${selectedActivity.teacherName} · ${selectedActivity.occurredAt}` : ''}>
        {selectedActivity && <div className="space-y-3 text-sm"><p><span className="text-graphite">Class:</span> {selectedActivity.className}</p><p><span className="text-graphite">Subject:</span> {selectedActivity.subject}</p><p><span className="text-graphite">Activity type:</span> {ACTIVITY_TYPE_LABELS[selectedActivity.type]}</p><p><span className="text-graphite">Details:</span> {selectedActivity.detail}</p></div>}
      </Modal>
    </div>
  )
}
