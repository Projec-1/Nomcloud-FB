import { useCallback, useEffect, useState } from 'react'
import { Save, Lock } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonRows } from '@/components/ui/Loader'
import { useAcademicStructure } from '@/hooks/useAcademicStructure'
import type { ClassSummary } from '@/services/teacherService'
import { fetchRosterStudents, type RosterStudent } from '@/services/studentService'
import { fetchGrades, saveGrades, type GradeEntry } from '@/services/teachingRecordsService'
import { cn } from '@/utils/cn'
import { errorMessage } from '@/utils/errorMessage'

// ---------------------------------------------------------------------------
// Phase 8 batch 5. Reads and writes real grade_records.
//
// THIS SCREEN IS WHERE SUBJECT-EXACT ACCESS IS ENFORCED IN THE INTERFACE.
//
// grade_records_teacher_insert requires teaches_class_subject(school_id,
// class_id, subject_id) — the exact (class, subject) pair, established in RLS
// migration 12. A teacher READS the whole class's grades through
// grade_records_teacher_select (teaches_class, class-level) but may WRITE only
// their own subjects.
//
// So the subject selector is NOT selectedClass.subject, which is every subject
// taught in the class. It is selectedClass.writableSubjects, which for a teacher
// is only their own class_subjects rows and for management is every subject,
// matching can_manage_class being class-level. A homeroom-only teacher therefore
// sees an empty selector and NO SCORE INPUTS AT ALL, rather than a full form
// whose Save is refused.
//
// That distinction matters because RLS filters rather than raises. Offering the
// field and letting the database decide would, for an UPDATE, report zero rows
// and no error — the teacher would type a column of marks, press Save, see a
// success toast and lose the lot.
//
// WHY THE TERM IS A VISIBLE CONTROL. grade_records.term_id is NOT NULL and part
// of the natural key, UNIQUE (school_id, student_id, subject_id, term_id,
// assessment). The batch 2 academic hook resolves the current term by date and
// returns NULL between terms, so a hidden default would silently write into the
// wrong term or fail. The term is chosen explicitly, defaulted to the current
// one when there is one.
//
// NO DELETE CONTROL. grade_records has no teacher DELETE policy; only management
// can remove a mark, and no screen in this batch offers it.
// ---------------------------------------------------------------------------

const assessmentTypes = ['CAT 1', 'CAT 2', 'Mid-Term Exam', 'End-Term Exam', 'Assignment']

const MAX_SCORE = 100

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

interface GradeBookProps {
  classes: ClassSummary[]
  schoolId: string
}

export default function GradeBook({ classes, schoolId }: GradeBookProps) {
  const { showToast } = useToast()
  const { state: academicState } = useAcademicStructure()

  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const selectedClass = classes.find((c) => c.id === classId)

  // The writable set, not the class's full subject list. This one line is the
  // subject-exact restriction as the user experiences it.
  const writable = selectedClass?.writableSubjects ?? []

  const [subjectId, setSubjectId] = useState(writable[0]?.id ?? '')
  const [termId, setTermId] = useState('')
  const [assessment, setAssessment] = useState(assessmentTypes[0])
  const [students, setStudents] = useState<RosterStudent[]>([])
  const [scores, setScores] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const terms = academicState.status === 'ready' ? academicState.data.terms : []
  const currentTermId = academicState.status === 'ready' ? (academicState.data.term?.id ?? '') : ''

  // Changing class re-anchors the subject, because the writable set is per class:
  // a teacher may teach Mathematics in one class and nothing in another.
  //
  // Keyed on the subject IDS rather than the array, so a re-render that hands
  // back an equal-but-new array does not silently reset a subject the user
  // chose. Only a genuine change of writable subjects re-anchors it.
  const writableKey = writable.map((s) => s.id).join(',')
  useEffect(() => {
    setSubjectId((current) => {
      if (current && writable.some((s) => s.id === current)) return current
      return writable[0]?.id ?? ''
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, writableKey])

  // Default to the term containing today, falling back to the most recent
  // defined term when today falls between terms.
  useEffect(() => {
    if (termId) return
    if (currentTermId) setTermId(currentTermId)
    else if (terms.length > 0) setTermId(terms[terms.length - 1].id)
  }, [currentTermId, terms, termId])

  useEffect(() => {
    let cancelled = false
    if (!selectedClass) {
      setStudents([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const needsGrades = Boolean(subjectId && termId)

    Promise.all([
      fetchRosterStudents(schoolId, selectedClass.studentIds),
      needsGrades
        ? fetchGrades(schoolId, selectedClass.id, subjectId, termId, assessment)
        : Promise.resolve(new Map<string, GradeEntry>()),
    ])
      .then(([roster, existing]) => {
        if (cancelled) return
        setStudents(roster)
        const next: Record<string, string> = {}
        for (const s of roster) {
          const record = existing.get(s.id)
          next[s.id] = record ? String(record.score) : ''
        }
        setScores(next)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        showToast({
          type: 'error',
          title: 'Could not load grades',
          description: errorMessage(err),
        })
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [schoolId, selectedClass, subjectId, termId, assessment, showToast])

  const handleSave = useCallback(async () => {
    if (!selectedClass || !subjectId || !termId) return
    setIsSaving(true)

    const entries: GradeEntry[] = []
    for (const s of students) {
      const raw = scores[s.id]
      if (raw === undefined || raw.trim() === '') continue
      const parsed = Number(raw)
      if (Number.isNaN(parsed)) continue
      // grade_records_score_check enforces 0 <= score <= max_score in the
      // database. Clamping here only produces a better outcome than a raw
      // constraint violation; the constraint is what guarantees it.
      entries.push({ studentId: s.id, score: Math.max(0, Math.min(MAX_SCORE, parsed)), maxScore: MAX_SCORE })
    }

    if (entries.length === 0) {
      setIsSaving(false)
      showToast({ type: 'info', title: 'Nothing to save', description: 'Enter at least one score first.' })
      return
    }

    try {
      await saveGrades(schoolId, selectedClass.id, subjectId, termId, assessment, entries)
      const subjectName = writable.find((s) => s.id === subjectId)?.name ?? 'this subject'
      showToast({
        type: 'success',
        title: 'Grades saved',
        description: `${entries.length} grade${entries.length === 1 ? '' : 's'} recorded for ${subjectName}.`,
      })
    } catch (err: unknown) {
      // A subject this user does not teach raises 42501 here. Surfacing it is
      // the point: a silent success toast over a refused write is exactly the
      // failure this screen is designed to avoid.
      showToast({
        type: 'error',
        title: 'Grades not saved',
        description: errorMessage(err),
      })
    } finally {
      setIsSaving(false)
    }
  }, [selectedClass, subjectId, termId, assessment, students, scores, schoolId, writable, showToast])

  // The homeroom-only case: assigned to the class, teaching none of its
  // subjects. Reading grades is allowed; writing any of them is not. Saying so
  // is better than an empty dropdown the user cannot explain.
  if (selectedClass && writable.length === 0) {
    return (
      <div>
        <ClassPicker classes={classes} classId={classId} onChange={setClassId} />
        <EmptyState
          icon={Lock}
          title="No subjects you can grade in this class"
          description="Marks are entered by the teacher assigned to each subject. You can still mark this class's attendance."
        />
      </div>
    )
  }

  const canSave = Boolean(selectedClass && subjectId && termId) && !isSaving && !isLoading

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Select label="Class" value={classId} onChange={(e) => setClassId(e.target.value)} className="sm:w-44">
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="sm:w-44">
            {writable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select label="Term" value={termId} onChange={(e) => setTermId(e.target.value)} className="sm:w-44">
            {terms.length === 0 && <option value="">No terms defined</option>}
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select label="Assessment" value={assessment} onChange={(e) => setAssessment(e.target.value)} className="sm:w-44">
            {assessmentTypes.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={handleSave} disabled={!canSave} icon={<Save className="h-4 w-4" />}>
          {isSaving ? 'Saving…' : 'Save Grades'}
        </Button>
      </div>

      {terms.length === 0 ? (
        <EmptyState
          title="No terms defined yet"
          description="Grades are recorded against a term. Ask your administrator to set up the academic year first."
        />
      ) : isLoading ? (
        <SkeletonRows />
      ) : students.length === 0 ? (
        <EmptyState title="No students in this class" description="Add students to this class to begin recording grades." />
      ) : (
        <div className="card divide-y divide-ink/5 dark:divide-white/5">
          <div className="flex items-center justify-between px-5 py-3.5 text-xs font-medium text-graphite">
            <span>Student</span>
            <span>Score / {MAX_SCORE}</span>
          </div>
          {students.map((s) => {
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
                    max={MAX_SCORE}
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

function ClassPicker({
  classes,
  classId,
  onChange,
}: {
  classes: ClassSummary[]
  classId: string
  onChange: (id: string) => void
}) {
  return (
    <div className="mb-6">
      <Select label="Class" value={classId} onChange={(e) => onChange(e.target.value)} className="sm:w-44">
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </div>
  )
}
