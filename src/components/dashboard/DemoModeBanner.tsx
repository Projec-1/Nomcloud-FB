import { Flask as FlaskConical } from '@phosphor-icons/react'
import { useAuth } from '@/context/AuthContext'
import { shouldShowDemoIndicator } from '@/lib/demoSchool'

/**
 * The persistent Demo Mode indicator.
 *
 * Decision 12 in docs/PHASE8_CONNECTION_PLAN.md section H.9 calls for something
 * "a person cannot miss in a screenshot or a screen share, so a demo can never
 * be mistaken for a customer's real data or the reverse". Hence a full-width
 * amber bar above the top bar rather than a small badge tucked into a corner.
 *
 * Renders nothing at all unless the active school carries is_demo, and the whole
 * component folds out of a production bundle because shouldShowDemoIndicator
 * depends on the compile-time import.meta.env.DEV.
 */
export default function DemoModeBanner() {
  const { school } = useAuth()

  if (!shouldShowDemoIndicator(school)) return null

  return (
    <div
      role="status"
      aria-label="Demo mode"
      className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-center text-[13px] font-semibold text-amber-950"
    >
      <FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Demo Mode — {school?.name}. This is sample data, not a real school.
      </span>
    </div>
  )
}
