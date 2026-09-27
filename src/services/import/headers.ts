import type { ColumnMapping, ColumnSpec } from '@/services/import/types'

// ---------------------------------------------------------------------------
// Recognising a school's OWN column headers.
//
// WHY THIS EXISTS. A school with 500 pupils already has a spreadsheet. Making
// them retype it into our template would take days, so they would not do it and
// would not adopt the product. The importer therefore reads their file as it is,
// works out which of their columns is which, and only asks a question when it
// genuinely cannot tell.
//
// CANONICAL FORM. Headers are compared with everything that is not a letter or a
// digit removed, and lower-cased. So "Full Name", "full_name", "FULL NAME" and
// "Full-Name" are one and the same, and "D.O.B" becomes "dob".
//
// FIRST MATCH WINS, BOTH WAYS. A header feeds at most one of our fields, and a
// field takes the first of their headers that matches it. Columns are matched in
// the order they are declared, which is the order a person reads them in, so
// "Full name" claims "Name" before "Guardian 1 name" can.
// ---------------------------------------------------------------------------

/** "Adm No." -> "admno". Letters and digits only, lower-cased. */
export function canonicalHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Every name a column answers to: its own header first, then its aliases. */
function acceptedNames(column: ColumnSpec): string[] {
  const names = [column.header, ...(column.aliases ?? [])]
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of names) {
    const key = canonicalHeader(name)
    if (key && !seen.has(key)) {
      seen.add(key)
      out.push(key)
    }
  }
  return out
}

export interface HeaderMatch {
  /** Our column key -> their header text, or null when nothing matched. */
  mapping: ColumnMapping
  /** Their headers that fed no column of ours, in file order. */
  unmatched: string[]
  /** Keys of required columns still unmapped. */
  missingRequired: string[]
}

/**
 * Works out the mapping from the headers actually present in their file.
 *
 * Their headers are kept verbatim as the mapping's values, because that is what
 * the administrator sees in the dropdown — canonical forms like "guardian1phone"
 * would be unreadable.
 */
export function matchHeaders(headers: string[], columns: ColumnSpec[]): HeaderMatch {
  // Their headers by canonical form. A repeated header keeps its first column,
  // which is the one a person would have filled in.
  const byCanonical = new Map<string, string>()
  for (const header of headers) {
    const key = canonicalHeader(header)
    if (key && !byCanonical.has(key)) byCanonical.set(key, header)
  }

  const mapping: ColumnMapping = {}
  const claimed = new Set<string>()

  for (const column of columns) {
    let found: string | null = null
    for (const name of acceptedNames(column)) {
      const header = byCanonical.get(name)
      if (header !== undefined && !claimed.has(header)) {
        found = header
        break
      }
    }
    if (found !== null) claimed.add(found)
    mapping[column.key] = found
  }

  return {
    mapping,
    unmatched: headers.filter((header) => canonicalHeader(header) && !claimed.has(header)),
    missingRequired: columns.filter((column) => column.required && !mapping[column.key]).map((column) => column.key),
  }
}

/** Which required columns a hand-corrected mapping still leaves unfilled. */
export function unmappedRequired(mapping: ColumnMapping, columns: ColumnSpec[]): ColumnSpec[] {
  return columns.filter((column) => column.required && !mapping[column.key])
}

/**
 * The refusal, naming the field so the administrator knows what to point at
 * rather than being told the file is wrong.
 */
export function unmappedRequiredMessage(missing: ColumnSpec[]): string {
  return missing
    .map((column) => `Required field '${column.header}' is not mapped. Choose the column that holds it.`)
    .join(' ')
}
