import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Info, Loader2, MinusCircle, Upload, XCircle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { downloadResults, downloadTemplate, readSpreadsheet, ImportFileError } from '@/services/import/spreadsheet'
import { runImport, summariseImport, type ImportProgress } from '@/services/import/run'
import type { ImportKind, ImportPlan, RowOutcome } from '@/services/import/types'
import { errorMessage } from '@/utils/errorMessage'

// ---------------------------------------------------------------------------
// Upload → preview → import → summary, for all three imports.
//
// NOTHING IS WRITTEN UNTIL THE PREVIEW IS CONFIRMED. The file is read and
// checked entirely in the browser; the button that starts writing says exactly
// how many rows it will create and how many it will leave alone.
//
// WHO MAY IMPORT. The dialog is only offered to an owner, director or
// administrator, and refuses to open for anyone else. The DATABASE's own rule
// is unchanged and slightly wider — has_school_management_role also admits a
// principal — so a principal calling the API directly is still permitted,
// exactly as they are for every other write. That is deliberate: weakening or
// tightening the policy was not part of this work.
// ---------------------------------------------------------------------------

type Phase = 'choose' | 'reading' | 'preview' | 'importing' | 'done'

const IMPORTER_ROLES = ['owner', 'director', 'administrator']

export default function ImportDialog<T, Ctx>({
  kind,
  open,
  onClose,
  onImported,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kind: ImportKind<T, Ctx>
  open: boolean
  onClose: () => void
  onImported: () => void
}) {
  const { school, memberships } = useAuth()
  const schoolId = school?.id ?? null
  const mayImport = memberships.some((m) => IMPORTER_ROLES.includes(m.role))

  const [phase, setPhase] = useState<Phase>('choose')
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [plan, setPlan] = useState<ImportPlan<T> | null>(null)
  const [outcomes, setOutcomes] = useState<RowOutcome[] | null>(null)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const contextRef = useRef<Ctx | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setPhase('choose')
    setError(null)
    setBlocked(null)
    setPlan(null)
    setOutcomes(null)
    setProgress(null)
    contextRef.current = null
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  const getTemplate = async () => {
    setBusy(true)
    setError(null)
    try {
      await downloadTemplate({
        fileName: kind.fileName,
        sheetName: kind.title.replace('Import ', ''),
        columns: kind.columns,
        notes: kind.notes,
        maxRows: kind.maxRows,
      })
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file || !schoolId) return
    setPhase('reading')
    setError(null)
    setBlocked(null)
    try {
      const context = await kind.loadContext(schoolId)
      contextRef.current = context

      const stop = kind.precheck(context)
      if (stop) {
        setBlocked(stop)
        setPhase('choose')
        return
      }

      const { rows } = await readSpreadsheet(file, kind.columns)
      if (rows.length === 0) {
        setError('That file has no rows below the header.')
        setPhase('choose')
        return
      }
      if (rows.length > kind.maxRows) {
        setError(`That file has ${rows.length} rows. The limit is ${kind.maxRows} per file — split it and import in parts.`)
        setPhase('choose')
        return
      }
      setPlan(kind.prepare(rows, context))
      setPhase('preview')
    } catch (err: unknown) {
      setError(err instanceof ImportFileError ? err.message : errorMessage(err))
      setPhase('choose')
    }
  }

  const startImport = async () => {
    if (!schoolId || !plan || !contextRef.current) return
    setPhase('importing')
    setProgress({ done: 0, total: plan.counts.ready, current: null })
    try {
      const results = await runImport({ schoolId, kind, plan, context: contextRef.current, onProgress: setProgress })
      setOutcomes(results)
      setPhase('done')
      onImported()
    } catch (err: unknown) {
      setError(errorMessage(err))
      setPhase('preview')
    }
  }

  if (!open) return null

  if (!mayImport) {
    return (
      <Modal open={open} onClose={onClose} title={kind.title}>
        <p className="text-sm text-graphite">
          Importing is available to the school&rsquo;s owner, director or administrator.
        </p>
      </Modal>
    )
  }

  const errorRows = plan?.rows.filter((r) => r.status === 'error') ?? []
  const summary = outcomes ? summariseImport(outcomes) : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kind.title}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          {phase === 'preview' && (
            <>
              <Button variant="ghost" onClick={reset}>
                Choose another file
              </Button>
              <Button onClick={() => void startImport()} disabled={!plan || plan.counts.ready === 0}>
                Import {plan?.counts.ready ?? 0} {plan?.counts.ready === 1 ? 'row' : 'rows'}
              </Button>
            </>
          )}
          {phase === 'done' && (
            <>
              <Button
                variant="outline"
                onClick={() => void downloadResults(`${kind.fileName} - results`, outcomes ?? [])}
              >
                <Download className="h-4 w-4" /> Download results
              </Button>
              <Button onClick={onClose}>Done</Button>
            </>
          )}
          {(phase === 'choose' || phase === 'reading') && (
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
      }
    >
      {error && (
        <p className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
      )}

      {blocked && (
        <div className="mb-4 flex gap-3 rounded-xl bg-amber-500/10 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
          <p className="text-sm text-ink dark:text-white">{blocked}</p>
        </div>
      )}

      {(phase === 'choose' || phase === 'reading') && (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl bg-brand/5 px-4 py-3.5">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" />
            <div className="text-sm text-ink dark:text-white">
              <p>Start from the template so the columns and the allowed values are already correct.</p>
              <p className="mt-1 text-xs text-graphite">
                Your file is read on this computer and is never uploaded. Up to {kind.maxRows} rows and 5 MB.
                <strong className="ml-1 text-ink dark:text-white">No invitation email is sent by importing</strong> — import
                first, check the data, then invite.
              </p>
            </div>
          </div>

          <Button variant="outline" onClick={() => void getTemplate()} loading={busy}>
            <Download className="h-4 w-4" /> Download template
          </Button>

          <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-ink/15 px-6 py-8 text-center hover:border-brand/50 dark:border-white/15">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            {phase === 'reading' ? (
              <span className="flex items-center justify-center gap-2 text-sm text-graphite">
                <Loader2 className="h-4 w-4 animate-spin" /> Reading and checking…
              </span>
            ) : (
              <>
                <FileSpreadsheet className="mx-auto h-8 w-8 text-graphite" />
                <span className="mt-2 block text-sm font-medium text-ink dark:text-white">Choose a file</span>
                <span className="mt-0.5 block text-xs text-graphite">.xlsx or .csv</span>
              </>
            )}
          </label>
        </div>
      )}

      {phase === 'preview' && plan && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Rows in file" value={plan.counts.total} />
            <Stat label="Ready" value={plan.counts.ready} tone="good" />
            <Stat label="Already exist" value={plan.counts.exists} tone="warn" />
            <Stat label="Problems" value={plan.counts.error} tone="bad" />
          </div>

          <p className="rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink dark:bg-white/5 dark:text-white">
            Nothing has been written yet. Importing will create{' '}
            <strong>{plan.counts.ready}</strong> {plan.counts.ready === 1 ? 'row' : 'rows'} and leave the other{' '}
            {plan.counts.total - plan.counts.ready} alone.
          </p>

          {plan.notices.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink dark:text-white">
                <Info className="h-4 w-4 text-brand" /> Worth knowing
              </p>
              <ul className="space-y-1 text-sm text-graphite">
                {plan.notices.map((notice) => (
                  <li key={notice}>{notice}</li>
                ))}
              </ul>
            </div>
          )}

          {errorRows.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" /> These rows will not be imported
              </p>
              <ul className="max-h-60 space-y-1 overflow-y-auto rounded-xl bg-red-500/5 px-4 py-3 text-sm">
                {errorRows.map((row) => (
                  <li key={row.row} className="text-graphite">
                    <span className="font-medium text-ink dark:text-white">Row {row.row}:</span> {row.problems.join('; ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {phase === 'importing' && progress && (
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-ink dark:text-white">
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
            Importing {Math.min(progress.done + 1, progress.total)} of {progress.total}…
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-graphite">Leave this open until it finishes.</p>
        </div>
      )}

      {phase === 'done' && summary && (
        <div className="space-y-4">
          <h3 className="font-semibold text-ink dark:text-white">
            {summary.created.length} created · {summary.skipped.length} skipped · {summary.failed.length} failed
          </h3>
          <OutcomeList icon={CheckCircle2} tone="text-emerald-600 dark:text-emerald-400" title="Created" rows={summary.created} />
          <OutcomeList icon={MinusCircle} tone="text-amber-600 dark:text-amber-400" title="Skipped" rows={summary.skipped} />
          <OutcomeList icon={XCircle} tone="text-red-600 dark:text-red-400" title="Failed" rows={summary.failed} />
          <p className="flex items-start gap-2 rounded-xl bg-brand/5 px-4 py-3 text-xs text-graphite">
            <Upload className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />
            Download the results file to see every row&rsquo;s outcome, fix the failures, and re-upload just those. Nobody has
            been emailed — invite them from the Teachers or Guardians page when the data looks right.
          </p>
        </div>
      )}
    </Modal>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'warn' | 'bad' }) {
  const colour =
    tone === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'bad'
          ? 'text-red-600 dark:text-red-400'
          : 'text-ink dark:text-white'
  return (
    <div className="rounded-xl bg-ink/5 px-3 py-2.5 dark:bg-white/5">
      <p className={`text-xl font-semibold ${colour}`}>{value}</p>
      <p className="text-xs text-graphite">{label}</p>
    </div>
  )
}

function OutcomeList({
  icon: Icon,
  tone,
  title,
  rows,
}: {
  icon: typeof CheckCircle2
  tone: string
  title: string
  rows: RowOutcome[]
}) {
  if (rows.length === 0) return null
  return (
    <div>
      <p className={`mb-1.5 flex items-center gap-1.5 text-sm font-medium ${tone}`}>
        <Icon className="h-4 w-4" /> {title} ({rows.length})
      </p>
      <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-graphite">
        {rows.slice(0, 60).map((row) => (
          <li key={row.row}>
            <span className="text-ink dark:text-white">Row {row.row}</span> — {row.label}: {row.detail}
          </li>
        ))}
        {rows.length > 60 && <li className="italic">…and {rows.length - 60} more, in the results file.</li>}
      </ul>
    </div>
  )
}
