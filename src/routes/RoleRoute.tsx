import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import AccessDenied from '@/components/ui/AccessDenied'
import { useAuth } from '@/context/AuthContext'
import { isDemoSessionBlocked } from '@/lib/demoSchool'
import type { Role } from '@/types'

export default function RoleRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { authState, workspaces, activeRole, platformAdmin, logout, school } = useAuth()

  if (authState !== 'ready') return null

  // Decision 12: the demo tenant is reachable only in development.
  //
  // This branch deliberately SURVIVES into production, unlike the Demo Mode
  // indicator, which folds away. It has to: it is the thing that refuses a demo
  // session in a production build, so eliminating it would remove the boundary
  // rather than enforce it. In development isDemoSessionBlocked is always false
  // and this is inert.
  if (isDemoSessionBlocked(school)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cloud px-6 dark:bg-ink">
        <div className="w-full max-w-md">
          <AccessDenied
            hint="This account belongs to the demonstration school, which is not available here."
            action={
              <button type="button" onClick={logout} className="btn-accent px-5 py-2.5 text-sm">
                Sign out
              </button>
            }
          />
        </div>
      </div>
    )
  }

  if (workspaces.includes(role)) {
    // This is navigation convenience only; Phase 7 RLS must independently verify every role.
    return <>{children}</>
  }

  if (workspaces.length > 0) {
    return <Navigate to={`/app/${activeRole && workspaces.includes(activeRole) ? activeRole : workspaces[0]}`} replace />
  }

  // A platform operator holds no school membership by design; send them to their
  // own workspace rather than reporting a missing membership.
  if (platformAdmin) return <Navigate to="/platform" replace />

  // No workspace at all. Under Phase 8 decision 1 this is the ordinary state for
  // a member holding only owner, director or principal: those roles have real
  // database capability and no interface yet, so they must be told plainly
  // rather than bounced.
  //
  // This previously redirected to /login with a state flag, which decision 3
  // rules out: an unexplained redirect reads as a failed sign-in when the
  // session is in fact valid. See docs/PHASE8_CONNECTION_PLAN.md section F.7.
  return (
    <div className="flex min-h-screen items-center justify-center bg-cloud px-6 dark:bg-ink">
      <div className="w-full max-w-md">
        <AccessDenied
          hint="Your account is signed in, but no workspace is available for it yet."
          action={
            <button type="button" onClick={logout} className="btn-accent px-5 py-2.5 text-sm">
              Sign out
            </button>
          }
        />
      </div>
    </div>
  )
}
