import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/utils/cn'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: { value: string; positive: boolean }
  tint?: string
}

export default function StatCard({ label, value, icon: Icon, trend, tint = '#0071E3' }: StatCardProps) {
  return (
    <div className="card group relative overflow-hidden p-6 transition-transform duration-300 hover:-translate-y-1">
      <div
        className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.12] blur-xl transition-transform duration-500 group-hover:scale-125"
        style={{ background: tint }}
      />
      <div className="relative flex items-start justify-between">
        <div className="rounded-2xl p-2.5" style={{ backgroundColor: `${tint}1A`, color: tint }}>
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
