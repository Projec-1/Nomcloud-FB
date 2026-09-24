import { useState } from 'react'
import { CalendarRange, Clock3, Pencil, Plus, Trash2, Users, Sparkles, BookOpen } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/context/ToastContext'
import { lessonTone, loadMockLessons, MOCK_CLASSES, MOCK_TEACHERS, saveMockLessons, timeRows, WEEKDAYS, type MockLesson } from '@/data/mockTimetable'

type LessonForm = {
  day: string
  subject: string
  teacher: string
  startTime: string
  endTime: string
  type: MockLesson['type']
}

const emptyLesson: LessonForm = { day: '6', subject: 'Mathematics', teacher: 'Ahmed Hassan', startTime: '08:00', endTime: '08:40', type: 'lesson' }

export default function AdminTimetables() {
  const { showToast } = useToast()
  const [lessons, setLessons] = useState<MockLesson[]>(loadMockLessons)
  const [classId, setClassId] = useState(MOCK_CLASSES[0].id)
  const [weekMode, setWeekMode] = useState<'five' | 'six'>('five')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MockLesson | null>(null)
  const [form, setForm] = useState(emptyLesson)

  const activeClass = MOCK_CLASSES.find((item) => item.id === classId) ?? MOCK_CLASSES[0]
  const visibleDays = WEEKDAYS.slice(0, weekMode === 'five' ? 5 : 6)
  const classLessons = lessons.filter((lesson) => lesson.classId === classId)
  const rows = timeRows(classLessons)

  const openNew = (day?: number, startTime?: string, endTime?: string) => {
    setEditing(null)
    setForm({ ...emptyLesson, day: String(day ?? 6), startTime: startTime ?? '08:00', endTime: endTime ?? '08:40' })
    setModalOpen(true)
  }

  const openEdit = (lesson: MockLesson) => {
    setEditing(lesson)
    setForm({ day: String(lesson.day), subject: lesson.subject, teacher: lesson.teacher, startTime: lesson.startTime, endTime: lesson.endTime, type: lesson.type })
    setModalOpen(true)
  }

  const saveLesson = () => {
    if (!form.startTime || !form.endTime || form.endTime <= form.startTime) {
      showToast({ type: 'error', title: 'Check the lesson time', description: 'End time must be later than start time.' })
      return
    }
    const conflict = lessons.some((lesson) =>
      lesson.id !== editing?.id &&
      lesson.teacher === form.teacher &&
      lesson.teacher &&
      lesson.day === Number(form.day) &&
      lesson.startTime === form.startTime &&
      lesson.endTime === form.endTime,
    )
    if (conflict) {
      showToast({ type: 'error', title: 'Teacher conflict', description: `${form.teacher} is already teaching another class at this time.` })
      return
    }
    const teacher = MOCK_TEACHERS.find((item) => item.name === form.teacher)
    if (form.type === 'lesson' && teacher && teacher.subject !== form.subject) {
      showToast({ type: 'error', title: 'Subject teacher mismatch', description: `${teacher.name} is assigned to ${teacher.subject}, not ${form.subject}.` })
      return
    }
    const next: MockLesson = {
      id: editing?.id ?? `mock-${Date.now()}`,
      classId,
      day: Number(form.day) as MockLesson['day'],
      subject: form.type === 'break' ? '' : form.subject,
      teacher: form.type === 'break' ? '' : form.teacher,
      startTime: form.startTime,
      endTime: form.endTime,
      type: form.type,
    }
    const updated = editing ? lessons.map((lesson) => (lesson.id === editing.id ? next : lesson)) : [...lessons, next]
    setLessons(updated)
    saveMockLessons(updated)
    setModalOpen(false)
    showToast({ type: 'success', title: editing ? 'Lesson updated' : 'Lesson added', description: 'Saved to this browser for the frontend demo.' })
  }

  const removeLesson = (id: string) => {
    const updated = lessons.filter((lesson) => lesson.id !== id)
    setLessons(updated)
    saveMockLessons(updated)
    showToast({ type: 'success', title: 'Timetable item removed' })
  }

  const lessonAt = (day: number, row: { startTime: string; endTime: string }) =>
    classLessons.find((lesson) => lesson.day === day && lesson.startTime === row.startTime && lesson.endTime === row.endTime)

  return (
    <div>
      <div className="relative mb-7 overflow-hidden rounded-[2rem] border border-[#FF5A1F]/15 bg-white p-6 text-ink shadow-[0_18px_60px_rgba(255,90,31,0.08)] dark:bg-[#161618] dark:text-white sm:p-8">
        <div className="pointer-events-none absolute -bottom-32 left-1/2 h-64 w-[115%] -translate-x-1/2 rounded-[50%] border border-[#FF5A1F]/20" />
        <div className="pointer-events-none absolute -bottom-24 left-1/2 h-48 w-[90%] -translate-x-1/2 rounded-[50%] border border-[#FF5A1F]/15" />
        <div className="pointer-events-none absolute -bottom-16 left-1/2 h-32 w-[65%] -translate-x-1/2 rounded-[50%] border border-[#FF5A1F]/10" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#FF5A1F]"><Sparkles className="h-4 w-4" /> Academic planning</div>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">A clearer rhythm for every school day.</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-graphite">Plan six focused lessons across the Somali school week, then add extra periods whenever your classes need them.</p>
          </div>
          <Button onClick={() => openNew()} className="bg-[#FF5A1F] text-white hover:bg-[#e94d16]" icon={<Plus className="h-4 w-4" />}>Add Lesson</Button>
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-2xl border border-ink/5 bg-white p-3 shadow-[0_12px_35px_rgba(20,20,20,0.04)] dark:border-white/10 dark:bg-[#161618] sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-accent" /><h2 className="text-sm font-semibold text-ink dark:text-white">Choose class</h2></div>
            <span className="text-[11px] text-graphite">{MOCK_CLASSES.length} classes</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {MOCK_CLASSES.map((item) => (
              <button key={item.id} type="button" onClick={() => setClassId(item.id)} className={`min-w-[150px] shrink-0 rounded-xl px-3.5 py-2.5 text-left transition-all ${item.id === classId ? 'bg-[#FF5A1F] text-white shadow-sm' : 'bg-[#fff7f3] text-ink hover:bg-[#FF5A1F]/10 dark:bg-white/5 dark:text-white'}`}>
                <p className="text-sm font-semibold">{item.name}</p>
                <p className={`mt-0.5 truncate text-[11px] ${item.id === classId ? 'text-white/70' : 'text-graphite'}`}>{item.homeroomTeacher}</p>
              </button>
            ))}
          </div>
        </div>

        <section className="min-w-0">
          <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-ink/5 bg-white p-4 shadow-[0_12px_35px_rgba(20,20,20,0.04)] dark:border-white/10 dark:bg-[#161618] sm:flex-row sm:items-end sm:justify-between sm:p-5">
            <div>
              <div className="flex items-center gap-2"><div className="rounded-xl bg-[#FF5A1F]/10 p-2 text-[#FF5A1F]"><BookOpen className="h-4 w-4" /></div><div><p className="text-xs font-semibold uppercase tracking-wider text-[#FF5A1F]">Weekly schedule</p><h2 className="mt-1 text-xl font-semibold text-ink dark:text-white">{activeClass.name}</h2></div></div>
              <p className="mt-3 text-sm text-graphite">Foremaster / Homeroom Teacher: <span className="font-medium text-ink dark:text-white">{activeClass.homeroomTeacher}</span></p>
              <p className="mt-1 text-xs text-graphite">Six lesson periods are ready each day. Add a seventh or extra period whenever your school needs one.</p>
            </div>
            <Select label="School week" value={weekMode} onChange={(event) => setWeekMode(event.target.value as 'five' | 'six')} className="w-full sm:w-64">
              <option value="five">5 days · Saturday–Wednesday</option>
              <option value="six">6 days · Saturday–Thursday</option>
            </Select>
          </div>

          <div className="rounded-2xl border border-ink/5 bg-white p-3 shadow-[0_12px_35px_rgba(20,20,20,0.04)] dark:border-white/10 dark:bg-[#161618] sm:p-5">
            <table className="w-full min-w-[900px] border-separate border-spacing-2 text-left">
              <thead>
                <tr>
                  <th className="w-32 px-2 py-3 text-xs font-semibold uppercase tracking-wide text-graphite">Time</th>
                  {visibleDays.map((day) => <th key={day.value} className="rounded-xl bg-[#fff7f3] px-3 py-3 text-sm font-semibold text-ink dark:bg-white/5 dark:text-white">{day.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.startTime}-${row.endTime}`}>
                    <td className="px-2 py-3 align-top text-xs font-medium leading-5 text-graphite">{row.startTime}<br />{row.endTime}</td>
                    {visibleDays.map((day) => {
                      const lesson = lessonAt(day.value, row)
                      return (
                        <td key={day.value} className="min-w-[160px] align-top">
                          {lesson ? (
                            <div className={`group relative min-h-[112px] rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md ${lessonTone(lesson)}`}>
                              <button type="button" onClick={() => openEdit(lesson)} className="w-full text-left">
                                <p className="text-sm font-semibold">{lesson.type === 'break' ? 'Break time' : lesson.subject}</p>
                                <p className="mt-2 flex items-center gap-1 text-xs opacity-75"><Clock3 className="h-3.5 w-3.5" />{lesson.startTime}–{lesson.endTime}</p>
                                {lesson.teacher && <p className="mt-1.5 truncate text-xs opacity-75">Teacher: {lesson.teacher}</p>}
                              </button>
                              <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                                <button type="button" onClick={() => openEdit(lesson)} className="rounded-md bg-white/70 p-1.5 text-ink" aria-label="Edit lesson"><Pencil className="h-3 w-3" /></button>
                                <button type="button" onClick={() => removeLesson(lesson.id)} className="rounded-md bg-white/70 p-1.5 text-red-500" aria-label="Delete lesson"><Trash2 className="h-3 w-3" /></button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => openNew(day.value, row.startTime, row.endTime)} className="flex min-h-[112px] w-full items-center justify-center rounded-2xl border border-dashed border-ink/10 text-graphite/30 transition-colors hover:border-accent hover:bg-accent/5 hover:text-accent dark:border-white/10"><Plus className="h-5 w-5" /></button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <div className="py-14 text-center text-sm text-graphite">No lessons yet. Use Add Lesson to build this class schedule.</div>}
          </div>
        </section>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit timetable item' : 'Add timetable item'} description="This frontend demo saves changes in your browser." footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={saveLesson}>{editing ? 'Save changes' : 'Add lesson'}</Button></>}>
        <div className="space-y-4">
          <Select label="Day" value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value })}>{WEEKDAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</Select>
          <Select label="Type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as MockLesson['type'] })}><option value="lesson">Lesson</option><option value="break">Break time</option></Select>
          {form.type === 'lesson' && <><Select label="Subject" value={form.subject} onChange={(event) => { const subject = event.target.value; const specialist = MOCK_TEACHERS.find((teacher) => teacher.subject === subject); setForm({ ...form, subject, teacher: specialist?.name ?? form.teacher }) }}>{activeClass.subjects.map((subject) => <option key={subject}>{subject}</option>)}</Select><Select label="Subject teacher" value={form.teacher} onChange={(event) => setForm({ ...form, teacher: event.target.value })}>{MOCK_TEACHERS.filter((teacher) => teacher.subject === form.subject).map((teacher) => <option key={teacher.id} value={teacher.name}>{teacher.name} · {teacher.subject}</option>)}</Select><p className="-mt-2 text-xs text-graphite">Teachers are subject specialists and can move between classes during the day.</p></>}
          <div className="grid gap-4 sm:grid-cols-2"><Input label="Start time" type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /><Input label="End time" type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></div>
        </div>
      </Modal>
    </div>
  )
}
