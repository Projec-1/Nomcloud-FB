import { supabase } from '@/lib/supabase'
import type { MembershipRole } from '@/types/auth'

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

export interface InvitationRow {
  id: string
  school_id: string
  email: string
  role: MembershipRole
  teacher_id: string | null
  guardian_id: string | null
  expires_at: string
  accepted_at: string | null
  accepted_by: string | null
  invited_by: string
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateInvitationInput {
  schoolId: string
  email: string
  role: MembershipRole
  invitedBy: string
  teacherId?: string
  guardianId?: string
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function hashToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const invitationColumns =
  'id,school_id,email,role,teacher_id,guardian_id,expires_at,accepted_at,accepted_by,invited_by,revoked_at,created_at,updated_at'

export async function createInvitation(input: CreateInvitationInput): Promise<InvitationRow> {
  const email = input.email.trim().toLowerCase()
  const token = generateToken()
  const tokenHash = await hashToken(token)
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS).toISOString()

  const { data, error } = await supabase
    .from('invitations')
    .insert({
      school_id: input.schoolId,
      email,
      role: input.role,
      teacher_id: input.teacherId || null,
      guardian_id: input.guardianId || null,
      token_hash: tokenHash,
      expires_at: expiresAt,
      invited_by: input.invitedBy,
      accepted_at: null,
      accepted_by: null,
      revoked_at: null,
    })
    .select(invitationColumns)
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('A live invitation already exists for this email and role. Revoke it before sending a replacement.')
    }
    throw error
  }

  const invitationUrl = `${window.location.origin}/invite/accept?token=${encodeURIComponent(token)}`
  // TODO: hand invitationUrl to the approved email-delivery service. Do not log, persist, or return it.
  void invitationUrl

  return data as InvitationRow
}

export async function listLiveInvitations(schoolId: string): Promise<InvitationRow[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select(invitationColumns)
    .eq('school_id', schoolId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as InvitationRow[]
}

export async function revokeInvitation(invitationId: string, schoolId: string): Promise<void> {
  const { error } = await supabase
    .from('invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invitationId)
    .eq('school_id', schoolId)
    .is('accepted_at', null)
    .is('revoked_at', null)

  if (error) throw error
}
