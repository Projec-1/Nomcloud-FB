import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  AcademicYear,
  Announcement,
  AnnouncementAudience,
  AttendanceRecord,
  AttendanceStatus,
  ChatMessage,
  Exam,
  FeeRecord,
  GradeRecord,
  Homework,
  HomeworkSubmission,
  MessageThread,
  NotificationItem,
  Parent,
  Role,
  SchoolClass,
  SchoolSettings,
  Student,
  Teacher,
  TimetableSlot,
} from '@/types'
import * as seed from '@/data/mockData'
import { makeId } from '@/utils/id'
import { AVATAR_COLORS } from '@/constants/avatarColors'

const STORAGE_KEY = 'nomcloud_school_data_v2'

interface SchoolDataState {
  academicYears: AcademicYear[]
  settings: SchoolSettings
  teachers: Teacher[]
  students: Student[]
  parents: Parent[]
  classes: SchoolClass[]
  attendance: AttendanceRecord[]
  grades: GradeRecord[]
  homework: Homework[]
  exams: Exam[]
  fees: FeeRecord[]
  announcements: Announcement[]
  notifications: NotificationItem[]
  messageThreads: MessageThread[]
  timetables: TimetableSlot[]
}

function scopeKey(role: Role, teacherId?: string, parentId?: string): string {
  if (role === 'admin') return 'admin:all'
  if (role === 'teacher') return `teacher:${teacherId}`
  return `parent:${parentId}`
}

function buildInitialState(): SchoolDataState {
  const demoParentScope = scopeKey('parent', undefined, 'p3')
  const demoTeacherScope = scopeKey('teacher', 't1')
  const demoAdminScope = scopeKey('admin')
  const notifications: NotificationItem[] = seed.notificationSeed.map((n, i) => ({
    ...n,
    id: `not-${i + 1}`,
    userId: i % 3 === 0 ? demoTeacherScope : i % 5 === 0 ? demoAdminScope : demoParentScope,
  }))

  return {
    academicYears: seed.academicYears,
    settings: seed.schoolSettings,
    teachers: seed.teachers,
    students: seed.students,
    parents: seed.parents,
    classes: seed.classes,
    attendance: seed.attendanceRecords,
    grades: seed.gradeRecords,
    homework: seed.homeworkList,
    exams: seed.exams,
    fees: seed.feeRecords,
    announcements: seed.announcements,
    notifications,
    messageThreads: seed.messageThreads,
    timetables: [],
  }
}

function loadState(): SchoolDataState {
  if (typeof window === 'undefined') return buildInitialState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return buildInitialState()
    const parsed = JSON.parse(raw) as Partial<SchoolDataState>
    // Merge in defaults for any fields introduced after a user's data was first saved.
    return { ...buildInitialState(), ...parsed, timetables: parsed.timetables ?? [] }
  } catch {
    return buildInitialState()
  }
}

interface DataContextValue extends SchoolDataState {
  scopeKey: typeof scopeKey
  resetDemoData: () => void
  // Students
  addStudent: (data: Omit<Student, 'id' | 'avatarColor' | 'status' | 'enrolledDate'> & { newParent?: { name: string; email: string; phone: string } }) => Student
  updateStudent: (id: string, data: Partial<Student>) => void
  deleteStudent: (id: string) => void
  // Teachers
  addTeacher: (data: Omit<Teacher, 'id' | 'avatarColor' | 'status' | 'joinedDate' | 'classIds'>) => Teacher
  updateTeacher: (id: string, data: Partial<Teacher>) => void
  deleteTeacher: (id: string) => void
  assignTeacherToClass: (teacherId: string, classId: string) => void
  // Parents
  addParent: (data: Omit<Parent, 'id' | 'studentIds' | 'avatarColor'>) => Parent
  // Classes
  addClass: (data: Omit<SchoolClass, 'id' | 'studentIds'>) => SchoolClass
  updateClass: (id: string, data: Partial<SchoolClass>) => void
  deleteClass: (id: string) => void
  // Timetable
  addTimetableSlot: (data: Omit<TimetableSlot, 'id'>) => void
  deleteTimetableSlot: (id: string) => void
  // Attendance
  markAttendance: (classId: string, date: string, entries: { studentId: string; status: AttendanceStatus; note?: string }[], markedBy: string) => void
  // Grades
  addGrade: (data: Omit<GradeRecord, 'id'>) => void
  updateGrade: (id: string, data: Partial<GradeRecord>) => void
  deleteGrade: (id: string) => void
  // Homework
  addHomework: (data: Omit<Homework, 'id' | 'submissions'>) => void
  updateHomework: (id: string, data: Partial<Homework>) => void
  deleteHomework: (id: string) => void
  updateSubmission: (homeworkId: string, studentId: string, data: Partial<HomeworkSubmission>) => void
  // Exams
  addExam: (data: Omit<Exam, 'id'>) => void
  updateExam: (id: string, data: Partial<Exam>) => void
  deleteExam: (id: string) => void
  // Fees
  recordPayment: (feeId: string, amount: number, method: 'card' | 'bank_transfer' | 'cash' | 'mobile_money', reference: string) => void
  // Announcements
  addAnnouncement: (data: Omit<Announcement, 'id' | 'date'>) => void
  deleteAnnouncement: (id: string) => void
  togglePin: (id: string) => void
  // Notifications
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: (scope: string) => void
  notificationsFor: (scope: string) => NotificationItem[]
  // Messages
  sendMessage: (threadId: string, senderId: string, senderName: string, body: string) => void
  createThread: (data: Omit<MessageThread, 'id' | 'messages' | 'updatedAt'> & { firstMessage: { senderId: string; senderName: string; body: string } }) => MessageThread
  // Academic years
  setActiveYear: (id: string) => void
  addAcademicYear: (data: Omit<AcademicYear, 'id'>) => void
  // Settings
  updateSettings: (data: Partial<SchoolSettings>) => void
}

const DataContext = createContext<DataContextValue | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SchoolDataState>(loadState)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const resetDemoData = () => {
    window.localStorage.removeItem(STORAGE_KEY)
    setState(buildInitialState())
  }

  const pushNotification = (scope: string, n: Omit<NotificationItem, 'id' | 'userId'>) => {
    setState((prev) => ({
      ...prev,
      notifications: [{ ...n, id: makeId('not'), userId: scope }, ...prev.notifications],
    }))
  }

  // ---- Students ----
  const addStudent: DataContextValue['addStudent'] = (data) => {
    let parentId = data.parentId
    setState((prev) => {
      let parents = prev.parents
      if (data.newParent && data.newParent.name.trim()) {
        const newParent: Parent = {
          id: makeId('p'),
          name: data.newParent.name,
          email: data.newParent.email,
          phone: data.newParent.phone,
          studentIds: [],
          avatarColor: AVATAR_COLORS[parents.length % AVATAR_COLORS.length],
        }
        parentId = newParent.id
        parents = [...parents, newParent]
      }
      const newStudent: Student = {
        id: makeId('s'),
        name: data.name,
        admissionNo: data.admissionNo,
        classId: data.classId,
        parentId: parentId || '',
        gender: data.gender,
        dateOfBirth: data.dateOfBirth,
        status: 'active',
        enrolledDate: new Date().toISOString().slice(0, 10),
        avatarColor: AVATAR_COLORS[prev.students.length % AVATAR_COLORS.length],
      }
      return {
        ...prev,
        parents: parents.map((p) => (p.id === parentId ? { ...p, studentIds: [...new Set([...p.studentIds, newStudent.id])] } : p)),
        students: [...prev.students, newStudent],
        classes: prev.classes.map((c) => (c.id === data.classId ? { ...c, studentIds: [...c.studentIds, newStudent.id] } : c)),
      }
    })
    return { ...data, id: 'pending', avatarColor: '', status: 'active', enrolledDate: '' } as Student
  }

  const updateStudent: DataContextValue['updateStudent'] = (id, data) => {
    setState((prev) => {
      const old = prev.students.find((s) => s.id === id)
      let classes = prev.classes
      if (old && data.classId && data.classId !== old.classId) {
        classes = classes.map((c) => {
          if (c.id === old.classId) return { ...c, studentIds: c.studentIds.filter((sid) => sid !== id) }
          if (c.id === data.classId) return { ...c, studentIds: [...c.studentIds, id] }
          return c
        })
      }
      return { ...prev, classes, students: prev.students.map((s) => (s.id === id ? { ...s, ...data } : s)) }
    })
  }

  const deleteStudent: DataContextValue['deleteStudent'] = (id) => {
    setState((prev) => ({
      ...prev,
      students: prev.students.filter((s) => s.id !== id),
      classes: prev.classes.map((c) => ({ ...c, studentIds: c.studentIds.filter((sid) => sid !== id) })),
      parents: prev.parents.map((p) => ({ ...p, studentIds: p.studentIds.filter((sid) => sid !== id) })),
    }))
  }

  // ---- Teachers ----
  const addTeacher: DataContextValue['addTeacher'] = (data) => {
    const newTeacher: Teacher = {
      ...data,
      id: makeId('t'),
      classIds: [],
      status: 'active',
      joinedDate: new Date().toISOString().slice(0, 10),
      avatarColor: AVATAR_COLORS[state.teachers.length % AVATAR_COLORS.length],
    }
    setState((prev) => ({ ...prev, teachers: [...prev.teachers, newTeacher] }))
    return newTeacher
  }

  const updateTeacher: DataContextValue['updateTeacher'] = (id, data) => {
    setState((prev) => ({ ...prev, teachers: prev.teachers.map((t) => (t.id === id ? { ...t, ...data } : t)) }))
  }

  const deleteTeacher: DataContextValue['deleteTeacher'] = (id) => {
    setState((prev) => ({
      ...prev,
      teachers: prev.teachers.filter((t) => t.id !== id),
      classes: prev.classes.map((c) => (c.teacherId === id ? { ...c, teacherId: '' } : c)),
    }))
  }

  const assignTeacherToClass: DataContextValue['assignTeacherToClass'] = (teacherId, classId) => {
    setState((prev) => ({
      ...prev,
      classes: prev.classes.map((c) => (c.id === classId ? { ...c, teacherId } : c)),
      teachers: prev.teachers.map((t) => {
        if (t.id === teacherId) return { ...t, classIds: [...new Set([...t.classIds, classId])] }
        return { ...t, classIds: t.classIds.filter((cid) => cid !== classId) }
      }),
    }))
  }

  // ---- Parents ----
  const addParent: DataContextValue['addParent'] = (data) => {
    const newParent: Parent = {
      ...data,
      id: makeId('p'),
      studentIds: [],
      avatarColor: AVATAR_COLORS[state.parents.length % AVATAR_COLORS.length],
    }
    setState((prev) => ({ ...prev, parents: [...prev.parents, newParent] }))
    return newParent
  }

  // ---- Classes ----
  const addClass: DataContextValue['addClass'] = (data) => {
    const newClass: SchoolClass = { ...data, id: makeId('c'), studentIds: [] }
    setState((prev) => ({
      ...prev,
      classes: [...prev.classes, newClass],
      teachers: prev.teachers.map((t) => (t.id === data.teacherId ? { ...t, classIds: [...t.classIds, newClass.id] } : t)),
    }))
    return newClass
  }

  const updateClass: DataContextValue['updateClass'] = (id, data) => {
    setState((prev) => ({ ...prev, classes: prev.classes.map((c) => (c.id === id ? { ...c, ...data } : c)) }))
  }

  const deleteClass: DataContextValue['deleteClass'] = (id) => {
    setState((prev) => ({
      ...prev,
      classes: prev.classes.filter((c) => c.id !== id),
      teachers: prev.teachers.map((t) => ({ ...t, classIds: t.classIds.filter((cid) => cid !== id) })),
    }))
  }

  // ---- Timetable ----
  const addTimetableSlot: DataContextValue['addTimetableSlot'] = (data) => {
    setState((prev) => ({
      ...prev,
      timetables: [
        ...prev.timetables.filter((t) => !(t.classId === data.classId && t.day === data.day && t.period === data.period)),
        { ...data, id: makeId('tt') },
      ],
    }))
  }

  const deleteTimetableSlot: DataContextValue['deleteTimetableSlot'] = (id) => {
    setState((prev) => ({ ...prev, timetables: prev.timetables.filter((t) => t.id !== id) }))
  }

  // ---- Attendance ----
  const markAttendance: DataContextValue['markAttendance'] = (classId, date, entries, markedBy) => {
    setState((prev) => {
      const filtered = prev.attendance.filter((a) => !(a.classId === classId && a.date === date))
      const newRecords: AttendanceRecord[] = entries.map((e) => ({
        id: makeId('att'),
        classId,
        studentId: e.studentId,
        date,
        status: e.status,
        note: e.note,
        markedBy,
      }))
      return { ...prev, attendance: [...filtered, ...newRecords] }
    })
  }

  // ---- Grades ----
  const addGrade: DataContextValue['addGrade'] = (data) => {
    setState((prev) => ({ ...prev, grades: [{ ...data, id: makeId('gr') }, ...prev.grades] }))
    const student = state.students.find((s) => s.id === data.studentId)
    if (student) {
      pushNotification(scopeKey('parent', undefined, student.parentId), {
        title: 'New grade recorded',
        body: `${data.subject} — ${data.assessment}: ${data.score}/${data.maxScore}`,
        type: 'grade',
        date: new Date().toISOString(),
        read: false,
        link: '/app/parent/grades',
      })
    }
  }

  const updateGrade: DataContextValue['updateGrade'] = (id, data) => {
    setState((prev) => ({ ...prev, grades: prev.grades.map((g) => (g.id === id ? { ...g, ...data } : g)) }))
  }
  const deleteGrade: DataContextValue['deleteGrade'] = (id) => {
    setState((prev) => ({ ...prev, grades: prev.grades.filter((g) => g.id !== id) }))
  }

  // ---- Homework ----
  const addHomework: DataContextValue['addHomework'] = (data) => {
    const cls = state.classes.find((c) => c.id === data.classId)
    const submissions: HomeworkSubmission[] = (cls?.studentIds ?? []).map((studentId) => ({ studentId, status: 'pending' }))
    setState((prev) => ({ ...prev, homework: [{ ...data, id: makeId('hw'), submissions }, ...prev.homework] }))
    cls?.studentIds.forEach((studentId) => {
      const student = state.students.find((s) => s.id === studentId)
      if (student) {
        pushNotification(scopeKey('parent', undefined, student.parentId), {
          title: 'New homework assigned',
          body: data.title,
          type: 'homework',
          date: new Date().toISOString(),
          read: false,
          link: '/app/parent/homework',
        })
      }
    })
  }
  const updateHomework: DataContextValue['updateHomework'] = (id, data) => {
    setState((prev) => ({ ...prev, homework: prev.homework.map((h) => (h.id === id ? { ...h, ...data } : h)) }))
  }
  const deleteHomework: DataContextValue['deleteHomework'] = (id) => {
    setState((prev) => ({ ...prev, homework: prev.homework.filter((h) => h.id !== id) }))
  }
  const updateSubmission: DataContextValue['updateSubmission'] = (homeworkId, studentId, data) => {
    setState((prev) => ({
      ...prev,
      homework: prev.homework.map((h) =>
        h.id === homeworkId
          ? { ...h, submissions: h.submissions.map((s) => (s.studentId === studentId ? { ...s, ...data } : s)) }
          : h,
      ),
    }))
  }

  // ---- Exams ----
  const addExam: DataContextValue['addExam'] = (data) => {
    setState((prev) => ({ ...prev, exams: [{ ...data, id: makeId('ex') }, ...prev.exams] }))
  }
  const updateExam: DataContextValue['updateExam'] = (id, data) => {
    setState((prev) => ({ ...prev, exams: prev.exams.map((e) => (e.id === id ? { ...e, ...data } : e)) }))
  }
  const deleteExam: DataContextValue['deleteExam'] = (id) => {
    setState((prev) => ({ ...prev, exams: prev.exams.filter((e) => e.id !== id) }))
  }

  // ---- Fees ----
  const recordPayment: DataContextValue['recordPayment'] = (feeId, amount, method, reference) => {
    setState((prev) => ({
      ...prev,
      fees: prev.fees.map((f) => {
        if (f.id !== feeId) return f
        const amountPaid = Math.min(f.amount, f.amountPaid + amount)
        const status = amountPaid >= f.amount ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid'
        return {
          ...f,
          amountPaid,
          status,
          payments: [...f.payments, { id: makeId('pay'), amount, date: new Date().toISOString().slice(0, 10), method, reference }],
        }
      }),
    }))
  }

  // ---- Announcements ----
  const addAnnouncement: DataContextValue['addAnnouncement'] = (data) => {
    const newAnnouncement: Announcement = { ...data, id: makeId('an'), date: new Date().toISOString() }
    setState((prev) => ({ ...prev, announcements: [newAnnouncement, ...prev.announcements] }))

    const notify = (scope: string) =>
      pushNotification(scope, {
        title: 'New announcement posted',
        body: data.title,
        type: 'announcement',
        date: new Date().toISOString(),
        read: false,
        link: '/app/announcements',
      })

    if (data.audience === 'all') {
      notify('admin:all')
      state.teachers.forEach((t) => notify(scopeKey('teacher', t.id)))
      state.parents.forEach((p) => notify(scopeKey('parent', undefined, p.id)))
    } else if (data.audience === 'teachers') {
      state.teachers.forEach((t) => notify(scopeKey('teacher', t.id)))
    } else if (data.audience === 'parents' || data.audience === 'students') {
      state.parents.forEach((p) => notify(scopeKey('parent', undefined, p.id)))
    } else if (data.audience === 'class' && data.classId) {
      const cls = state.classes.find((c) => c.id === data.classId)
      cls?.studentIds.forEach((sid) => {
        const student = state.students.find((s) => s.id === sid)
        if (student) notify(scopeKey('parent', undefined, student.parentId))
      })
    }
  }

  const deleteAnnouncement: DataContextValue['deleteAnnouncement'] = (id) => {
    setState((prev) => ({ ...prev, announcements: prev.announcements.filter((a) => a.id !== id) }))
  }
  const togglePin: DataContextValue['togglePin'] = (id) => {
    setState((prev) => ({ ...prev, announcements: prev.announcements.map((a) => (a.id === id ? { ...a, pinned: !a.pinned } : a)) }))
  }

  // ---- Notifications ----
  const markNotificationRead: DataContextValue['markNotificationRead'] = (id) => {
    setState((prev) => ({ ...prev, notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }))
  }
  const markAllNotificationsRead: DataContextValue['markAllNotificationsRead'] = (scope) => {
    setState((prev) => ({ ...prev, notifications: prev.notifications.map((n) => (n.userId === scope ? { ...n, read: true } : n)) }))
  }
  const notificationsFor: DataContextValue['notificationsFor'] = (scope) =>
    state.notifications.filter((n) => n.userId === scope).sort((a, b) => (a.date < b.date ? 1 : -1))

  // ---- Messages ----
  const sendMessage: DataContextValue['sendMessage'] = (threadId, senderId, senderName, body) => {
    const message: ChatMessage = { id: makeId('m'), senderId, senderName, body, date: new Date().toISOString() }
    setState((prev) => ({
      ...prev,
      messageThreads: prev.messageThreads.map((t) =>
        t.id === threadId ? { ...t, messages: [...t.messages, message], updatedAt: message.date } : t,
      ),
    }))
    const thread = state.messageThreads.find((t) => t.id === threadId)
    const otherId = thread?.participantIds.find((id) => id !== senderId)
    if (otherId) {
      const isTeacher = state.teachers.some((t) => t.id === otherId)
      const scope = isTeacher ? scopeKey('teacher', otherId) : scopeKey('parent', undefined, otherId)
      pushNotification(scope, {
        title: 'New message',
        body: `${senderName}: ${body.slice(0, 60)}`,
        type: 'message',
        date: message.date,
        read: false,
        link: '/app/messages',
      })
    }
  }

  const createThread: DataContextValue['createThread'] = (data) => {
    const message: ChatMessage = { ...data.firstMessage, id: makeId('m'), date: new Date().toISOString() }
    const newThread: MessageThread = {
      id: makeId('mt'),
      participantIds: data.participantIds,
      participantNames: data.participantNames,
      subject: data.subject,
      studentId: data.studentId,
      messages: [message],
      updatedAt: message.date,
    }
    setState((prev) => ({ ...prev, messageThreads: [newThread, ...prev.messageThreads] }))
    return newThread
  }

  // ---- Academic years ----
  const setActiveYear: DataContextValue['setActiveYear'] = (id) => {
    setState((prev) => ({
      ...prev,
      academicYears: prev.academicYears.map((y) => ({
        ...y,
        status: y.id === id ? 'active' : y.status === 'active' ? 'closed' : y.status,
      })),
      settings: { ...prev.settings, academicYearId: id },
    }))
  }
  const addAcademicYear: DataContextValue['addAcademicYear'] = (data) => {
    setState((prev) => ({ ...prev, academicYears: [...prev.academicYears, { ...data, id: makeId('ay') }] }))
  }

  // ---- Settings ----
  const updateSettings: DataContextValue['updateSettings'] = (data) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...data } }))
  }

  const value = useMemo<DataContextValue>(
    () => ({
      ...state,
      scopeKey,
      resetDemoData,
      addStudent,
      updateStudent,
      deleteStudent,
      addTeacher,
      updateTeacher,
      deleteTeacher,
      assignTeacherToClass,
      addParent,
      addClass,
      updateClass,
      deleteClass,
      addTimetableSlot,
      deleteTimetableSlot,
      markAttendance,
      addGrade,
      updateGrade,
      deleteGrade,
      addHomework,
      updateHomework,
      deleteHomework,
      updateSubmission,
      addExam,
      updateExam,
      deleteExam,
      recordPayment,
      addAnnouncement,
      deleteAnnouncement,
      togglePin,
      markNotificationRead,
      markAllNotificationsRead,
      notificationsFor,
      sendMessage,
      createThread,
      setActiveYear,
      addAcademicYear,
      updateSettings,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within a DataProvider')
  return ctx
}
