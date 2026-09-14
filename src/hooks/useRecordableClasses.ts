import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { deriveResourceState, type ResourceState } from '@/lib/resourceState'
import { fetchManagedClasses } from '@/services/classService'
import { fetchTeacherWorkspace, type ClassSummary } from '@/services/teacherService'

// ---------------------------------------------------------------------------
// "Which classes may I record against, and what may I write in them?"
// Phase 8 batch 5.
//
// One hook for both sides of every teaching-records screen, because
// AttendanceMarker, GradeBook and HomeworkBoard are each mounted by a teacher
// page AND by an administrator page. The two identities reach the same rows
// through different policies, so they need different queries, but the screens
// need one answer in one shape.
//
//   teacher      fetchTeacherWorkspace  assigned classes, subject-exact writes
//   management   fetchManagedClasses    every class, class-level writes
//
// The role split mirrors the policy split exactly. Teacher policies key on
// teaches_class / teaches_class_subject; management policies key on
// can_manage_class. A guardian matches neither and is denied, which is correct:
// no guardian route mounts these screens, and decision 4 of RLS batch 4 gives
// guardians no write path in this batch at all.
// ---------------------------------------------------------------------------

const MANAGEMENT_ROLES = ['owner', 'director', 'administrator', 'principal'] as const

export interface UseRecordableClassesResult {
  state: ResourceState<ClassSummary[]>
  classes: ClassSummary[]
  /** True for owner/director/administrator/principal. Gates management-only controls. */
  canManage: boolean
  schoolId: string | null
  reload: () => void
}

export function useRecordableClasses(): UseRecordableClassesResult {
  const { activeMembership, school, authState } = useAuth()

  const role = activeMembership?.role ?? null
  const canManage = role !== null && (MANAGEMENT_ROLES as readonly string[]).includes(role)
  const teacherId = role === 'teacher' ? (activeMembership?.teacher_id ?? null) : null
  const schoolId = school?.id ?? null

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [classes, setClasses] = useState<ClassSummary[]>([])
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false

    if (authState !== 'ready') return
    if (!schoolId || (!canManage && !teacherId)) {
      setIsLoading(false)
      setClasses([])
      return
    }

    setIsLoading(true)
    setError(null)

    const load = canManage
      ? fetchManagedClasses(schoolId)
      : fetchTeacherWorkspace(schoolId, teacherId as string).then((w) => w.classes)

    load
      .then((result) => {
        if (!cancelled) setClasses(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [schoolId, canManage, teacherId, authState, nonce])

  const state = deriveResourceState<ClassSummary[]>({
    isLoading: authState !== 'ready' || isLoading,
    // Derived from identity, never from the result. Holding neither a management
    // role nor a teacher membership is what denies these screens. A school with
    // no classes yet, or a teacher not yet given one, is `empty` — telling them
    // they lack access would be wrong.
    canAccess: authState !== 'ready' ? undefined : schoolId !== null && (canManage || teacherId !== null),
    error,
    data: classes,
    retry: reload,
  })

  return { state, classes, canManage, schoolId, reload }
}
