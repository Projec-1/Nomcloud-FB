export type Role = 'admin' | 'teacher' | 'parent'

export interface SchoolSettings {
  id: string
  name: string
  address: string
  phone: string
  email: string
  website: string
  logoInitial: string
  logoDataUrl?: string
  primaryColor: string
  academicYearId: string
  gradingScale: 'letter' | 'percentage' | 'gpa'
  timezone: string
  attendanceCutoffTime: string
  emailNotifications: boolean
  smsNotifications: boolean
  parentPortalEnabled: boolean
}

export interface AcademicYear {
  id: string
  label: string
  startDate: string
  endDate: string
  status: 'upcoming' | 'active' | 'closed'
  terms: Term[]
}

export interface Term {
  id: string
  name: string
  startDate: string
  endDate: string
}

export interface Teacher {
  id: string
  name: string
  email: string
  phone: string
  subject: string
  classIds: string[]
  status: 'active' | 'inactive'
  joinedDate: string
  avatarColor: string
}

/**
 * ISO 8601 weekday: 1 = Monday through 7 = Sunday.
 *
 * Replaces a `'Monday' | … | 'Friday'` string union, which could not express a
 * Friday-and-Saturday weekend and so could not represent the Somali school week
 * at all (Phase 8 decision 9). Matches timetable_slots.day_of_week smallint and
 * schools.weekend_days, so no translation is needed when batch 4 connects the
 * real table. Use isoWeekdayLabel from @/utils/schoolCalendar to display one.
 */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface TimetableSlot {
  id: string
  classId: string
  teacherId: string
  day: IsoWeekday
  period: number
  startTime: string
  endTime: string
  subject: string
  teacherName?: string
  room: string
}

export interface Student {
  id: string
  name: string
  admissionNo: string
  classId: string
  parentId: string
  gender: 'Male' | 'Female'
  dateOfBirth: string
  status: 'active' | 'inactive' | 'graduated'
  enrolledDate: string
  avatarColor: string
}

export interface Parent {
  id: string
  name: string
  email: string
  phone: string
  studentIds: string[]
  avatarColor: string
}

export interface SchoolClass {
  id: string
  name: string
  grade: string
  section: string
  teacherId: string
  studentIds: string[]
  subject: string[]
  capacity: number
  room: string
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export interface AttendanceRecord {
  id: string
  classId: string
  studentId: string
  date: string
  status: AttendanceStatus
  note?: string
  markedBy: string
}

export interface GradeRecord {
  id: string
  studentId: string
  classId: string
  subject: string
  term: string
  assessment: string
  score: number
  maxScore: number
  grade: string
  comment?: string
  recordedBy: string
  date: string
}

export interface Homework {
  id: string
  classId: string
  subject: string
  title: string
  description: string
  assignedDate: string
  dueDate: string
  attachments: number
  createdBy: string
  submissions: HomeworkSubmission[]
}

export interface HomeworkSubmission {
  studentId: string
  status: 'pending' | 'submitted' | 'late' | 'graded'
  submittedDate?: string
  grade?: string
}

export interface Exam {
  id: string
  name: string
  classId: string
  subject: string
  date: string
  startTime: string
  duration: number
  maxScore: number
  term: string
  status: 'scheduled' | 'completed' | 'cancelled'
  room: string
}

export type FeeStatus = 'paid' | 'partial' | 'unpaid' | 'overdue'

export interface FeeRecord {
  id: string
  studentId: string
  term: string
  category: string
  amount: number
  amountPaid: number
  dueDate: string
  status: FeeStatus
  payments: FeePayment[]
}

export interface FeePayment {
  id: string
  amount: number
  date: string
  method: 'card' | 'bank_transfer' | 'cash' | 'mobile_money'
  reference: string
}

export type AnnouncementAudience = 'all' | 'teachers' | 'parents' | 'students' | 'class'

export interface Announcement {
  id: string
  title: string
  body: string
  audience: AnnouncementAudience
  classId?: string
  priority: 'normal' | 'important' | 'urgent'
  createdBy: string
  createdByRole: Role
  date: string
  pinned?: boolean
}

export interface NotificationItem {
  id: string
  userId: string
  title: string
  body: string
  type: 'announcement' | 'grade' | 'attendance' | 'fee' | 'homework' | 'message'
  date: string
  read: boolean
  link?: string
}

export interface MessageThread {
  id: string
  participantIds: string[]
  participantNames: string[]
  subject: string
  studentId?: string
  messages: ChatMessage[]
  updatedAt: string
}

export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  body: string
  date: string
}

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  description?: string
}
