import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { ACCESS_DENIED_MESSAGE } from '@/lib/resourceState'

interface AccessDeniedProps {
  /**
   * Optional secondary line. The primary message is fixed and must stay fixed;
   * see ACCESS_DENIED_MESSAGE. Use this only to say what the person could do
   * instead, never to explain what they are missing, which would leak the
   * shape of data they cannot see.
   */
  hint?: string
  action?: ReactNode
}

/**
 * The single rendering of a denied read or an unreachable route.
 *
 * Decision 3 in docs/PHASE8_CONNECTION_PLAN.md section F.7: not a blank screen,
 * not a crash, not an unexplained redirect. One component so the wording cannot
 * drift between screens.
 */
export default function AccessDenied({ hint, action }: AccessDeniedProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-ink/10 dark:border-white/15 px-6 py-16 text-center"
    >
      <div className="mb-4 rounded-2xl bg-ink/5 dark:bg-white/10 p-4">
        <Lock className="h-6 w-6 text-graphite" />
      </div>
      <h3 className="text-base font-semibold text-ink dark:text-white">{ACCESS_DENIED_MESSAGE}</h3>
      {hint && <p className="mt-1.5 max-w-sm text-sm text-graphite">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
