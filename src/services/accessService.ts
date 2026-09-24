// ---------------------------------------------------------------------------
// App access — the deliberate way to take a login away, and give it back.
// SYSTEM_ISSUES_LIST S3 and S4.
//
// TWO FACTS, NOT ONE. A person in this school has up to two records:
//
//   teachers.status / guardians.status   EMPLOYMENT or family record. Whether
//                                        they work here, or are an active
//                                        contact. Most people have only this.
//   memberships.status                   LOGIN ACCESS. Exists only once an
//                                        invitation has been accepted; it is
//                                        what every policy resolves through
//                                        (current_teacher_id, teaches_class,
//                                        is_guardian_of_student all require an
//                                        ACTIVE membership).
//
// They are not the same thing and this module does not conflate them:
//   - Marking a teacher "inactive" used to do nothing to their access, which is
//     S4. It still does nothing on its own — but the interface now shows both
//     states and offers this action alongside, so the two are never confused.
//   - Deleting the employment record used to silently delete the membership,
//     which is S3. Migration 20260916000001 made that link RESTRICT, so the
//     delete now fails while a login exists and this is the way to remove it.
//
// GRANTING access is NOT here, deliberately. An invitation, accepted through
// accept_invitation, is the only path that creates a membership, and it stays
// that way: this module can only suspend an existing membership or re-activate
// one it suspended. Re-activating is not a grant — the membership, with its
// role and its teacher/guardian link, is already there.
//
// WHAT ENFORCES IT. memberships_admin_update: owner, director and administrator,
// on any row except an owner's (migration 20260915000007). No new privilege is
// created here, and RLS filters rather than raises, so a refused update returns
// zero rows and is reported as a refusal rather than a success.
// ---------------------------------------------------------------------------

import { supabase } from '@/lib/supabase'

export type MembershipAccessStatus = 'active' | 'suspended'

/** One person's login, as the staff screens show it. */
export interface PersonAccess {
  membershipId: string
  userId: string
  role: string
  status: MembershipAccessStatus
}

interface MembershipRow {
  id: string
  user_id: string
  role: string
  status: string
  teacher_id: string | null
  guardian_id: string | null
}

async function fetchMemberships(schoolId: string): Promise<MembershipRow[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, user_id, role, status, teacher_id, guardian_id')
    .eq('school_id', schoolId)

  if (error) throw error
  return (data ?? []) as MembershipRow[]
}

const toAccess = (m: MembershipRow): PersonAccess => ({
  membershipId: m.id,
  userId: m.user_id,
  role: m.role,
  status: m.status === 'suspended' ? 'suspended' : 'active',
})

/**
 * Logins by teacher id. A teacher absent from the map has no login at all,
 * which is the common case and is shown as such rather than as "suspended".
 */
export async function fetchTeacherAccess(schoolId: string): Promise<Map<string, PersonAccess>> {
  const rows = await fetchMemberships(schoolId)
  const map = new Map<string, PersonAccess>()
  for (const m of rows) {
    if (m.teacher_id) map.set(m.teacher_id, toAccess(m))
  }
  return map
}

/** Logins by guardian id. Same shape as fetchTeacherAccess. */
export async function fetchGuardianAccess(schoolId: string): Promise<Map<string, PersonAccess>> {
  const rows = await fetchMemberships(schoolId)
  const map = new Map<string, PersonAccess>()
  for (const m of rows) {
    if (m.guardian_id) map.set(m.guardian_id, toAccess(m))
  }
  return map
}

async function setMembershipStatus(
  schoolId: string,
  membershipId: string,
  status: MembershipAccessStatus,
): Promise<void> {
  const { data, error } = await supabase
    .from('memberships')
    .update({ status })
    .eq('school_id', schoolId)
    .eq('id', membershipId)
    .select('id')

  if (error) throw error
  // RLS filters rather than raises: zero rows is a refusal, not a success.
  if ((data ?? []).length !== 1) {
    throw new Error("You don't have permission to change this person's access.")
  }
}

/**
 * Blocks someone's login, keeping their employment or family record and all of
 * its history. Everything they could see resolves through an ACTIVE membership,
 * so this alone ends their access.
 */
export async function revokeAccess(schoolId: string, membershipId: string): Promise<void> {
  await setMembershipStatus(schoolId, membershipId, 'suspended')
}

/** Re-activates a membership this action suspended. Creates nothing. */
export async function restoreAccess(schoolId: string, membershipId: string): Promise<void> {
  await setMembershipStatus(schoolId, membershipId, 'active')
}
