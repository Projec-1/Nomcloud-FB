import { useMemo, useState } from 'react'
import { Download, TrendingUp, CalendarCheck, Wallet, Users, GraduationCap, CalendarRange } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { formatCurrency, percentage } from '@/utils/format'
import { schoolDays } from '@/utils/schoolCalendar'

type ReportTab = 'attendance' | 'academic' | 'financial' | 'students' | 'teachers' | 'monthly'

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function AdminReports() {
  const { classes, students, teachers, attendance, grades, fees, parents } = useData()
  const { showToast } = useToast()
  const [tab, setTab] = useState<ReportTab>('attendance')

  const attendanceByClass = useMemo(
    () =>
      classes.map((c) => {
        const records = attendance.filter((a) => a.classId === c.id)
        const present = records.filter((a) => a.status === 'present' || a.status === 'late').length
        return { name: c.name, rate: records.length ? percentage(present, records.length) : 0 }
      }),
    [classes, attendance],
  )

  const academicByClass = useMemo(
    () =>
      classes.map((c) => {
        const classGrades = grades.filter((g) => g.classId === c.id)
        const avg = classGrades.length ? Math.round(classGrades.reduce((sum, g) => sum + g.score, 0) / classGrades.length) : 0
        return { name: c.name, avg }
      }),
    [classes, grades],
  )

  const financialByCategory = useMemo(() => {
    const map = new Map<string, { due: number; collected: number }>()
    fees.forEach((f) => {
      const entry = map.get(f.category) ?? { due: 0, collected: 0 }
      entry.due += f.amount
      entry.collected += f.amountPaid
      map.set(f.category, entry)
    })
    return Array.from(map.entries()).map(([category, v]) => ({ category, ...v }))
  }, [fees])

  const studentsByClass = useMemo(
    () =>
      classes.map((c) => {
        const roster = students.filter((s) => s.classId === c.id)
        const male = roster.filter((s) => s.gender === 'Male').length
        const female = roster.filter((s) => s.gender === 'Female').length
        return { name: c.name, total: roster.length, male, female }
      }),
    [classes, students],
  )

  const teacherSummaries = useMemo(
    () =>
      teachers.map((t) => {
        const teacherClasses = classes.filter((c) => c.teacherId === t.id)
        const studentCount = teacherClasses.reduce((sum, c) => sum + c.studentIds.length, 0)
        return { ...t, classCount: teacherClasses.length, studentCount }
      }),
    [teachers, classes],
  )

  const monthlyCollection = useMemo(() => {
    const now = new Date()
    const months: { label: string; collected: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = MONTHS[d.getMonth()]
      const collected = fees.reduce((sum, f) => {
        const inMonth = f.payments.filter((p) => {
          const pd = new Date(p.date)
          return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear()
        })
        return sum + inMonth.reduce((s, p) => s + p.amount, 0)
      }, 0)
      months.push({ label, collected })
    }
    return months
  }, [fees])

  const handleExport = () => {
    if (tab === 'attendance') {
      downloadCsv('attendance-report.csv', [['Class', 'Attendance Rate (%)'], ...attendanceByClass.map((r) => [r.name, r.rate])])
    } else if (tab === 'academic') {
      downloadCsv('academic-report.csv', [['Class', 'Average Score (%)'], ...academicByClass.map((r) => [r.name, r.avg])])
    } else if (tab === 'financial') {
      downloadCsv('financial-report.csv', [
        ['Category', 'Amount Due (USD)', 'Amount Collected (USD)'],
        ...financialByCategory.map((r) => [r.category, r.due, r.collected]),
      ])
    } else if (tab === 'students') {
      downloadCsv('students-report.csv', [
        ['Class', 'Total Students', 'Male', 'Female'],
        ...studentsByClass.map((r) => [r.name, r.total, r.male, r.female]),
      ])
    } else if (tab === 'teachers') {
      downloadCsv('teachers-report.csv', [
        ['Teacher', 'Subject', 'Classes', 'Students Taught'],
        ...teacherSummaries.map((t) => [t.name, t.subject, t.classCount, t.studentCount]),
      ])
    } else {
      downloadCsv('monthly-collection-report.csv', [['Month', 'Collected (USD)'], ...monthlyCollection.map((m) => [m.label, m.collected])])
    }
    showToast({ type: 'success', title: 'Report exported', description: 'Your CSV file has started downloading.' })
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description={`Insights across ${students.length} students, ${teachers.length} teachers and ${classes.length} classes`}
        actions={
          <Button onClick={handleExport} icon={<Download className="h-4 w-4" />}>
            Export CSV
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: 'attendance', label: 'Attendance' },
          { id: 'academic', label: 'Academic' },
          { id: 'financial', label: 'Fees' },
          { id: 'students', label: 'Students' },
          { id: 'teachers', label: 'Teachers' },
          { id: 'monthly', label: 'Monthly' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as ReportTab)}
      />

      <div className="mt-8 card p-6">
        {tab === 'attendance' && (
          <>
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600">
                <CalendarCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-ink dark:text-white">Attendance Rate by Class</h3>
                <p className="text-xs text-graphite">Across the last {schoolDays.length} school days</p>
              </div>
            </div>
            <div className="space-y-4">
              {attendanceByClass.map((r) => (
                <div key={r.name}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink dark:text-white">{r.name}</span>
                    <span className="text-graphite">{r.rate}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink/5 dark:bg-white/10">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.rate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'academic' && (
          <>
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-accent/10 p-2.5 text-accent">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-ink dark:text-white">Average Score by Class</h3>
                <p className="text-xs text-graphite">All recorded assessments this term</p>
              </div>
            </div>
            <div className="flex h-56 items-end gap-4">
              {academicByClass.map((r) => (
                <div key={r.name} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-medium text-ink dark:text-white">{r.avg}%</span>
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-t-lg bg-gradient-to-t from-accent/70 to-accent" style={{ height: `${r.avg}%` }} />
                  </div>
                  <span className="text-[11px] text-graphite">{r.name}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'financial' && (
          <>
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-brand/10 p-2.5 text-brand">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-ink dark:text-white">Fee Collection by Category</h3>
                <p className="text-xs text-graphite">Term 1 — collected vs. total due</p>
              </div>
            </div>
            <div className="space-y-4">
              {financialByCategory.map((r) => (
                <div key={r.category}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink dark:text-white">{r.category}</span>
                    <span className="text-graphite">
                      {formatCurrency(r.collected)} / {formatCurrency(r.due)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink/5 dark:bg-white/10">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${percentage(r.collected, r.due)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'students' && (
          <>
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-[#A855F7]/10 p-2.5 text-[#A855F7]">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-ink dark:text-white">Enrollment by Class</h3>
                <p className="text-xs text-graphite">{students.length} students · {parents.length} parent accounts</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-ink/5 text-left text-xs text-graphite dark:border-white/10">
                    <th className="py-3 font-medium">Class</th>
                    <th className="py-3 font-medium text-right">Total</th>
                    <th className="py-3 font-medium text-right">Male</th>
                    <th className="py-3 font-medium text-right">Female</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsByClass.map((r) => (
                    <tr key={r.name} className="border-b border-ink/5 last:border-b-0 dark:border-white/5">
                      <td className="py-3 font-medium text-ink dark:text-white">{r.name}</td>
                      <td className="py-3 text-right text-graphite">{r.total}</td>
                      <td className="py-3 text-right text-graphite">{r.male}</td>
                      <td className="py-3 text-right text-graphite">{r.female}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'teachers' && (
          <>
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-[#FF5A1F]/10 p-2.5 text-[#FF5A1F]">
                <GraduationCap className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-ink dark:text-white">Teaching Staff Summary</h3>
                <p className="text-xs text-graphite">{teachers.length} teachers on staff</p>
              </div>
            </div>
            <div className="space-y-3">
              {teacherSummaries.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-ink/5 px-4 py-3 dark:border-white/10">
                  <div className="flex items-center gap-3">
                    <Avatar name={t.name} color={t.avatarColor} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-ink dark:text-white">{t.name}</p>
                      <p className="text-xs text-graphite">{t.subject}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-graphite">
                    <p>{t.classCount} classes</p>
                    <p>{t.studentCount} students</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'monthly' && (
          <>
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600">
                <CalendarRange className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-ink dark:text-white">Monthly Fee Collection</h3>
                <p className="text-xs text-graphite">Payments recorded over the last 6 months</p>
              </div>
            </div>
            <div className="flex h-56 items-end gap-4">
              {monthlyCollection.map((m) => {
                const max = Math.max(...monthlyCollection.map((mm) => mm.collected), 1)
                return (
                  <div key={m.label} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-medium text-ink dark:text-white">{formatCurrency(m.collected)}</span>
                    <div className="flex w-full flex-1 items-end">
                      <div className="w-full rounded-t-lg bg-gradient-to-t from-emerald-500/60 to-emerald-500" style={{ height: `${(m.collected / max) * 100}%` }} />
                    </div>
                    <span className="text-[11px] text-graphite">{m.label}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
