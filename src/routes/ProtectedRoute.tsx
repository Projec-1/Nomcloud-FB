import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { PageLoader } from '@/components/ui/Loader'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { authState, logout } = useAuth()
  const location = useLocation()

  if (authState === 'initialising' || authState === 'loading_profile') {
    return <PageLoader label="Loading your workspace…" />
  }

  if (authState === 'signed_out') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (authState === 'error') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div>
          <h1 className="text-lg font-semibold text-ink dark:text-white">We could not load your workspace</h1>
          <p className="mt-1 max-w-md text-sm text-graphite">
            Please try again. If the problem continues, sign out and contact your administrator.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand/90"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ink/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (authState === 'ready') return <>{children}</>

  return <PageLoader label="Loading your workspace…" />
}
