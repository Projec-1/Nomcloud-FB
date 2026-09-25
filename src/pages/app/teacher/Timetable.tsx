import { useMemo, useState } from 'react'
import { CalendarRange, Clock3, Lock, MapPin, Sparkles } from 'lucide-react'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import { lessonTone, loadMockLessons, MOCK_CLASSES, MOCK_TEACHERS, timeRows, WEEKDAYS } from '@/data/mockTimetable'

export default function TeacherTimetable() {
  const [teacherId, setTeacherId] = useState(MOCK_TEACHERS[0].id)
  const [weekMode, setWeekMode] = useState<'five' | 'six'>('five')
  const [view, setView] = useState<'route' | 'class'>('route')
  const lessons = loadMockLessons()
  const teacher = MOCK_TEACHERS.find((item) => item.id === teacherId) ?? MOCK_TEACHERS[0]
  const visibleDays = WEEKDAYS.slice(0, weekMode === 'five' ? 5 : 6)
  const teachingLessons = lessons.filter((lesson) => lesson.teacher === teacher.name && lesson.type === 'lesson')
  const classIds = Array.from(new Set(teachingLessons.map((lesson) => lesson.classId)))
  const classes = classIds.map((id) => MOCK_CLASSES.find((item) => item.id === id)).filter(Boolean)
  const selectedClass = classes[0]
  const classLessons = selectedClass ? lessons.filter((lesson) => lesson.classId === selectedClass.id) : []
  const times = timeRows(classLessons).map(({ startTime, endTime }) => `${startTime}|${endTime}`)

  const teachingDays = useMemo(() => visibleDays.map((day) => ({
    ...day,
    lessons: teachingLessons.filter((lesson) => lesson.day === day.value).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  })), [teachingLessons, visibleDays])

  return (
    <div>
      <div className="relative mb-7 overflow-hidden rounded-[2rem] border border-[#FF5A1F]/15 bg-white p-6 text-ink shadow-[0_18px_60px_rgba(255,90,31,0.08)] dark:bg-[#161618] dark:text-white sm:p-8">
        <div className="pointer-events-none absolute -bottom-28 left-1/2 h-56 w-[100%] -translate-x-1/2 rounded-[50%] border border-[#FF5A1F]/20" />
        <div className="pointer-events-none absolute -bottom-20 left-1/2 h-40 w-[75%] -translate-x-1/2 rounded-[50%] border border-[#FF5A1F]/12" />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#FF5A1F]"><Sparkles className="h-4 w-4" /> Subject specialist schedule</div>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Your school day, in motion.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite">Move smoothly from class to class while teaching your specialist subject throughout the school day.</p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-xs font-medium uppercase tracking-wide text-graphite">Specialist subject</p><p className="mt-2 text-xl font-semibold text-ink dark:text-white">{teacher.subject}</p><p className="mt-1 text-xs text-graphite">{teacher.name}</p></div>
        <div className="card p-5"><p className="text-xs font-medium uppercase tracking-wide text-graphite">Classes visited</p><p className="mt-2 text-xl font-semibold text-ink dark:text-white">{classIds.length}</p><p className="mt-1 text-xs text-graphite">Across your weekly schedule</p></div>
        <div className="card p-5"><p className="text-xs font-medium uppercase tracking-wide text-graphite">Teaching periods</p><p className="mt-2 text-xl font-semibold text-ink dark:text-white">{teachingLessons.length}</p><p className="mt-1 text-xs text-graphite">Every lesson has a class destination</p></div>
      </div>

      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-ink/5 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.03] sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row">
          <Select label="Teacher" value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className="w-full sm:w-64">{MOCK_TEACHERS.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.subject}</option>)}</Select>
          <Select label="School week" value={weekMode} onChange={(event) => setWeekMode(event.target.value as 'five' | 'six')} className="w-full sm:w-64"><option value="five">5 days · Saturday–Wednesday</option><option value="six">6 days · Saturday–Thursday</option></Select>
        </div>
        <div className="flex rounded-xl bg-mist p-1 dark:bg-white/10"><button type="button" onClick={() => setView('route')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === 'route' ? 'bg-white text-ink shadow-sm dark:bg-white/15 dark:text-white' : 'text-graphite'}`}>My route</button><button type="button" onClick={() => setView('class')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === 'class' ? 'bg-white text-ink shadow-sm dark:bg-white/15 dark:text-white' : 'text-graphite'}`}>Class view</button></div>
      </div>

      {view === 'route' ? (
        <div className="grid gap-5 md:grid-cols-2">
          {teachingDays.map((day) => (
            <section key={day.value} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink/5 px-5 py-4 dark:border-white/10"><div><p className="text-xs font-semibold uppercase tracking-wider text-accent">{day.label}</p><h2 className="mt-1 font-semibold text-ink dark:text-white">{day.lessons.length ? `${day.lessons.length} class visits` : 'No classes scheduled'}</h2></div><CalendarRange className="h-5 w-5 text-graphite/50" /></div>
              <div className="space-y-2 p-3">{day.lessons.length ? day.lessons.map((lesson, index) => { const classItem = MOCK_CLASSES.find((item) => item.id === lesson.classId); return <div key={lesson.id} className="flex items-center gap-3 rounded-2xl bg-mist/70 p-3 dark:bg-white/[0.04]"><div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-accent/10 text-accent"><span className="text-[10px] font-semibold">{index + 1}</span><Clock3 className="mt-0.5 h-3.5 w-3.5" /></div><div className="min-w-0 flex-1"><p className="font-semibold text-ink dark:text-white">{classItem?.name ?? 'Class'}</p><p className="text-xs text-graphite">{lesson.subject} · {lesson.startTime}–{lesson.endTime}</p></div><Badge tone="info"><MapPin className="h-3 w-3" /> Room</Badge></div> }) : <p className="px-2 py-8 text-center text-sm text-graphite">Your schedule is clear today.</p>}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto p-3 sm:p-4">
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-mist/70 p-4 dark:bg-white/[0.04]"><div className="rounded-xl bg-accent/10 p-2.5 text-accent"><CalendarRange className="h-4 w-4" /></div><div><h2 className="font-semibold text-ink dark:text-white">{selectedClass?.name ?? 'Assigned class'} weekly timetable</h2><p className="text-xs text-graphite">Your {teacher.subject} lessons are highlighted in the class schedule.</p></div></div>
          <table className="w-full min-w-[760px] border-separate border-spacing-1.5 text-left"><thead><tr><th className="w-28 px-2 py-2 text-[11px] uppercase tracking-wide text-graphite">Time</th>{visibleDays.map((day) => <th key={day.value} className="rounded-xl bg-[#fff7f3] px-2 py-2.5 text-xs font-semibold text-ink dark:bg-white/5 dark:text-white sm:px-3 sm:text-sm">{day.label}</th>)}</tr></thead><tbody>{times.map((time) => { const [startTime, endTime] = time.split('|'); return <tr key={time}><td className="px-2 py-2 align-top text-[11px] leading-5 text-graphite">{startTime}<br />{endTime}</td>{visibleDays.map((day) => { const lesson = classLessons.find((item) => item.day === day.value && item.startTime === startTime && item.endTime === endTime); return <td key={day.value} className="align-top">{lesson ? <div className={`min-h-[82px] rounded-xl border p-2.5 shadow-sm sm:min-h-[92px] sm:rounded-2xl sm:p-3 ${lessonTone(lesson, lesson.teacher === teacher.name)}`}><p className="text-xs font-semibold sm:text-sm">{lesson.type === 'break' ? 'Break time' : lesson.subject}</p><p className="mt-1.5 flex items-center gap-1 text-[10px] opacity-75"><Clock3 className="h-3 w-3" />{lesson.startTime}–{lesson.endTime}</p>{lesson.teacher && <p className="mt-1 truncate text-[10px] opacity-75">Teacher: {lesson.teacher}</p>}</div> : <div className="min-h-[82px] rounded-xl bg-mist/40 dark:bg-white/[0.02] sm:min-h-[92px] sm:rounded-2xl" />}</td>})}</tr> })}</tbody></table>
        </div>
      )}
      <p className="mt-4 flex items-center gap-2 text-xs text-graphite"><Badge tone="neutral"><Lock className="h-3 w-3" /> Frontend demo</Badge> Teaching assignments are subject-based: one teacher can visit multiple classes in the same school day.</p>
    </div>
  )
}
