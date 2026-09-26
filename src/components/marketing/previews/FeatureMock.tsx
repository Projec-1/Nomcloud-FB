import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Check, Clock, Paperclip } from '@phosphor-icons/react'

export type FeatureMockVariant = 'table' | 'chat' | 'chart' | 'calendar' | 'list' | 'cards'

interface FeatureMockProps {
  variant: FeatureMockVariant
  tint: string
}

const chartBars = [40, 65, 50, 80, 60, 90, 70]

export default function FeatureMock({ variant }: FeatureMockProps) {
  if (variant === 'chart') {
    return (
      <div className="flex h-28 items-end gap-1.5 px-1">
        {chartBars.map((h, i) => (
          <div key={i} className="flex-1 bg-brand" style={{ height: `${h}%` }} />
        ))}
      </div>
    )
  }

  if (variant === 'calendar') {
    return (
      <div className="grid h-28 grid-cols-7 gap-1">
        {Array.from({ length: 21 }).map((_, i) => (
          <div
            key={i}
            className={[3, 7, 12, 16].includes(i) ? 'rounded-md bg-brand' : 'rounded-md bg-ink/5 dark:bg-white/10'}
          />
        ))}
      </div>
    )
  }

  if (variant === 'chat') {
    return (
      <div className="flex h-28 flex-col justify-end gap-2">
        <div className="ml-auto max-w-[75%] rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-[11px] text-white">
          Thanks for the update, appreciate it!
        </div>
        <div className="mr-auto max-w-[75%] rounded-2xl rounded-bl-sm bg-ink/5 px-3 py-2 text-[11px] text-ink dark:bg-white/10 dark:text-white">
          Your child is doing great this term.
        </div>
      </div>
    )
  }

  if (variant === 'cards') {
    return (
      <div className="grid h-28 grid-cols-2 gap-2">
        {['Term 1', 'Term 2', 'Term 3', '2026/27'].map((label, i) => (
          <div
            key={label}
            className="flex flex-col justify-between rounded-lg border border-ink/5 p-2 text-[10px] dark:border-white/10"
            style={{ backgroundColor: i === 0 ? 'var(--nc-accent-soft)' : 'transparent' }}
          >
            <span className="font-medium text-ink dark:text-white">{label}</span>
            <span className="text-graphite">{i === 0 ? 'Active' : i === 3 ? 'Upcoming' : 'Closed'}</span>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className="h-28 space-y-2">
        {['Homework submitted', 'CAT graded', 'New attachment added'].map((item, i) => (
          <div key={item} className="flex items-center gap-2 text-[11px] text-ink dark:text-white">
            {i === 2 ? <Paperclip className="h-3 w-3 text-graphite" /> : <Check className="h-3 w-3 text-brand" />}
            {item}
          </div>
        ))}
        <div className="flex items-center gap-2 text-[11px] text-graphite">
          <Clock className="h-3 w-3" /> Due in 2 days
        </div>
      </div>
    )
  }

  // table
  return (
    <div className="h-28 space-y-1.5">
      {[
        ['Ahmed A.', 'Present'],
        ['Grace A.', 'Present'],
        ['Brian M.', 'Late'],
        ['Fatuma M.', 'Present'],
      ].map(([name, status]) => (
        <div key={name} className="flex items-center justify-between rounded-md bg-ink/[0.03] px-2.5 py-1.5 text-[11px] dark:bg-white/5">
          <span className="text-ink dark:text-white">{name}</span>
          <span className={`font-medium ${status === 'Present' ? 'text-brand' : 'text-amber-700'}`}>
            {status}
          </span>
        </div>
      ))}
    </div>
  )
}

export type { PhosphorIcon }
