import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { deriveResourceState, type ResourceState } from '@/lib/resourceState'
import {
  fetchChildAttendance,
  fetchChildGrades,
  fetchChildHomework,
  type ChildAttendanceRecord,
  type ChildGradeRecord,
  type ChildHomeworkItem,
} from '@/services/teachingRecordsService'
import { toError } from '@/utils/errorMessage'

// ---------------------------------------------------------------------------
// A guardian's view of one child's teaching records. Phase 8 batch 5.
//
// READ-ONLY BY CONSTRUCTION. There is no write counterpart to any of these, and
// the service exposes none for a guardian. Decision 4 of RLS batch 4 settled it:
// homework is physical and the teacher marks it reviewed in person, so no
// guardian-submission path is needed anywhere. The prototype's parent homework
// screen had a "Mark as Submitted" button; it is gone, not disabled.
//
// The guardian policies are shaped differently from the teacher ones and these
// queries match that shape. is_guardian_of_student is STUDENT-shaped, so
// attendance and grades are fetched by student_id. guardian_has_student_in_class
// is CLASS-shaped, so homework is fetched by the class the child is enrolled in.
//
// `denied` is derived from identity — no child selected, or no school — never
// from an empty result. A child with no marks yet is `empty`: telling a parent
// they lack access to their own child's blank record would be wrong, and is
// precisely the mistake resourceState.ts exists to prevent.
// ---------------------------------------------------------------------------

interface ChildRecordsResult<T> {
  state: ResourceState<T>
  reload: () => void
}

function useChildResource<T>(
  studentId: string | null,
  load: ((schoolId: string, studentId: string) => Promise<T>) | null,
  isEmpty: (data: T) => boolean,
): ChildRecordsResult<T> {
  const { school, authState } = useAuth()
  const schoolId = school?.id ?? null

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<T | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false

    if (authState !== 'ready') return
    if (!schoolId || !studentId || !load) {
      setIsLoading(false)
      setData(null)
      return
    }

    setIsLoading(true)
    setError(null)

    load(schoolId, studentId)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toError(err))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [schoolId, studentId, load, authState, nonce])

  const state = deriveResourceState<T>({
    isLoading: authState !== 'ready' || isLoading,
    canAccess: authState !== 'ready' ? undefined : schoolId !== null && studentId !== null,
    error,
    data,
    isEmpty,
    retry: reload,
  })

  return { state, reload }
}

/** One child's attendance, most recent first. */
export function useChildAttendance(studentId: string | null): ChildRecordsResult<ChildAttendanceRecord[]> {
  return useChildResource<ChildAttendanceRecord[]>(
    studentId,
    fetchChildAttendance,
    (rows) => rows.length === 0,
  )
}

/** One child's grades, with subject and term names resolved. */
export function useChildGrades(studentId: string | null): ChildRecordsResult<ChildGradeRecord[]> {
  return useChildResource<ChildGradeRecord[]>(studentId, fetchChildGrades, (rows) => rows.length === 0)
}

/**
 * One child's homework for the class they are enrolled in.
 *
 * Takes the classId separately because the guardian homework policy is
 * class-shaped. A child with no open enrolment has no class, and therefore no
 * homework to show — `empty`, not `denied`.
 */
export function useChildHomework(
  studentId: string | null,
  classId: string | null,
): ChildRecordsResult<ChildHomeworkItem[]> {
  const load = useCallback(
    (schoolId: string, id: string) => fetchChildHomework(schoolId, classId as string, id),
    [classId],
  )
  return useChildResource<ChildHomeworkItem[]>(
    studentId,
    classId ? load : null,
    (rows) => rows.length === 0,
  )
}
