import { useEffect, useMemo, useState } from 'react'
import { Check, X, Clock, FileWarning, Save } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import type { AttendanceStatus, SchoolClass } from '@/types'
import { schoolDays } from '@/utils/schoolCalendar'
import { cn } from '@/utils/cn'

const statusConfig: Record<AttendanceStatus, { label: string; icon: typeof Check; tone: string }> = {
  present: { label: 'Present', icon: Check, tone: 'bg-emerald-500 text-white' },
  absent: { label: 'Absent', icon: X, tone: 'bg-red-500 text-white' },
  late: { label: 'Late', icon: Clock, tone: 'bg-amber-500 text-white' },
  excused: { label: 'Excused', icon: FileWarning, tone: 'bg-accent text-white' },
}

export default function AttendanceMarker({ classes, markedBy }: { classes: SchoolClass[]; markedBy: string }) {
  const { students, attendance, markAttendance } = useData()
  const { showToast } = useToast()

  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [date, setDate] = useState(schoolDays[schoolDays.length - 1])
  const [draft, setDraft] = useState<Record<string, { status: AttendanceStatus; note?: string }>>({})

  const selectedClass = classes.find((c) => c.id === classId)
  const classStudents = useMemo(
    () => students.filter((s) => s.classId === classId).sort((a, b) => a.name.localeCompare(b.name)),
    [students, classId],
  )

  useEffect(() => {
    const existing: Record<string, { status: AttendanceStatus; note?: string }> = {}
    classStudents.forEach((s) => {
      const record = attendance.find((a) => a.classId === classId && a.date === date && a.studentId === s.id)
      existing[s.id] = { status: record?.status ?? 'present', note: record?.note }
    })
    setDraft(existing)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date, students.length])

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setDraft((prev) => ({ ...prev, [studentId]: { ...prev[studentId], status } }))
  }

  const markAll = (status: AttendanceStatus) => {
    const next: Record<string, { status: AttendanceStatus; note?: string }> = {}
    classStudents.forEach((s) => {
      next[s.id] = { ...draft[s.id], status }
    })
    setDraft(next)
  }

  const handleSave = () => {
    if (!selectedClass) return
    const entries = classStudents.map((s) => ({ studentId: s.id, status: draft[s.id]?.status ?? 'present', note: draft[s.id]?.note }))
    markAttendance(classId, date, entries, markedBy)
    showToast({
      type: 'success',
      title: 'Attendance saved',
      description: `${selectedClass.name} attendance for ${date} has been recorded.`,
    })
  }

  const presentCount = classStudents.filter((s) => draft[s.id]?.status === 'present').length

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select label="Class" value={classId} onChange={(e) => setClassId(e.target.value)} className="sm:w-56">
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-48" />
        </div>
        <Button onClick={handleSave} icon={<Save className="h-4 w-4" />}>
          Save Attendance
        </Button>
      </div>

      {classStudents.length === 0 ? (
        <EmptyState title="No students in this class" description="Add students to this class to begin marking attendance." />
      ) : (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/5 px-5 py-4 dark:border-white/10">
            <p className="text-sm text-graphite">
              <span className="font-semibold text-ink dark:text-white">{presentCount}</span> / {classStudents.length} marked present
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => markAll(status)}
                  className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-medium text-graphite hover:border-ink/30 hover:text-ink dark:border-white/10 dark:hover:text-white"
                >
                  Mark all {statusConfig[status].label}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-ink/5 dark:divide-white/5">
            {classStudents.map((s) => {
              const current = draft[s.id]?.status ?? 'present'
              return (
                <div key={s.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} color={s.avatarColor} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-ink dark:text-white">{s.name}</p>
                      <p className="text-xs text-graphite">{s.admissionNo}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => {
                      const config = statusConfig[status]
                      const active = current === status
                      return (
                        <button
                          key={status}
                          onClick={() => setStatus(s.id, status)}
                          className={cn(
                            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                            active ? config.tone : 'bg-ink/5 text-graphite hover:bg-ink/10 dark:bg-white/10',
                          )}
                        >
                          <config.icon className="h-3 w-3" />
                          {config.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
