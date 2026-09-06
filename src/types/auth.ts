import type { User as SupabaseUser } from '@supabase/supabase-js'

export type AuthSessionUser = SupabaseUser

export type MembershipRole = 'admin' | 'teacher' | 'parent'
export type MembershipStatus = 'active' | 'suspended'
export type SchoolStatus = 'active' | 'suspended' | 'closed'

export interface ProfileRow {
  id: string
  school_id: string | null
  full_name: string
  email: string
  phone: string | null
  locale: string
  avatar_url: string | null
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface MembershipRow {
  id: string
  user_id: string
  school_id: string
  role: MembershipRole
  status: MembershipStatus
  teacher_id: string | null
  guardian_id: string | null
  invited_by: string | null
  joined_at: string
  created_at: string
  updated_at: string
}

export interface SchoolRow {
  id: string
  shortcode: string
  name: string
  status: SchoolStatus
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  logo_path: string | null
  primary_color: string
  timezone: string
  country: string
  currency: string
  locale: string
  weekend_days: number[]
  grading_scale: 'letter' | 'percentage' | 'gpa'
  attendance_cutoff_time: string
  email_notifications: boolean
  sms_notifications: boolean
  parent_portal_enabled: boolean
  suspended_at: string | null
  suspension_reason: string | null
  created_at: string
  updated_at: string
}

export interface ResolvedIdentityContext {
  authUser: AuthSessionUser
  profile: ProfileRow
  school: SchoolRow | null
  memberships: MembershipRow[]
}

export type AuthState =
  | 'initialising'
  | 'loading_profile'
  | 'ready'
  | 'signed_out'
  | 'error'
