import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { deriveResourceState, type ResourceState } from '@/lib/resourceState'
import {
  fetchEnrolledClasses,
  fetchLinkedStudents,
  toChildSummary,
  type ChildSummary,
} from '@/services/guardianService'
import { toError } from '@/utils/errorMessage'

const STORAGE_KEY = 'nomcloud_selected_child'

// ---------------------------------------------------------------------------
// Phase 8 batch 3. Rewritten to fix the breakage described in plan section A.4.
//
// BEFORE (broken since Phase 4):
//
//   const { parents, students } = <prototype store>
//   const parent = parents.find((p) => p.id === activeMembership?.guardian_id)
//   const children = students.filter((s) => parent?.studentIds.includes(s.id))
//
// activeMembership.guardian_id is a UUID. parents[].id is 'p1' or 'p2' from the
// seed. The find never matched, so `parent` was always undefined and `children`
// was always []. Every parent page then hit its own `if (!selectedChild)` guard
// and rendered "No children linked yet" to a guardian who does have children.
//
// AFTER: the guardian is resolved from the real membership and the children come
// from student_guardians. Nothing is compared against mock data.
//
// The multi-child switcher is deliberately preserved. student_guardians is
// many-to-many by design (SCHEMA_DESIGN section C table 18 exists precisely to
// replace the frontend's one-parent-per-student assumption), so a guardian with
// several children is normal, not an edge case. The selected child is still
// remembered per browser, and is now validated against real ids.
// ---------------------------------------------------------------------------

export interface UseSelectedChildResult {
  /** Four-state contract for the children list. Pages render it through ResourceGate. */
  state: ResourceState<ChildSummary[]>
  children: ChildSummary[]
  selectedChild: ChildSummary | null
  selectChild: (id: string) => void
  reload: () => void
}

export function useSelectedChild(): UseSelectedChildResult {
  const { activeMembership, school, authState } = useAuth()

  // The resolution that is the fix. guardian_id is present only on a membership
  // whose role is 'guardian'; the positive CHECK on memberships guarantees that
  // pairing, so a non-guardian membership yields null and this hook stays inert.
  const guardianId = activeMembership?.role === 'guardian' ? activeMembership.guardian_id : null
  const schoolId = school?.id ?? null

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [children, setChildren] = useState<ChildSummary[]>([])
  const [nonce, setNonce] = useState(0)

  const [selectedId, setSelectedId] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(STORAGE_KEY) ?? ''
  })

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false

    if (authState !== 'ready') return
    if (!schoolId || !guardianId) {
      setIsLoading(false)
      setChildren([])
      return
    }

    setIsLoading(true)
    setError(null)

    fetchLinkedStudents(schoolId, guardianId)
      .then(async (students) => {
        if (cancelled) return
        // Batch 4 closed the gap batch 3 left here: a child's class comes from
        // class_enrollments, not from a column on students.
        const classes = await fetchEnrolledClasses(
          schoolId,
          students.map((s) => s.id),
        )
        if (cancelled) return
        setChildren(students.map((s) => toChildSummary(s, classes.get(s.id) ?? null)))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(toError(err))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [schoolId, guardianId, authState, nonce])

  // A remembered selection from a previous session, or from another guardian on
  // a shared device, must not survive if it is not one of THIS guardian's
  // children. Falling back to the first child is what keeps the switcher honest.
  useEffect(() => {
    if (children.length === 0) return
    if (!children.some((child) => child.id === selectedId)) {
      setSelectedId(children[0].id)
    }
  }, [children, selectedId])

  const selectChild = useCallback((id: string) => {
    setSelectedId(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // A browser with storage blocked still switches for this session.
    }
  }, [])

  const state = deriveResourceState<ChildSummary[]>({
    isLoading: authState !== 'ready' || isLoading,
    // Derived from identity, never from the result. Holding no guardian
    // membership is the one thing that genuinely denies this data. A guardian
    // with zero linked children is `empty`, because an administrator simply has
    // not attached a child yet — telling them they lack access would be wrong.
    canAccess: authState !== 'ready' ? undefined : guardianId !== null && schoolId !== null,
    error,
    data: children,
    retry: reload,
  })

  const selectedChild = children.find((child) => child.id === selectedId) ?? children[0] ?? null

  return { state, children, selectedChild, selectChild, reload }
}
