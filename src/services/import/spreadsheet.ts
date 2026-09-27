import { canonicalHeader } from '@/services/import/headers'
import type { ColumnMapping, ColumnSpec, RowOutcome } from '@/services/import/types'
import { MAX_FILE_BYTES } from '@/services/import/types'

// ---------------------------------------------------------------------------
// Reading and writing spreadsheets, entirely in the administrator's browser.
//
// NOTHING IS UPLOADED. The file is read with FileReader, parsed here, and only
// the resulting records ever reach the database — through the same RLS-governed
// calls the forms use. A school's pupil list never travels anywhere it does not
// need to go, and no copy of the file is kept by the product.
//
// BOTH LIBRARIES ARE LOADED ON DEMAND. exceljs and papaparse together are far
// larger than the rest of this screen, and most people never open it, so they
// are behind dynamic import() and cost nothing until an import actually starts.
// ---------------------------------------------------------------------------

/** The file as a grid of text, before anything knows what the columns mean. */
export interface SheetMatrix {
  /** Every line of the sheet, row 0 being the header line. */
  matrix: string[][]
  /** Non-empty headers found on line 1, in file order. */
  headers: string[]
}

/** Rows of raw text keyed by OUR column key, ready for a kind to check. */
export interface SheetRows {
  rows: Record<string, string>[]
  /** Headers found in the file, in file order. */
  headers: string[]
}

const clean = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    // Dates are normalised to yyyy-mm-dd in the sheet's own local terms; Excel
    // hands back a UTC-midnight Date for a date-formatted cell, and toISOString
    // on that can slip to the previous day west of Greenwich.
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof value === 'object') {
    const cell = value as { text?: unknown; result?: unknown; richText?: { text: string }[]; hyperlink?: string }
    if (Array.isArray(cell.richText)) return cell.richText.map((part) => part.text).join('').trim()
    if (cell.text !== undefined) return clean(cell.text)
    if (cell.result !== undefined) return clean(cell.result)
    return ''
  }
  return String(value).trim()
}

/**
 * Turns the grid into records, using the mapping to decide which of THEIR
 * columns feeds each of OURS.
 *
 * The mapping is the only thing that knows about their headers; a column our
 * mapping leaves null simply reads as empty, which is what "not in my file"
 * means for an optional field.
 */
export function toRecords(source: SheetMatrix, columns: ColumnSpec[], mapping: ColumnMapping): SheetRows {
  const { matrix, headers } = source
  const headerRow = matrix[0] ?? []

  // Their header text -> its column index in the sheet.
  const indexOfHeader = new Map<string, number>()
  headerRow.forEach((header, i) => {
    const key = canonicalHeader(header)
    if (key && !indexOfHeader.has(key)) indexOfHeader.set(key, i)
  })

  // Our column key -> its column index, resolved once rather than per row.
  const columnIndex = new Map<string, number>()
  for (const column of columns) {
    const header = mapping[column.key]
    if (!header) continue
    const at = indexOfHeader.get(canonicalHeader(header))
    if (at !== undefined) columnIndex.set(column.key, at)
  }

  const rows: Record<string, string>[] = []
  for (let r = 1; r < matrix.length; r += 1) {
    const cells = matrix[r] ?? []
    const record: Record<string, string> = {}
    let any = false
    for (const column of columns) {
      const at = columnIndex.get(column.key)
      const value = at === undefined ? '' : clean(cells[at])
      record[column.key] = value
      if (value) any = true
    }
    // A completely empty line is spacing, not a record. Excel files are full of
    // them, and reporting 900 empty-row errors would bury the real ones.
    if (any) {
      record.__row = String(r + 1)
      rows.push(record)
    }
  }
  return { rows, headers }
}

export class ImportFileError extends Error {}

/** The headers on line 1, trimmed, with blank cells dropped. */
const headersOf = (matrix: string[][]) => (matrix[0] ?? []).map((header) => header.trim()).filter(Boolean)

/**
 * Reads .xlsx or .csv into a grid of text. Throws ImportFileError for anything
 * else.
 *
 * Deliberately knows nothing about our columns. The file is read ONCE and the
 * grid is kept, so correcting the column mapping re-maps what is already in
 * memory instead of asking the administrator to choose the file again.
 */
export async function readSheet(file: File): Promise<SheetMatrix> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportFileError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`)
  }
  const name = file.name.toLowerCase()

  if (name.endsWith('.csv')) {
    const Papa = (await import('papaparse')).default
    const text = await file.text()
    const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: false })
    const matrix = (parsed.data ?? []).map((line) => (Array.isArray(line) ? line.map((c) => clean(c)) : []))
    if (matrix.length === 0) throw new ImportFileError('That file appears to be empty.')
    return { matrix, headers: headersOf(matrix) }
  }

  if (name.endsWith('.xlsx')) {
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await file.arrayBuffer())
    const sheet = workbook.worksheets[0]
    if (!sheet) throw new ImportFileError('That workbook has no sheets.')
    const matrix: string[][] = []
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const cells: string[] = []
      // row.values is 1-based with a leading hole; normalise to 0-based.
      const values = row.values as unknown[]
      for (let c = 1; c < values.length; c += 1) cells.push(clean(values[c]))
      matrix.push(cells)
    })
    if (matrix.length === 0) throw new ImportFileError('That sheet appears to be empty.')
    return { matrix, headers: headersOf(matrix) }
  }

  if (name.endsWith('.xls')) {
    throw new ImportFileError('The old .xls format is not supported. Save the file as .xlsx and try again.')
  }
  throw new ImportFileError('Only .xlsx and .csv files can be imported.')
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * Builds the example file and downloads it to the administrator's own computer.
 *
 * THIS IS AN EXAMPLE, NOT A REQUIREMENT. The importer reads a school's own
 * spreadsheet and recognises their own headers; this file just shows which
 * columns Nom Cloud can use and which values a fixed-value column accepts.
 *
 * Fixed-value columns get a real Excel dropdown, so a school cannot type "Male"
 * where the database will only accept "male". The list is applied generously far
 * down the sheet, because the whole point is that they paste hundreds of rows in.
 */
export async function downloadTemplate(options: {
  fileName: string
  sheetName: string
  columns: ColumnSpec[]
  notes: string[]
  maxRows: number
}): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Nom Cloud'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(options.sheetName)
  sheet.columns = options.columns.map((column) => ({
    header: column.required ? `${column.header}*` : column.header,
    key: column.key,
    width: Math.max(16, Math.min(34, column.header.length + 8)),
  }))

  const header = sheet.getRow(1)
  header.font = { bold: true }
  header.alignment = { vertical: 'middle' }
  header.height = 22
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  const example = sheet.addRow(Object.fromEntries(options.columns.map((c) => [c.key, c.example])))
  example.font = { italic: true, color: { argb: 'FF7A7A7A' } }

  // Dropdowns, from the example row to well past any realistic paste.
  //
  // exceljs 4.4.0 implements worksheet.dataValidations but does not declare it
  // on the Worksheet type, so it is reached through a narrow local shape rather
  // than by casting the whole worksheet to any.
  const validations = (sheet as unknown as {
    dataValidations: { add: (range: string, rule: Record<string, unknown>) => void }
  }).dataValidations
  const lastRow = options.maxRows + 1
  options.columns.forEach((column, i) => {
    if (!column.options?.length) return
    const letter = sheet.getColumn(i + 1).letter
    validations.add(`${letter}2:${letter}${lastRow}`, {
      type: 'list',
      allowBlank: !column.required,
      formulae: [`"${column.options.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Not an allowed value',
      error: `Choose one of: ${column.options.join(', ')}`,
    })
  })

  const guide = workbook.addWorksheet('How to use this')
  guide.columns = [{ width: 24 }, { width: 96 }]
  guide.addRow(['Nom Cloud', `${options.sheetName} import — example file`]).font = { bold: true, size: 14 }
  guide.addRow([])
  guide.addRow(['Rule', 'What it means']).font = { bold: true }
  guide.addRow(['You do not need this file', 'Import your own spreadsheet. Nom Cloud recognises common column names such as "Student Name", "Adm No" or "Parent Mobile", and asks you to point at a column only when it cannot tell.'])
  guide.addRow(['The example row', 'Row 2 is an example. Delete it before importing, or leave it — it will be reported as a row like any other.'])
  guide.addRow(['Starred columns', 'A star in the header means Nom Cloud needs that information. Everything else can be missing, and is left empty.'])
  guide.addRow(['Dropdowns', 'Cells with a dropdown only accept the listed values. Do not type your own.'])
  guide.addRow(['Row limit', `Up to ${options.maxRows} rows per file, and 5 MB.`])
  guide.addRow(['Nothing is sent', 'No invitation email is sent by importing. Import first, check the data, then invite from the Teachers or Guardians page.'])
  for (const note of options.notes) guide.addRow(['', note])
  guide.getColumn(2).alignment = { wrapText: true, vertical: 'top' }

  const buffer = await workbook.xlsx.writeBuffer()
  download(new Blob([buffer], { type: XLSX_TYPE }), `${options.fileName}.xlsx`)
}

/**
 * The results file: every row's outcome, so a school can correct the failures
 * and re-upload just those rather than guessing what happened.
 */
export async function downloadResults(fileName: string, outcomes: RowOutcome[]): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Results')
  sheet.columns = [
    { header: 'Row', key: 'row', width: 8 },
    { header: 'Record', key: 'label', width: 34 },
    { header: 'Outcome', key: 'status', width: 14 },
    { header: 'Detail', key: 'detail', width: 90 },
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  for (const outcome of outcomes) sheet.addRow(outcome)
  sheet.getColumn('detail').alignment = { wrapText: true, vertical: 'top' }

  const buffer = await workbook.xlsx.writeBuffer()
  download(new Blob([buffer], { type: XLSX_TYPE }), `${fileName}.xlsx`)
}
