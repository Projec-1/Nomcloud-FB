import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Loader'
import { getApplication, type SchoolApplication } from '@/services/platformService'

export default function PlatformApplicationDetail() {
  const { id } = useParams()
  const [application, setApplication] = useState<SchoolApplication | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    void getApplication(id).then((value) => { if (!value) setError('Application not found.'); else setApplication(value) }).catch(() => setError('Unable to load application.')).finally(() => setLoading(false))
  }, [id])

  if (loading) return <PageLoader label="Loading application…" />
  if (error || !application) return <div><p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error || 'Application not found.'}</p><Link to="/platform/applications" className="mt-5 inline-block text-sm text-orange-300">Back to applications</Link></div>

  return (
    <div>
      <PageHeader title={application.school_name} description="Application details and review actions." actions={<Link to="/platform/applications" className="text-sm text-orange-300">Back to applications</Link>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="mb-5 flex items-center justify-between"><h2 className="font-semibold">Submitted details</h2><Badge tone={application.status === 'pending' ? 'warning' : application.status === 'approved' ? 'success' : 'neutral'}>{application.status}</Badge></div><dl className="space-y-4 text-sm">{[['Administrator', application.administrator_name], ['Email', application.email], ['Phone', application.phone], ['School size', application.school_size_band], ['Country', application.country || 'Not provided'], ['Submitted', new Date(application.created_at).toLocaleString()]].map(([label, value]) => <div key={label}><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1">{value}</dd></div>)}</dl>{application.message && <div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs uppercase tracking-wide text-slate-400">Message</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{application.message}</p></div>}</section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold">Review</h2><p className="mt-2 text-sm text-slate-400">Approval and rejection are intentionally disabled in Part A. Part B will connect these controls to the atomic approval transaction.</p><div className="mt-6 flex gap-3"><button disabled className="rounded-xl bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-emerald-300 opacity-60">Approve</button><button disabled className="rounded-xl bg-red-500/20 px-4 py-2.5 text-sm font-semibold text-red-300 opacity-60">Reject</button></div></section>
      </div>
    </div>
  )
}
