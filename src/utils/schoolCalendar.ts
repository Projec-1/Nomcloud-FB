// ---------------------------------------------------------------------------
// School calendar helpers.
//
// Moved verbatim out of `src/data/mockData.ts` so that consuming components no
// longer have to import from the seed data module. The behaviour is unchanged.
//
// FOLLOW-UP (deferred, do not fix as part of this move):
//   1. Weekend assumption — `lastSchoolDays` skips Sunday (0) and Saturday (6),
//      i.e. a Monday–Friday week. Nom Cloud launches in Somalia, where the
//      weekend is commonly Friday–Saturday, so this is wrong for the first
//      market. The weekend needs to become a per-school setting.
//   2. Timezone — dates are derived from the runtime's local clock via
//      `new Date()` and `toISOString()`, which is UTC-based. It ignores
//      `SchoolSettings.timezone` even though that field already exists, so a
//      school's "today" can be off by a day near midnight.
// ---------------------------------------------------------------------------

function lastSchoolDays(count: number): string[] {
  const days: string[] = []
  const d = new Date()
  while (days.length < count) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) {
      days.unshift(d.toISOString().slice(0, 10))
    }
    d.setDate(d.getDate() - 1)
  }
  return days
}

export const schoolDays = lastSchoolDays(12)
