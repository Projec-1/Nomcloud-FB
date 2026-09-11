import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { Role } from '@/types'

export default function RoleRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { authState, workspaces, activeRole, platformAdmin } = useAuth()

  if (authState !== 'ready') return null

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

  return <Navigate to="/login" replace state={{ reason: 'no-active-membership' }} />
}
