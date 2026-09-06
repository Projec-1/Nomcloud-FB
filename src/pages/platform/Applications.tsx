import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Loader'
import { listApplications, type SchoolApplication } from '@/services/platformService'

function complete(application: SchoolApplication) {
  return Boolean(application.school_name && application.administrator_name && application.email && application.phone && application.school_size_band)
}

export default function PlatformApplications() {
  const [applications, setApplications] = useState<SchoolApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void listApplications().then(setApplications).catch(() => setError('Unable to load applications.')).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader title="Applications" description="Review requests to join the Nom Cloud platform." />
      {loading && <PageLoader label="Loading applications…" />}
      {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>}
      {!loading && !error && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="grid gap-4 border-b border-white/10 px-5 py-4 text-xs font-medium uppercase tracking-wide text-slate-400 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
            <span>School</span><span>Applicant</span><span>Status</span><span>Details</span>
          </div>
          {applications.map((application) => (
            <div key={application.id} className="grid gap-3 border-b border-white/10 px-5 py-4 last:border-0 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center">
              <div><p className="font-medium">{application.school_name}</p><p className="text-xs text-slate-400">{new Date(application.created_at).toLocaleString()}</p></div>
              <div><p className="text-sm">{application.administrator_name}</p><p className="text-xs text-slate-400">{application.email}</p></div>
              <div className="flex items-center gap-2"><Badge tone={application.status === 'pending' ? 'warning' : application.status === 'approved' ? 'success' : 'neutral'}>{application.status}</Badge><span className="text-xs text-slate-400">{complete(application) ? 'Complete' : 'Incomplete'}</span></div>
              <Link to={`/platform/applications/${application.id}`} className="text-sm font-medium text-orange-300 hover:text-orange-200">View</Link>
            </div>
          ))}
          {applications.length === 0 && <p className="px-5 py-8 text-sm text-slate-400">No applications yet.</p>}
        </div>
      )}
    </div>
  )
}
