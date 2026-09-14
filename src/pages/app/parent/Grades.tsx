import { useMemo } from 'react'
import { BookOpen } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useSelectedChild } from '@/hooks/useSelectedChild'
import PageHeader from '@/components/ui/PageHeader'
import ChildSwitcher from '@/components/dashboard/ChildSwitcher'
import EmptyState from '@/components/ui/EmptyState'
import ResourceGate from '@/components/ui/ResourceGate'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import { formatDate } from '@/utils/format'

function gradeTone(grade: string): 'success' | 'info' | 'warning' | 'danger' {
  if (grade.startsWith('A')) return 'success'
  if (grade.startsWith('B')) return 'info'
  if (grade.startsWith('C')) return 'warning'
  return 'danger'
}

export default function ParentGrades() {
  const { grades } = useData()
  const { children, selectedChild, selectChild, state } = useSelectedChild()

  const childGrades = useMemo(
    () => (selectedChild ? grades.filter((g) => g.studentId === selectedChild.id).sort((a, b) => (a.date < b.date ? 1 : -1)) : []),
    [grades, selectedChild],
  )

  const bySubject = useMemo(() => {
    const map = new Map<string, number[]>()
    childGrades.forEach((g) => {
      map.set(g.subject, [...(map.get(g.subject) ?? []), g.score])
    })
    return Array.from(map.entries()).map(([subject, scores]) => ({
      subject,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))
  }, [childGrades])

  if (!selectedChild) {
    return (
      <div>
        <PageHeader title="Grades" description="Your child's academic performance." />
        <ResourceGate
          state={state}
          empty={{ icon: BookOpen, title: "No children linked yet", description: "Contact your school administrator to link your child's record." }}
          deniedHint="Child records are available to a linked parent or guardian."
        >
          {() => null}
        </ResourceGate>
      </div>
    )
  }

  const overallAvg = childGrades.length ? Math.round(childGrades.reduce((sum, g) => sum + g.score, 0) / childGrades.length) : 0

  return (
    <div>
      <PageHeader
        title="Grades"
        description={`${selectedChild.name} · ${selectedChild.className ?? ''}`}
        actions={<ChildSwitcher children={children} selectedId={selectedChild.id} onSelect={selectChild} classLabel={(c) => c.className ?? ''} />}
      />

      <div className="mb-6 grid gap-5 sm:grid-cols-3">
        <StatCard label="Overall Average" value={childGrades.length ? `${overallAvg}%` : '—'} icon={BookOpen} tint="#0071E3" />
        <StatCard label="Assessments Recorded" value={childGrades.length} icon={BookOpen} tint="#FF5A1F" />
        <StatCard label="Subjects" value={bySubject.length} icon={BookOpen} tint="#A855F7" />
      </div>

      {bySubject.length > 0 && (
        <div className="card mb-6 p-6">
          <h3 className="mb-5 font-semibold text-ink dark:text-white">Average by Subject</h3>
          <div className="space-y-4">
            {bySubject.map((s) => (
              <div key={s.subject}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink dark:text-white">{s.subject}</span>
                  <span className="text-graphite">{s.avg}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-ink/5 dark:bg-white/10">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${s.avg}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {childGrades.length === 0 ? (
        <EmptyState title="No grades recorded yet" description="Grades will appear here as soon as they're recorded by teachers." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-ink/5 text-left text-xs text-graphite dark:border-white/10">
                <th className="px-5 py-3.5 font-medium">Subject</th>
                <th className="px-5 py-3.5 font-medium">Assessment</th>
                <th className="px-5 py-3.5 font-medium">Score</th>
                <th className="px-5 py-3.5 font-medium">Grade</th>
                <th className="px-5 py-3.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {childGrades.map((g) => (
                <tr key={g.id} className="border-b border-ink/5 last:border-b-0 dark:border-white/5">
                  <td className="px-5 py-3.5 text-ink dark:text-white">{g.subject}</td>
                  <td className="px-5 py-3.5 text-graphite">{g.assessment}</td>
                  <td className="px-5 py-3.5 text-graphite">
                    {g.score}/{g.maxScore}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge tone={gradeTone(g.grade)}>{g.grade}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-graphite">{formatDate(g.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
