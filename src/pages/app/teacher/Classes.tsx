import { useState } from 'react'
import { Users, MapPin, BookOpen, CalendarRange } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Avatar from '@/components/ui/Avatar'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import TimetableGrid, { PERIODS } from '@/components/dashboard/TimetableGrid'
import { formatDate } from '@/utils/format'
import type { SchoolClass, Weekday } from '@/types'

export default function TeacherClasses() {
  const { activeMembership } = useAuth()
  const { classes, students, timetables, addTimetableSlot, deleteTimetableSlot } = useData()
  const { showToast } = useToast()
  const [viewing, setViewing] = useState<SchoolClass | null>(null)

  const myClasses = classes.filter((c) => c.teacherId === activeMembership?.teacher_id)
  const [timetableClassId, setTimetableClassId] = useState(myClasses[0]?.id ?? '')
  const [slotDraft, setSlotDraft] = useState<{ day: Weekday; period: number } | null>(null)
  const [slotSubject, setSlotSubject] = useState('')
  const [slotRoom, setSlotRoom] = useState('')

  const activeClass = myClasses.find((c) => c.id === timetableClassId) ?? myClasses[0]
  const classSlots = timetables.filter((t) => t.classId === activeClass?.id)

  const openSlot = (day: Weekday, period: number) => {
    setSlotDraft({ day, period })
    setSlotSubject(activeClass?.subject[0] ?? '')
    setSlotRoom(activeClass?.room ?? '')
  }

  const saveSlot = () => {
    if (!activeClass || !slotDraft || !slotSubject.trim()) {
      showToast({ type: 'error', title: 'Add a subject for this period' })
      return
    }
    const periodInfo = PERIODS.find((p) => p.period === slotDraft.period)!
    addTimetableSlot({
      classId: activeClass.id,
      teacherId: activeMembership!.teacher_id!,
      day: slotDraft.day,
      period: slotDraft.period,
      startTime: periodInfo.startTime,
      endTime: periodInfo.endTime,
      subject: slotSubject,
      room: slotRoom,
    })
    showToast({ type: 'success', title: 'Timetable updated' })
    setSlotDraft(null)
  }

  if (myClasses.length === 0) {
    return (
      <div>
        <PageHeader title="My Classes" description="Classes assigned to you by the school administrator." />
        <EmptyState icon={BookOpen} title="No classes assigned yet" description="Reach out to your school administrator to get assigned to a class." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="My Classes" description={`You are teaching ${myClasses.length} class${myClasses.length === 1 ? '' : 'es'}.`} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {myClasses.map((c) => (
          <button key={c.id} onClick={() => setViewing(c)} className="card p-6 text-left transition-transform hover:-translate-y-1">
            <p className="font-semibold text-ink dark:text-white">{c.name}</p>
            <p className="text-xs text-graphite">Grade {c.grade} · Section {c.section}</p>
            <div className="mt-4 space-y-2 text-xs text-graphite">
              <p className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5" /> {c.studentIds.length} students
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" /> {c.room}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {c.subject.slice(0, 3).map((s) => (
                <span key={s} className="rounded-full bg-ink/5 px-2.5 py-1 text-[11px] text-graphite dark:bg-white/10">
                  {s}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name} description={`${viewing?.studentIds.length ?? 0} students · ${viewing?.room ?? ''}`} size="lg">
        <div className="space-y-2">
          {viewing &&
            students
              .filter((s) => s.classId === viewing.id)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl bg-mist px-4 py-3 dark:bg-white/5">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} color={s.avatarColor} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-ink dark:text-white">{s.name}</p>
                      <p className="text-xs text-graphite">{s.admissionNo}</p>
                    </div>
                  </div>
                  <p className="text-xs text-graphite">Enrolled {formatDate(s.enrolledDate)}</p>
                </div>
              ))}
        </div>
      </Modal>

      <div className="mt-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-accent/10 p-2.5 text-accent">
              <CalendarRange className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-ink dark:text-white">Weekly Timetable</h3>
          </div>
          {myClasses.length > 1 && (
            <Select value={timetableClassId || myClasses[0]?.id} onChange={(e) => setTimetableClassId(e.target.value)} className="w-56">
              {myClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          )}
        </div>
        <div className="card p-5">
          <TimetableGrid slots={classSlots} editable onAddSlot={openSlot} onRemoveSlot={deleteTimetableSlot} />
        </div>
      </div>

      <Modal
        open={!!slotDraft}
        onClose={() => setSlotDraft(null)}
        title={slotDraft ? `${slotDraft.day} · Period ${slotDraft.period}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSlotDraft(null)}>Cancel</Button>
            <Button onClick={saveSlot}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Subject" value={slotSubject} onChange={(e) => setSlotSubject(e.target.value)}>
            {activeClass?.subject.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Input label="Room" value={slotRoom} onChange={(e) => setSlotRoom(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}
