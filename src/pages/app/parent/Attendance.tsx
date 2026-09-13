import { CalendarCheck, Check, X, Clock, FileWarning } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useSelectedChild } from '@/hooks/useSelectedChild'
import PageHeader from '@/components/ui/PageHeader'
import ChildSwitcher from '@/components/dashboard/ChildSwitcher'
import EmptyState from '@/components/ui/EmptyState'
import ResourceGate from '@/components/ui/ResourceGate'
import StatCard from '@/components/ui/StatCard'
import { schoolDays } from '@/utils/schoolCalendar'
import { formatDate, percentage } from '@/utils/format'
import type { AttendanceStatus } from '@/types'
import { cn } from '@/utils/cn'

const statusMeta: Record<AttendanceStatus, { icon: typeof Check; tone: string; label: string }> = {
  present: { icon: Check, tone: 'text-emerald-500 bg-emerald-500/10', label: 'Present' },
  absent: { icon: X, tone: 'text-red-500 bg-red-500/10', label: 'Absent' },
  late: { icon: Clock, tone: 'text-amber-500 bg-amber-500/10', label: 'Late' },
  excused: { icon: FileWarning, tone: 'text-accent bg-accent/10', label: 'Excused' },
}

export default function ParentAttendance() {
  const { classes, attendance } = useData()
  const { children, selectedChild, selectChild, state } = useSelectedChild()

  if (!selectedChild) {
    return (
      <div>
        <PageHeader title="Attendance" description="Your child's attendance record." />
        <ResourceGate
          state={state}
          empty={{ icon: CalendarCheck, title: "No children linked yet", description: "Contact your school administrator to link your child's record." }}
          deniedHint="Child records are available to a linked parent or guardian."
        >
          {() => null}
        </ResourceGate>
      </div>
    )
  }

  const cls = classes.find((c) => c.id === selectedChild.classId)
  const records = schoolDays
    .map((date) => attendance.find((a) => a.studentId === selectedChild.id && a.date === date))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .reverse()

  const present = records.filter((r) => r.status === 'present' || r.status === 'late').length
  const absent = records.filter((r) => r.status === 'absent').length

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={`${selectedChild.name} · ${cls?.name ?? ''}`}
        actions={<ChildSwitcher children={children} selectedId={selectedChild.id} onSelect={selectChild} classLabel={(c) => classes.find((cl) => cl.id === c.classId)?.name ?? ''} />}
      />

      <div className="mb-6 grid gap-5 sm:grid-cols-3">
        <StatCard label="Attendance Rate" value={records.length ? `${percentage(present, records.length)}%` : '—'} icon={CalendarCheck} tint="#34A853" />
        <StatCard label="Days Present" value={present} icon={Check} tint="#0071E3" />
        <StatCard label="Days Absent" value={absent} icon={X} tint="#EF4444" />
      </div>

      {records.length === 0 ? (
        <EmptyState title="No attendance recorded yet" description="Attendance records will appear here once marked by the teacher." />
      ) : (
        <div className="card divide-y divide-ink/5 dark:divide-white/5">
          {records.map((r) => {
            const meta = statusMeta[r.status]
            return (
              <div key={r.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-ink dark:text-white">{formatDate(r.date, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                  {r.note && <p className="text-xs text-graphite">{r.note}</p>}
                </div>
                <span className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium', meta.tone)}>
                  <meta.icon className="h-3.5 w-3.5" /> {meta.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
