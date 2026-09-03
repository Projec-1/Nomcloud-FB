import type {
  AcademicYear,
  Announcement,
  AttendanceRecord,
  AttendanceStatus,
  Exam,
  FeeRecord,
  FeeStatus,
  GradeRecord,
  Homework,
  MessageThread,
  NotificationItem,
  Parent,
  SchoolClass,
  SchoolSettings,
  Student,
  Teacher,
} from '@/types'
import { colorFor } from '@/constants/avatarColors'
import { schoolDays } from '@/utils/schoolCalendar'

// ---------------------------------------------------------------------------
// Academic years
// ---------------------------------------------------------------------------
export const academicYears: AcademicYear[] = [
  {
    id: 'ay-2024',
    label: '2024 / 2025',
    startDate: '2024-09-02',
    endDate: '2025-06-27',
    status: 'closed',
    terms: [
      { id: 'ay24-t1', name: 'Term 1', startDate: '2024-09-02', endDate: '2024-12-06' },
      { id: 'ay24-t2', name: 'Term 2', startDate: '2025-01-06', endDate: '2025-03-28' },
      { id: 'ay24-t3', name: 'Term 3', startDate: '2025-04-14', endDate: '2025-06-27' },
    ],
  },
  {
    id: 'ay-2025',
    label: '2025 / 2026',
    startDate: '2025-09-01',
    endDate: '2026-06-26',
    status: 'active',
    terms: [
      { id: 'ay25-t1', name: 'Term 1', startDate: '2025-09-01', endDate: '2025-12-05' },
      { id: 'ay25-t2', name: 'Term 2', startDate: '2026-01-05', endDate: '2026-03-27' },
      { id: 'ay25-t3', name: 'Term 3', startDate: '2026-04-13', endDate: '2026-06-26' },
    ],
  },
  {
    id: 'ay-2026',
    label: '2026 / 2027',
    startDate: '2026-09-01',
    endDate: '2027-06-25',
    status: 'upcoming',
    terms: [
      { id: 'ay26-t1', name: 'Term 1', startDate: '2026-09-01', endDate: '2026-12-04' },
      { id: 'ay26-t2', name: 'Term 2', startDate: '2027-01-04', endDate: '2027-03-26' },
      { id: 'ay26-t3', name: 'Term 3', startDate: '2027-04-12', endDate: '2027-06-25' },
    ],
  },
]

export const CURRENT_TERM = 'Term 1'

export const schoolSettings: SchoolSettings = {
  id: 'sch-001',
  name: 'Nom Cloud Demo Academy',
  address: 'Ngong Road, Nairobi, Kenya',
  phone: '+254 700 112 233',
  email: 'admin@nomcloud-academy.ac.ke',
  website: 'www.nomcloud-academy.ac.ke',
  logoInitial: 'N',
  primaryColor: '#FF5A1F',
  academicYearId: 'ay-2025',
  gradingScale: 'percentage',
  timezone: 'Africa/Nairobi',
  attendanceCutoffTime: '09:00',
  emailNotifications: true,
  smsNotifications: true,
  parentPortalEnabled: true,
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------
const teacherSeed: Array<[string, string, string]> = [
  ['Amina Yusuf', 'Mathematics', 'amina.yusuf'],
  ['David Mwangi', 'English Language', 'david.mwangi'],
  ['Fatima Noor', 'Integrated Science', 'fatima.noor'],
  ['Peter Otieno', 'Social Studies', 'peter.otieno'],
  ['Halima Abdi', 'Kiswahili', 'halima.abdi'],
  ['James Kariuki', 'Computer Studies', 'james.kariuki'],
  ['Grace Wanjiru', 'Creative Arts', 'grace.wanjiru'],
  ['Omar Hassan', 'Physical Education', 'omar.hassan'],
]

export const teachers: Teacher[] = teacherSeed.map(([name, subject, handle], i) => ({
  id: `t${i + 1}`,
  name,
  email: `${handle}@nomcloud-academy.ac.ke`,
  phone: `+254 71${(i + 1).toString().padStart(1, '0')} ${(200000 + i * 1234).toString().slice(0, 6)}`,
  subject,
  classIds: [],
  status: 'active',
  joinedDate: `202${2 + (i % 3)}-0${(i % 8) + 1}-1${i % 9}`,
  avatarColor: colorFor(i),
}))

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------
const classSeed: Array<[string, string, string, number]> = [
  ['Grade 6A', '6', 'A', 0],
  ['Grade 6B', '6', 'B', 1],
  ['Grade 7A', '7', 'A', 2],
  ['Grade 7B', '7', 'B', 3],
  ['Grade 8A', '8', 'A', 4],
  ['Grade 8B', '8', 'B', 5],
]

export const classes: SchoolClass[] = classSeed.map(([name, grade, section, teacherIdx], i) => ({
  id: `c${i + 1}`,
  name,
  grade,
  section,
  teacherId: teachers[teacherIdx].id,
  studentIds: [],
  subject: ['Mathematics', 'English Language', 'Integrated Science', 'Social Studies', 'Kiswahili'],
  capacity: 32,
  room: `Room ${100 + i}`,
}))

classes.forEach((c) => {
  const t = teachers.find((t) => t.id === c.teacherId)
  if (t) t.classIds.push(c.id)
})
// Give a couple of teachers a second class for realism
teachers[5].classIds.push(classes[2].id)
teachers[6].classIds.push(classes[4].id)

// ---------------------------------------------------------------------------
// Students & Parents
// ---------------------------------------------------------------------------
const firstNamesM = ['Ahmed', 'Ibrahim', 'Yusuf', 'Musa', 'Hassan', 'Khalid', 'Samuel', 'Brian', 'Kevin', 'Elijah', 'Noah', 'Liam']
const firstNamesF = ['Amina', 'Fatuma', 'Zainab', 'Halima', 'Mariam', 'Sara', 'Grace', 'Faith', 'Joy', 'Diana', 'Aisha', 'Layla']
const lastNames = ['Abdullahi', 'Mohamed', 'Ali', 'Farah', 'Warsame', 'Njoroge', 'Kamau', 'Achieng', 'Otieno', 'Mutua', 'Wafula', 'Kiptoo']

export const students: Student[] = []
export const parents: Parent[] = []

let studentCounter = 0
let parentCounter = 0

classes.forEach((cls, classIdx) => {
  const classSize = 6
  for (let i = 0; i < classSize; i++) {
    studentCounter += 1
    const isMale = studentCounter % 2 === 0
    const first = isMale
      ? firstNamesM[studentCounter % firstNamesM.length]
      : firstNamesF[studentCounter % firstNamesF.length]
    const last = lastNames[(studentCounter + classIdx) % lastNames.length]
    const studentId = `s${studentCounter}`

    // Every third student shares a parent with the previous one (sibling)
    let parentId: string
    if (i > 0 && i % 3 === 0 && parents.length > 0) {
      parentId = parents[parents.length - 1].id
      parents[parents.length - 1].studentIds.push(studentId)
    } else {
      parentCounter += 1
      parentId = `p${parentCounter}`
      const parentLast = last
      parents.push({
        id: parentId,
        name: `${isMale ? 'Mr.' : 'Mrs.'} ${parentLast} ${isMale ? firstNamesM[(parentCounter + 3) % firstNamesM.length] : ''}`.trim(),
        email: `parent.${parentLast.toLowerCase()}${parentCounter}@gmail.com`,
        phone: `+254 72${parentCounter.toString().padStart(1, '0')} ${(300000 + parentCounter * 777).toString().slice(0, 6)}`,
        studentIds: [studentId],
        avatarColor: colorFor(parentCounter + 2),
      })
    }

    students.push({
      id: studentId,
      name: `${first} ${last}`,
      admissionNo: `NCA-${2025000 + studentCounter}`,
      classId: cls.id,
      parentId,
      gender: isMale ? 'Male' : 'Female',
      dateOfBirth: `201${3 + (classIdx % 4)}-0${(studentCounter % 9) + 1}-1${studentCounter % 8}`,
      status: 'active',
      enrolledDate: `202${3 + (classIdx % 2)}-01-1${classIdx}`,
      avatarColor: colorFor(studentCounter),
    })
    cls.studentIds.push(studentId)
  }
})

// ---------------------------------------------------------------------------
// Attendance — last 12 school days across all classes
// ---------------------------------------------------------------------------
export const attendanceRecords: AttendanceRecord[] = []
let attendanceCounter = 0
const statusCycle: AttendanceStatus[] = ['present', 'present', 'present', 'present', 'present', 'late', 'absent', 'present', 'present', 'excused']

classes.forEach((cls) => {
  schoolDays.forEach((date, dayIdx) => {
    cls.studentIds.forEach((studentId, sIdx) => {
      attendanceCounter += 1
      const status = statusCycle[(sIdx * 3 + dayIdx) % statusCycle.length]
      attendanceRecords.push({
        id: `att-${attendanceCounter}`,
        classId: cls.id,
        studentId,
        date,
        status,
        markedBy: cls.teacherId,
        note: status === 'excused' ? 'Medical appointment' : status === 'absent' && sIdx % 4 === 0 ? 'No reason provided' : undefined,
      })
    })
  })
})

// ---------------------------------------------------------------------------
// Grades
// ---------------------------------------------------------------------------
const assessmentTypes = ['CAT 1', 'CAT 2', 'Mid-Term Exam', 'End-Term Exam', 'Assignment']

function scoreToGrade(pct: number) {
  if (pct >= 90) return 'A'
  if (pct >= 80) return 'A-'
  if (pct >= 70) return 'B+'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C+'
  if (pct >= 40) return 'C'
  return 'D'
}

export const gradeRecords: GradeRecord[] = []
let gradeCounter = 0
classes.forEach((cls, classIdx) => {
  cls.studentIds.forEach((studentId, sIdx) => {
    cls.subject.forEach((subject, subjIdx) => {
      assessmentTypes.slice(0, 3).forEach((assessment, aIdx) => {
        gradeCounter += 1
        const base = 55 + ((sIdx * 7 + subjIdx * 5 + aIdx * 3 + classIdx * 2) % 44)
        const maxScore = 100
        gradeRecords.push({
          id: `gr-${gradeCounter}`,
          studentId,
          classId: cls.id,
          subject,
          term: CURRENT_TERM,
          assessment,
          score: base,
          maxScore,
          grade: scoreToGrade(base),
          recordedBy: cls.teacherId,
          date: schoolDays[(aIdx * 3) % schoolDays.length],
          comment: base >= 85 ? 'Outstanding work, keep it up!' : base < 50 ? 'Needs extra support — let’s meet.' : undefined,
        })
      })
    })
  })
})

// ---------------------------------------------------------------------------
// Homework
// ---------------------------------------------------------------------------
export const homeworkList: Homework[] = []
let hwCounter = 0
const hwTitles: Record<string, string[]> = {
  Mathematics: ['Fractions & Decimals worksheet', 'Algebra practice set', 'Geometry: angles & shapes'],
  'English Language': ['Comprehension passage & questions', 'Essay: My Favourite Holiday', 'Grammar exercise — tenses'],
  'Integrated Science': ['Plant cell diagram labelling', 'States of matter worksheet', 'Simple machines project'],
  'Social Studies': ['Map reading exercise', 'County research project', 'Timeline of independence'],
  Kiswahili: ['Insha: Safari Yangu', 'Msamiati — mazoezi', 'Ufahamu na maswali'],
}

classes.forEach((cls, classIdx) => {
  cls.subject.slice(0, 3).forEach((subject, subjIdx) => {
    hwCounter += 1
    const titles = hwTitles[subject] ?? ['Homework assignment']
    const title = titles[(classIdx + subjIdx) % titles.length]
    const assignedOffset = 6 - subjIdx * 2
    const dueOffset = 2 - subjIdx
    const assignedDate = new Date()
    assignedDate.setDate(assignedDate.getDate() - assignedOffset)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + dueOffset)

    const submissions = cls.studentIds.map((studentId, sIdx) => {
      const roll = (sIdx + subjIdx + classIdx) % 5
      if (dueOffset < 0) {
        return {
          studentId,
          status: (roll === 0 ? 'late' : 'graded') as 'late' | 'graded',
          submittedDate: assignedDate.toISOString().slice(0, 10),
          grade: roll === 0 ? undefined : scoreToGrade(60 + roll * 8),
        }
      }
      return {
        studentId,
        status: (roll <= 1 ? 'submitted' : 'pending') as 'submitted' | 'pending',
        submittedDate: roll <= 1 ? new Date().toISOString().slice(0, 10) : undefined,
      }
    })

    homeworkList.push({
      id: `hw-${hwCounter}`,
      classId: cls.id,
      subject,
      title,
      description: `Complete the "${title}" and bring your notebook for review during the next lesson. Reach out to your teacher via Messages if you need help.`,
      assignedDate: assignedDate.toISOString().slice(0, 10),
      dueDate: dueDate.toISOString().slice(0, 10),
      attachments: (subjIdx % 2) + 1,
      createdBy: cls.teacherId,
      submissions,
    })
  })
})

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------
export const exams: Exam[] = []
let examCounter = 0
classes.forEach((cls, classIdx) => {
  cls.subject.forEach((subject, subjIdx) => {
    examCounter += 1
    const dayOffset = subjIdx * 2 - 4 + classIdx
    const date = new Date()
    date.setDate(date.getDate() + dayOffset)
    exams.push({
      id: `ex-${examCounter}`,
      name: `${subject} — End of Term Exam`,
      classId: cls.id,
      subject,
      date: date.toISOString().slice(0, 10),
      startTime: `${8 + (subjIdx % 4)}:00`,
      duration: 90,
      maxScore: 100,
      term: CURRENT_TERM,
      status: dayOffset < 0 ? 'completed' : 'scheduled',
      room: cls.room,
    })
  })
})

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------
const feeCategories = [
  { name: 'Tuition Fee', amount: 450 },
  { name: 'Transport', amount: 80 },
  { name: 'Lunch Program', amount: 60 },
  { name: 'Activity Fee', amount: 35 },
]

export const feeRecords: FeeRecord[] = []
let feeCounter = 0
students.forEach((student, idx) => {
  feeCategories.forEach((cat, catIdx) => {
    feeCounter += 1
    const roll = (idx + catIdx) % 5
    let status: FeeStatus = 'paid'
    let amountPaid = cat.amount
    const payments: FeeRecord['payments'] = []
    if (roll === 0) {
      status = 'unpaid'
      amountPaid = 0
    } else if (roll === 1) {
      status = 'partial'
      amountPaid = Math.round(cat.amount * 0.5)
      payments.push({
        id: `pay-${feeCounter}-1`,
        amount: amountPaid,
        date: schoolDays[2],
        method: 'mobile_money',
        reference: `MPX${100000 + feeCounter}`,
      })
    } else if (roll === 2 && catIdx === 0) {
      status = 'overdue'
      amountPaid = 0
    } else {
      payments.push({
        id: `pay-${feeCounter}-1`,
        amount: amountPaid,
        date: schoolDays[0],
        method: catIdx % 2 === 0 ? 'bank_transfer' : 'card',
        reference: `TXN${200000 + feeCounter}`,
      })
    }
    const due = new Date()
    due.setDate(due.getDate() + (catIdx === 0 ? -5 : 10 + catIdx * 5))
    feeRecords.push({
      id: `fee-${feeCounter}`,
      studentId: student.id,
      term: CURRENT_TERM,
      category: cat.name,
      amount: cat.amount,
      amountPaid,
      dueDate: due.toISOString().slice(0, 10),
      status,
      payments,
    })
  })
})

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
export const announcements: Announcement[] = [
  {
    id: 'an-1',
    title: 'Term 1 Mid-Term Break Schedule',
    body: 'School will close for mid-term break from the 24th and resume on the 3rd. Please ensure fee balances are cleared before the break begins.',
    audience: 'all',
    priority: 'important',
    createdBy: 'School Administration',
    createdByRole: 'admin',
    date: schoolDays[1],
    pinned: true,
  },
  {
    id: 'an-2',
    title: 'Parent-Teacher Conference — Saturday',
    body: 'We invite all parents to our Term 1 parent-teacher conference this Saturday from 9:00 AM. Please book a slot with your child\'s class teacher.',
    audience: 'parents',
    priority: 'important',
    createdBy: 'School Administration',
    createdByRole: 'admin',
    date: schoolDays[3],
  },
  {
    id: 'an-3',
    title: 'Staff Meeting — Curriculum Review',
    body: 'All teaching staff are required to attend the curriculum review meeting in the staff room at 3:30 PM today.',
    audience: 'teachers',
    priority: 'normal',
    createdBy: 'School Administration',
    createdByRole: 'admin',
    date: schoolDays[5],
  },
  {
    id: 'an-4',
    title: 'Science Fair Submissions Due Friday',
    body: 'Grade 7A, please submit your science fair project proposals by Friday. Reach out if you need extra materials from the lab.',
    audience: 'class',
    classId: 'c3',
    priority: 'normal',
    createdBy: 'Fatima Noor',
    createdByRole: 'teacher',
    date: schoolDays[6],
  },
  {
    id: 'an-5',
    title: 'Fee Payment Reminder',
    body: 'A gentle reminder that Term 1 tuition balances are due by end of month. You can pay directly through the parent portal.',
    audience: 'parents',
    priority: 'urgent',
    createdBy: 'School Administration',
    createdByRole: 'admin',
    date: schoolDays[8],
  },
  {
    id: 'an-6',
    title: 'Interclass Sports Day',
    body: 'Get ready for our annual interclass sports day! Classes should prepare their team colours and cheer squads.',
    audience: 'students',
    priority: 'normal',
    createdBy: 'Omar Hassan',
    createdByRole: 'teacher',
    date: schoolDays[9],
  },
]

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
export const messageThreads: MessageThread[] = [
  {
    id: 'mt-1',
    participantIds: ['t1', 'p1'],
    participantNames: ['Amina Yusuf', parents[0]?.name ?? 'Parent'],
    subject: `Progress update for ${students[0]?.name ?? 'your child'}`,
    studentId: students[0]?.id,
    updatedAt: schoolDays[10],
    messages: [
      {
        id: 'm-1',
        senderId: 't1',
        senderName: 'Amina Yusuf',
        body: `Hi, just wanted to flag that ${students[0]?.name ?? 'your child'} has been doing really well in Mathematics this term. Keep encouraging the practice at home!`,
        date: schoolDays[10],
      },
      {
        id: 'm-2',
        senderId: 'p1',
        senderName: parents[0]?.name ?? 'Parent',
        body: 'Thank you so much for letting me know! We will keep it up at home. Is there anything specific we should focus on?',
        date: schoolDays[9],
      },
    ],
  },
  {
    id: 'mt-2',
    participantIds: ['t3', 'p2'],
    participantNames: ['Fatima Noor', parents[1]?.name ?? 'Parent'],
    subject: 'Missed homework submission',
    studentId: students[1]?.id,
    updatedAt: schoolDays[7],
    messages: [
      {
        id: 'm-3',
        senderId: 't3',
        senderName: 'Fatima Noor',
        body: `Hello, I noticed the Science homework wasn't submitted this week. Could you please check in with your child?`,
        date: schoolDays[7],
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Notifications (per role, generated at runtime by service using this base)
// ---------------------------------------------------------------------------
export const notificationSeed: Omit<NotificationItem, 'id' | 'userId'>[] = [
  { title: 'New announcement posted', body: 'Term 1 Mid-Term Break Schedule', type: 'announcement', date: schoolDays[1], read: false, link: '/app/parent/announcements' },
  { title: 'New grade recorded', body: 'Mathematics — Mid-Term Exam score is now available', type: 'grade', date: schoolDays[3], read: false, link: '/app/parent/grades' },
  { title: 'Attendance alert', body: 'Marked late on ' + schoolDays[4], type: 'attendance', date: schoolDays[4], read: true, link: '/app/parent/attendance' },
  { title: 'Fee reminder', body: 'Tuition Fee balance is due soon', type: 'fee', date: schoolDays[6], read: false, link: '/app/parent/fees' },
  { title: 'New homework assigned', body: 'Comprehension passage & questions — due soon', type: 'homework', date: schoolDays[8], read: true, link: '/app/parent/homework' },
  { title: 'New message', body: 'You have a new message from the class teacher', type: 'message', date: schoolDays[9], read: false, link: '/app/parent/messages' },
]

export function findStudent(id: string) {
  return students.find((s) => s.id === id)
}
export function findParent(id: string) {
  return parents.find((p) => p.id === id)
}
export function findTeacher(id: string) {
  return teachers.find((t) => t.id === id)
}
export function findClass(id: string) {
  return classes.find((c) => c.id === id)
}
