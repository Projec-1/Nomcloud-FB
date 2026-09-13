import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { schoolInitial } from '@/services/schoolService'
import { cn } from '@/utils/cn'

// Once a user is signed in, the app should feel like *their* school's private
// system — not a Nom Cloud-branded product. Everywhere inside /app, we show the
// school's own logo (uploaded in Admin → Settings) and name instead of the Nom
// Cloud mark, falling back to a clean initial badge in the school's brand color
// when no logo image has been uploaded yet.
export default function SchoolBrandLogo({ to, className, textClassName }: { to: string; className?: string; textClassName?: string }) {
  // Phase 8 batch 1: the real schools row, already fetched by AuthContext on
  // sign-in, replaces the mock settings object.
  //
  // logo_path names a Storage object and there is no bucket yet (plan section
  // H.6, open decision 10), so no image is rendered and the initial badge is
  // always used. The initial is derived from the name rather than stored,
  // because SCHEMA_DESIGN section F lists logoInitial as derivable data that
  // must not be persisted.
  const { school } = useAuth()
  const name = school?.name ?? ''

  return (
    <Link to={to} className={cn('group inline-flex min-w-0 items-center gap-2.5', className)}>
      <span
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white transition-transform duration-300 group-hover:scale-105"
        style={{ backgroundColor: school?.primary_color ?? '#FF5A1F' }}
      >
        {schoolInitial(name)}
      </span>
      <span className={cn('truncate text-[1.05rem] font-semibold tracking-tight text-ink dark:text-white', textClassName)}>{name}</span>
    </Link>
  )
}
