import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-ink/10 dark:border-white/15 px-6 py-16 text-center">
      <div className="mb-4 rounded-2xl bg-ink/5 dark:bg-white/10 p-4">
        <Icon className="h-6 w-6 text-graphite" />
      </div>
      <h3 className="text-base font-semibold text-ink dark:text-white">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-graphite">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
