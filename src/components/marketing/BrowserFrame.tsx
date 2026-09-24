import type { ReactNode } from 'react'
import { Lock, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react'
import { cn } from '@/utils/cn'

export default function BrowserFrame({
  children,
  url = 'app.nomcloud.academy',
  className,
}: {
  children: ReactNode
  url?: string
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-[22px] border border-ink/10 bg-white shadow-floaty dark:border-white/10 dark:bg-[#141416]', className)}>
      <div className="flex items-center gap-3 border-b border-ink/5 bg-[#F5F5F7] px-4 py-3 dark:border-white/10 dark:bg-[#1c1c1e]">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="hidden items-center gap-1 text-graphite/50 sm:flex">
          <ChevronLeft className="h-3.5 w-3.5" />
          <ChevronRight className="h-3.5 w-3.5" />
          <RotateCw className="h-3 w-3" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] text-graphite shadow-sm dark:bg-white/10">
            <Lock className="h-2.5 w-2.5" />
            {url}
          </div>
        </div>
      </div>
      <div className="bg-mist dark:bg-[#0B0B0D]">{children}</div>
    </div>
  )
}
