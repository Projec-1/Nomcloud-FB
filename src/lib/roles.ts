import type { Role } from '@/types'
import type { MembershipRole } from '@/types/auth'

// The database role vocabulary was renamed by migration 20260908000002
// (admin -> administrator, parent -> guardian) and widened to six values.
// The Phase 4 frontend workspaces were deliberately NOT expanded
// (CAMPUS_ROLE_DESIGN.md section G), so membership roles are translated to a
// workspace here, at the identity boundary, and nowhere else.
//
// Owner, Director and Principal have no frontend workspace yet. They map to
// null on purpose: `admin` must never silently stand in for all four
// organisational roles (CAMPUS_ROLE_DESIGN.md section C).
const WORKSPACE_BY_MEMBERSHIP_ROLE: Record<MembershipRole, Role | null> = {
  owner: null,
  director: null,
  administrator: 'admin',
  principal: null,
  teacher: 'teacher',
  guardian: 'parent',
}

// Workspace order is stable so a multi-role user lands on the same default view.
const WORKSPACE_ORDER: Role[] = ['admin', 'teacher', 'parent']

export function workspaceForMembershipRole(role: MembershipRole): Role | null {
  return WORKSPACE_BY_MEMBERSHIP_ROLE[role] ?? null
}

export function workspacesForMembershipRoles(roles: MembershipRole[]): Role[] {
  const mapped = new Set(
    roles
      .map(workspaceForMembershipRole)
      .filter((workspace): workspace is Role => workspace !== null),
  )
  return WORKSPACE_ORDER.filter((workspace) => mapped.has(workspace))
}
