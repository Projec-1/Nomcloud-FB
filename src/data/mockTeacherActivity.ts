export type ActivityType = 'attendance' | 'homework' | 'grades' | 'announcement' | 'timetable'

export type TeacherActivity = {
  id: string
  teacherId: string
  teacherName: string
  classId: string
  className: string
  subject: string
  type: ActivityType
  action: string
  detail: string
  occurredAt: string
}

export const MOCK_TEACHER_ACTIVITY: TeacherActivity[] = [
  { id: 'activity-1', teacherId: 'ahmed', teacherName: 'Ahmed Hassan', classId: 'grade-7', className: 'Grade 7', subject: 'Mathematics', type: 'attendance', action: 'Marked attendance', detail: '37 of 40 students present', occurredAt: 'Today, 9:42 AM' },
  { id: 'activity-2', teacherId: 'maryan', teacherName: 'Maryan Ali', classId: 'grade-7', className: 'Grade 7', subject: 'English', type: 'homework', action: 'Uploaded homework', detail: 'Reading comprehension · due Friday', occurredAt: 'Today, 8:55 AM' },
  { id: 'activity-3', teacherId: 'ahmed', teacherName: 'Ahmed Hassan', classId: 'grade-7', className: 'Grade 7', subject: 'Mathematics', type: 'grades', action: 'Updated student results', detail: 'Algebra quiz · 40 submissions', occurredAt: 'Yesterday, 2:15 PM' },
  { id: 'activity-4', teacherId: 'hodan', teacherName: 'Hodan Yusuf', classId: 'grade-6', className: 'Grade 6', subject: 'Science', type: 'timetable', action: 'Changed timetable lesson', detail: 'Moved Science to 10:20–11:00', occurredAt: 'Yesterday, 10:20 AM' },
  { id: 'activity-5', teacherId: 'yusuf', teacherName: 'Yusuf Omar', classId: 'grade-5', className: 'Grade 5', subject: 'Somali', type: 'announcement', action: 'Published class announcement', detail: 'Somali reading circle reminder', occurredAt: 'Yesterday, 9:05 AM' },
  { id: 'activity-6', teacherId: 'ahmed', teacherName: 'Ahmed Hassan', classId: 'grade-6', className: 'Grade 6', subject: 'Mathematics', type: 'attendance', action: 'Marked attendance', detail: '35 of 38 students present', occurredAt: 'Monday, 9:40 AM' },
  { id: 'activity-7', teacherId: 'maryan', teacherName: 'Maryan Ali', classId: 'grade-5', className: 'Grade 5', subject: 'English', type: 'grades', action: 'Entered assessment results', detail: 'Vocabulary assessment · 32 submissions', occurredAt: 'Monday, 1:30 PM' },
]

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  attendance: 'Attendance',
  homework: 'Homework',
  grades: 'Results',
  announcement: 'Announcement',
  timetable: 'Timetable',
}
