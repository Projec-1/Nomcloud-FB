import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export default function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('phone-frame relative mx-auto w-[280px] max-w-full', className)}>
      <span className="phone-frame__island" aria-hidden="true" />
      <div className="phone-frame__screen bg-mist dark:bg-[#0B0B0D]">{children}</div>
    </div>
  )
}
