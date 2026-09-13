import { useNavigate } from 'react-router-dom'
import { Users, CalendarCheck, BookOpen, Wallet } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useSelectedChild } from '@/hooks/useSelectedChild'
import PageHeader from '@/components/ui/PageHeader'
import ResourceGate from '@/components/ui/ResourceGate'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { formatDate, percentage } from '@/utils/format'
import { schoolDays } from '@/utils/schoolCalendar'

export default function ParentChildren() {
  const { classes, attendance, grades, fees } = useData()
  const { children, selectedChild, selectChild, state } = useSelectedChild()
  const navigate = useNavigate()

  if (children.length === 0) {
    return (
      <div>
        <PageHeader title="My Children" description="Children linked to your account." />
        <ResourceGate
          state={state}
          empty={{ icon: Users, title: "No children linked yet", description: "Contact your school administrator to link your child's record to this account." }}
          deniedHint="Child records are available to a linked parent or guardian."
        >
          {() => null}
        </ResourceGate>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="My Children" description={`${children.length} child${children.length === 1 ? '' : 'ren'} linked to your account`} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {children.map((child) => {
          const cls = classes.find((c) => c.id === child.classId)
          const childAttendance = attendance.filter((a) => a.studentId === child.id && schoolDays.includes(a.date))
          const present = childAttendance.filter((a) => a.status === 'present' || a.status === 'late').length
          const childGrades = grades.filter((g) => g.studentId === child.id)
          const avg = childGrades.length ? Math.round(childGrades.reduce((sum, g) => sum + g.score, 0) / childGrades.length) : 0
          const balance = fees.filter((f) => f.studentId === child.id).reduce((sum, f) => sum + (f.amount - f.amountPaid), 0)

          return (
            <div key={child.id} className="card p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={child.name} color={child.avatarColor} />
                  <div>
                    <p className="font-medium text-ink dark:text-white">{child.name}</p>
                    <p className="text-xs text-graphite">{cls?.name} · {child.admissionNo}</p>
                  </div>
                </div>
                {selectedChild?.id === child.id && <Badge tone="brand">Selected</Badge>}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-mist p-2.5 dark:bg-white/5">
                  <CalendarCheck className="mx-auto mb-1 h-3.5 w-3.5 text-emerald-500" />
                  <p className="text-sm font-semibold text-ink dark:text-white">{childAttendance.length ? `${percentage(present, childAttendance.length)}%` : '—'}</p>
                </div>
                <div className="rounded-xl bg-mist p-2.5 dark:bg-white/5">
                  <BookOpen className="mx-auto mb-1 h-3.5 w-3.5 text-accent" />
                  <p className="text-sm font-semibold text-ink dark:text-white">{childGrades.length ? `${avg}%` : '—'}</p>
                </div>
                <div className="rounded-xl bg-mist p-2.5 dark:bg-white/5">
                  <Wallet className="mx-auto mb-1 h-3.5 w-3.5 text-brand" />
                  <p className="text-sm font-semibold text-ink dark:text-white">{balance > 0 ? 'Due' : 'Paid'}</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-graphite">Enrolled {formatDate(child.enrolledDate)}</p>
              <button
                onClick={() => {
                  selectChild(child.id)
                  navigate('/app/parent')
                }}
                className="btn-outline mt-4 w-full justify-center py-2.5 text-sm"
              >
                View Dashboard
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
