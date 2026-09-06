import { useEffect, useState } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Loader'
import { listSchools, type PlatformSchool } from '@/services/platformService'

export default function PlatformSchools() {
  const [schools, setSchools] = useState<PlatformSchool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void listSchools().then(setSchools).catch(() => setError('Unable to load schools.')).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <PageHeader title="Schools" description="Every school currently registered on Nom Cloud." />
      {loading && <PageLoader label="Loading schools…" />}
      {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>}
      {!loading && !error && <div className="grid gap-4 md:grid-cols-2">{schools.map((school) => <div key={school.id} className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{school.name}</p><p className="mt-1 text-sm text-slate-400">{school.shortcode}</p></div><Badge tone={school.status === 'active' ? 'success' : school.status === 'suspended' ? 'warning' : 'danger'}>{school.status}</Badge></div><p className="mt-4 text-xs text-slate-400">{school.country}{school.email ? ` · ${school.email}` : ''}</p></div>)}{schools.length === 0 && <p className="text-sm text-slate-400">No schools yet.</p>}</div>}
    </div>
  )
}
