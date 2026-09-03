import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import type { SchoolClass } from '@/types'
import { cn } from '@/utils/cn'

const assessmentTypes = ['CAT 1', 'CAT 2', 'Mid-Term Exam', 'End-Term Exam', 'Assignment']

function scoreToGrade(pct: number) {
  if (pct >= 90) return 'A'
  if (pct >= 80) return 'A-'
  if (pct >= 70) return 'B+'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C+'
  if (pct >= 40) return 'C'
  return 'D'
}

function gradeTone(grade: string) {
  if (grade.startsWith('A')) return 'text-emerald-600'
  if (grade.startsWith('B')) return 'text-accent'
  if (grade.startsWith('C')) return 'text-amber-600'
  return 'text-red-500'
}

export default function GradeBook({ classes, recordedBy }: { classes: SchoolClass[]; recordedBy: string }) {
  const { students, grades, addGrade, updateGrade, currentTerm } = useData()
  const { showToast } = useToast()

  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const selectedClass = classes.find((c) => c.id === classId)
  const [subject, setSubject] = useState(selectedClass?.subject[0] ?? '')
  const [assessment, setAssessment] = useState(assessmentTypes[0])
  const [scores, setScores] = useState<Record<string, string>>({})

  useEffect(() => {
    setSubject(selectedClass?.subject[0] ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  const classStudents = useMemo(
    () => students.filter((s) => s.classId === classId).sort((a, b) => a.name.localeCompare(b.name)),
    [students, classId],
  )

  useEffect(() => {
    const next: Record<string, string> = {}
    classStudents.forEach((s) => {
      const existing = grades.find(
        (g) => g.studentId === s.id && g.classId === classId && g.subject === subject && g.assessment === assessment && g.term === currentTerm,
      )
      next[s.id] = existing ? String(existing.score) : ''
    })
    setScores(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subject, assessment, students.length])

  const handleSave = () => {
    if (!selectedClass) return
    let count = 0
    classStudents.forEach((s) => {
      const raw = scores[s.id]
      if (raw === undefined || raw === '') return
      const score = Math.max(0, Math.min(100, Number(raw)))
      const existing = grades.find(
        (g) => g.studentId === s.id && g.classId === classId && g.subject === subject && g.assessment === assessment && g.term === currentTerm,
      )
      count += 1
      if (existing) {
        updateGrade(existing.id, { score, grade: scoreToGrade(score) })
      } else {
        addGrade({
          studentId: s.id,
          classId,
          subject,
          term: currentTerm,
          assessment,
          score,
          maxScore: 100,
          grade: scoreToGrade(score),
          recordedBy,
          date: new Date().toISOString().slice(0, 10),
        })
      }
    })
    showToast({ type: 'success', title: 'Grades saved', description: `${count} grade${count === 1 ? '' : 's'} recorded for ${subject}.` })
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select label="Class" value={classId} onChange={(e) => setClassId(e.target.value)} className="sm:w-52">
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="sm:w-52">
            {(selectedClass?.subject ?? []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select label="Assessment" value={assessment} onChange={(e) => setAssessment(e.target.value)} className="sm:w-48">
            {assessmentTypes.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={handleSave} icon={<Save className="h-4 w-4" />}>
          Save Grades
        </Button>
      </div>

      {classStudents.length === 0 ? (
        <EmptyState title="No students in this class" description="Add students to this class to begin recording grades." />
      ) : (
        <div className="card divide-y divide-ink/5 dark:divide-white/5">
          <div className="flex items-center justify-between px-5 py-3.5 text-xs font-medium text-graphite">
            <span>Student</span>
            <span>Score / 100</span>
          </div>
          {classStudents.map((s) => {
            const raw = scores[s.id] ?? ''
            const num = Number(raw)
            const grade = raw !== '' && !Number.isNaN(num) ? scoreToGrade(num) : null
            return (
              <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} color={s.avatarColor} size="sm" />
                  <p className="text-sm font-medium text-ink dark:text-white">{s.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  {grade && <span className={cn('w-8 text-right text-sm font-semibold', gradeTone(grade))}>{grade}</span>}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={raw}
                    onChange={(e) => setScores((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    className="input w-20 text-center"
                    placeholder="—"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
