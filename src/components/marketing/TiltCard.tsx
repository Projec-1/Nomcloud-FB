import type { ReactNode } from 'react'

export default function TiltCard({ children, className = '', max = 8 }: { children: ReactNode; className?: string; max?: number }) {
  void max
  return <div className={className}>{children}</div>
}
