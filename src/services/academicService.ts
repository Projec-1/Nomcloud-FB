// ---------------------------------------------------------------------------
// Academic structure: academic years, terms, subjects. Phase 8 batch 2.
//
// TENANT SCOPING. Every query filters `.eq('school_id', schoolId)` explicitly
// rather than selecting the whole table and letting RLS narrow it. RLS is the
// boundary that makes a mistake safe; it is not the mechanism the application
// should depend on to be correct.
//
// HOW "CURRENT" IS DERIVED. The two are derived differently, because the schema
// expresses them differently, and the difference matters.
//
//   CURRENT ACADEMIC YEAR is a stored fact. academic_years.status carries
//   'upcoming' | 'active' | 'closed', and the database enforces at most one
//   active year per school with a partial unique index:
//
//     CREATE UNIQUE INDEX academic_years_school_id_active_idx
//       ON public.academic_years (school_id) WHERE status = 'active'
//
//   So the active year is read, never computed. Note that
//   schools.active_academic_year_id does NOT exist: Amendment 14 removed it
//   precisely so there is one source of truth. The mock's
//   SchoolSettings.academicYearId is a leftover of that removed column and is
//   not reintroduced here.
//
//   CURRENT TERM is NOT stored. public.terms has no status column, only name,
//   start_date, end_date and sort_order. The current term is therefore the term
//   of the active year whose date range contains today, evaluated in the
//   school's own timezone using the batch 0 calendar helpers.
//
//   Between terms — holidays — no term contains today and currentTerm is null.
//   That is reported honestly rather than papered over by snapping to the
//   nearest term, because the sensible fallback differs by screen and inventing
//   one rule here would hide the gap. Which term a new grade or fee defaults to
//   during a holiday is a real question for batches 5 and 6.
//
//   The mock's CURRENT_TERM = 'Term 1' is a hardcoded string with no
//   relationship to any date. It is not reconciled to; it is replaced.
// ---------------------------------------------------------------------------

import { supabase } from '@/lib/supabase'
import { todayInTimeZone } from '@/utils/schoolCalendar'

export interface AcademicYearRow {
  id: string
  school_id: string
  label: string
  start_date: string
  end_date: string
  status: 'upcoming' | 'active' | 'closed'
  created_at: string
  updated_at: string
}

export interface TermRow {
  id: string
  school_id: string
  academic_year_id: string
  name: string
  start_date: string
  end_date: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SubjectRow {
  id: string
  school_id: string
  name: string
  code: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function fetchAcademicYears(schoolId: string): Promise<AcademicYearRow[]> {
  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .eq('school_id', schoolId)
    .order('start_date', { ascending: false })

  if (error) throw error
  return (data ?? []) as AcademicYearRow[]
}

export async function fetchTerms(schoolId: string): Promise<TermRow[]> {
  const { data, error } = await supabase
    .from('terms')
    .select('*')
    .eq('school_id', schoolId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []) as TermRow[]
}

/**
 * Active subjects for a school.
 *
 * Built in batch 2 because the plan scopes subjects here and because the three
 * academic-structure tables are one cohesive service. NOTHING CONSUMES IT YET:
 * subjects appear in the interface only as free text on teachers, classes,
 * grades, homework and exams, and those records are connected in batches 3 to 5.
 * This exists so those batches reference one definition rather than each
 * deriving their own.
 */
export async function fetchSubjects(schoolId: string): Promise<SubjectRow[]> {
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as SubjectRow[]
}

/** The active academic year, or null when the school has not set one. */
export function activeAcademicYear(years: AcademicYearRow[]): AcademicYearRow | null {
  return years.find((year) => year.status === 'active') ?? null
}

/**
 * The term of the active year containing today in the school's timezone, or
 * null between terms. See the header for why null is returned rather than a
 * nearest-term guess.
 */
export function currentTerm(
  years: AcademicYearRow[],
  terms: TermRow[],
  timeZone: string,
): TermRow | null {
  const year = activeAcademicYear(years)
  if (!year) return null

  const today = todayInTimeZone(timeZone)
  return (
    terms.find(
      (term) => term.academic_year_id === year.id && term.start_date <= today && term.end_date >= today,
    ) ?? null
  )
}
