import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface PendingApplication {
  id: string
  school_name: string
}

export default function ApprovalPanel() {
  const { authUser, logout } = useAuth()
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null)
  const [applications, setApplications] = useState<PendingApplication[]>([])
  const [shortcodes, setShortcodes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<unknown>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

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
      .select('id, school_name')
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
    const { data, error: approvalError } = await supabase.functions.invoke('approve-school-application', {
      body: {
        application_id: application.id,
        shortcode,
      },
    })

    if (approvalError) {
      setError(JSON.stringify(approvalError, null, 2))
    } else {
      setResult(data)
      await loadApplications()
    }
    setApprovingId(null)
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
          This development panel is restricted to an unrevoked platform-admin account.
        </p>
        <Button className="mt-5" variant="outline" onClick={logout}>
          Sign out
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Development only</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink dark:text-white">Approve school application</h1>
        <p className="mt-2 text-sm text-graphite">
          This panel calls the approval RPC using the current authenticated session. The temporary password is shown
          only in this result.
        </p>
      </div>

      {error && (
        <pre className="overflow-x-auto rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </pre>
      )}

      {result !== null && (
        <pre className="overflow-x-auto rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
          {JSON.stringify(result, null, 2)}
        </pre>
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
