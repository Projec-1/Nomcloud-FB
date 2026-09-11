import { supabase } from '@/lib/supabase'
import type { MembershipRow, ProfileRow, SchoolRow } from '@/types/auth'

export async function fetchProfileByAuthUserId(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data as ProfileRow | null
}

export async function fetchActiveMemberships(userId: string): Promise<MembershipRow[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('role')

  if (error) throw error
  return (data ?? []) as MembershipRow[]
}

export async function fetchSchoolById(schoolId: string): Promise<SchoolRow | null> {
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', schoolId)
    .maybeSingle()

  if (error) throw error
  return data as SchoolRow | null
}

export async function fetchPlatformAdminStatus(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('platform_admins')
    .select('id')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .maybeSingle()

  if (error) throw error
  return data !== null
}
