import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { deriveResourceState, type ResourceState } from '@/lib/resourceState'
import { fetchTeacherWorkspace, type TeacherWorkspace } from '@/services/teacherService'
import { toError } from '@/utils/errorMessage'

// ---------------------------------------------------------------------------
// Phase 8 batch 4. The teacher-side counterpart of useSelectedChild.
//
// Replaces this, repeated in all seven teacher pages:
//
//   const myClasses = classes.filter((c) => c.teacherId === activeMembership?.teacher_id)
//
// which compared 't1' against a UUID and therefore always produced []. See
// teacherService.ts for the resolution chain and for why the "assigned to teach"
// definition is reused rather than re-derived.
// ---------------------------------------------------------------------------

export interface UseTeacherClassesResult {
  state: ResourceState<TeacherWorkspace>
  /** Convenience accessors; empty until the state is ready. */
  classes: TeacherWorkspace['classes']
  timetable: TeacherWorkspace['timetable']
  teacherId: string | null
  reload: () => void
}

export function useTeacherClasses(): UseTeacherClassesResult {
  const { activeMembership, school, authState } = useAuth()

  // The resolution that is the fix. teacher_id is present only on a membership
  // whose role is 'teacher', guaranteed by the positive CHECK on memberships.
  const teacherId = activeMembership?.role === 'teacher' ? activeMembership.teacher_id : null
  const schoolId = school?.id ?? null

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<TeacherWorkspace | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false

    if (authState !== 'ready') return
    if (!schoolId || !teacherId) {
      setIsLoading(false)
      setData(null)
      return
    }

    setIsLoading(true)
    setError(null)

    fetchTeacherWorkspace(schoolId, teacherId)
      .then((workspace) => {
        if (!cancelled) setData(workspace)
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
  }, [schoolId, teacherId, authState, nonce])

  const state = deriveResourceState<TeacherWorkspace>({
    isLoading: authState !== 'ready' || isLoading,
    // Derived from identity, never from the result. Holding no teacher
    // membership is what denies this data. A teacher with zero assigned classes
    // is `empty`, because an administrator has simply not given them a class
    // yet — telling them they lack access would be wrong.
    canAccess: authState !== 'ready' ? undefined : teacherId !== null && schoolId !== null,
    error,
    data,
    isEmpty: (workspace) => workspace.classes.length === 0,
    retry: reload,
  })

  return {
    state,
    classes: data?.classes ?? [],
    timetable: data?.timetable ?? [],
    teacherId,
    reload,
  }
}
