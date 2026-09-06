import { supabase } from '@/lib/supabase'

export interface SchoolApplication {
  id: string
  school_name: string
  administrator_name: string
  email: string
  phone: string
  school_size_band: string
  message: string | null
  country: string | null
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  approved_school_id: string | null
  created_at: string
  updated_at: string
}

export interface PlatformSchool {
  id: string
  shortcode: string
  name: string
  status: 'active' | 'suspended' | 'closed'
  email: string | null
  country: string
  created_at: string
}

const applicationColumns = 'id,school_name,administrator_name,email,phone,school_size_band,message,country,status,reviewed_by,reviewed_at,rejection_reason,approved_school_id,created_at,updated_at'

export async function listApplications(): Promise<SchoolApplication[]> {
  const { data, error } = await supabase.from('school_applications').select(applicationColumns).order('status').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SchoolApplication[]
}

export async function getApplication(id: string): Promise<SchoolApplication | null> {
  const { data, error } = await supabase.from('school_applications').select(applicationColumns).eq('id', id).maybeSingle()
  if (error) throw error
  return data as SchoolApplication | null
}

export async function listSchools(): Promise<PlatformSchool[]> {
  const { data, error } = await supabase.from('schools').select('id,shortcode,name,status,email,country,created_at').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PlatformSchool[]
}
