import { BookOpen } from '@phosphor-icons/react'
import { useSelectedChild } from '@/hooks/useSelectedChild'
import { useChildGrades } from '@/hooks/useChildRecords'
import PageHeader from '@/components/ui/PageHeader'
import ChildSwitcher from '@/components/dashboard/ChildSwitcher'
import ResourceGate from '@/components/ui/ResourceGate'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import { formatDate } from '@/utils/format'
import type { ChildGradeRecord } from '@/services/teachingRecordsService'

// Phase 8 batch 5. Real grade_records for the selected child.
//
// READ ONLY. grade_records_guardian_select (is_guardian_of_student) is the only
// guardian policy on the table; there is no guardian write policy of any kind,
// so nothing here offers one.
//
// THE LETTER GRADE IS COMPUTED HERE, NOT READ. grade_records stores score and
// max_score and has no grade column — the prototype's `g.grade` string had no
// equivalent in the real schema. The percentage is taken against each row's own
// max_score rather than assuming 100, since max_score is per record.

function percentOf(record: ChildGradeRecord): number {
  if (!record.maxScore) return 0
  return (record.score / record.maxScore) * 100
}

function scoreToGrade(pct: number) {
  if (pct >= 90) return 'A'
  if (pct >= 80) return 'A-'
  if (pct >= 70) return 'B+'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C+'
  if (pct >= 40) return 'C'
  return 'D'
}

function gradeTone(grade: string): 'success' | 'info' | 'warning' | 'danger' {
  if (grade.startsWith('A')) return 'success'
  if (grade.startsWith('B')) return 'info'
  if (grade.startsWith('C')) return 'warning'
  return 'danger'
}

export default function ParentGrades() {
  const { children, selectedChild, selectChild, state } = useSelectedChild()
  const { state: gradesState } = useChildGrades(selectedChild?.id ?? null)

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

  return (
    <div>
      <PageHeader
        title="Grades"
        description={`${selectedChild.name} · ${selectedChild.className ?? ''}`}
        actions={<ChildSwitcher children={children} selectedId={selectedChild.id} onSelect={selectChild} classLabel={(c) => c.className ?? ''} />}
      />

      <ResourceGate
        state={gradesState}
        empty={{
          icon: BookOpen,
          title: 'No grades recorded yet',
          description: "Grades will appear here as soon as they're recorded by teachers.",
        }}
        deniedHint="Child records are available to a linked parent or guardian."
      >
        {(records) => {
          const bySubjectMap = new Map<string, number[]>()
          for (const g of records) {
            bySubjectMap.set(g.subjectName, [...(bySubjectMap.get(g.subjectName) ?? []), percentOf(g)])
          }
          const bySubject = Array.from(bySubjectMap.entries()).map(([subject, pcts]) => ({
            subject,
            avg: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
          }))
          const overallAvg = Math.round(records.reduce((sum, g) => sum + percentOf(g), 0) / records.length)

          return (
            <>
              <div className="mb-6 grid gap-5 sm:grid-cols-3">
                <StatCard label="Overall Average" value={`${overallAvg}%`} icon={BookOpen} tint="#0071E3" />
                <StatCard label="Assessments Recorded" value={records.length} icon={BookOpen} tint="#FF5A1F" />
                <StatCard label="Subjects" value={bySubject.length} icon={BookOpen} tint="#A855F7" />
              </div>

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

              <div className="card overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-ink/5 text-left text-xs text-graphite dark:border-white/10">
                      <th className="px-5 py-3.5 font-medium">Subject</th>
                      <th className="px-5 py-3.5 font-medium">Term</th>
                      <th className="px-5 py-3.5 font-medium">Assessment</th>
                      <th className="px-5 py-3.5 font-medium">Score</th>
                      <th className="px-5 py-3.5 font-medium">Grade</th>
                      <th className="px-5 py-3.5 font-medium">Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((g) => {
                      const grade = scoreToGrade(percentOf(g))
                      return (
                        <tr key={g.id} className="border-b border-ink/5 last:border-b-0 dark:border-white/5">
                          <td className="px-5 py-3.5 text-ink dark:text-white">{g.subjectName}</td>
                          <td className="px-5 py-3.5 text-graphite">{g.termName}</td>
                          <td className="px-5 py-3.5 text-graphite">{g.assessment}</td>
                          <td className="px-5 py-3.5 text-graphite">
                            {g.score}/{g.maxScore}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge tone={gradeTone(grade)}>{grade}</Badge>
                          </td>
                          <td className="px-5 py-3.5 text-graphite">{formatDate(g.recordedAt.slice(0, 10))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )
        }}
      </ResourceGate>
    </div>
  )
}
