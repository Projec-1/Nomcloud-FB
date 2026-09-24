import type { IsoWeekday } from '@/types'

export type MockLesson = {
  id: string
  classId: string
  day: IsoWeekday
  subject: string
  teacher: string
  startTime: string
  endTime: string
  type: 'lesson' | 'break'
}

export type MockClass = {
  id: string
  name: string
  grade: string
  homeroomTeacher: string
  subjects: string[]
}

export type MockTeacher = {
  id: string
  name: string
  subject: string
}

export const MOCK_TEACHERS: MockTeacher[] = [
  { id: 'ahmed', name: 'Ahmed Hassan', subject: 'Mathematics' },
  { id: 'maryan', name: 'Maryan Ali', subject: 'English' },
  { id: 'hodan', name: 'Hodan Yusuf', subject: 'Science' },
  { id: 'yusuf', name: 'Yusuf Omar', subject: 'Somali' },
  { id: 'amina', name: 'Amina Noor', subject: 'Social Studies' },
  { id: 'abdullahi', name: 'Abdullahi Warsame', subject: 'Arabic' },
]

export const MOCK_CLASSES: MockClass[] = [
  { id: 'grade-7', name: 'Grade 7', grade: '7', homeroomTeacher: 'Ahmed Hassan', subjects: ['Mathematics', 'English', 'Science', 'Somali', 'Social Studies', 'Arabic'] },
  { id: 'grade-6', name: 'Grade 6', grade: '6', homeroomTeacher: 'Maryan Ali', subjects: ['Mathematics', 'English', 'Science', 'Somali', 'Arabic'] },
  { id: 'grade-5', name: 'Grade 5', grade: '5', homeroomTeacher: 'Hodan Yusuf', subjects: ['Mathematics', 'English', 'Science', 'Somali', 'Social Studies'] },
]

const seedLessons: MockLesson[] = [
  { id: 'g7-sat-1', classId: 'grade-7', day: 6, subject: 'Mathematics', teacher: 'Ahmed Hassan', startTime: '08:00', endTime: '08:40', type: 'lesson' },
  { id: 'g7-sat-2', classId: 'grade-7', day: 6, subject: 'English', teacher: 'Maryan Ali', startTime: '08:40', endTime: '09:20', type: 'lesson' },
  { id: 'g7-sat-b', classId: 'grade-7', day: 6, subject: '', teacher: '', startTime: '09:20', endTime: '09:40', type: 'break' },
  { id: 'g7-sat-3', classId: 'grade-7', day: 6, subject: 'Science', teacher: 'Hodan Yusuf', startTime: '09:40', endTime: '10:20', type: 'lesson' },
  { id: 'g7-sun-1', classId: 'grade-7', day: 7, subject: 'English', teacher: 'Maryan Ali', startTime: '08:00', endTime: '08:40', type: 'lesson' },
  { id: 'g7-sun-2', classId: 'grade-7', day: 7, subject: 'Mathematics', teacher: 'Ahmed Hassan', startTime: '08:40', endTime: '09:20', type: 'lesson' },
  { id: 'g7-mon-1', classId: 'grade-7', day: 1, subject: 'Science', teacher: 'Hodan Yusuf', startTime: '08:00', endTime: '08:40', type: 'lesson' },
  { id: 'g7-mon-2', classId: 'grade-7', day: 1, subject: 'Somali', teacher: 'Ahmed Hassan', startTime: '08:40', endTime: '09:20', type: 'lesson' },
  { id: 'g7-tue-1', classId: 'grade-7', day: 2, subject: 'Somali', teacher: 'Ahmed Hassan', startTime: '08:00', endTime: '08:40', type: 'lesson' },
  { id: 'g7-tue-2', classId: 'grade-7', day: 2, subject: 'Science', teacher: 'Hodan Yusuf', startTime: '08:40', endTime: '09:20', type: 'lesson' },
  { id: 'g7-wed-1', classId: 'grade-7', day: 3, subject: 'Mathematics', teacher: 'Ahmed Hassan', startTime: '08:00', endTime: '08:40', type: 'lesson' },
  { id: 'g7-wed-2', classId: 'grade-7', day: 3, subject: 'English', teacher: 'Maryan Ali', startTime: '08:40', endTime: '09:20', type: 'lesson' },
  { id: 'g6-sat-1', classId: 'grade-6', day: 6, subject: 'English', teacher: 'Maryan Ali', startTime: '08:00', endTime: '08:40', type: 'lesson' },
  { id: 'g6-sat-2', classId: 'grade-6', day: 6, subject: 'Science', teacher: 'Hodan Yusuf', startTime: '08:40', endTime: '09:20', type: 'lesson' },
  { id: 'g5-sat-1', classId: 'grade-5', day: 6, subject: 'Mathematics', teacher: 'Ahmed Hassan', startTime: '08:00', endTime: '08:40', type: 'lesson' },
  { id: 'g5-sat-2', classId: 'grade-5', day: 6, subject: 'English', teacher: 'Maryan Ali', startTime: '08:40', endTime: '09:20', type: 'lesson' },
  { id: 'g5-sun-1', classId: 'grade-5', day: 7, subject: 'Science', teacher: 'Hodan Yusuf', startTime: '08:00', endTime: '08:40', type: 'lesson' },
  { id: 'g5-sun-2', classId: 'grade-5', day: 7, subject: 'Somali', teacher: 'Yusuf Omar', startTime: '08:40', endTime: '09:20', type: 'lesson' },
  { id: 'g6-sun-1', classId: 'grade-6', day: 7, subject: 'Mathematics', teacher: 'Ahmed Hassan', startTime: '08:00', endTime: '08:40', type: 'lesson' },
  { id: 'g6-sun-2', classId: 'grade-6', day: 7, subject: 'English', teacher: 'Maryan Ali', startTime: '08:40', endTime: '09:20', type: 'lesson' },
  { id: 'g5-mon-1', classId: 'grade-5', day: 1, subject: 'Mathematics', teacher: 'Ahmed Hassan', startTime: '08:00', endTime: '08:40', type: 'lesson' },
  { id: 'g5-mon-2', classId: 'grade-5', day: 1, subject: 'Science', teacher: 'Hodan Yusuf', startTime: '08:40', endTime: '09:20', type: 'lesson' },
]

const STORAGE_KEY = 'nomcloud_frontend_timetable_v2'

export const DEFAULT_LESSON_PERIODS = [
  { startTime: '08:00', endTime: '08:40' },
  { startTime: '08:40', endTime: '09:20' },
  { startTime: '09:40', endTime: '10:20' },
  { startTime: '10:20', endTime: '11:00' },
  { startTime: '11:00', endTime: '11:40' },
  { startTime: '11:40', endTime: '12:20' },
]

export function lessonTone(lesson: Pick<MockLesson, 'subject' | 'type'>, highlighted = false) {
  if (lesson.type === 'break') {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300'
  }

  const tones: Record<string, string> = {
    Mathematics: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300',
    English: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-300',
    Science: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300',
    Somali: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300',
    'Social Studies': 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-300',
    Arabic: 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-300',
  }

  return `${tones[lesson.subject] ?? 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-400/20 dark:bg-orange-400/10 dark:text-orange-300'}${highlighted ? ' ring-2 ring-[#FF5A1F]/25' : ''}`
}

export function loadMockLessons(): MockLesson[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as MockLesson[]) : seedLessons
  } catch {
    return seedLessons
  }
}

export function saveMockLessons(lessons: MockLesson[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons))
}

export const WEEKDAYS: { value: IsoWeekday; label: string }[] = [
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
]

export function timeRows(lessons: MockLesson[]) {
  return Array.from(new Set([
    ...DEFAULT_LESSON_PERIODS.map((period) => `${period.startTime}|${period.endTime}`),
    ...lessons.map((lesson) => `${lesson.startTime}|${lesson.endTime}`),
  ]))
    .map((value) => {
      const [startTime, endTime] = value.split('|')
      return { startTime, endTime }
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}
