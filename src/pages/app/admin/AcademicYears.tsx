import { CalendarRange, Info } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import ResourceGate from '@/components/ui/ResourceGate'
import { useAcademicStructure, type AcademicStructure } from '@/hooks/useAcademicStructure'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'

// Phase 8 batch 2. Reads real academic_years and terms for the signed-in user's
// own school, replacing the mock academicYears array and its nested terms[].
//
// READ ONLY in this batch, deliberately. The "Add Academic Year" and "Set as
// Active Year" controls have been removed rather than left writing to a mock
// store whose contents are no longer displayed, which would have looked like it
// worked and silently discarded everything on reload.
//
// Activation in particular is not a one-line write and is reported rather than
// improvised: academic_years carries
//
//   CREATE UNIQUE INDEX academic_years_school_id_active_idx
//     ON public.academic_years (school_id) WHERE status = 'active'
//
// so a school cannot hold two active years even momentarily. Switching the
// active year means closing the current one and activating the next, and those
// are two statements with no client-side transaction between them. If the first
// succeeds and the second fails the school is left with no active year at all,
// and the active year is what every later batch derives the current term from.
// That wants a SECURITY DEFINER function or an explicit decision, not an ad hoc
// pair of updates.

const statusTone = { active: 'success', upcoming: 'info', closed: 'neutral' } as const

export default function AdminAcademicYears() {
  const { state } = useAcademicStructure()

  return (
    <div>
      <PageHeader
        title="Academic Years"
        description="Plan terms ahead of time and switch the active year without losing history."
      />

      <ResourceGate
        state={state}
        empty={{
          icon: CalendarRange,
          title: 'No academic years yet',
          description: 'Academic years and their terms will appear here once your school has created them.',
        }}
        deniedHint="Academic years are managed by your school's administrator."
      >
        {(structure) => <YearGrid structure={structure} />}
      </ResourceGate>
    </div>
  )
}

function YearGrid({ structure }: { structure: AcademicStructure }) {
  const { years, terms, activeYear, term } = structure

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-ink/5 bg-white/60 px-4 py-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
        <Info className="h-3.5 w-3.5 shrink-0 text-graphite" />
        <span className="text-graphite">
          Active year:{' '}
          <span className="font-semibold text-ink dark:text-white">{activeYear ? activeYear.label : 'none set'}</span>
        </span>
        <span className="text-graphite">·</span>
        <span className="text-graphite">
          Current term:{' '}
          <span className="font-semibold text-ink dark:text-white">
            {term ? term.name : 'between terms'}
          </span>
        </span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {years.map((year) => {
          const yearTerms = terms.filter((t) => t.academic_year_id === year.id)
          return (
            <div
              key={year.id}
              className={cn('card p-6', year.status === 'active' && 'border-brand/30 ring-1 ring-brand/20')}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="rounded-xl bg-ink/5 p-2.5 text-ink dark:bg-white/10 dark:text-white">
                  <CalendarRange className="h-4 w-4" />
                </div>
                <Badge tone={statusTone[year.status]}>{year.status}</Badge>
              </div>
              <p className="text-lg font-semibold text-ink dark:text-white">{year.label}</p>
              <p className="text-xs text-graphite">
                {formatDate(year.start_date)} — {formatDate(year.end_date)}
              </p>
              <div className="mt-4 space-y-2 border-t border-ink/5 pt-4 dark:border-white/10">
                {yearTerms.length === 0 ? (
                  <p className="text-xs text-graphite">No terms defined for this year yet.</p>
                ) : (
                  yearTerms.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs">
                      <span className={cn('text-ink dark:text-white', term?.id === t.id && 'font-semibold text-brand')}>
                        {t.name}
                      </span>
                      <span className="text-graphite">
                        {formatDate(t.start_date)} – {formatDate(t.end_date)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
