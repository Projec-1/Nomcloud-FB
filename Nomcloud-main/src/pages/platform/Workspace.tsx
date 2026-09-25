import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Pulse as Activity,
  Warning as AlertTriangle,
  ArrowUpRight,
  Buildings as Building2,
  Check,
  CaretRight as ChevronRight,
  ClipboardText as ClipboardCheck,
  Clock as Clock3,
  FileText,
  Key as KeyRound,
  Layout as LayoutDashboard,
  LockKey as LockKeyhole,
  SignOut as LogOut,
  List as Menu,
  DotsThree as MoreHorizontal,
  MagnifyingGlass as Search,
  Gear as Settings2,
  Shield,
  SlidersHorizontal,
  Users,
  X,
  Wrench,
  Eye,
  ChartBar as BarChart3,
  Globe as Globe2,
  Flag,
  DownloadSimple as Download,
  Prohibit as Ban,
  ArrowCounterClockwise as RotateCcw,
  Megaphone,
  Database,
  PlugsConnected,
  Sliders,
  CreditCard,
  UserCircle,
} from '@phosphor-icons/react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { useAuth } from '@/context/AuthContext'

type SchoolStatus = 'Active' | 'Pending' | 'Under review' | 'Suspended'
type RequestStatus = 'Open' | 'In review' | 'Resolved'

interface School {
  id: string
  name: string
  location: string
  admin: string
  email: string
  phone: string
  status: SchoolStatus
  plan: string
  students: number
  teachers: number
  registered: string
  activity: string
}

interface Request {
  id: string
  type: string
  school: string
  submittedBy: string
  submitted: string
  status: RequestStatus
  summary: string
}

const schools: School[] = [
  { id: 'NCL-00182', name: 'Hodan International School', location: 'Mogadishu, Somalia', admin: 'Amina Yusuf', email: 'admin@hodan.edu', phone: '+252 61 555 0182', status: 'Active', plan: 'Growth', students: 842, teachers: 54, registered: 'Sep 08, 2026', activity: 'Active 12 min ago' },
  { id: 'NCL-00179', name: 'Riverside Academy', location: 'Nairobi, Kenya', admin: 'Daniel Mwangi', email: 'hello@riverside.ac.ke', phone: '+254 712 220 901', status: 'Under review', plan: 'Scale', students: 1240, teachers: 82, registered: 'Sep 18, 2026', activity: 'Application updated 1h ago' },
  { id: 'NCL-00177', name: 'Al-Noor Primary', location: 'Hargeisa, Somalia', admin: 'Hassan Ali', email: 'office@alnoor.edu', phone: '+252 63 442 1098', status: 'Pending', plan: 'Starter', students: 316, teachers: 22, registered: 'Sep 20, 2026', activity: 'Awaiting verification' },
  { id: 'NCL-00154', name: 'Maktab Academy', location: 'Garowe, Somalia', admin: 'Sahra Osman', email: 'admin@maktab.edu', phone: '+252 90 770 1220', status: 'Suspended', plan: 'Growth', students: 576, teachers: 39, registered: 'Jun 14, 2026', activity: 'Suspended Sep 21' },
]

const requests: Request[] = [
  { id: 'REQ-1048', type: 'Registration request', school: 'Riverside Academy', submittedBy: 'Daniel Mwangi', submitted: 'Today, 10:42', status: 'In review', summary: 'Complete school registration and verification information submitted for approval.' },
  { id: 'REQ-1047', type: 'Permission request', school: 'Hodan International School', submittedBy: 'Amina Yusuf', submitted: 'Today, 09:18', status: 'Open', summary: 'Request to add a finance manager with billing permissions.' },
  { id: 'REQ-1042', type: 'Support request', school: 'Al-Noor Primary', submittedBy: 'Hassan Ali', submitted: 'Yesterday, 16:04', status: 'Open', summary: 'Unable to import the new academic year staff roster.' },
  { id: 'REQ-1038', type: 'Account change', school: 'Maktab Academy', submittedBy: 'Sahra Osman', submitted: 'Sep 21, 14:12', status: 'Resolved', summary: 'Update the registered organization administrator.' },
]

const auditLogs = [
  ['School approved', 'Leila Hassan', 'Hodan International School', 'Today, 09:42', 'Success'],
  ['Request reviewed', 'Omar Abdi', 'REQ-1038 · Maktab Academy', 'Today, 09:18', 'Success'],
  ['Permission changed', 'Leila Hassan', 'Amina Yusuf · Finance', 'Yesterday, 16:32', 'Success'],
  ['School suspended', 'Omar Abdi', 'Maktab Academy', 'Sep 21, 14:12', 'Success'],
  ['Operator login', 'Leila Hassan', 'Platform workspace', 'Sep 21, 08:01', 'Success'],
]

const navGroups = [
  {
    label: 'Workspace',
    items: [
      { label: 'Overview', path: '/platform', icon: LayoutDashboard },
      { label: 'Action Center', path: '/platform/actions', icon: AlertTriangle, count: 6 },
    ],
  },
  {
    label: 'Network',
    items: [
      { label: 'Schools', path: '/platform/schools', icon: Building2 },
      { label: 'People', path: '/platform/people', icon: UserCircle },
      { label: 'Requests & Reviews', path: '/platform/requests', icon: ClipboardCheck, count: 3 },
      { label: 'Communications', path: '/platform/communications', icon: Megaphone },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Analytics', path: '/platform/analytics', icon: BarChart3 },
      { label: 'Activity', path: '/platform/activity', icon: Activity },
      { label: 'Audit Logs', path: '/platform/audit', icon: FileText },
      { label: 'System Health', path: '/platform/health', icon: Activity },
      { label: 'Maintenance', path: '/platform/maintenance', icon: Wrench },
    ],
  },
  {
    label: 'Security',
    items: [
      { label: 'Security', path: '/platform/security', icon: Shield },
      { label: 'Permissions', path: '/platform/permissions', icon: KeyRound },
      { label: 'Operators', path: '/platform/operators', icon: Users },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Features', path: '/platform/features', icon: Sliders },
      { label: 'Integrations', path: '/platform/integrations', icon: PlugsConnected },
      { label: 'Billing', path: '/platform/billing', icon: CreditCard },
      { label: 'Data', path: '/platform/data', icon: Database },
      { label: 'Email Templates', path: '/platform/templates/email', icon: FileText },
      { label: 'Announcement Templates', path: '/platform/templates/announcements', icon: Megaphone },
      { label: 'Money Receipt Templates', path: '/platform/templates/receipts', icon: FileText },
      { label: 'Record Templates', path: '/platform/templates/records', icon: FileText },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', path: '/platform/settings', icon: Settings2 },
    ],
  },
]

const nav = navGroups.flatMap((group) => group.items)

const globalResults = [
  { type: 'School', title: 'Hodan International School', detail: 'NCL-00182 · Mogadishu · Active', path: '/platform/schools' },
  { type: 'Operator', title: 'Hodan · Amina Yusuf', detail: 'Administrator · admin@hodan.edu', path: '/platform/schools' },
  { type: 'Request', title: 'REQ-1047 · Finance manager access', detail: 'Hodan International School · Open', path: '/platform/requests' },
  { type: 'Audit event', title: 'Permission changed', detail: 'Amina Yusuf · Yesterday, 16:32', path: '/platform/audit' },
]

const schoolTimeline = [
  ['Today, 09:42', 'School approval completed', 'Leila Hassan approved the organization application.'],
  ['Sep 22, 14:18', '3 teachers added', 'Roster import completed by Amina Yusuf.'],
  ['Sep 20, 11:05', 'Attendance activated', 'Attendance workspace enabled for all campuses.'],
  ['Sep 18, 08:30', 'Administrator verified', 'Identity and organization records verified.'],
  ['Sep 15, 16:12', 'Application submitted', 'School application received by Nom Cloud.'],
]

const statusStyle: Record<string, string> = {
  Active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  Pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'Under review': 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  Suspended: 'bg-red-500/10 text-red-700 dark:text-red-300',
  Open: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'In review': 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  Resolved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
}

function Status({ value }: { value: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[value] ?? 'bg-slate-500/10 text-slate-600'}`}><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />{value}</span>
}

export default function PlatformWorkspace() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, logout } = useAuth()
  const [mobileNav, setMobileNav] = useState(false)
  const [school, setSchool] = useState<School | null>(null)
  const [request, setRequest] = useState<Request | null>(null)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [schoolFilter, setSchoolFilter] = useState<'All' | SchoolStatus>('All')
  const [toast, setToast] = useState('')
  const [globalQuery, setGlobalQuery] = useState('')
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [operator, setOperator] = useState<string | null>(null)
  const [schoolRecords, setSchoolRecords] = useState(schools)
  const [requestRecords, setRequestRecords] = useState(requests)
  const [auditRecords, setAuditRecords] = useState(auditLogs)
  const currentPath = location.pathname
  const section = currentPath === '/platform'
    ? 'Overview'
    : [...nav]
        .sort((a, b) => b.path.length - a.path.length)
        .find((item) => currentPath === item.path || currentPath.startsWith(`${item.path}/`))?.label ?? 'Overview'

  const filteredSchools = useMemo(() => schoolRecords.filter((item) => (schoolFilter === 'All' || item.status === schoolFilter) && `${item.name} ${item.id} ${item.location}`.toLowerCase().includes(query.toLowerCase())), [query, schoolFilter, schoolRecords])
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800) }
  const displayName = profile?.full_name || 'Leila Hassan'

  const action = (message: string) => { setRequest(null); setSchool(null); notify(message) }
  const recordAudit = (actionName: string, target: string) => {
    setAuditRecords((current) => [[actionName, displayName, target, 'Just now', 'Success'], ...current])
  }
  const updateSchool = (id: string, status: SchoolStatus, message: string) => {
    setSchoolRecords((current) => current.map((item) => item.id === id ? { ...item, status, activity: 'Updated just now' } : item))
    recordAudit(message, schoolRecords.find((item) => item.id === id)?.name ?? id)
    setSchool(null)
    notify(message)
  }
  const updateRequest = (id: string, status: RequestStatus, message: string) => {
    setRequestRecords((current) => current.map((item) => item.id === id ? { ...item, status } : item))
    recordAudit(message, requestRecords.find((item) => item.id === id)?.id ?? id)
    setRequest(null)
    notify(message)
  }
  const searchResults = globalResults.filter((result) => `${result.type} ${result.title} ${result.detail}`.toLowerCase().includes(globalQuery.toLowerCase()))

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-ink dark:bg-[#0a0e14] dark:text-white">
      <aside className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col overflow-hidden border-r border-[#e6e4df] bg-white px-3 py-5 transition-transform dark:border-white/[0.08] dark:bg-[#10151d] lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-start justify-between px-3">
          <button type="button" onClick={() => navigate('/platform')} className="flex items-center gap-3 text-left">
            <img src="/logo-512.png" alt="Nom Cloud" className="h-10 w-10 rounded-xl object-contain" />
            <span className="min-w-0"><span className="block text-[15px] font-bold tracking-tight">Nom Cloud</span><span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-graphite">Control Center</span></span>
          </button>
          <button className="ml-auto rounded-lg p-1 text-graphite lg:hidden" onClick={() => setMobileNav(false)}><X className="h-4 w-4" /></button>
        </div>
        <nav className="mt-8 min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
          {navGroups.map((group) => <section key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-graphite/70">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => { const Icon = item.icon; const active = section === item.label; return <button key={item.path} onClick={() => { navigate(item.path); setMobileNav(false) }} className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${active ? 'border-brand/20 bg-brand/10 text-brand' : 'border-transparent text-graphite hover:bg-ink/[0.05] hover:text-ink dark:hover:bg-white/[0.06] dark:hover:text-white'}`}><Icon className="h-[17px] w-[17px]" /><span className="flex-1">{item.label}</span>{item.count && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? 'bg-brand text-white' : 'bg-brand/10 text-brand'}`}>{item.count}</span>}</button> })}
            </div>
          </section>)}
        </nav>
        <div className="mt-auto">
          <div className="mb-3 rounded-2xl border border-ink/[0.07] bg-ink/[0.025] p-3 dark:border-white/[0.08] dark:bg-white/[0.03]"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-xs font-semibold">All systems operational</span></div><p className="mt-1 pl-4 text-[11px] text-graphite">Last checked 2 min ago</p></div>
          <button onClick={() => navigate('/platform/settings')} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-ink/[0.05] dark:hover:bg-white/[0.06]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white">{displayName.charAt(0)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{displayName}</span><span className="block text-xs text-graphite">Founder / Super Admin</span></span><MoreHorizontal className="h-4 w-4 text-graphite" /></button>
          <button onClick={() => setSignOutOpen(true)} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-graphite hover:bg-red-500/10 hover:text-red-600"><LogOut className="h-4 w-4" /> Sign out</button>
        </div>
      </aside>
      {mobileNav && <button className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
      <main className="platform-main lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-ink/[0.07] bg-[#f6f7f9]/80 px-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#0a0e14]/80 sm:px-8"><div className="flex items-center gap-3"><button className="rounded-xl p-2 hover:bg-ink/[0.06] lg:hidden" onClick={() => setMobileNav(true)}><Menu className="h-5 w-5" /></button><span className="text-sm font-semibold text-graphite">Platform /</span><span className="text-sm font-semibold">{section}</span></div><div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-xl border border-ink/[0.08] bg-white/70 px-3 py-2 text-xs text-graphite dark:border-white/[0.1] dark:bg-white/[0.04] sm:flex"><Search className="h-3.5 w-3.5" /> <span>⌘ K</span></div><button onClick={() => navigate('/platform/settings')} className="rounded-xl p-2 text-graphite hover:bg-ink/[0.06]"><Settings2 className="h-4 w-4" /></button><span className="h-8 w-8 rounded-full bg-brand text-center text-sm font-bold leading-8 text-white">{displayName.charAt(0)}</span></div></header>
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-ink/[0.07] bg-[#f6f7f9]/80 px-5 py-2 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#0a0e14]/80 sm:px-8"><div className="flex items-center gap-3"><button className="rounded-xl p-2 hover:bg-ink/[0.06] lg:hidden" onClick={() => setMobileNav(true)}><Menu className="h-5 w-5" /></button><span className="hidden text-sm font-semibold text-graphite sm:block">Platform /</span><span className="text-sm font-semibold">{section}</span></div><div className="flex flex-1 items-center justify-end gap-3"><div className="relative w-full max-w-sm"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite" /><input value={globalQuery} onFocus={() => setGlobalSearchOpen(true)} onChange={(event) => { setGlobalQuery(event.target.value); setGlobalSearchOpen(true) }} placeholder="Search schools, people, requests…" className="input h-10 bg-white/70 pl-10 pr-12 dark:bg-white/[0.05]" /><span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 text-[10px] text-graphite sm:block">⌘ K</span>{globalSearchOpen && globalQuery && <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-ink/10 bg-white p-2 shadow-card dark:border-white/10 dark:bg-[#171c24]">{searchResults.length ? searchResults.map((result) => <button key={`${result.type}-${result.title}`} onClick={() => { navigate(result.path); setGlobalSearchOpen(false); setGlobalQuery('') }} className="flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-ink/[0.05] dark:hover:bg-white/[0.06]"><span className="mt-0.5 rounded-lg bg-brand/10 p-2 text-brand"><Search className="h-3.5 w-3.5" /></span><span><span className="block text-[10px] font-bold uppercase tracking-wider text-brand">{result.type}</span><span className="block text-sm font-semibold">{result.title}</span><span className="block text-xs text-graphite">{result.detail}</span></span></button>) : <p className="p-3 text-sm text-graphite">No matching platform records.</p>}</div>}</div><button onClick={() => navigate('/platform/settings')} className="rounded-xl p-2 text-graphite hover:bg-ink/[0.06]"><Settings2 className="h-4 w-4" /></button><span className="h-8 w-8 shrink-0 rounded-full bg-brand text-center text-sm font-bold leading-8 text-white">{displayName.charAt(0)}</span></div></header>
        <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
          {section === 'Overview' && <Overview onSchool={setSchool} onRequest={setRequest} navigate={navigate} notify={notify} schools={schoolRecords} requests={requestRecords} />}
          {section === 'Action Center' && <ActionCenter onSchool={setSchool} onRequest={setRequest} navigate={navigate} schools={schoolRecords} requests={requestRecords} />}
          {section === 'Schools' && <SchoolsView schools={filteredSchools} query={query} setQuery={setQuery} filter={schoolFilter} setFilter={setSchoolFilter} onSchool={setSchool} onNotify={notify} />}
          {['People', 'Communications', 'Activity', 'System Health', 'Features', 'Integrations', 'Billing', 'Data'].includes(section) && <OperatorModuleView section={section} onNotify={notify} />}
          {section === 'Requests & Reviews' && <RequestsView onRequest={setRequest} requests={requestRecords} onAction={updateRequest} />}
          {section === 'Operators' && <OperatorsView onNotify={notify} onOperator={setOperator} />}
          {section === 'Permissions' && <PermissionsView onNotify={notify} />}
          {section === 'Audit Logs' && <AuditView notify={notify} rows={auditRecords} />}
          {section === 'Security' && <SecurityView onNotify={notify} />}
          {section === 'Maintenance' && <MaintenanceView onNotify={notify} />}
          {section === 'Analytics' && <AnalyticsView />}
          {section === 'Settings' && <SettingsView onNotify={notify} onEmergency={() => setEmergencyOpen(true)} />}
        </div>
      </main>
      {toast && <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-xl dark:bg-white dark:text-ink"><Check className="h-4 w-4 text-emerald-400" />{toast}</div>}
      <SchoolModal school={school} onClose={() => setSchool(null)} onAction={action} onStatusChange={updateSchool} />
      <RequestModal request={request} onClose={() => setRequest(null)} onAction={action} onDecision={updateRequest} onSchool={(name) => { setRequest(null); setSchool(schoolRecords.find((item) => item.name === name) ?? null) }} />
      <OperatorModal operator={operator} onClose={() => setOperator(null)} onAction={notify} />
      <Modal open={emergencyOpen} onClose={() => setEmergencyOpen(false)} title="Emergency controls" description="These actions affect live platform access and will be written to the audit log." size="md" footer={<Button variant="outline" onClick={() => setEmergencyOpen(false)}>Close</Button>}><div className="space-y-2">{['Suspend a school account', 'Revoke all sessions for a user', 'Restrict an operator account', 'Put platform into maintenance mode'].map((item) => <button key={item} onClick={() => { setEmergencyOpen(false); notify(`${item} requires founder confirmation`) }} className="flex w-full items-center gap-3 rounded-2xl border border-red-500/15 p-4 text-left text-sm font-semibold text-red-700 hover:bg-red-500/[0.05] dark:text-red-300"><Ban className="h-4 w-4" />{item}<ChevronRight className="ml-auto h-4 w-4" /></button>)}</div></Modal>
      <Modal open={signOutOpen} onClose={() => setSignOutOpen(false)} title="Sign out?" description="Are you sure you want to sign out of Nom Cloud?" size="sm" footer={<><Button variant="outline" onClick={() => setSignOutOpen(false)}>Cancel</Button><Button variant="danger" onClick={logout}>Sign Out</Button></>}><div /></Modal>
    </div>
  )
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-graphite">{description}</p></div>{action}</div>
}

const moduleContent: Record<string, { eyebrow: string; title: string; description: string; stats: string[]; rows: string[] }> = {
  People: { eyebrow: 'Network directory', title: 'People', description: 'Search administrators, teachers, students, parents, and operators across the Nom Cloud network.', stats: ['48,290 students', '3,842 teachers', '1,126 administrators'], rows: ['Amina Yusuf · Administrator · Hodan International School', 'Ahmed Hassan · Teacher · Riverside Academy', 'Maryan Ali · Teacher · Al-Noor Primary', 'Leila Hassan · Operator · Nom Cloud'] },
  Communications: { eyebrow: 'Platform messaging', title: 'Communications', description: 'Create and publish clear platform-wide announcements for schools and operators.', stats: ['12 published', '3 scheduled', '4 drafts'], rows: ['Scheduled maintenance · Scheduled · All schools', 'New attendance tools · Published · School administrators', 'Welcome to the new academic year · Draft · Selected schools'] },
  Activity: { eyebrow: 'Network activity', title: 'Activity', description: 'Review the latest activity across schools, operators, security, billing, and system services.', stats: ['248 events today', '36 school actions', '12 operator actions'], rows: ['School approved · Hodan International School · Just now', 'Permission changed · Amina Yusuf · 12 min ago', 'Backup created · Platform storage · 34 min ago', 'Announcement published · All schools · 1h ago'] },
  'System Health': { eyebrow: 'Platform operations', title: 'System Health', description: 'Monitor the services that keep the Nom Cloud network running.', stats: ['99.98% uptime', '11 services', '0 active incidents'], rows: ['Authentication · Operational · 99.99% uptime', 'School Dashboard · Operational · 99.98% uptime', 'Notifications · Degraded · Delivery latency elevated', 'File Storage · Operational · 99.99% uptime'] },
  Features: { eyebrow: 'Feature control', title: 'Features', description: 'Control feature availability and rollout stages across the Nom Cloud network.', stats: ['10 features', '7 enabled', '2 beta rollouts'], rows: ['Parent App · Enabled · v2.4', 'Online Payments · Beta · v1.8', 'AI Assistant · Coming Soon · v0.9', 'Advanced Analytics · Enabled · v1.3'] },
  Integrations: { eyebrow: 'Developer center', title: 'Integrations', description: 'Manage connected services, API keys, webhooks, and provider configurations.', stats: ['5 connected', '2 API keys', '98.7% delivery rate'], rows: ['SMS provider · Connected · Last activity 12 min ago', 'Payments · Connected · 142 transactions this month', 'Email delivery · Connected · 99.2% delivery rate', 'Webhooks · 3 endpoints · Operational'] },
  Billing: { eyebrow: 'Subscriptions', title: 'Billing', description: 'Review school plans, renewals, payment status, and subscription changes.', stats: ['248 schools', '112 Growth', '8 past due'], rows: ['Hodan International School · Growth · Paid · Oct 08, 2026', 'Riverside Academy · Scale · Paid · Oct 18, 2026', 'Al-Noor Primary · Starter · Trial · Oct 20, 2026', 'Maktab Academy · Growth · Past due · Sep 30, 2026'] },
  Data: { eyebrow: 'Records center', title: 'Data', description: 'Manage exports, imports, backups, archived records, and data requests.', stats: ['2.4 TB stored', '6 recent exports', '3 pending requests'], rows: ['Schools Export · CSV · Completed · 2.4 MB', 'Users Import · Validation required · Ready for review', 'Nightly backup · Healthy · 18.6 GB', 'Data access request · Reviewing · Hodan International School'] },
}

function OperatorModuleView({ section, onNotify }: { section: string; onNotify: (message: string) => void }) {
  const config = moduleContent[section]
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftMessage, setDraftMessage] = useState('')
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const rows = config.rows.filter((row) => row.toLowerCase().includes(query.toLowerCase()))
  const isComposer = section === 'Communications'
  const isFeature = section === 'Features'
  const isIntegrations = section === 'Integrations'
  const isData = section === 'Data'

  return <div>
    <SectionHeader eyebrow={config.eyebrow} title={config.title} description={config.description} action={<Button variant="accent" onClick={() => isComposer || isData || isIntegrations ? setCreateOpen(true) : onNotify('Create action started')}>{isComposer ? 'Create announcement' : isData ? 'Create export' : isIntegrations ? 'Add integration' : 'Create'}</Button>} />
    <div className="mb-6 grid gap-4 sm:grid-cols-3">{config.stats.map((stat) => <div key={stat} className="platform-main-card rounded-xl p-5"><p className="text-lg font-semibold">{stat.split(' ').slice(0, 2).join(' ')}</p><p className="mt-1 text-xs text-graphite">{stat.split(' ').slice(2).join(' ') || 'Current platform status'}</p></div>)}</div>
    <div className="platform-main-card rounded-xl p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">{isFeature ? 'Feature list' : isIntegrations ? 'Connected services' : isData ? 'Data operations' : `Recent ${section.toLowerCase()}`}</h2><p className="mt-1 text-xs text-graphite">Mock records are ready for backend connection.</p></div><input className="input max-w-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" /></div>
      <div className="divide-y divide-ink/5 dark:divide-white/10">{rows.length ? rows.map((row) => <button type="button" key={row} onClick={() => setSelected(row)} className="flex w-full items-center gap-4 py-4 text-left hover:bg-ink/[0.02]"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isFeature && enabled[row] ? 'bg-emerald-100 text-emerald-700' : 'bg-brand/10 text-brand'}`}>{isFeature ? <Sliders className="h-4 w-4" /> : isIntegrations ? <PlugsConnected className="h-4 w-4" /> : isData ? <Database className="h-4 w-4" /> : <Activity className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{row.split(' · ')[0]}</span><span className="mt-1 block truncate text-xs text-graphite">{row.split(' · ').slice(1).join(' · ')}</span></span>{isFeature && <span role="switch" aria-checked={Boolean(enabled[row])} onClick={(event) => { event.stopPropagation(); setEnabled((current) => ({ ...current, [row]: !current[row] })); onNotify(`${row.split(' · ')[0]} updated`) }} className={`h-6 w-11 rounded-full p-1 transition ${enabled[row] ? 'bg-brand' : 'bg-ink/15'}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${enabled[row] ? 'translate-x-5' : ''}`} /></span>}<ChevronRight className="h-4 w-4 text-graphite" /></button>) : <div className="py-14 text-center text-sm text-graphite">No records match this search.</div>}</div>
    </div>
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.split(' · ')[0] ?? 'Record details'} description={`Mock ${section.toLowerCase()} detail`}>
      {selected && <div className="space-y-4"><div className="rounded-xl bg-brand/5 p-4 text-sm text-graphite">{selected}</div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-ink/10 p-4"><p className="text-xs text-graphite">Status</p><p className="mt-2 text-sm font-semibold">Operational</p></div><div className="rounded-xl border border-ink/10 p-4"><p className="text-xs text-graphite">Last updated</p><p className="mt-2 text-sm font-semibold">Just now</p></div></div><Button variant="accent" onClick={() => { setSelected(null); onNotify(`${section} record updated`) }}>Save mock change</Button></div>}
    </Modal>
    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={isComposer ? 'Create announcement' : isData ? 'Create data export' : 'Connect integration'} description="This action is simulated locally for the frontend prototype." footer={<><Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="accent" onClick={() => { setCreateOpen(false); onNotify(isComposer ? 'Announcement saved as draft' : isData ? 'Export preparation started' : 'Integration connected') }}>Save mock change</Button></>}>
      {isComposer ? <div className="space-y-4"><label className="label">Title<input className="input mt-2" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Scheduled maintenance" /></label><label className="label">Message<textarea className="input mt-2 min-h-28" value={draftMessage} onChange={(event) => setDraftMessage(event.target.value)} placeholder="Write the announcement message..." /></label><Select label="Audience" defaultValue="all"><option value="all">All schools</option><option value="operators">Operators</option><option value="admins">School administrators</option></Select></div> : <div className="space-y-4"><label className="label">{isData ? 'Record type' : 'Provider'}<Select defaultValue={isData ? 'schools' : 'sms'}><option value={isData ? 'schools' : 'sms'}>{isData ? 'Schools' : 'SMS provider'}</option><option value={isData ? 'users' : 'payments'}>{isData ? 'Users' : 'Payment provider'}</option><option value={isData ? 'audit' : 'email'}>{isData ? 'Audit logs' : 'Email provider'}</option></Select></label><div className="rounded-xl border border-dashed border-ink/15 p-5 text-sm text-graphite">{isData ? 'Mock export will show progress and a ready state.' : 'Connection details are simulated and can be replaced by the backend later.'}</div></div>}
    </Modal>
  </div>
}

function ActionCenter({ onSchool, onRequest, navigate, schools: schoolRecords, requests: requestRecords }: { onSchool: (school: School) => void; onRequest: (request: Request) => void; navigate: (path: string) => void; schools: School[]; requests: Request[] }) {
  const alerts = [
    ['4 schools awaiting verification', 'Review pending organization records', '/platform/schools', 'amber'],
    ['2 permission requests', 'Decisions are waiting in the inbox', '/platform/requests', 'blue'],
    ['1 suspicious login', 'Unusual operator activity detected', '/platform/security', 'red'],
    ['3 schools experiencing issues', 'Support and service health needs review', '/platform/maintenance', 'amber'],
    ['Subscription attention required', 'One account is approaching its plan limit', '/platform/schools', 'blue'],
  ]
  return <><SectionHeader eyebrow="Operator attention" title="Action center" description="Prioritized signals across the Nom Cloud network. Open an alert to jump directly to the underlying record." /><div className="grid gap-3">{alerts.map(([title, detail, path, tone]) => <button key={title} onClick={() => navigate(path)} className="flex items-center gap-4 rounded-2xl border border-ink/[0.07] bg-white p-4 text-left shadow-soft hover:bg-ink/[0.025] dark:border-white/[0.08] dark:bg-white/[0.04]"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone === 'red' ? 'bg-red-500/10 text-red-600' : tone === 'amber' ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'}`}><AlertTriangle className="h-4 w-4" /></span><span className="flex-1"><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm text-graphite">{detail}</span></span><ChevronRight className="h-5 w-5 text-graphite" /></button>)}</div><div className="mt-8 rounded-3xl border border-ink/[0.07] bg-ink p-5 text-white shadow-soft dark:bg-white/[0.06]"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-white/50">Quick investigation</p><h2 className="mt-2 text-xl font-semibold">Open records needing context</h2></div><Globe2 className="h-5 w-5 text-white/50" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={() => onSchool(schools[1])} className="rounded-2xl bg-white/[0.09] p-4 text-left hover:bg-white/[0.14]"><p className="text-sm font-semibold">Riverside Academy</p><p className="mt-1 text-xs text-white/55">School under review · 5 recent events</p></button><button onClick={() => onRequest(requests[0])} className="rounded-2xl bg-white/[0.09] p-4 text-left hover:bg-white/[0.14]"><p className="text-sm font-semibold">REQ-1048</p><p className="mt-1 text-xs text-white/55">Registration request · In review</p></button></div></div></>
}

function Overview({ onSchool, onRequest, navigate, notify, schools: schoolRecords, requests: requestRecords }: { onSchool: (school: School) => void; onRequest: (request: Request) => void; navigate: (path: string) => void; notify: (message: string) => void; schools: School[]; requests: Request[] }) {
  const stats: Array<[string, string, string, typeof Activity]> = [['Registered schools', '248', '+12 this month', Building2], ['Active students', '48,290', '+8.4%', Users], ['Open requests', '12', '3 need attention', ClipboardCheck], ['Platform uptime', '99.98%', 'All systems nominal', Activity]]
  return <div><SectionHeader eyebrow="Thursday, September 24, 2026" title="Good morning, Leila." description="A clear view of platform health, school activity, and the decisions waiting for your team." action={<Button variant="outline" size="sm" onClick={() => notify('Export prepared for download')}><ArrowUpRight className="h-4 w-4" /> Export report</Button>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value, detail, Icon]) => <div key={label} className="rounded-3xl border border-ink/[0.07] bg-white p-5 shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><div className="flex items-center justify-between"><span className="text-sm font-medium text-graphite">{label}</span><span className="rounded-xl bg-brand/10 p-2.5 text-brand"><Icon className="h-4 w-4" /></span></div><p className="mt-5 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">{detail}</p></div>)}</div><div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]"><div className="rounded-3xl border border-ink/[0.07] bg-white p-5 shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Schools needing attention</h2><p className="mt-1 text-xs text-graphite">Review exceptions before they become blockers.</p></div><button onClick={() => navigate('/platform/schools')} className="text-xs font-semibold text-brand">View all <ChevronRight className="inline h-3.5 w-3.5" /></button></div><div className="mt-5 divide-y divide-ink/[0.06] dark:divide-white/[0.08]">{schools.slice(1).map((item) => <button key={item.id} onClick={() => onSchool(item)} className="flex w-full items-center gap-3 py-4 text-left hover:bg-ink/[0.02]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600 dark:bg-white/[0.08] dark:text-white">{item.name.charAt(0)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.name}</span><span className="block text-xs text-graphite">{item.location} · {item.id}</span></span><Status value={item.status} /><ChevronRight className="h-4 w-4 text-graphite" /></button>)}</div></div><div className="rounded-3xl border border-ink/[0.07] bg-ink p-5 text-white shadow-soft dark:bg-white/[0.08]"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Action queue</p><h2 className="mt-2 text-xl font-semibold">3 decisions waiting</h2></div><span className="rounded-xl bg-white/10 p-2.5"><Clock3 className="h-5 w-5" /></span></div><div className="mt-6 space-y-3">{requests.slice(0, 3).map((item) => <button key={item.id} onClick={() => onRequest(item)} className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.08] p-3 text-left hover:bg-white/[0.14]"><span className="rounded-lg bg-brand p-2"><FileText className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.type}</span><span className="block truncate text-xs text-white/50">{item.school}</span></span><ChevronRight className="h-4 w-4 text-white/50" /></button>)}</div><button onClick={() => navigate('/platform/requests')} className="mt-5 text-xs font-semibold text-white/60 hover:text-white">Open request center <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></button></div></div><div className="mt-6 rounded-3xl border border-ink/[0.07] bg-white p-5 shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Recent platform activity</h2><p className="mt-1 text-xs text-graphite">A live stream of important changes across Nom Cloud.</p></div><button onClick={() => navigate('/platform/audit')} className="text-xs font-semibold text-brand">Audit logs <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></button></div><AuditTable rows={    auditLogs.slice(0, 4)} /></div></div>
}

function SchoolsView({ schools: list, query, setQuery, filter, setFilter, onSchool, onNotify }: { schools: School[]; query: string; setQuery: (v: string) => void; filter: 'All' | SchoolStatus; setFilter: (v: 'All' | SchoolStatus) => void; onSchool: (school: School) => void; onNotify: (message: string) => void }) {
  return <><SectionHeader eyebrow="Organization directory" title="Schools" description="Every school connected to Nom Cloud, with status, ownership, activity, and operational context." action={<Button variant="accent" size="sm" onClick={() => onNotify('School creation flow opened')}><Building2 className="h-4 w-4" /> Add school</Button>} /><div className="mb-5 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search schools, IDs, or locations…" className="input pl-10" /></div><div className="flex gap-2 overflow-x-auto">{(['All', 'Active', 'Pending', 'Under review', 'Suspended'] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${filter === item ? 'bg-ink text-white dark:bg-white dark:text-ink' : 'bg-white text-graphite dark:bg-white/[0.06]'}`}>{item}</button>)}</div></div><div className="overflow-hidden rounded-3xl border border-ink/[0.07] bg-white shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><div className="hidden grid-cols-[2fr_1.4fr_1fr_1fr_1fr_auto] gap-4 border-b border-ink/[0.06] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-graphite dark:border-white/[0.08] md:grid"><span>School</span><span>Administrator</span><span>Plan</span><span>Students</span><span>Status</span><span /></div>{list.map((item) => <button key={item.id} onClick={() => onSchool(item)} className="grid w-full gap-3 border-b border-ink/[0.06] px-5 py-4 text-left transition last:border-0 hover:bg-ink/[0.025] dark:border-white/[0.08] md:grid-cols-[2fr_1.4fr_1fr_1fr_1fr_auto] md:items-center md:gap-4"><span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 font-bold text-brand">{item.name.charAt(0)}</span><span><span className="block text-sm font-semibold">{item.name}</span><span className="block text-xs text-graphite">{item.id} · {item.location}</span></span></span><span className="text-sm text-graphite">{item.admin}<span className="block text-xs">{item.email}</span></span><span className="text-sm font-medium">{item.plan}</span><span className="text-sm font-medium">{item.students.toLocaleString()}<span className="block text-xs text-graphite">{item.teachers} teachers</span></span><Status value={item.status} /><ChevronRight className="hidden h-4 w-4 text-graphite md:block" /></button>)}</div></>
}

function RequestsView({ onRequest, requests: requestRecords, onAction }: { onRequest: (request: Request) => void; requests: Request[]; onAction: (id: string, status: RequestStatus, message: string) => void }) {
  const [filter, setFilter] = useState<'All' | RequestStatus>('All')
  const visible = requestRecords.filter((item) => filter === 'All' || item.status === filter)
  return <><SectionHeader eyebrow="Operations queue" title="Requests & reviews" description="Review every submission with the full school context before making a decision." action={<div className="flex gap-2 overflow-x-auto">{(['All', 'Open', 'In review', 'Resolved'] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold ${filter === item ? 'bg-ink text-white dark:bg-white dark:text-ink' : 'bg-white text-graphite dark:bg-white/[0.06]'}`}>{item}</button>)}</div>} /><div className="overflow-hidden rounded-3xl border border-ink/[0.07] bg-white shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><div className="hidden grid-cols-[1.2fr_1.5fr_1fr_auto] gap-4 border-b border-ink/[0.06] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-graphite dark:border-white/[0.08] md:grid"><span>Request</span><span>School & context</span><span>Submitted</span><span>Status</span></div>{visible.map((item) => <button key={item.id} onClick={() => onRequest(item)} className="group grid w-full gap-3 border-b border-ink/[0.06] px-5 py-4 text-left last:border-0 hover:bg-ink/[0.025] dark:border-white/[0.08] md:grid-cols-[1.2fr_1.5fr_1fr_auto] md:items-center md:gap-4"><span><span className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-brand" />{item.type}</span><span className="mt-1 block text-xs text-graphite">{item.id}</span></span><span><span className="block text-sm font-medium">{item.school}</span><span className="mt-1 block text-xs text-graphite">{item.summary}</span></span><span className="text-xs text-graphite">By {item.submittedBy}<span className="block mt-1">{item.submitted}</span></span><span className="flex items-center justify-between gap-3"><Status value={item.status} /><ChevronRight className="h-4 w-4 text-graphite transition group-hover:translate-x-1" /></span></button>)}</div></>
}

function OperatorsView({ onNotify, onOperator }: { onNotify: (message: string) => void; onOperator: (name: string) => void }) { const operators = [['Leila Hassan', 'Founder / Super Admin', 'leila@nom.cloud', 'Active', 'Today, 08:01'], ['Omar Abdi', 'Platform Admin', 'omar@nom.cloud', 'Active', 'Today, 07:44'], ['Nadia Warsame', 'Support Operator', 'nadia@nom.cloud', 'Active', 'Yesterday, 16:20'], ['Yusuf Ahmed', 'Operations Operator', 'yusuf@nom.cloud', 'Invited', '—']]; return <><SectionHeader eyebrow="People & access" title="Operators" description="Manage the team trusted to operate Nom Cloud and see each account's access level." action={<Button variant="accent" size="sm" onClick={() => onNotify('Invitation flow opened')}><Users className="h-4 w-4" /> Invite operator</Button>} /><div className="overflow-hidden rounded-3xl border border-ink/[0.07] bg-white shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><div className="hidden grid-cols-[1.5fr_1.4fr_1.2fr_1fr_auto] gap-4 border-b border-ink/[0.06] px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-graphite dark:border-white/[0.08] md:grid"><span>Operator</span><span>Role</span><span>Last active</span><span>Status</span><span>Actions</span></div>{operators.map((item) => <div key={item[0]} className="grid gap-3 border-b border-ink/[0.06] px-5 py-4 last:border-0 dark:border-white/[0.08] md:grid-cols-[1.5fr_1.4fr_1.2fr_1fr_auto] md:items-center md:gap-4"><span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{item[0].charAt(0)}</span><span><span className="block text-sm font-semibold">{item[0]}</span><span className="block text-xs text-graphite">{item[2]}</span></span></span><span className="text-sm text-graphite">{item[1]}</span><span className="text-xs text-graphite">{item[4]}</span><Status value={item[3] === 'Invited' ? 'Pending' : 'Active'} /><span className="flex gap-2"><button onClick={() => onOperator(item[0])} className="rounded-xl border border-ink/10 px-3 py-2 text-xs font-semibold dark:border-white/10">View</button><button onClick={() => onNotify(`${item[0]}'s sessions revoked`)} className="rounded-xl bg-ink/[0.05] p-2 dark:bg-white/[0.08]" title="Revoke sessions"><RotateCcw className="h-3.5 w-3.5" /></button></span></div>)}</div></> }

function PermissionsView({ onNotify }: { onNotify: (message: string) => void }) { const roles = [['Founder / Super Admin', 'Full platform access', '4 operators'], ['Platform Admin', 'Schools, requests, audit logs', '2 operators'], ['Operations Operator', 'Schools and request reviews', '3 operators'], ['Support Operator', 'Support requests and school context', '5 operators']]; return <><SectionHeader eyebrow="Access governance" title="Roles & permissions" description="A clear permission model for safe delegation across the Nom Cloud operations team." /><div className="grid gap-4">{roles.map((role, index) => <div key={role[0]} className="flex flex-col gap-4 rounded-3xl border border-ink/[0.07] bg-white p-5 shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04] sm:flex-row sm:items-center"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${index === 0 ? 'bg-brand text-white' : 'bg-ink/[0.06] text-ink dark:bg-white/[0.1] dark:text-white'}`}><Shield className="h-5 w-5" /></span><span className="flex-1"><span className="block font-semibold">{role[0]}</span><span className="mt-1 block text-sm text-graphite">{role[1]} · {role[2]}</span></span><button onClick={() => onNotify(`Editing ${role[0]}`)} className="rounded-xl border border-ink/10 px-3 py-2 text-xs font-semibold dark:border-white/10">Edit role</button></div>)}</div></> }

function AuditView({ notify, rows }: { notify: (message: string) => void; rows: string[][] }) {
  const [query, setQuery] = useState('')
  const visible = rows.filter((row) => row.join(' ').toLowerCase().includes(query.toLowerCase()))
  return <><SectionHeader eyebrow="Traceability" title="Audit logs" description="A tamper-evident record of important actions across the platform and operator accounts." action={<Button variant="outline" size="sm" onClick={() => notify('Audit log export prepared')}><ArrowUpRight className="h-4 w-4" /> Export logs</Button>} /><div className="mb-5 flex gap-3"><div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search action, operator, or target…" className="input pl-10" /></div></div><div className="overflow-hidden rounded-3xl border border-ink/[0.07] bg-white p-5 shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><div className="hidden grid-cols-[1.3fr_1fr_1.5fr_1fr_auto] gap-4 border-b border-ink/[0.06] pb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-graphite dark:border-white/[0.08] sm:grid"><span>Action</span><span>Operator</span><span>Target</span><span>Date</span><span>Status</span></div><AuditTable rows={visible} /></div></>
}

function SecurityView({ onNotify }: { onNotify: (message: string) => void }) {
  const events = [['Suspicious login detected', 'Unknown Chrome device · Addis Ababa', '12 min ago', 'Review'], ['Password changed', 'Nadia Warsame · Support Operator', 'Yesterday, 16:18', 'Verified'], ['Failed login attempt', 'Yusuf Ahmed · 3 attempts', 'Sep 22, 09:40', 'Blocked']]
  return <><SectionHeader eyebrow="Operator protection" title="Security center" description="Review account protection, active sessions, and signals that need a founder's attention." action={<Button variant="outline" size="sm" onClick={() => onNotify('All other operator sessions revoked')}><RotateCcw className="h-4 w-4" /> Revoke other sessions</Button>} /><div className="grid gap-4 md:grid-cols-3">{[['MFA coverage', '3 / 4', 'One operator needs setup'], ['Active sessions', '7', 'Across 4 operators'], ['Failed attempts', '3', 'Blocked this week']].map((item) => <div key={item[0]} className="rounded-2xl border border-ink/[0.07] bg-white p-5 shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><p className="text-sm text-graphite">{item[0]}</p><p className="mt-3 text-2xl font-semibold">{item[1]}</p><p className="mt-1 text-xs text-graphite">{item[2]}</p></div>)}</div><div className="mt-6 overflow-hidden rounded-3xl border border-ink/[0.07] bg-white shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><div className="border-b border-ink/[0.06] px-5 py-4 dark:border-white/[0.08]"><h2 className="font-semibold">Security events</h2><p className="mt-1 text-xs text-graphite">Security records are retained and cannot be edited by operators.</p></div>{events.map((event) => <div key={event[0]} className="flex flex-col gap-3 border-b border-ink/[0.06] px-5 py-4 last:border-0 dark:border-white/[0.08] sm:flex-row sm:items-center"><span className={`rounded-xl p-2 ${event[3] === 'Review' ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'}`}><Shield className="h-4 w-4" /></span><span className="flex-1"><span className="block text-sm font-semibold">{event[0]}</span><span className="block text-xs text-graphite">{event[1]}</span></span><span className="text-xs text-graphite">{event[2]}</span><button onClick={() => onNotify(`${event[0]} opened`)} className="rounded-xl border border-ink/10 px-3 py-2 text-xs font-semibold dark:border-white/10">Review</button></div>)}</div></>
}

function AnalyticsView() {
  const plans = [['Growth', '112 schools', '45%'], ['Starter', '86 schools', '35%'], ['Scale', '50 schools', '20%']]
  return <><SectionHeader eyebrow="Nom Cloud network" title="Platform analytics" description="A network-wide view of adoption, activity, and subscription distribution." action={<Button variant="outline" size="sm"><Download className="h-4 w-4" /> Export analytics</Button>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Schools', '248', '+12 this month'], ['Students', '48,290', '+8.4%'], ['Teachers', '3,184', '+5.2%'], ['Requests', '86', '24 resolved this week']].map((item) => <div key={item[0]} className="rounded-2xl border border-ink/[0.07] bg-white p-5 shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><p className="text-sm text-graphite">{item[0]}</p><p className="mt-3 text-3xl font-semibold">{item[1]}</p><p className="mt-1 text-xs font-semibold text-emerald-600">{item[2]}</p></div>)}</div><div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]"><div className="rounded-3xl border border-ink/[0.07] bg-white p-5 shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><h2 className="font-semibold">Platform activity</h2><div className="mt-6 flex h-40 items-end gap-2">{[42, 58, 51, 76, 64, 82, 91, 72, 88, 96, 84, 100].map((height, index) => <div key={index} className="flex-1 rounded-t-lg bg-brand/70" style={{ height: `${height}%` }} title={`${height} activity units`} />)}</div><div className="mt-3 flex justify-between text-[10px] text-graphite"><span>Sep 13</span><span>Sep 24</span></div></div><div className="rounded-3xl border border-ink/[0.07] bg-white p-5 shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><h2 className="font-semibold">Subscription distribution</h2><div className="mt-5 space-y-4">{plans.map((item) => <div key={item[0]}><div className="flex justify-between text-sm"><span className="font-medium">{item[0]}</span><span className="text-graphite">{item[1]}</span></div><div className="mt-2 h-2 rounded-full bg-ink/[0.07] dark:bg-white/[0.08]"><div className="h-2 rounded-full bg-brand" style={{ width: item[2] }} /></div></div>)}</div></div></div></>
}

function OperatorModal({ operator, onClose, onAction }: { operator: string | null; onClose: () => void; onAction: (message: string) => void }) {
  return <Modal open={Boolean(operator)} onClose={onClose} size="lg" title={operator ?? ''} description="Operator profile, permissions, activity, and security history." footer={operator ? <><Button variant="outline" onClick={() => onAction('Password reset email sent')}>Reset password</Button><Button variant="danger" onClick={() => onAction(`${operator} suspension requires confirmation`)}>Suspend operator</Button></> : null}>{operator && <div className="space-y-5"><div className="flex items-center gap-4 rounded-2xl bg-ink/[0.035] p-4 dark:bg-white/[0.05]"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">{operator.charAt(0)}</span><div><p className="font-semibold">{operator}</p><p className="text-sm text-graphite">Platform Admin · Active</p></div></div><div className="grid gap-4 sm:grid-cols-2">{[['Permissions', 'Schools, requests, audit logs'], ['Created', 'May 12, 2026'], ['Last active', 'Today, 07:44'], ['Sessions', '2 active devices']].map((item) => <div key={item[0]} className="rounded-2xl border border-ink/10 p-4 dark:border-white/10"><p className="text-xs text-graphite">{item[0]}</p><p className="mt-2 text-sm font-semibold">{item[1]}</p></div>)}</div><div className="rounded-2xl border border-ink/10 p-4 dark:border-white/10"><p className="font-semibold">Recent actions</p><p className="mt-2 text-sm text-graphite">Reviewed REQ-1038, changed Amina Yusuf's permissions, and approved one school.</p></div></div>}</Modal>
}

function AuditTable({ rows }: { rows: string[][] }) { return <div className="mt-5 divide-y divide-ink/[0.06] dark:divide-white/[0.08]">{rows.map((row) => <div key={`${row[0]}-${row[3]}`} className="grid gap-2 py-4 text-sm sm:grid-cols-[1.3fr_1fr_1.5fr_1fr_auto] sm:items-center"><span className="flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full bg-emerald-500" />{row[0]}</span><span className="text-graphite">{row[1]}</span><span className="text-graphite">{row[2]}</span><span className="text-xs text-graphite">{row[3]}</span><span className="text-xs font-semibold text-emerald-600">{row[4]}</span></div>)}</div> }

function MaintenanceView({ onNotify }: { onNotify: (message: string) => void }) { const flags: Array<[string, string, boolean]> = [['Online payments', 'All schools', true], ['SMS notifications', 'Selected schools', true], ['New parent dashboard', 'Test schools', false], ['AI features', 'Disabled globally', false]]; return <><SectionHeader eyebrow="Reliability center" title="Maintenance & system health" description="Monitor platform services, coordinate maintenance windows, and control staged feature rollouts." action={<Button variant="accent" size="sm" onClick={() => onNotify('Maintenance notice composer opened')}><Wrench className="h-4 w-4" /> New notice</Button>} /><div className="grid gap-4 md:grid-cols-3">{[['Authentication', 'Operational', '99.99%'], ['Database', 'Operational', '99.98%'], ['Notifications', 'Operational', '99.97%'], ['Payments', 'Operational', '99.95%'], ['File storage', 'Operational', '99.97%'], ['School dashboards', 'Operational', '99.98%']].map((item) => <div key={item[0]} className="rounded-2xl border border-ink/[0.07] bg-white p-5 shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><div className="flex items-center gap-2 text-emerald-600"><span className="h-2 w-2 rounded-full bg-current" /><span className="text-xs font-bold uppercase tracking-wider">{item[1]}</span></div><p className="mt-4 font-semibold">{item[0]}</p><p className="mt-1 text-lg font-semibold">{item[2]}</p></div>)}</div><div className="mt-6 grid gap-6 lg:grid-cols-2"><div className="rounded-3xl border border-ink/[0.07] bg-white p-5 shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><h2 className="font-semibold">Upcoming maintenance</h2><div className="mt-4 flex items-center gap-4 rounded-2xl bg-amber-500/[0.08] p-4"><Clock3 className="h-5 w-5 text-amber-600" /><div className="flex-1"><p className="text-sm font-semibold">Database optimization window</p><p className="mt-1 text-xs text-graphite">Sunday, Sep 27 · 02:00–02:30 UTC · No expected downtime</p></div><button onClick={() => onNotify('Maintenance notice details opened')} className="text-xs font-semibold text-brand">View details</button></div></div><div className="rounded-3xl border border-ink/[0.07] bg-white p-5 shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Feature flags</h2><p className="mt-1 text-xs text-graphite">Mock controls ready for backend rollout rules.</p></div><Flag className="h-5 w-5 text-brand" /></div><div className="mt-4 space-y-3">{flags.map((flag) => <div key={flag[0]} className="flex items-center gap-3"><span className={`h-2 w-2 rounded-full ${flag[2] ? 'bg-emerald-500' : 'bg-graphite/40'}`} /><span className="flex-1"><span className="block text-sm font-semibold">{flag[0]}</span><span className="block text-xs text-graphite">{flag[1]}</span></span><button onClick={() => onNotify(`${flag[0]} flag change queued for audit review`)} className={`rounded-full px-3 py-1 text-xs font-semibold ${flag[2] ? 'bg-emerald-500/10 text-emerald-700' : 'bg-ink/[0.06] text-graphite dark:bg-white/[0.08]'}`}>{flag[2] ? 'On' : 'Off'}</button></div>)}</div></div></div></> }

function SettingsView({ onNotify, onEmergency }: { onNotify: (message: string) => void; onEmergency: () => void }) { return <><SectionHeader eyebrow="Your account" title="Profile & settings" description="Manage your operator identity, security preferences, and workspace defaults." /><div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]"><div className="rounded-3xl border border-ink/[0.07] bg-ink p-6 text-white shadow-soft"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-2xl font-bold">L</div><h2 className="mt-5 text-xl font-semibold">Leila Hassan</h2><p className="mt-1 text-sm text-white/55">Founder / Super Admin</p><div className="mt-8 space-y-3 text-sm text-white/70"><p className="flex items-center gap-2"><LockKeyhole className="h-4 w-4" /> Two-factor authentication enabled</p><p className="flex items-center gap-2"><Activity className="h-4 w-4" /> Last login today at 08:01</p></div></div><div className="rounded-3xl border border-ink/[0.07] bg-white p-6 shadow-soft dark:border-white/[0.08] dark:bg-white/[0.04]"><h2 className="font-semibold">Personal information</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-graphite">First name<input className="input mt-2" defaultValue="Leila" /></label><label className="text-xs font-semibold text-graphite">Last name<input className="input mt-2" defaultValue="Hassan" /></label><label className="text-xs font-semibold text-graphite sm:col-span-2">Email<input className="input mt-2" defaultValue="leila@nom.cloud" /></label><label className="text-xs font-semibold text-graphite">Phone<input className="input mt-2" defaultValue="+252 61 440 8821" /></label><label className="text-xs font-semibold text-graphite">Role<input className="input mt-2" value="Founder / Super Admin" readOnly /></label></div><div className="mt-6 flex flex-wrap gap-3"><Button variant="accent" onClick={() => onNotify('Profile changes saved')}>Save changes</Button><Button variant="outline" onClick={() => onNotify('Security settings opened')}><Shield className="h-4 w-4" /> Security</Button><Button variant="danger" onClick={onEmergency}><Ban className="h-4 w-4" /> Emergency controls</Button></div></div></div></> }

function SchoolModal({ school, onClose, onAction, onStatusChange }: { school: School | null; onClose: () => void; onAction: (message: string) => void; onStatusChange: (id: string, status: SchoolStatus, message: string) => void }) {
  const [tab, setTab] = useState('Overview')
  useEffect(() => { if (school) setTab('Overview') }, [school])
  return <Modal open={Boolean(school)} onClose={onClose} size="xl" title={school?.name} description={school ? `${school.id} · ${school.location}` : ''} footer={school ? <><Button variant="outline" onClick={() => onAction('School marked for review')}>Request changes</Button>{school.status === 'Suspended' ? <Button variant="accent" onClick={() => onStatusChange(school.id, 'Active', 'School reactivated')}>Reactivate school</Button> : <Button variant="danger" onClick={() => onStatusChange(school.id, 'Suspended', 'School suspended')}>Suspend school</Button>}{school.status === 'Pending' && <Button variant="accent" onClick={() => onStatusChange(school.id, 'Active', 'School approved')}>Approve school</Button>}</> : null}>{school && <><div className="flex gap-1 overflow-x-auto border-b border-ink/[0.07] pb-3 dark:border-white/[0.08]">{['Overview', 'School Information', 'Users', 'Activity', 'Requests', 'Documents', 'Billing', 'Permissions', 'Audit History'].map((item) => <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${tab === item ? 'bg-ink text-white dark:bg-white dark:text-ink' : 'text-graphite hover:bg-ink/[0.05]'}`}>{item}</button>)}</div>{tab === 'Overview' && <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2 rounded-2xl border border-brand/15 bg-brand/[0.05] p-4"><p className="text-xs font-semibold uppercase tracking-wider text-brand">Primary contact</p><p className="mt-2 text-sm font-semibold">{school.admin}</p><p className="mt-1 text-xs text-graphite">{school.email} · {school.phone}</p></div>{[['Account status', <Status value={school.status} />], ['Subscription', school.plan], ['Students', school.students.toLocaleString()], ['Teachers', school.teachers], ['Registered', school.registered], ['Last activity', school.activity]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-ink/[0.035] p-4 dark:bg-white/[0.05]"><p className="text-xs text-graphite">{label}</p><div className="mt-2 text-sm font-semibold">{value}</div></div>)}<div className="sm:col-span-2 rounded-2xl border border-ink/10 p-4 dark:border-white/10"><div className="flex items-center justify-between"><p className="font-semibold">Internal operator note</p><span className="text-[10px] font-bold uppercase tracking-wider text-brand">Private</span></div><p className="mt-2 text-sm text-graphite">School requested an administrator change. Waiting for verification documents.</p></div></div>}{tab === 'Activity' && <div className="mt-6 space-y-5">{schoolTimeline.map((event) => <div key={event[0]} className="relative flex gap-4 pl-1"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand ring-4 ring-brand/10" /><div><p className="text-xs font-semibold text-graphite">{event[0]}</p><p className="mt-1 text-sm font-semibold">{event[1]}</p><p className="mt-1 text-xs leading-5 text-graphite">{event[2]}</p></div></div>)}</div>}{tab === 'Documents' && <div className="mt-6 space-y-3">{['Organization registration.pdf', 'Administrator identity.pdf', 'School verification photos.zip'].map((document) => <div key={document} className="flex items-center gap-3 rounded-2xl border border-ink/10 p-4 dark:border-white/10"><FileText className="h-4 w-4 text-brand" /><span className="flex-1 text-sm font-semibold">{document}<span className="block text-xs font-normal text-graphite">Uploaded Sep 18, 2026 · Verification record</span></span><button onClick={() => onAction(`${document} preview opened`)} className="rounded-xl border border-ink/10 px-3 py-2 text-xs font-semibold dark:border-white/10">Preview</button></div>)}</div>}{tab === 'Billing' && <div className="mt-6 grid gap-4 sm:grid-cols-2">{[['Current plan', school.plan], ['Renewal date', 'Oct 08, 2026'], ['Billing status', 'Paid'], ['Usage', '72% of plan limits']].map(([label, value]) => <div key={label} className="rounded-2xl bg-ink/[0.035] p-4 dark:bg-white/[0.05]"><p className="text-xs text-graphite">{label}</p><p className="mt-2 text-sm font-semibold">{value}</p></div>)}</div>}{tab !== 'Overview' && tab !== 'Activity' && tab !== 'Documents' && tab !== 'Billing' && <div className="mt-6 rounded-2xl bg-ink/[0.035] p-6 text-sm text-graphite dark:bg-white/[0.05]"><p className="font-semibold text-ink dark:text-white">{tab}</p><p className="mt-2">Mock {tab.toLowerCase()} for {school.name} is ready for backend connection.</p></div>}</>}</Modal>
}

function RequestModal({ request, onClose, onAction, onDecision, onSchool }: { request: Request | null; onClose: () => void; onAction: (message: string) => void; onDecision: (id: string, status: RequestStatus, message: string) => void; onSchool: (name: string) => void }) {
  return <Modal open={Boolean(request)} onClose={onClose} size="lg" title={request?.type} description={request ? `${request.id} · ${request.school}` : ''} footer={request ? <><Button variant="outline" onClick={() => onDecision(request.id, 'In review', 'Changes requested from school')}>Request changes</Button><Button variant="danger" onClick={() => onDecision(request.id, 'Resolved', 'Request rejected')}>Reject</Button><Button variant="accent" onClick={() => onDecision(request.id, 'Resolved', 'Request approved')}>Approve</Button></> : null}>{request && <div className="space-y-5"><div className="rounded-2xl border border-brand/15 bg-brand/[0.06] p-4"><p className="text-sm font-semibold">{request.summary}</p><p className="mt-2 text-xs text-graphite">Submitted by {request.submittedBy} · {request.submitted}</p></div><div className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-semibold text-graphite">School context</p><button onClick={() => onSchool(request.school)} className="mt-2 flex w-full items-center justify-between rounded-2xl border border-ink/10 p-4 text-left text-sm font-semibold hover:bg-ink/[0.03] dark:border-white/10 dark:hover:bg-white/[0.05]">Open {request.school}<Eye className="h-4 w-4 text-graphite" /></button></div><div><p className="text-xs font-semibold text-graphite">Current status</p><div className="mt-2 rounded-2xl border border-ink/10 p-4 dark:border-white/10"><Status value={request.status} /></div></div></div><div><p className="text-xs font-semibold text-graphite">Operator notes</p><textarea placeholder="Add context for the next operator…" className="input mt-2 min-h-24 resize-none" /></div><div className="rounded-2xl bg-ink/[0.035] p-4 text-sm dark:bg-white/[0.05]"><p className="font-semibold">Previous actions</p><p className="mt-2 text-xs text-graphite">No previous actions recorded. All decisions will be added to the audit log.</p></div></div>}</Modal>
}
