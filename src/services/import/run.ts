import { IMPORT_BATCH_SIZE, type ImportKind, type ImportPlan, type PreparedRow, type RowOutcome } from '@/services/import/types'

// ---------------------------------------------------------------------------
// Writing the approved rows.
//
// ONE BAD ROW MUST NEVER STOP THE REST. Every row is written inside its own
// try/catch inside importRow, and a rejected promise here would still only lose
// that row — so a file with one impossible record still imports the other 1,999.
//
// STUDENT ROWS ARE WRITTEN ONE AT A TIME, not in parallel like the others. A
// student row can create a guardian that the NEXT row must reuse, and two
// siblings written concurrently would both look up an empty cache and create
// two guardian records for one parent. The unique index on (school_id, email)
// would catch it, but as a failed row rather than a link — so the ordering is
// enforced here instead of being left to the database to refuse.
// ---------------------------------------------------------------------------

export interface ImportProgress {
  done: number
  total: number
  current: string | null
}

export async function runImport<T, Ctx>(options: {
  schoolId: string
  kind: ImportKind<T, Ctx>
  plan: ImportPlan<T>
  context: Ctx
  onProgress?: (progress: ImportProgress) => void
}): Promise<RowOutcome[]> {
  const { schoolId, kind, plan, context, onProgress } = options

  const outcomes: RowOutcome[] = []
  const importable: PreparedRow<T>[] = []

  // Rows that were never going to be written still appear in the results file,
  // so the school can see every row of their sheet accounted for.
  for (const row of plan.rows) {
    if (row.status === 'error') {
      outcomes.push({ row: row.row, label: `Row ${row.row}`, status: 'skipped', detail: row.problems.join('; ') })
    } else if (row.status === 'exists') {
      outcomes.push({ row: row.row, label: `Row ${row.row}`, status: 'skipped', detail: row.note ?? 'Already in Nom Cloud.' })
    } else {
      importable.push(row)
    }
  }

  const total = importable.length
  const sequential = kind.id === 'students'
  let done = 0

  for (let start = 0; start < total; start += IMPORT_BATCH_SIZE) {
    const batch = importable.slice(start, start + IMPORT_BATCH_SIZE)
    onProgress?.({ done, total, current: `row ${batch[0]?.row ?? ''}` })

    if (sequential) {
      for (const row of batch) {
        outcomes.push(await settle(schoolId, kind, row, context))
        done += 1
        onProgress?.({ done, total, current: `row ${row.row}` })
      }
    } else {
      const settled = await Promise.all(batch.map((row) => settle(schoolId, kind, row, context)))
      outcomes.push(...settled)
      done += batch.length
      onProgress?.({ done, total, current: null })
    }
  }

  onProgress?.({ done: total, total, current: null })
  return outcomes.sort((a, b) => a.row - b.row)
}

/** importRow already catches its own errors; this is the last net under it. */
async function settle<T, Ctx>(
  schoolId: string,
  kind: ImportKind<T, Ctx>,
  row: PreparedRow<T>,
  context: Ctx,
): Promise<RowOutcome> {
  try {
    return await kind.importRow(schoolId, row, context)
  } catch (error: unknown) {
    return {
      row: row.row,
      label: `Row ${row.row}`,
      status: 'failed',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export interface ImportSummary {
  created: RowOutcome[]
  linked: RowOutcome[]
  skipped: RowOutcome[]
  failed: RowOutcome[]
}

export function summariseImport(outcomes: RowOutcome[]): ImportSummary {
  return {
    created: outcomes.filter((o) => o.status === 'created'),
    linked: outcomes.filter((o) => o.status === 'linked'),
    skipped: outcomes.filter((o) => o.status === 'skipped'),
    failed: outcomes.filter((o) => o.status === 'failed'),
  }
}
