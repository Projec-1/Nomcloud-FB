import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { schoolInitial } from '@/services/schoolService'
import { schoolLogoUrl } from '@/services/storageService'
import { cn } from '@/utils/cn'

// Once a user is signed in, the app should feel like *their* school's private
// system — not a Nom Cloud-branded product. Everywhere inside /app, we show the
// school's own logo (uploaded in Admin → Settings) and name instead of the Nom
// Cloud mark, falling back to a clean initial badge in the school's brand color
// when no logo image has been uploaded yet.
export default function SchoolBrandLogo({ to, className, textClassName }: { to: string; className?: string; textClassName?: string }) {
  // The real schools row, already fetched by AuthContext on sign-in.
  //
  // logo_path names an object in the public school-branding bucket (migration
  // 20260915000004), so the image needs no signed URL. The initial is derived
  // from the name rather than stored, because SCHEMA_DESIGN section F lists
  // logoInitial as derivable data that must not be persisted.
  const { school } = useAuth()
  const name = school?.name ?? ''
  const logoUrl = schoolLogoUrl(school?.logo_path ?? null)
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [logoUrl])

  return (
    <Link to={to} className={cn('group inline-flex min-w-0 items-center gap-2.5', className)}>
      {logoUrl && !failed ? (
        <img
          src={logoUrl}
          alt=""
          onError={() => setFailed(true)}
          className="h-8 w-8 flex-shrink-0 rounded-lg object-contain transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <span
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white transition-transform duration-300 group-hover:scale-105"
          style={{ backgroundColor: school?.primary_color ?? '#FF5A1F' }}
        >
          {schoolInitial(name)}
        </span>
      )}
      <span className={cn('truncate text-[1.05rem] font-semibold tracking-tight text-ink dark:text-white', textClassName)}>{name}</span>
    </Link>
  )
}
