// ---------------------------------------------------------------------------
// The shape every bulk import shares.
//
// Teachers, classes and students differ only in their columns, how a row is
// checked and how a row is written. Everything else — reading the file,
// numbering rows the way Excel numbers them, showing a preview, importing in
// batches, writing a results file — is the same, so it is written once here and
// in spreadsheet.ts rather than three times.
//
// ROW NUMBERS ARE THE ADMINISTRATOR'S ROW NUMBERS. The header is row 1, so the
// first record is row 2. "Row 47" in a message means row 47 in their file.
// ---------------------------------------------------------------------------

/** One column of a template: its header, whether it must be filled, and its fixed values. */
export interface ColumnSpec {
  /** Internal key the parsed row is stored under. */
  key: string
  /** The exact header text written into, and expected back from, the file. */
  header: string
  required: boolean
  /** Shown in the single example row so the expected format is obvious. */
  example: string
  /** Fixed values; becomes a real dropdown in the generated .xlsx. */
  options?: readonly string[]
  /** Extra guidance, shown in the template's notes sheet. */
  hint?: string
}

/** What checking one row concluded. */
export type RowStatus = 'ready' | 'exists' | 'error'

export interface PreparedRow<T> {
  /** 1-based row number as the administrator sees it; header is 1. */
  row: number
  /** The parsed, validated record. Null when the row cannot be imported. */
  value: T | null
  /** Plain-language problems, already prefixed with nothing — the UI adds "Row n:". */
  problems: string[]
  status: RowStatus
  /** A short note shown next to a ready row, e.g. which guardian it will reuse. */
  note?: string
}

export interface ImportPlan<T> {
  rows: PreparedRow<T>[]
  /**
   * File-level observations that belong to no single row, such as two rows
   * holding what is probably the same guardian with no email to prove it.
   */
  notices: string[]
  counts: { total: number; ready: number; exists: number; error: number }
}

/** What writing one row actually did. */
export type OutcomeStatus = 'created' | 'linked' | 'skipped' | 'failed'

export interface RowOutcome {
  row: number
  /** Whatever identifies the row to a human: a name, an admission number. */
  label: string
  status: OutcomeStatus
  detail: string
}

/**
 * One importable thing. `Ctx` is whatever that kind needs to look up while
 * checking and writing — existing records, the active year, and so on. It is
 * deliberately mutable: a student row that creates a guardian records it in the
 * context so the next sibling's row links to that guardian instead of making a
 * second one.
 */
export interface ImportKind<T, Ctx> {
  id: 'teachers' | 'classes' | 'students'
  /** Shown in the dialog title. */
  title: string
  /** Base name of the generated template file. */
  fileName: string
  maxRows: number
  columns: ColumnSpec[]
  /** Extra sheet notes explaining the rules that matter to a school. */
  notes: string[]
  loadContext: (schoolId: string) => Promise<Ctx>
  /** A reason this kind cannot be imported at all right now, or null. */
  precheck: (context: Ctx) => string | null
  prepare: (rows: Record<string, string>[], context: Ctx) => ImportPlan<T>
  importRow: (schoolId: string, prepared: PreparedRow<T>, context: Ctx) => Promise<RowOutcome>
}

/** Upper bound on any uploaded file, whatever its row count. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024

/** Rows written per batch. No email is sent, so this is only about round trips. */
export const IMPORT_BATCH_SIZE = 25
