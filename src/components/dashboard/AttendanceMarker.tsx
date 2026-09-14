import { useCallback, useEffect, useState } from 'react'
import { Check, X, Clock, FileWarning, Save } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonRows } from '@/components/ui/Loader'
import type { AttendanceStatus } from '@/types'
import type { ClassSummary } from '@/services/teacherService'
import { fetchRosterStudents, type RosterStudent } from '@/services/studentService'
import { fetchAttendance, saveAttendance, type AttendanceEntry } from '@/services/teachingRecordsService'
import { todayInTimeZone } from '@/utils/schoolCalendar'
import { cn } from '@/utils/cn'

// ---------------------------------------------------------------------------
// Phase 8 batch 5. Reads and writes real attendance_records.
//
// Attendance is the one record in this batch that is CLASS-level rather than
// subject-exact: attendance_records_teacher_insert checks teaches_class, not
// teaches_class_subject. So a homeroom teacher who teaches none of the class's
// subjects can still mark this register, which is the decision RLS batch 4
// recorded and the reason there is no subject selector on this screen.
//
// WHAT CHANGED BEYOND THE DATA SOURCE. The prototype filtered a mock array by
// `s.classId === classId`. Students have no class_id in the real schema —
// enrolment lives in class_enrollments — so the roster now comes from the ids
// the class summary already resolved through that table.
//
// The date no longer defaults to the last element of a hardcoded mock week. It
// defaults to today in the SCHOOL'S timezone, which batch 0 established as the
// correct basis after proving a UTC-based "today" reports the wrong date for
// Mogadishu after 21:00 local.
//
// NO DELETE CONTROL, DELIBERATELY. attendance_records has no teacher DELETE
// policy. Offering an "unmark" button would produce a silent no-op, because a
// refused DELETE reports zero rows and no error.
// ---------------------------------------------------------------------------

const statusConfig: Record<AttendanceStatus, { label: string; icon: typeof Check; tone: string }> = {
  present: { label: 'Present', icon: Check, tone: 'bg-emerald-500 text-white' },
  absent: { label: 'Absent', icon: X, tone: 'bg-red-500 text-white' },
  late: { label: 'Late', icon: Clock, tone: 'bg-amber-500 text-white' },
  excused: { label: 'Excused', icon: FileWarning, tone: 'bg-accent text-white' },
}

interface AttendanceMarkerProps {
  classes: ClassSummary[]
  schoolId: string
  /** The school's IANA timezone, for deciding what "today" means. */
  timeZone: string
}

export default function AttendanceMarker({ classes, schoolId, timeZone }: AttendanceMarkerProps) {
  const { showToast } = useToast()

  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [date, setDate] = useState(() => todayInTimeZone(timeZone))
  const [students, setStudents] = useState<RosterStudent[]>([])
  const [draft, setDraft] = useState<Record<string, { status: AttendanceStatus; note: string | null }>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const selectedClass = classes.find((c) => c.id === classId)

  // Roster and existing marks load together, so the editor never renders a row
  // whose saved status has not arrived yet and briefly claims "present".
  useEffect(() => {
    let cancelled = false
    if (!selectedClass) {
      setStudents([])
      setDraft({})
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    Promise.all([
      fetchRosterStudents(schoolId, selectedClass.studentIds),
      fetchAttendance(schoolId, selectedClass.id, date),
    ])
      .then(([roster, existing]) => {
        if (cancelled) return
        setStudents(roster)
        const next: Record<string, { status: AttendanceStatus; note: string | null }> = {}
        for (const s of roster) {
          const record = existing.get(s.id)
          // An unmarked student defaults to present in the editor only. Nothing
          // is persisted until Save, so this default never becomes a record on
          // its own.
          next[s.id] = { status: record?.status ?? 'present', note: record?.note ?? null }
        }
        setDraft(next)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        showToast({
          type: 'error',
          title: 'Could not load attendance',
          description: err instanceof Error ? err.message : String(err),
        })
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [schoolId, selectedClass, date, showToast])

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setDraft((prev) => ({ ...prev, [studentId]: { ...prev[studentId], status } }))
  }

  const markAll = (status: AttendanceStatus) => {
    setDraft((prev) => {
      const next: typeof prev = {}
      for (const s of students) next[s.id] = { ...prev[s.id], status, note: prev[s.id]?.note ?? null }
      return next
    })
  }

  const handleSave = useCallback(async () => {
    if (!selectedClass || students.length === 0) return
    setIsSaving(true)

    const entries: AttendanceEntry[] = students.map((s) => ({
      studentId: s.id,
      status: draft[s.id]?.status ?? 'present',
      note: draft[s.id]?.note ?? null,
    }))

    try {
      await saveAttendance(schoolId, selectedClass.id, date, entries)
      showToast({
        type: 'success',
        title: 'Attendance saved',
        description: `${selectedClass.name} attendance for ${date} has been recorded.`,
      })
    } catch (err: unknown) {
      // A refused INSERT raises 42501 and lands here. The message is shown
      // rather than swallowed, because a teacher who is not assigned to this
      // class needs to know the save did not happen.
      showToast({
        type: 'error',
        title: 'Attendance not saved',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setIsSaving(false)
    }
  }, [selectedClass, students, draft, schoolId, date, showToast])

  const presentCount = students.filter((s) => draft[s.id]?.status === 'present').length

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
        <Button onClick={handleSave} disabled={isSaving || isLoading || students.length === 0} icon={<Save className="h-4 w-4" />}>
          {isSaving ? 'Saving…' : 'Save Attendance'}
        </Button>
      </div>

      {isLoading ? (
        <SkeletonRows />
      ) : students.length === 0 ? (
        <EmptyState title="No students in this class" description="Add students to this class to begin marking attendance." />
      ) : (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/5 px-5 py-4 dark:border-white/10">
            <p className="text-sm text-graphite">
              <span className="font-semibold text-ink dark:text-white">{presentCount}</span> / {students.length} marked present
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
            {students.map((s) => {
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
