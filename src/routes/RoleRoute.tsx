import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { Role } from '@/types'

export default function RoleRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { authState, memberships, activeRole } = useAuth()

  if (authState !== 'ready') return null

  const activeRoles = memberships.map((membership) => membership.role)
  if (activeRoles.includes(role)) {
    // This is navigation convenience only; Phase 7 RLS must independently verify every role.
    return <>{children}</>
  }

  if (activeRoles.length > 0) {
    return <Navigate to={`/app/${activeRole && activeRoles.includes(activeRole) ? activeRole : activeRoles[0]}`} replace />
  }

  return <Navigate to="/login" replace state={{ reason: 'no-active-membership' }} />
}
