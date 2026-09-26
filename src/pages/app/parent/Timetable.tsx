import { useEffect, useState } from 'react'
import { CalendarBlank as CalendarRange } from '@phosphor-icons/react'
import { useAuth } from '@/context/AuthContext'
import { useSelectedChild } from '@/hooks/useSelectedChild'
import ChildSwitcher from '@/components/dashboard/ChildSwitcher'
import TimetableGrid from '@/components/dashboard/TimetableGrid'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import ResourceGate from '@/components/ui/ResourceGate'
import { deriveResourceState } from '@/lib/resourceState'
import { fetchChildTimetable } from '@/services/guardianService'
import type { TimetableSlotView } from '@/services/teacherService'
import { toError } from '@/utils/errorMessage'

export default function ParentTimetable() {
  const { school } = useAuth()
  const { children, selectedChild, selectChild, state: childrenState } = useSelectedChild()
  const [slots, setSlots] = useState<TimetableSlotView[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const schoolId = school?.id ?? null
  const classId = selectedChild?.classId ?? null

  useEffect(() => {
    let cancelled = false
    if (!schoolId || !classId) {
      setSlots([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)
    fetchChildTimetable(schoolId, classId)
      .then((rows) => {
        if (!cancelled) setSlots(rows)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(toError(cause))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [schoolId, classId, reloadKey])

  if (childrenState.status !== 'ready') {
    return (
      <div>
        <PageHeader title="Timetable" />
        <ResourceGate state={childrenState} empty={{ title: 'No children linked yet' }} deniedHint="Timetables are available to a linked parent or guardian.">
          {() => null}
        </ResourceGate>
      </div>
    )
  }

  if (!selectedChild) {
    return (
      <div>
        <PageHeader title="Timetable" />
        <EmptyState
          icon={CalendarRange}
          title="No children linked yet"
          description="Contact your school administrator to link your child's record to this account."
        />
      </div>
    )
  }

  if (!classId) {
    return (
      <div>
        <PageHeader title="Timetable" description={`${selectedChild.name} has no active class enrolment.`} />
        <ChildSwitcher children={children} selectedId={selectedChild.id} onSelect={selectChild} classLabel={(child) => child.className ?? ''} />
        <div className="mt-6">
          <EmptyState icon={CalendarRange} title="No class timetable yet" description="The school timetable will appear here after a class is assigned." />
        </div>
      </div>
    )
  }

  const timetableState = deriveResourceState({
    isLoading,
    canAccess: schoolId !== null && classId !== null,
    error,
    data: slots,
    retry: () => setReloadKey((current) => current + 1),
  })

  return (
    <div>
      <PageHeader
        title="Timetable"
        description={`${selectedChild.name} · ${selectedChild.className ?? 'Assigned class'}`}
        actions={<ChildSwitcher children={children} selectedId={selectedChild.id} onSelect={selectChild} classLabel={(child) => child.className ?? ''} />}
      />
      <ResourceGate state={timetableState} empty={{ icon: CalendarRange, title: 'No timetable published yet' }} deniedHint="This timetable is not available to your account.">
        {(data) => <TimetableGrid slots={data} />}
      </ResourceGate>
    </div>
  )
}
