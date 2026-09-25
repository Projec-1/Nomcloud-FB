import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Pulse as Activity, ArrowUpRight, BookOpen, CalendarCheck, Check, ClipboardText, Clock, DownloadSimple, MagnifyingGlass, Plus, UserCircle, Users, X } from '@phosphor-icons/react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import { MOCK_CLASSES, MOCK_TEACHERS, loadMockLessons, type MockLesson } from '@/data/mockTimetable'

type AttendanceState = 'present' | 'late' | 'absent' | 'excused'
type Student = { id: string; name: string; classId: string; attendance: number; average: number; status: string }

const students: Student[] = [
  { id: 'ST-0801', name: 'Ahmed Ali', classId: 'grade-7', attendance: 96, average: 82, status: 'On track' },
  { id: 'ST-0802', name: 'Amina Hassan', classId: 'grade-7', attendance: 99, average: 91, status: 'Excellent' },
  { id: 'ST-0803', name: 'Mohamed Omar', classId: 'grade-7', attendance: 88, average: 74, status: 'Needs attention' },
  { id: 'ST-0601', name: 'Hodan Abdi', classId: 'grade-6', attendance: 94, average: 86, status: 'On track' },
  { id: 'ST-0602', name: 'Yusuf Noor', classId: 'grade-6', attendance: 91, average: 78, status: 'On track' },
  { id: 'ST-0501', name: 'Sahra Ali', classId: 'grade-5', attendance: 84, average: 69, status: 'Needs attention' },
]

const classes = MOCK_CLASSES.map((item) => ({ ...item, students: students.filter((student) => student.classId === item.id) }))
const initialAssignments = [{ id: 'a1', title: 'Reading comprehension', classId: 'grade-7', subject: 'English', status: 'Published' }, { id: 'a2', title: 'Algebra practice', classId: 'grade-7', subject: 'Mathematics', status: 'Due Soon' }]

export default function TeacherWorkspace() {
  const location = useLocation()
  const navigate = useNavigate()
  const section = location.pathname.split('/').pop() ?? 'teacher'
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<MockLesson | null>(null)
  const [attendance, setAttendance] = useState<Record<string, AttendanceState>>({})
  const [assignments, setAssignments] = useState(initialAssignments)
  const [modal, setModal] = useState<'assignment' | 'lesson' | 'profile' | null>(null)
  const lessons = loadMockLessons().filter((lesson) => lesson.type === 'lesson' && lesson.teacher === MOCK_TEACHERS[0].name)
  const filteredStudents = students.filter((student) => (classFilter === 'all' || student.classId === classFilter) && `${student.name} ${student.id}`.toLowerCase().includes(query.toLowerCase()))

  const title: Record<string, string> = { 'my-day': 'My Day', students: 'My Students', resources: 'Teaching Resources', progress: 'Student Progress', profile: 'Teacher Profile', notifications: 'Notifications', assignments: 'Assignments', lessons: 'Lessons', exams: 'Exams', 'class-performance': 'Class Performance' }
  let content: React.ReactNode
  if (section === 'timetable') content = <TimetableView lessons={lessons} onSelect={setSelectedLesson} navigate={navigate} />
  else if (section === 'my-day') content = <MyDay lessons={lessons} onSelect={setSelectedLesson} navigate={navigate} />
  else if (section === 'students' || section === 'progress') content = <StudentView progress={section === 'progress'} students={filteredStudents} query={query} setQuery={setQuery} classFilter={classFilter} setClassFilter={setClassFilter} onSelect={setSelectedStudent} />
  else if (section === 'resources') content = <ResourceView onNotify={() => setModal('lesson')} />
  else if (section === 'profile') content = <ProfileView onNotify={() => setModal('profile')} />
  else if (section === 'notifications') content = <NotificationView navigate={navigate} />
  else if (section === 'assignments') content = <AssignmentView assignments={assignments} onCreate={() => setModal('assignment')} />
  else if (section === 'lessons') content = <LessonView lessons={lessons} onSelect={setSelectedLesson} />
  else if (section === 'exams') content = <ExamView />
  else if (section === 'class-performance') content = <PerformanceView />
  else content = <TeacherOverview lessons={lessons} assignments={assignments} onCreate={() => setModal('assignment')} navigate={navigate} />

  return <>
    {content}
    <Modal open={Boolean(selectedLesson)} onClose={closeModal} title={selectedLesson?.subject} description="Timetable entry details">
      {selectedLesson && <div className="space-y-3 text-sm"><p><strong>Class:</strong> {MOCK_CLASSES.find((item) => item.id === selectedLesson.classId)?.name}</p><p><strong>Time:</strong> {selectedLesson.startTime}–{selectedLesson.endTime}</p><p><strong>Room:</strong> Assigned classroom</p><Button variant="accent" onClick={() => navigate('/app/teacher/attendance')}>Take attendance</Button></div>}
    </Modal>
    <Modal open={Boolean(selectedStudent)} onClose={() => setSelectedStudent(null)} title={selectedStudent?.name} description="Student profile and progress">
      {selectedStudent && <div className="space-y-3 text-sm"><p><strong>Student ID:</strong> {selectedStudent.id}</p><p><strong>Attendance:</strong> {selectedStudent.attendance}%</p><p><strong>Average:</strong> {selectedStudent.average}%</p><Badge tone={selectedStudent.status === 'Excellent' ? 'success' : selectedStudent.status === 'Needs attention' ? 'warning' : 'neutral'}>{selectedStudent.status}</Badge></div>}
    </Modal>
    <Modal open={modal === 'profile' || modal === 'lesson'} onClose={closeModal} title={modal === 'profile' ? 'Saved locally' : 'Resource action'} description="Frontend-only prototype">
      <p className="text-sm text-graphite">{modal === 'profile' ? 'Your profile changes are ready to be connected to the backend.' : 'This mock action is ready for backend integration.'}</p>
    </Modal>
    <Modal open={modal === 'assignment'} onClose={closeModal} title="Create assignment" description="Add a mock assignment for Grade 7A">
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); saveAssignment(new FormData(event.currentTarget).get('title')?.toString() ?? '') }}>
        <label className="label">Assignment title<input name="title" className="input mt-2" placeholder="e.g. Fractions practice" autoFocus /></label>
        <div className="flex justify-end"><Button type="submit" variant="accent">Create assignment</Button></div>
      </form>
    </Modal>
  </>

  function closeModal() { setModal(null); setSelectedLesson(null) }
  function saveAssignment(titleValue: string) {
    if (!titleValue.trim()) return
    setAssignments((current) => [...current, { id: `a-${Date.now()}`, title: titleValue, classId: 'grade-7', subject: 'Mathematics', status: 'Draft' }])
    closeModal()
  }
}

function Header({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-graphite">{description}</p></div>{action}</div>
}

function Shell({ children, title, description, action }: { children: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div><Header eyebrow="Teacher workspace" title={title} description={description} action={action} />{children}</div>
}

function TeacherOverview({ lessons, assignments, onCreate, navigate }: { lessons: MockLesson[]; assignments: typeof initialAssignments; onCreate: () => void; navigate: (path: string) => void }) {
  const insightCards = [
    { label: 'Classes', metricLabel: 'Active classes', value: '3', tone: 'orange' as const, caption: 'Your assigned classes are ready for today.', chart: 'line' as const },
    { label: 'Students', metricLabel: 'Students in your classes', value: String(students.length), tone: 'blue' as const, caption: 'Learners connected to your teaching workspace.', chart: 'curve' as const },
    { label: "Today's classes", metricLabel: 'Scheduled today', value: String(lessons.length), tone: 'green' as const, caption: 'Lessons planned in the school timetable.', chart: 'ring' as const },
  ]
  return <Shell title="Good morning, Ahmed" description="Your teaching day at Hodan International School." action={<Button variant="accent" onClick={onCreate}><Plus className="h-4 w-4" /> Create assignment</Button>}><div className="teacher-workspace-insights grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{insightCards.map((card) => <TeacherWorkspaceInsightCard key={card.label} {...card} />)}</div><div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><div className="card p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Today's schedule</h2><button className="text-xs font-semibold text-brand" onClick={() => navigate('/app/teacher/timetable')}>View timetable</button></div><div className="mt-4 space-y-2">{lessons.slice(0, 4).map((lesson) => <button key={lesson.id} onClick={() => navigate('/app/teacher/my-day')} className="flex w-full items-center gap-3 rounded-xl bg-mist/60 p-3 text-left hover:bg-brand/5"><Clock className="h-4 w-4 text-brand" /><span className="flex-1"><span className="block text-sm font-semibold">{lesson.subject} · {MOCK_CLASSES.find((item) => item.id === lesson.classId)?.name}</span><span className="text-xs text-graphite">{lesson.startTime}–{lesson.endTime} · Managed by Administration</span></span></button>)}</div></div><div className="card p-5"><h2 className="font-semibold">Connected school updates</h2><div className="mt-4 space-y-4 text-sm"><p className="flex gap-3"><CalendarCheck className="h-4 w-4 text-brand" />New timetable published</p><p className="flex gap-3"><ClipboardText className="h-4 w-4 text-brand" />Grade 7A assignment due tomorrow</p><p className="flex gap-3"><Activity className="h-4 w-4 text-brand" />Administration updated the active term</p></div></div></div></Shell>
}

function TeacherWorkspaceInsightCard({ label, metricLabel, value, tone, caption, chart }: { label: string; metricLabel: string; value: string; tone: 'orange' | 'blue' | 'green'; caption: string; chart: 'line' | 'curve' | 'ring' }) {
  return <div className={`teacher-workspace-insight-card teacher-workspace-insight-card--${tone}`}><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{label}</p><span className="teacher-workspace-insight-card__period">Weekly <span aria-hidden>⌄</span></span></div><p className="teacher-workspace-insight-card__label">{metricLabel}</p><p className="teacher-workspace-insight-card__value">{value}</p><div className="teacher-workspace-insight-card__chart" aria-hidden="true">{chart === 'line' && <svg viewBox="0 0 220 72" preserveAspectRatio="none"><path className="teacher-workspace-insight-card__area" d="M0 60 L42 42 L78 42 L112 25 L145 25 L180 25 L220 25 L220 72 L0 72 Z" /><path d="M0 60 L42 42 L78 42 L112 25 L145 25 L180 25 L220 25" /><circle cx="220" cy="25" r="3.5" /></svg>}{chart === 'curve' && <svg viewBox="0 0 220 72" preserveAspectRatio="none"><path className="teacher-workspace-insight-card__area" d="M0 60 C30 50 42 68 70 52 S105 8 130 22 S170 64 220 28 L220 72 L0 72 Z" /><path d="M0 60 C30 50 42 68 70 52 S105 8 130 22 S170 64 220 28" /><circle cx="130" cy="22" r="7" /></svg>}{chart === 'ring' && <span className="teacher-workspace-insight-card__ring" />}</div><p className="teacher-workspace-insight-card__caption">{caption}</p><span className="teacher-workspace-insight-card__arrow"><ArrowUpRight size={14} /></span></div>
}

function TimetableView({ lessons, onSelect, navigate }: { lessons: MockLesson[]; onSelect: (lesson: MockLesson) => void; navigate: (path: string) => void }) {
  return <Shell title="My Timetable" description="School timetable · Managed by Administration"><div className="mb-5 flex gap-2"><Button variant="outline" onClick={() => navigate('/app/teacher/my-day')}>Today</Button><Button variant="outline" onClick={() => navigate('/app/teacher/classes')}>My classes</Button></div><div className="card overflow-hidden"><div className="border-b border-ink/5 p-5"><p className="text-sm text-graphite">Your assigned Mathematics periods are shown from the school timetable.</p></div><div className="divide-y divide-ink/5">{lessons.map((lesson) => <button key={lesson.id} onClick={() => onSelect(lesson)} className="flex w-full items-center gap-4 p-5 text-left hover:bg-brand/5"><span className="w-20 text-sm font-semibold text-brand">{lesson.startTime}</span><span className="flex-1"><span className="block font-semibold">{lesson.subject} · {MOCK_CLASSES.find((item) => item.id === lesson.classId)?.name}</span><span className="text-xs text-graphite">{lesson.endTime} · Room 204 · {lesson.teacher}</span></span><Badge tone="info">School timetable</Badge></button>)}</div></div></Shell>
}

function MyDay({ lessons, onSelect, navigate }: { lessons: MockLesson[]; onSelect: (lesson: MockLesson) => void; navigate: (path: string) => void }) {
  return <Shell title="My Day" description="Focus on today's classes and the actions that matter."><div className="space-y-3">{lessons.map((lesson) => <div key={lesson.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand"><Clock className="h-5 w-5" /></div><div className="flex-1"><p className="font-semibold">{lesson.subject} · {MOCK_CLASSES.find((item) => item.id === lesson.classId)?.name}</p><p className="mt-1 text-sm text-graphite">{lesson.startTime}–{lesson.endTime} · Room 204 · 32 students</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate('/app/teacher/attendance')}>Take attendance</Button><Button variant="ghost" onClick={() => onSelect(lesson)}>Details</Button></div></div>)}</div></Shell>
}

function StudentView({ progress, students: visible, query, setQuery, classFilter, setClassFilter, onSelect }: { progress: boolean; students: Student[]; query: string; setQuery: (value: string) => void; classFilter: string; setClassFilter: (value: string) => void; onSelect: (student: Student) => void }) {
  return <Shell title={progress ? 'Student Progress' : 'My Students'} description="Only students in your assigned classes are shown."><div className="mb-5 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite" /><input className="input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students" /></div><Select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="all">All classes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div><div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-ink/5 text-xs text-graphite"><tr><th className="p-4">Student</th><th>Class</th><th>Attendance</th><th>Average</th><th>Status</th></tr></thead><tbody className="divide-y divide-ink/5">{visible.map((student) => <tr key={student.id} onClick={() => onSelect(student)} className="cursor-pointer hover:bg-brand/5"><td className="p-4 font-semibold">{student.name}<span className="block text-xs font-normal text-graphite">{student.id}</span></td><td>{classes.find((item) => item.id === student.classId)?.name}</td><td>{student.attendance}%</td><td>{student.average}%</td><td><Badge tone={student.status === 'Excellent' ? 'success' : student.status === 'Needs attention' ? 'warning' : 'neutral'}>{student.status}</Badge></td></tr>)}</tbody></table></div>{visible.length === 0 && <div className="p-12 text-center text-sm text-graphite">No students match your filters.</div>}</div></Shell>
}

function ResourceView({ onNotify }: { onNotify: () => void }) {
  return <Shell title="Teaching Resources" description="Find, organize, and reuse resources for your classes." action={<Button variant="accent" onClick={onNotify}><Plus className="h-4 w-4" /> Upload resource</Button>}><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{['Grade 7 Algebra worksheet.pdf', 'Reading comprehension slides.pptx', 'Science lab lesson plan.docx'].map((resource) => <div key={resource} className="card p-5"><DownloadSimple className="h-5 w-5 text-brand" /><p className="mt-4 text-sm font-semibold">{resource}</p><p className="mt-1 text-xs text-graphite">School Resources · Updated today</p><button className="mt-4 text-xs font-semibold text-brand" onClick={onNotify}>Download mock file</button></div>)}</div></Shell>
}

function ProfileView({ onNotify }: { onNotify: () => void }) {
  return <Shell title="Teacher Profile" description="Manage your professional information and preferences."><div className="grid gap-5 lg:grid-cols-2"><div className="card p-5"><div className="flex items-center gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-xl font-bold text-white">A</div><div><h2 className="font-semibold">Ahmed Hassan</h2><p className="text-sm text-graphite">Mathematics · Hodan International School</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="label">First name<input className="input mt-2" defaultValue="Ahmed" /></label><label className="label">Last name<input className="input mt-2" defaultValue="Hassan" /></label><label className="label sm:col-span-2">Email<input className="input mt-2" defaultValue="ahmed@hodan.edu" /></label></div><Button variant="accent" className="mt-5" onClick={onNotify}>Save profile</Button></div><div className="card p-5"><h2 className="font-semibold">Security & preferences</h2><div className="mt-4 space-y-3 text-sm"><button className="flex w-full items-center justify-between rounded-xl border border-ink/10 p-3 text-left" onClick={onNotify}>Change password <span>›</span></button><button className="flex w-full items-center justify-between rounded-xl border border-ink/10 p-3 text-left" onClick={onNotify}>Active sessions <span>2</span></button><button className="flex w-full items-center justify-between rounded-xl border border-ink/10 p-3 text-left" onClick={onNotify}>Notification preferences <span>›</span></button></div></div></div></Shell>
}

function NotificationView({ navigate }: { navigate: (path: string) => void }) {
  return <Shell title="Notifications" description="Updates from administration and activity in your assigned classes."><div className="card divide-y divide-ink/5">{[['New timetable published', '/app/teacher/timetable'], ['Grade 7A assignment is due tomorrow', '/app/teacher/homework'], ['Administration published a new announcement', '/app/teacher/announcements'], ['Parent replied to your message', '/app/teacher/messages']].map(([title, path]) => <button key={title} onClick={() => navigate(path)} className="flex w-full items-center gap-3 p-5 text-left hover:bg-brand/5"><Activity className="h-5 w-5 text-brand" /><span className="flex-1 text-sm font-semibold">{title}</span><Check className="h-4 w-4 text-emerald-500" /></button>)}</div></Shell>
}

function AssignmentView({ assignments, onCreate }: { assignments: typeof initialAssignments; onCreate: () => void }) {
  return <Shell title="Assignments" description="Create and track work for your assigned classes." action={<Button variant="accent" onClick={onCreate}><Plus className="h-4 w-4" /> New assignment</Button>}><div className="card divide-y divide-ink/5">{assignments.map((item) => <div key={item.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><ClipboardText className="h-5 w-5 text-brand" /><div className="flex-1"><p className="font-semibold">{item.title}</p><p className="text-xs text-graphite">{item.subject} · Grade 7 · Managed by you</p></div><Badge tone={item.status === 'Published' ? 'success' : 'warning'}>{item.status}</Badge></div>)}</div></Shell>
}

function LessonView({ lessons, onSelect }: { lessons: MockLesson[]; onSelect: (lesson: MockLesson) => void }) {
  return <Shell title="Lessons" description="Your upcoming lessons, connected to the administrator timetable."><div className="grid gap-4 md:grid-cols-2">{lessons.map((lesson) => <button key={lesson.id} onClick={() => onSelect(lesson)} className="card flex items-center gap-4 p-5 text-left hover:border-brand/40"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand"><BookOpen className="h-5 w-5" /></div><div className="flex-1"><p className="font-semibold">{lesson.subject}</p><p className="mt-1 text-xs text-graphite">{lesson.startTime}–{lesson.endTime} · Grade 7 · {lesson.teacher}</p></div><span className="text-xs font-semibold text-brand">Open</span></button>)}</div></Shell>
}

function ExamView() {
  return <Shell title="Exams" description="Prepare, review, and track upcoming assessments."><div className="grid gap-4 md:grid-cols-2"><div className="card p-5"><p className="text-xs font-bold uppercase tracking-wider text-brand">Upcoming</p><h2 className="mt-3 text-lg font-semibold">Term 1 Mathematics Assessment</h2><p className="mt-2 text-sm text-graphite">Grade 7 · October 8 · 09:00</p><Badge className="mt-5" tone="warning">Draft schedule</Badge></div><div className="card p-5"><p className="text-xs font-bold uppercase tracking-wider text-brand">Published</p><h2 className="mt-3 text-lg font-semibold">English Reading Assessment</h2><p className="mt-2 text-sm text-graphite">Grade 7 · September 20 · 81% class average</p><Badge className="mt-5" tone="success">Results available</Badge></div></div></Shell>
}

function PerformanceView() {
  return <Shell title="Class Performance" description="A quick view of progress across your assigned classes."><div className="grid gap-4 sm:grid-cols-3">{[['Grade 7', '86%', 'On track'], ['Grade 6', '79%', 'Needs review'], ['Grade 5', '91%', 'Excellent']].map(([name, score, status]) => <div key={name} className="card p-5"><p className="text-sm font-semibold">{name}</p><p className="mt-5 text-3xl font-semibold text-brand">{score}</p><p className="mt-2 text-xs text-graphite">{status}</p><div className="mt-4 h-2 rounded-full bg-ink/10"><div className="h-2 rounded-full bg-brand" style={{ width: score }} /></div></div>)}</div></Shell>
}
