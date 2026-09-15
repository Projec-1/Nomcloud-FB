import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  activeAcademicYear,
  currentTerm,
  fetchAcademicYears,
  fetchTerms,
  type AcademicYearRow,
  type TermRow,
} from '@/services/academicService'
import { deriveResourceState, type ResourceState } from '@/lib/resourceState'
import { DEFAULT_TIME_ZONE } from '@/utils/schoolCalendar'
import { toError } from '@/utils/errorMessage'

export interface AcademicStructure {
  years: AcademicYearRow[]
  terms: TermRow[]
  /** The status='active' row, read not computed. Null when none is set. */
  activeYear: AcademicYearRow | null
  /** The term containing today in the school's timezone. Null between terms. */
  term: TermRow | null
}

/**
 * Loads a school's academic years and terms, resolved through the batch 0
 * four-state contract. Phase 8 batch 2.
 *
 * Both queries are scoped to the signed-in user's own school_id explicitly, not
 * by relying on RLS to narrow a broader read.
 *
 * The `denied` state is derived from identity, never from an empty result: a
 * school that has simply not created any academic years yet must show `empty`,
 * not "you don't have access", which is the rule resourceState.ts encodes. Here
 * the only way to be denied is to hold no school at all, which is the state of a
 * platform operator.
 */
export function useAcademicStructure(): {
  state: ResourceState<AcademicStructure>
  reload: () => void
} {
  const { school, authState } = useAuth()
  const schoolId = school?.id ?? null
  const timeZone = school?.timezone ?? DEFAULT_TIME_ZONE

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<AcademicStructure | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false

    if (authState !== 'ready') return
    if (!schoolId) {
      setIsLoading(false)
      setData(null)
      return
    }

    setIsLoading(true)
    setError(null)

    Promise.all([fetchAcademicYears(schoolId), fetchTerms(schoolId)])
      .then(([years, terms]) => {
        if (cancelled) return
        setData({
          years,
          terms,
          activeYear: activeAcademicYear(years),
          term: currentTerm(years, terms, timeZone),
        })
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
  }, [schoolId, timeZone, authState, nonce])

  const state = deriveResourceState<AcademicStructure>({
    isLoading: authState !== 'ready' || isLoading,
    // Derived from identity: no school means no academic structure to be
    // entitled to. An empty list of years is `empty`, never `denied`.
    canAccess: schoolId !== null,
    error,
    data,
    isEmpty: (structure) => structure.years.length === 0,
    retry: reload,
  })

  return { state, reload }
}
