import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { ArrowDownRight, ArrowUpRight } from '@phosphor-icons/react'
import { cn } from '@/utils/cn'

interface StatCardProps {
  label: string
  value: string | number
  icon: PhosphorIcon
  trend?: { value: string; positive: boolean }
  tint?: string
}

export default function StatCard({ label, value, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="card relative overflow-hidden p-5 sm:p-6">
      <div className="relative flex items-start justify-between">
        <div className="rounded-xl bg-brand/10 p-2.5 text-brand">
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
              trend.positive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500',
            )}
          >
            {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend.value}
          </span>
        )}
      </div>
      <p className="relative mt-4 text-2xl font-semibold tracking-tight text-ink dark:text-white">{value}</p>
      <p className="relative mt-1 text-sm text-graphite">{label}</p>
    </div>
  )
}
