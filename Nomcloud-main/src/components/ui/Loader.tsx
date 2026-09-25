import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-graphite">
      <Loader2 className="h-6 w-6 animate-spin text-brand" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-ink/5 dark:bg-white/10', className)} />
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}
