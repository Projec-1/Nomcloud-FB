import { useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  GraduationCap,
  MessageCircle,
  Paperclip,
  Plus,
  Settings,
  ShieldCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { MOCK_CLASSES, loadMockLessons, type MockLesson } from '@/data/mockTimetable'

type Child = { id: string; name: string; classId: string; className: string; grade: string }
type AttendanceRecord = { date: string; status: 'Present' | 'Late' | 'Absent'; note?: string }
type HomeworkItem = { id: string; subject: string; title: string; teacher: string; due: string; status: 'Pending' | 'Submitted' | 'Late' | 'Completed'; instructions: string }
type ResultItem = { subject: string; score: number; assessment: string; date: string }

const children: Child[] = [
  { id: 'ahmed', name: 'Ahmed Ali', classId: 'grade-7', className: 'Grade 7A', grade: 'Grade 7' },
  { id: 'amina', name: 'Amina Ali', classId: 'grade-5', className: 'Grade 5B', grade: 'Grade 5' },
]

const attendance: Record<string, AttendanceRecord[]> = {
  ahmed: [
    { date: 'September 24', status: 'Present' }, { date: 'September 23', status: 'Present' },
    { date: 'September 22', status: 'Late', note: 'Arrived at 08:12' }, { date: 'September 21', status: 'Absent', note: 'Reported sick' },
  ],
  amina: [
    { date: 'September 24', status: 'Present' }, { date: 'September 23', status: 'Present' },
    { date: 'September 22', status: 'Present' }, { date: 'September 21', status: 'Present' },
  ],
}

const homework: Record<string, HomeworkItem[]> = {
  ahmed: [
    { id: 'hw-1', subject: 'Mathematics', title: 'Fractions practice', teacher: 'Ahmed Hassan', due: 'September 27', status: 'Pending', instructions: 'Complete questions 1–20 in the workbook.' },
    { id: 'hw-2', subject: 'English', title: 'Reading response', teacher: 'Maryan Ali', due: 'September 25', status: 'Submitted', instructions: 'Read chapter four and write a short response.' },
  ],
  amina: [
    { id: 'hw-3', subject: 'Science', title: 'Plant life worksheet', teacher: 'Hodan Yusuf', due: 'September 28', status: 'Completed', instructions: 'Label the plant diagram and answer the review questions.' },
  ],
}

const results: Record<string, ResultItem[]> = {
  ahmed: [
    { subject: 'Mathematics', score: 86, assessment: 'Term 1 quiz', date: 'September 20' },
    { subject: 'English', score: 81, assessment: 'Reading assessment', date: 'September 18' },
    { subject: 'Science', score: 89, assessment: 'Unit assessment', date: 'September 15' },
  ],
  amina: [
    { subject: 'Mathematics', score: 92, assessment: 'Number skills', date: 'September 20' },
    { subject: 'English', score: 88, assessment: 'Writing assessment', date: 'September 18' },
    { subject: 'Science', score: 90, assessment: 'Living things', date: 'September 15' },
  ],
}

const announcements = [
  { id: 'ann-1', title: 'School holiday', body: 'School will be closed on October 1 for the national holiday.', date: 'September 24' },
  { id: 'ann-2', title: 'Exam schedule published', body: 'The Term 1 assessment schedule is now available for families.', date: 'September 22' },
  { id: 'ann-3', title: 'Parent meeting', body: 'Join your child’s class teacher on September 30 at 15:00.', date: 'September 20' },
]

const dayNames: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday' }

export default function ParentWorkspace() {
  const location = useLocation()
  const navigate = useNavigate()
  const section = location.pathname.split('/').pop() || 'parent'
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem('nomcloud-parent-child') || children[0].id)
  const [selectedItem, setSelectedItem] = useState<HomeworkItem | ResultItem | AttendanceRecord | MockLesson | null>(null)
  const [message, setMessage] = useState('')
  const [sentMessages, setSentMessages] = useState<string[]>([])
  const [settings, setSettings] = useState({ attendance: true, homework: true, results: true, announcements: true })
  const [showChildMenu, setShowChildMenu] = useState(false)
  const child = children.find((item) => item.id === selectedId) ?? children[0]
  const childLessons = useMemo(() => loadMockLessons().filter((lesson) => lesson.classId === child.classId && lesson.type === 'lesson'), [child.classId])
  const childAttendance = attendance[child.id]
  const childHomework = homework[child.id]
  const childResults = results[child.id]

  function selectChild(id: string) {
    setSelectedId(id)
    localStorage.setItem('nomcloud-parent-child', id)
    setShowChildMenu(false)
  }

  function open(path: string) { navigate(`/app/parent/${path}`) }

  let content: ReactNode
  if (section === 'timetable') content = <Timetable lessons={childLessons} onSelect={setSelectedItem} />
  else if (section === 'attendance') content = <Attendance records={childAttendance} onSelect={setSelectedItem} />
  else if (section === 'homework') content = <Homework items={childHomework} onSelect={setSelectedItem} />
  else if (section === 'grades') content = <Results items={childResults} onSelect={setSelectedItem} />
  else if (section === 'announcements') content = <Announcements />
  else if (section === 'messages') content = <Messages message={message} setMessage={setMessage} sentMessages={sentMessages} onSend={() => { if (message.trim()) { setSentMessages((current) => [...current, message.trim()]); setMessage('') } }} />
  else if (section === 'children') content = <Children current={child} onSelect={selectChild} />
  else if (section === 'notifications') content = <Notifications open={open} />
  else if (section === 'settings') content = <SettingsView settings={settings} setSettings={setSettings} />
  else content = <Overview child={child} lessons={childLessons} records={childAttendance} pending={childHomework.filter((item) => item.status === 'Pending')} latestResult={childResults[0]} open={open} onSelectLesson={setSelectedItem} />

  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Family workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{section === 'parent' ? 'Good morning, Fatima' : pageTitle(section)}</h1>
          <p className="mt-2 text-sm text-graphite">Hodan International School · Term 1, 2026</p>
        </div>
        <div className="relative">
          <button className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2 text-left dark:border-white/10 dark:bg-white/5" onClick={() => setShowChildMenu((open) => !open)}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">{child.name[0]}</span>
            <span><span className="block text-sm font-semibold">{child.name}</span><span className="block text-xs text-graphite">{child.className}</span></span>
            <ChevronDown className="h-4 w-4 text-graphite" />
          </button>
          {showChildMenu && <div className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-ink/10 bg-white p-2 shadow-card dark:border-white/10 dark:bg-[#161618]">{children.map((item) => <button key={item.id} onClick={() => selectChild(item.id)} className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-brand/5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">{item.name[0]}</span><span><span className="block text-sm font-semibold">{item.name}</span><span className="block text-xs text-graphite">{item.className}</span></span></button>)}</div>}
        </div>
      </div>
      {content}
      <Modal open={Boolean(selectedItem)} onClose={() => setSelectedItem(null)} title={itemTitle(selectedItem)} description="Information from the school workspace">
        {selectedItem && <ItemDetails item={selectedItem} />}
      </Modal>
    </>
  )
}

function pageTitle(section: string) { return ({ timetable: 'Timetable', attendance: 'Attendance', homework: 'Homework', grades: 'Results', announcements: 'Announcements', messages: 'Messages', children: 'My Children', notifications: 'Notifications', settings: 'Settings' }[section] ?? 'Overview') }
function itemTitle(item: ParentWorkspaceProps['selectedItem']) { if (!item) return ''; if ('instructions' in item) return item.title; if ('assessment' in item) return item.subject; if ('date' in item) return item.date; return item.subject }
type ParentWorkspaceProps = { selectedItem: HomeworkItem | ResultItem | AttendanceRecord | MockLesson | null }

function Overview({ child, lessons, records, pending, latestResult, open, onSelectLesson }: { child: Child; lessons: MockLesson[]; records: AttendanceRecord[]; pending: HomeworkItem[]; latestResult: ResultItem; open: (path: string) => void; onSelectLesson: (lesson: MockLesson) => void }) {
  return <div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Summary label="Today’s classes" value={String(lessons.filter((lesson) => lesson.day === 1).length || 3)} icon={CalendarDays} />
      <Summary label="Attendance" value="92%" icon={Check} />
      <Summary label="Pending homework" value={String(pending.length)} icon={BookOpen} />
      <Summary label="Latest result" value={`${latestResult.score}%`} icon={GraduationCap} />
    </div>
    <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="card p-5"><SectionHeading title="Today’s schedule" action={<button className="text-xs font-semibold text-brand" onClick={() => open('timetable')}>View timetable <ArrowRight className="inline h-3 w-3" /></button>} /><p className="mb-4 text-xs text-graphite">School timetable · Managed by Administration</p><div className="space-y-2">{lessons.slice(0, 3).map((lesson) => <button key={lesson.id} onClick={() => onSelectLesson(lesson)} className="flex w-full items-center gap-3 rounded-xl bg-mist/60 p-3 text-left hover:bg-brand/5"><Clock className="h-4 w-4 text-brand" /><span className="flex-1"><span className="block text-sm font-semibold">{lesson.startTime} — {lesson.subject}</span><span className="text-xs text-graphite">{child.className} · {lesson.teacher}</span></span><ArrowRight className="h-4 w-4 text-graphite" /></button>)}</div></div>
      <div className="card p-5"><SectionHeading title="Recent updates" /><div className="mt-4 space-y-4">{['Mathematics assignment added', `${child.name.split(' ')[0]} was marked absent`, 'New result published', 'School announcement'].map((update) => <button key={update} onClick={() => open(update.includes('assignment') ? 'homework' : update.includes('absent') ? 'attendance' : update.includes('result') ? 'grades' : 'announcements')} className="flex w-full items-start gap-3 text-left text-sm hover:text-brand"><span className="mt-1 h-2 w-2 rounded-full bg-brand" />{update}<ArrowRight className="ml-auto h-4 w-4 text-graphite" /></button>)}</div></div>
    </div>
  </div>
}

function Summary({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Check }) { return <div className="card p-5"><Icon className="h-5 w-5 text-brand" /><p className="mt-4 text-xs text-graphite">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div> }
function SectionHeading({ title, action }: { title: string; action?: ReactNode }) { return <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{title}</h2>{action}</div> }

function Timetable({ lessons, onSelect }: { lessons: MockLesson[]; onSelect: (lesson: MockLesson) => void }) { return <div className="card overflow-hidden"><div className="flex items-center justify-between border-b border-ink/5 p-5"><div><h2 className="font-semibold">This week</h2><p className="mt-1 text-xs text-graphite">Classes, teachers, rooms and times published by Administration.</p></div><div className="flex gap-2"><Badge tone="brand">Today</Badge><Badge>This week</Badge></div></div><div className="divide-y divide-ink/5">{lessons.map((lesson) => <button key={lesson.id} onClick={() => onSelect(lesson)} className="flex w-full items-center gap-4 p-5 text-left hover:bg-brand/5"><span className="w-24 text-xs font-semibold text-graphite">{dayNames[lesson.day]}<br />{lesson.startTime}</span><span className="flex-1"><span className="block font-semibold">{lesson.subject}</span><span className="text-xs text-graphite">{lesson.teacher} · {lesson.classId === 'grade-7' ? 'Room 204' : 'Room 105'}</span></span><ArrowRight className="h-4 w-4 text-graphite" /></button>)}</div></div> }
function Attendance({ records, onSelect }: { records: AttendanceRecord[]; onSelect: (record: AttendanceRecord) => void }) { return <div><div className="grid gap-4 sm:grid-cols-3"><Summary label="Present" value="92%" icon={Check} /><Summary label="Absent" value="5%" icon={X} /><Summary label="Late" value="3%" icon={Clock} /></div><div className="card mt-6 p-5"><SectionHeading title="Recent attendance" /><div className="divide-y divide-ink/5">{records.map((record) => <button key={record.date} onClick={() => onSelect(record)} className="flex w-full items-center gap-3 py-4 text-left hover:text-brand"><CalendarDays className="h-4 w-4 text-brand" /><span className="flex-1 text-sm">{record.date}</span><Badge tone={record.status === 'Present' ? 'success' : record.status === 'Late' ? 'warning' : 'danger'}>{record.status}</Badge><ArrowRight className="h-4 w-4 text-graphite" /></button>)}</div></div></div> }
function Homework({ items, onSelect }: { items: HomeworkItem[]; onSelect: (item: HomeworkItem) => void }) { return <div className="card overflow-hidden"><div className="divide-y divide-ink/5">{items.map((item) => <button key={item.id} onClick={() => onSelect(item)} className="flex w-full items-center gap-4 p-5 text-left hover:bg-brand/5"><BookOpen className="h-5 w-5 text-brand" /><span className="flex-1"><span className="block font-semibold">{item.title}</span><span className="text-xs text-graphite">{item.subject} · {item.teacher} · Due {item.due}</span></span><Badge tone={item.status === 'Completed' || item.status === 'Submitted' ? 'success' : item.status === 'Late' ? 'danger' : 'warning'}>{item.status}</Badge></button>)}</div></div> }
function Results({ items, onSelect }: { items: ResultItem[]; onSelect: (item: ResultItem) => void }) { const average = Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length); return <div><div className="card mb-6 flex items-center justify-between p-5"><div><p className="text-xs text-graphite">Overall average</p><p className="mt-1 text-3xl font-semibold">{average}%</p></div><GraduationCap className="h-8 w-8 text-brand" /></div><div className="grid gap-4 md:grid-cols-3">{items.map((item) => <button key={item.subject} onClick={() => onSelect(item)} className="card p-5 text-left hover:border-brand/40"><p className="text-sm font-semibold">{item.subject}</p><p className="mt-5 text-3xl font-semibold text-brand">{item.score}%</p><p className="mt-2 text-xs text-graphite">{item.assessment} · {item.date}</p></button>)}</div></div> }
function Announcements() { return <div className="space-y-3">{announcements.map((item) => <article key={item.id} className="card p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">{item.title}</h2><span className="text-xs text-graphite">{item.date}</span></div><p className="mt-2 text-sm text-graphite">{item.body}</p></article>)}</div> }
function Messages({ message, setMessage, sentMessages, onSend }: { message: string; setMessage: (value: string) => void; sentMessages: string[]; onSend: () => void }) { return <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]"><div className="card divide-y divide-ink/5"><button className="flex w-full items-center gap-3 bg-brand/5 p-4 text-left"><MessageCircle className="h-5 w-5 text-brand" /><span><b className="block text-sm">Ahmed Hassan</b><span className="text-xs text-graphite">Mathematics teacher</span></span></button><button className="flex w-full items-center gap-3 p-4 text-left"><ShieldCheck className="h-5 w-5 text-brand" /><span><b className="block text-sm">School Administration</b><span className="text-xs text-graphite">General enquiries</span></span></button></div><div className="card flex min-h-[340px] flex-col p-5"><SectionHeading title="Messages" /><div className="flex-1 space-y-3 text-sm text-graphite"><p className="rounded-xl bg-mist/60 p-3">Hello, I wanted to share an update about Ahmed’s progress this week.</p>{sentMessages.map((item, index) => <p key={`${item}-${index}`} className="ml-auto max-w-[80%] rounded-xl bg-brand/10 p-3 text-ink">{item}</p>)}</div><div className="mt-4 flex gap-2"><input className="input" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message" /><Button variant="accent" onClick={onSend}>Send</Button></div></div></div> }
function Children({ current, onSelect }: { current: Child; onSelect: (id: string) => void }) { return <div className="grid gap-4 sm:grid-cols-2">{children.map((item) => <button key={item.id} onClick={() => onSelect(item.id)} className={`card flex items-center gap-4 p-5 text-left ${item.id === current.id ? 'border-brand/40 bg-brand/5' : ''}`}><span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-lg font-bold text-brand">{item.name[0]}</span><span><b className="block">{item.name}</b><span className="text-sm text-graphite">{item.className}</span></span><ArrowRight className="ml-auto h-4 w-4 text-graphite" /></button>)}</div> }
function Notifications({ open }: { open: (path: string) => void }) { return <div className="card divide-y divide-ink/5">{[['Ahmed was marked absent today.', 'attendance'], ['New Mathematics result published.', 'grades'], ['New homework assigned.', 'homework'], ['School announcement published.', 'announcements']].map(([text, path]) => <button key={text} onClick={() => open(path)} className="flex w-full items-center gap-3 p-5 text-left hover:bg-brand/5"><Bell className="h-5 w-5 text-brand" /><span className="flex-1 text-sm">{text}</span><ArrowRight className="h-4 w-4 text-graphite" /></button>)}</div> }
function SettingsView({ settings, setSettings }: { settings: { attendance: boolean; homework: boolean; results: boolean; announcements: boolean }; setSettings: (value: { attendance: boolean; homework: boolean; results: boolean; announcements: boolean }) => void }) { return <div className="grid gap-5 lg:grid-cols-2"><div className="card p-5"><SectionHeading title="Profile" /><div className="grid gap-4 sm:grid-cols-2"><label className="label">Name<input className="input mt-2" defaultValue="Fatima Ali" /></label><label className="label">Phone<input className="input mt-2" defaultValue="+252 63 000 0000" /></label><label className="label sm:col-span-2">Email<input className="input mt-2" defaultValue="fatima@example.com" /></label></div><Button className="mt-5" variant="accent">Save profile</Button></div><div className="card p-5"><SectionHeading title="Notifications" /><div className="space-y-2">{[['attendance', 'Attendance alerts'], ['homework', 'Homework updates'], ['results', 'Results'], ['announcements', 'School announcements']].map(([key, label]) => <button key={key} onClick={() => setSettings({ ...settings, [key]: !settings[key as keyof typeof settings] })} className="flex w-full items-center justify-between rounded-xl border border-ink/10 p-3 text-left text-sm"><span>{label}</span><span className={`h-5 w-9 rounded-full p-0.5 ${settings[key as keyof typeof settings] ? 'bg-brand' : 'bg-ink/15'}`}><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${settings[key as keyof typeof settings] ? 'translate-x-4' : ''}`} /></span></button>)}</div><button className="mt-5 flex items-center gap-2 text-sm font-semibold text-brand"><Settings className="h-4 w-4" /> Change password</button></div></div> }
function ItemDetails({ item }: { item: NonNullable<ParentWorkspaceProps['selectedItem']> }) { if ('instructions' in item) return <div className="space-y-3 text-sm"><p><b>Teacher:</b> {item.teacher}</p><p><b>Due:</b> {item.due}</p><p><b>Instructions:</b> {item.instructions}</p><p className="flex items-center gap-2 text-brand"><Paperclip className="h-4 w-4" /> Attached workbook.pdf</p></div>; if ('assessment' in item) return <div className="space-y-3 text-sm"><p><b>Assessment:</b> {item.assessment}</p><p><b>Score:</b> {item.score}%</p><p><b>Published:</b> {item.date}</p></div>; if ('note' in item || 'status' in item && 'date' in item) return <div className="space-y-3 text-sm"><p><b>Date:</b> {item.date}</p><p><b>Status:</b> {item.status}</p>{'note' in item && item.note && <p><b>Note:</b> {item.note}</p>}</div>; return <div className="space-y-3 text-sm"><p><b>Teacher:</b> {item.teacher}</p><p><b>Time:</b> {item.startTime}–{item.endTime}</p><p><b>Room:</b> Room 204</p></div> }
