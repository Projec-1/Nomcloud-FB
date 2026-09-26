import type { ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'span'
}

export default function Reveal({ children, className, as = 'div' }: RevealProps) {
  const Tag = as === 'span' ? 'span' : 'div'
  return <Tag className={className}>{children}</Tag>
}
