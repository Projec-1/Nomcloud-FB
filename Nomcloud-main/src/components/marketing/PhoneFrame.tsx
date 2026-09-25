import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export default function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative mx-auto w-[280px] rounded-[42px] border-[6px] border-ink bg-ink p-1.5 shadow-floaty dark:border-white/20', className)}>
      <div className="absolute left-1/2 top-3 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-ink dark:bg-black" />
      <div className="h-[560px] overflow-hidden rounded-[34px] bg-mist dark:bg-[#0B0B0D]">{children}</div>
    </div>
  )
}
