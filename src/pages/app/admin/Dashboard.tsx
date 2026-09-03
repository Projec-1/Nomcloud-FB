import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  GraduationCap,
  Wallet,
  CalendarCheck,
  ArrowRight,
  Bell,
  Megaphone,
  UserPlus,
  BookPlus,
  TrendingUp,
} from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import StatCard from '@/components/ui/StatCard'
import PageHeader from '@/components/ui/PageHeader'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import { formatCurrency, percentage, timeAgo } from '@/utils/format'
import { schoolDays } from '@/utils/schoolCalendar'
import type { AnnouncementAudience } from '@/types'

type QuickAction = 'student' | 'teacher' | 'announcement' | null

export default function AdminDashboard() {
  const { currentUser } = useAuth()
  const { students, teachers, classes, attendance, fees, announcements, parents, addStudent, addTeacher, addAnnouncement } = useData()
  const { showToast } = useToast()

  const [action, setAction] = useState<QuickAction>(null)
  const [studentForm, setStudentForm] = useState({ name: '', classId: classes[0]?.id ?? '', gender: 'Male' as 'Male' | 'Female', dateOfBirth: '', parentId: parents[0]?.id ?? '' })
  const [teacherForm, setTeacherForm] = useState({ name: '', email: '', phone: '', subject: '' })
  const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '', audience: 'all' as AnnouncementAudience, priority: 'normal' as 'normal' | 'important' | 'urgent' })

  const latestDay = schoolDays[schoolDays.length - 1]
  const today = attendance.filter((a) => a.date === latestDay)
  const presentToday = today.filter((a) => a.status === 'present' || a.status === 'late').length
  const attendanceRate = today.length ? percentage(presentToday, today.length) : 0

  const totalDue = fees.reduce((sum, f) => sum + f.amount, 0)
  const totalCollected = fees.reduce((sum, f) => sum + f.amountPaid, 0)

  const recentAnnouncements = announcements.slice(0, 4)

  // Daily attendance trend, derived from real seeded attendance records — recomputes
  // to a fresh trailing window every time the app is opened on a new day.
  const trend = useMemo(
    () =>
      schoolDays.map((day) => {
        const records = attendance.filter((a) => a.date === day)
        const present = records.filter((a) => a.status === 'present' || a.status === 'late').length
        return records.length ? percentage(present, records.length) : 0
      }),
    [attendance],
  )
  const trendPath = trend
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * (240 / (trend.length - 1))).toFixed(1)} ${(56 - (v / 100) * 56).toFixed(1)}`)
    .join(' ')

  const classSummaries = classes.slice(0, 5).map((c) => {
    const teacher = teachers.find((t) => t.id === c.teacherId)
    const classAttendance = attendance.filter((a) => a.classId === c.id && a.date === latestDay)
    const presentCount = classAttendance.filter((a) => a.status === 'present' || a.status === 'late').length
    const rate = classAttendance.length ? percentage(presentCount, classAttendance.length) : 0
    return { ...c, teacherName: teacher?.name ?? 'Unassigned', rate }
  })

  const closeModal = () => setAction(null)

  const submitStudent = () => {
    if (!studentForm.name.trim() || !studentForm.classId || !studentForm.dateOfBirth || !studentForm.parentId) {
      showToast({ type: 'error', title: 'Fill in every field to enroll a student' })
      return
    }
    const targetClass = classes.find((c) => c.id === studentForm.classId)
    if (targetClass && targetClass.studentIds.length >= 50) {
      showToast({ type: 'error', title: `${targetClass.name} is full`, description: 'Classes are limited to 50 students. Choose another class.' })
      return
    }
    addStudent({
      name: studentForm.name,
      admissionNo: `ADM-${Math.floor(1000 + Math.random() * 9000)}`,
      classId: studentForm.classId,
      gender: studentForm.gender,
      dateOfBirth: studentForm.dateOfBirth,
      parentId: studentForm.parentId,
    })
    showToast({ type: 'success', title: 'Student enrolled', description: `${studentForm.name} was added to the school.` })
    setStudentForm({ name: '', classId: classes[0]?.id ?? '', gender: 'Male', dateOfBirth: '', parentId: parents[0]?.id ?? '' })
    closeModal()
  }

  const submitTeacher = () => {
    if (!teacherForm.name.trim() || !teacherForm.email.trim() || !teacherForm.subject.trim()) {
      showToast({ type: 'error', title: 'Fill in name, email and subject' })
      return
    }
    addTeacher(teacherForm)
    showToast({ type: 'success', title: 'Teacher added', description: `${teacherForm.name} can now sign in once invited.` })
    setTeacherForm({ name: '', email: '', phone: '', subject: '' })
    closeModal()
  }

  const submitAnnouncement = () => {
    if (!announcementForm.title.trim() || !announcementForm.body.trim()) {
      showToast({ type: 'error', title: 'Add a title and message' })
      return
    }
    addAnnouncement({
      title: announcementForm.title,
      body: announcementForm.body,
      audience: announcementForm.audience,
      priority: announcementForm.priority,
      createdBy: currentUser?.name ?? 'School Administration',
      createdByRole: 'admin',
    })
    showToast({ type: 'success', title: 'Announcement sent', description: 'It now appears across the relevant dashboards.' })
    setAnnouncementForm({ title: '', body: '', audience: 'all', priority: 'normal' })
    closeModal()
  }

  return (
    <div>
      <PageHeader
        title={`Good to see you, ${currentUser?.name.split(' ')[0]}`}
        description="Here's what's happening across Nom Cloud Demo Academy today."
        actions={
          <Link to="/app/admin/announcements" className="btn-accent px-5 py-2.5 text-sm">
            <Megaphone className="h-4 w-4" /> New Announcement
          </Link>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Students" value={students.length} icon={Users} tint="#0071E3" trend={{ value: '+4.2%', positive: true }} />
        <StatCard label="Total Teachers" value={teachers.length} icon={GraduationCap} tint="#FF5A1F" trend={{ value: '+1', positive: true }} />
        <StatCard label="Attendance Today" value={`${attendanceRate}%`} icon={CalendarCheck} tint="#34A853" />
        <StatCard label="Fees Collected" value={formatCurrency(totalCollected)} icon={Wallet} tint="#A855F7" />
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <button
          onClick={() => setAction('student')}
          className="group flex items-center gap-3 rounded-2xl border border-ink/5 bg-white p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card dark:border-white/10 dark:bg-[#161618]"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent transition-transform group-hover:scale-110">
            <UserPlus className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink dark:text-white">Add a Student</p>
            <p className="text-xs text-graphite">Enroll instantly</p>
          </div>
        </button>
        <button
          onClick={() => setAction('teacher')}
          className="group flex items-center gap-3 rounded-2xl border border-ink/5 bg-white p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card dark:border-white/10 dark:bg-[#161618]"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand transition-transform group-hover:scale-110">
            <BookPlus className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink dark:text-white">Add a Teacher</p>
            <p className="text-xs text-graphite">Grow your staff</p>
          </div>
        </button>
        <button
          onClick={() => setAction('announcement')}
          className="group flex items-center gap-3 rounded-2xl border border-ink/5 bg-white p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card dark:border-white/10 dark:bg-[#161618]"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 transition-transform group-hover:scale-110">
            <Megaphone className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink dark:text-white">Make an Announcement</p>
            <p className="text-xs text-graphite">Reach parents & staff</p>
          </div>
        </button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-semibold text-ink dark:text-white">Classes Overview</h3>
            <Link to="/app/admin/classes" className="link-underline flex items-center gap-1 text-xs font-medium text-accent">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <p className="mb-5 flex items-center gap-1.5 text-xs text-graphite">
            <TrendingUp className="h-3 w-3 text-emerald-500" /> Live attendance trend · last {schoolDays.length} school days
          </p>
          <div className="relative mb-5 h-16 w-full overflow-hidden rounded-xl bg-mist p-2 dark:bg-white/5">
            <svg viewBox="0 0 240 56" preserveAspectRatio="none" className="h-full w-full">
              <defs>
                <linearGradient id="dashTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34A853" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#34A853" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${trendPath} L 240 56 L 0 56 Z`} fill="url(#dashTrendFill)" />
              <path d={trendPath} fill="none" stroke="#34A853" strokeWidth="2" strokeLinecap="round" strokeDasharray="500" className="animate-draw-line" />
            </svg>
          </div>
          <div className="space-y-3">
            {classSummaries.map((c) => (
              <div key={c.id} className="rounded-xl border border-ink/5 px-4 py-3 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink dark:text-white">{c.name}</p>
                    <p className="text-xs text-graphite">{c.teacherName} · {c.room}</p>
                  </div>
                  <Badge tone="neutral">{c.studentIds.length}/50 students</Badge>
                </div>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-ink/5 dark:bg-white/10">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${c.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-semibold text-ink dark:text-white">Recent Announcements</h3>
            <Link to="/app/admin/announcements" className="text-accent">
              <Bell className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {recentAnnouncements.map((a) => (
              <div key={a.id} className="border-b border-ink/5 pb-4 last:border-b-0 last:pb-0 dark:border-white/10">
                <div className="mb-1 flex items-center justify-between">
                  <Badge tone={a.priority === 'urgent' ? 'danger' : a.priority === 'important' ? 'warning' : 'neutral'}>{a.priority}</Badge>
                  <span className="text-[11px] text-graphite">{timeAgo(a.date)}</span>
                </div>
                <p className="text-sm font-medium text-ink dark:text-white">{a.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <h3 className="mb-5 font-semibold text-ink dark:text-white">Fee Collection — Term 1</h3>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-graphite">{formatCurrency(totalCollected)} collected</span>
            <span className="text-graphite">of {formatCurrency(totalDue)}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink/5 dark:bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" style={{ width: `${percentage(totalCollected, totalDue)}%` }} />
          </div>
          <p className="mt-3 text-xs text-graphite">{percentage(totalCollected, totalDue)}% of total fees collected this term.</p>
        </div>
        <div className="card p-6">
          <h3 className="mb-4 font-semibold text-ink dark:text-white">Teaching Staff</h3>
          <div className="space-y-3">
            {teachers.slice(0, 4).map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <Avatar name={t.name} color={t.avatarColor} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink dark:text-white">{t.name}</p>
                  <p className="truncate text-xs text-graphite">{t.subject}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick-add: Student */}
      <Modal
        open={action === 'student'}
        onClose={closeModal}
        title="Add a Student"
        description="Enroll a new student directly from the dashboard."
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={submitStudent}>Add Student</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Full name" required value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Class" value={studentForm.classId} onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.studentIds.length}/50)</option>
              ))}
            </Select>
            <Select label="Gender" value={studentForm.gender} onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value as 'Male' | 'Female' })}>
              <option>Male</option>
              <option>Female</option>
            </Select>
          </div>
          <Input label="Date of birth" type="date" required value={studentForm.dateOfBirth} onChange={(e) => setStudentForm({ ...studentForm, dateOfBirth: e.target.value })} />
          <Select label="Parent / Guardian" value={studentForm.parentId} onChange={(e) => setStudentForm({ ...studentForm, parentId: e.target.value })}>
            <option value="">Select a parent…</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {p.email}</option>
            ))}
          </Select>
        </div>
      </Modal>

      {/* Quick-add: Teacher */}
      <Modal
        open={action === 'teacher'}
        onClose={closeModal}
        title="Add a Teacher"
        description="Add a new teacher to your staff directory."
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={submitTeacher}>Add Teacher</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Full name" required value={teacherForm.name} onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Email" type="email" required value={teacherForm.email} onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })} />
            <Input label="Phone" value={teacherForm.phone} onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })} />
          </div>
          <Input label="Subject" required value={teacherForm.subject} onChange={(e) => setTeacherForm({ ...teacherForm, subject: e.target.value })} placeholder="e.g. Mathematics" />
        </div>
      </Modal>

      {/* Quick: Announcement */}
      <Modal
        open={action === 'announcement'}
        onClose={closeModal}
        title="New Announcement"
        description="Send a message to the whole school, or a specific group."
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={submitAnnouncement}>Send</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Title" required value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} />
          <Textarea label="Message" required rows={4} value={announcementForm.body} onChange={(e) => setAnnouncementForm({ ...announcementForm, body: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Audience" value={announcementForm.audience} onChange={(e) => setAnnouncementForm({ ...announcementForm, audience: e.target.value as AnnouncementAudience })}>
              <option value="all">Entire School</option>
              <option value="teachers">All Teachers</option>
              <option value="parents">All Parents</option>
              <option value="students">All Students</option>
            </Select>
            <Select label="Priority" value={announcementForm.priority} onChange={(e) => setAnnouncementForm({ ...announcementForm, priority: e.target.value as typeof announcementForm.priority })}>
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  )
}
