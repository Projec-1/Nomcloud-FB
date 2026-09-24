import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'

export default function Logo({ className, to = '/', textClassName }: { className?: string; to?: string; textClassName?: string }) {
  return (
    <Link to={to} className={cn('group inline-flex items-center gap-2.5', className)}>
      <img src="/logo-512.png" alt="Nom Cloud" className="h-8 w-8 object-contain transition-transform duration-300 group-hover:scale-105" />
      <span className={cn('text-[1.05rem] font-semibold tracking-tight text-ink dark:text-white', textClassName)}>Nom Cloud</span>
    </Link>
  )
}
