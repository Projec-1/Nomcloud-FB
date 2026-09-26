import { useEffect, useState } from 'react'
import { initials } from '@/utils/format'
import { cn } from '@/utils/cn'

interface AvatarProps {
  name: string
  color?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  /** Image URL. The initials badge is shown while it is absent or if it fails to load. */
  src?: string | null
}

const sizeClass: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
}

export default function Avatar({ name, color = '#0071E3', size = 'md', className, src }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        title={name}
        onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-full object-cover', sizeClass[size], className)}
      />
    )
  }

  return (
    <div
      className={cn('avatar flex shrink-0 items-center justify-center rounded-full font-semibold text-white', sizeClass[size], className)}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initials(name)}
    </div>
  )
}
