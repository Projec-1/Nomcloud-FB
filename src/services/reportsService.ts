// ---------------------------------------------------------------------------
// School-wide report reads. Phase 8 batch 8.
//
// The management reports screen aggregates across the whole school, which no
// earlier service needed: every teaching-records read so far was scoped to one
// class, one date or one child. These two reads are scoped to the caller's own
// school explicitly and select only the columns an aggregate needs.
//
// They are reached by management only. attendance_records and grade_records
// admit management through can_manage_class, so for a principal with
// scope_mode='selected' the rows arrive already narrowed to their campuses —
// decision 2 keeps the client campus-unaware, and RLS does the narrowing, the
// same relationship classService documents.
//
// Aggregation happens in the browser. For a school of a few thousand pupils
// that is a few thousand small rows per term, which is acceptable for a report
// screen. If schools grow past that, the right fix is a SQL view or RPC that
// aggregates server-side, recorded as a scaling note rather than built now.
// ---------------------------------------------------------------------------

import { supabase } from '@/lib/supabase'
import type { AttendanceStatus } from '@/types'

export interface AttendanceFact {
  classId: string
  status: AttendanceStatus
}

export interface GradeFact {
  classId: string
  score: number
  maxScore: number
}

export async function fetchSchoolAttendanceFacts(schoolId: string): Promise<AttendanceFact[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('class_id, status')
    .eq('school_id', schoolId)

  if (error) throw error
  return ((data ?? []) as { class_id: string; status: AttendanceStatus }[]).map((r) => ({
    classId: r.class_id,
    status: r.status,
  }))
}

export async function fetchSchoolGradeFacts(schoolId: string): Promise<GradeFact[]> {
  const { data, error } = await supabase
    .from('grade_records')
    .select('class_id, score, max_score')
    .eq('school_id', schoolId)

  if (error) throw error
  return ((data ?? []) as { class_id: string; score: number; max_score: number }[]).map((r) => ({
    classId: r.class_id,
    score: Number(r.score),
    maxScore: Number(r.max_score),
  }))
}
