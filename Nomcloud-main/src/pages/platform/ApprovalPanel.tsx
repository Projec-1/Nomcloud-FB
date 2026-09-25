import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { errorMessage } from '@/utils/errorMessage'
import SignOutButton from '@/components/ui/SignOutButton'

interface PendingApplication {
  id: string
  school_name: string
  email: string
}

/** What approval reported. It contains no password, because none is created. */
interface ApprovalOutcome {
  application_id: string
  school_id: string
  user_id: string
  email: string
  activation_email_sent: boolean
  activation_email_error?: string
  email_kind?: 'invite' | 'recovery'
  school_name: string
}

/**
 * The real reason an Edge Function call failed.
 *
 * supabase.functions.invoke wraps every non-2xx response in a FunctionsHttpError
 * whose message is always "Edge Function returned a non-2xx status code". The
 * function's own explanation is in the response body, which the error carries as
 * `context`. Reading that body is what turns a generic wrapper into, for example,
 * "An account with this email already exists and is linked to a school".
 */
async function functionErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context
  if (context instanceof Response) {
    const status = `HTTP ${context.status}`
    try {
      const body = (await context.clone().json()) as { error?: unknown; cleanup_error?: unknown }
      if (typeof body.error === 'string' && body.error) {
        const cleanup = typeof body.cleanup_error === 'string' ? ` Cleanup also failed: ${body.cleanup_error}` : ''
        return `${body.error} (${status})${cleanup}`
      }
    } catch {
      try {
        const text = await context.clone().text()
        if (text) return `${text} (${status})`
      } catch {
        // Fall through to the error's own message.
      }
    }
    return `The approval service returned ${status}.`
  }
  return errorMessage(error)
}

export default function ApprovalPanel() {
  const { authUser } = useAuth()
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null)
  const [applications, setApplications] = useState<PendingApplication[]>([])
  const [shortcodes, setShortcodes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ApprovalOutcome | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resentNote, setResentNote] = useState<string | null>(null)

  const loadApplications = async () => {
    if (!authUser) return

    setLoading(true)
    setError(null)
    const { data: admin, error: adminError } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', authUser.id)
      .is('revoked_at', null)
      .maybeSingle()

    if (adminError) {
      setIsPlatformAdmin(false)
      setError(adminError.message)
      setLoading(false)
      return
    }

    if (!admin) {
      setIsPlatformAdmin(false)
      setLoading(false)
      return
    }

    setIsPlatformAdmin(true)
    const { data, error: applicationError } = await supabase
      .from('school_applications')
      .select('id, school_name, email')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (applicationError) {
      setError(applicationError.message)
    } else {
      setApplications((data ?? []) as PendingApplication[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadApplications()
  }, [authUser])

  const approve = async (application: PendingApplication) => {
    const shortcode = shortcodes[application.id]?.trim() ?? ''
    if (!shortcode) {
      setError(`Enter a shortcode for ${application.school_name}.`)
      return
    }

    setApprovingId(application.id)
    setError(null)
    setResult(null)
    setResentNote(null)
    const { data, error: approvalError } = await supabase.functions.invoke('approve-school-application', {
      body: {
        application_id: application.id,
        shortcode,
      },
    })

    if (approvalError) {
      setError(await functionErrorMessage(approvalError))
    } else {
      setResult({ ...(data as ApprovalOutcome), school_name: application.school_name })
      await loadApplications()
    }
    setApprovingId(null)
  }

  /**
   * Sends the activation email again. The person may have missed it, or the link
   * may have expired — each link is single use and short lived, so a resend is
   * the normal remedy. Still no password: the new email carries a new link.
   */
  const resendActivation = async () => {
    if (!result) return
    setResending(true)
    setError(null)
    setResentNote(null)
    const { error: resendError } = await supabase.functions.invoke('approve-school-application', {
      body: { application_id: result.application_id, action: 'resend' },
    })
    setResending(false)
    if (resendError) {
      setError(await functionErrorMessage(resendError))
      return
    }
    setResentNote(`Activation email sent again to ${result.email}.`)
  }

  if (!authUser) return null

  if (loading) {
    return <p className="text-sm text-graphite">Checking platform-admin access…</p>
  }

  if (!isPlatformAdmin) {
    return (
      <section className="max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
        <h1 className="text-xl font-semibold text-red-800 dark:text-red-200">Platform-admin access required</h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          School application approval is restricted to an unrevoked platform-admin account.
        </p>
        <SignOutButton className="btn-outline mt-5">
          Sign out
        </SignOutButton>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Platform administration</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink dark:text-white">Approve school application</h1>
        <p className="mt-2 text-sm text-graphite">
          Approving creates the school and its administrator, then emails that administrator a single-use activation
          link. No password is created, shown or sent — they choose their own.
        </p>
      </div>

      {error && (
        <pre className="overflow-x-auto rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </pre>
      )}

      {result !== null && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <h2 className="font-semibold text-emerald-900 dark:text-emerald-200">{result.school_name} is approved</h2>
          {result.activation_email_sent ? (
            <p className="mt-1.5 text-sm text-emerald-900 dark:text-emerald-200">
              Activation email sent to <strong>{result.email}</strong>. They choose their own password from the link;
              no password is created or shared.
            </p>
          ) : (
            <p className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-400">
              The school, the administrator&rsquo;s account and their membership all exist, but{' '}
              <strong>no activation email was sent</strong> to {result.email}, so nothing has reached them and they
              cannot sign in yet. Use &ldquo;Resend activation email&rdquo; once email is working.
              {result.activation_email_error ? ` Mail server: ${result.activation_email_error}` : ''}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" loading={resending} onClick={() => void resendActivation()}>
              Resend activation email
            </Button>
            {resentNote && <span className="text-sm text-emerald-900 dark:text-emerald-200">{resentNote}</span>}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {applications.length === 0 ? (
          <p className="rounded-xl border border-ink/10 bg-white p-5 text-sm text-graphite dark:border-white/10 dark:bg-white/5">
            No pending applications.
          </p>
        ) : (
          applications.map((application) => (
            <div
              key={application.id}
              className="flex flex-col gap-4 rounded-xl border border-ink/10 bg-white p-5 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-end sm:justify-between"
            >
              <div>
                <h2 className="font-semibold text-ink dark:text-white">{application.school_name}</h2>
                <p className="mt-1 break-all text-xs text-graphite">{application.id}</p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-80 sm:flex-row sm:items-end">
                <Input
                  label="Shortcode"
                  value={shortcodes[application.id] ?? ''}
                  onChange={(event) =>
                    setShortcodes((current) => ({ ...current, [application.id]: event.target.value }))
                  }
                  placeholder="school-shortcode"
                />
                <Button
                  onClick={() => void approve(application)}
                  loading={approvingId === application.id}
                  disabled={approvingId !== null}
                >
                  Approve
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
