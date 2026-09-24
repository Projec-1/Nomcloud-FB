import {
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarCheck,
  Check,
  LayoutGrid,
  MessageSquare,
  Settings,
  Users,
} from 'lucide-react'

const navItems = [
  { icon: LayoutGrid, label: 'Overview', active: true },
  { icon: Users, label: 'Students' },
  { icon: CalendarCheck, label: 'Attendance' },
  { icon: BookOpen, label: 'Academics' },
  { icon: MessageSquare, label: 'Messages' },
]

const statMetrics = [
  { label: 'Students', value: '1,248' },
  { label: 'Teachers', value: '68' },
  { label: 'Attendance', value: '94.8%' },
  { label: 'Outstanding fees', value: '$12,480' },
]

const attendanceBars = [40, 52, 47, 60, 56, 68, 64, 75, 82, 78, 88, 97]

const barColors = [
  '#E9F2FF',
  '#DCEBFF',
  '#CFE4FF',
  '#C2DDFF',
  '#B5D6FF',
  '#A8CFFF',
  '#9BC8FF',
  '#8EC1FF',
  '#81BAFF',
  '#74B3FF',
  '#67ACFF',
  '#007AFF',
]

const recentActivity = [
  { title: 'Attendance submitted', status: 'success' as const },
  { title: 'New student enrolled', status: 'neutral' as const },
  { title: 'Grades published', status: 'neutral' as const },
  { title: 'Payment recorded', status: 'neutral' as const },
]

export default function AdminDashboardHeroMock() {
  return (
    <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_40px_90px_-20px_rgba(15,23,42,0.18)]">
      <div className="flex h-[600px] text-[#1D1D1F]">
        {/* Sidebar */}
        <aside className="hidden w-[200px] flex-shrink-0 flex-col border-r border-[#ECECEC] px-4 py-6 sm:flex">
          <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">School</div>

          <nav className="mt-5 space-y-1">
            {navItems.map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-colors ${
                  active ? 'bg-[#E6F0FF] font-medium text-[#007AFF]' : 'text-[#6B7280] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]'
                }`}
              >
                {active && <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[#007AFF]" />}
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </div>
            ))}
          </nav>

          <div className="mt-auto">
            <div className="relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] text-[#6B7280] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#007AFF]" />
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 px-6 py-6 sm:px-10">
          {/* App header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/logo-512.png" alt="Nom Cloud" className="h-8 w-8 object-contain" />
              <span className="text-[15px] font-semibold tracking-tight text-[#1D1D1F]">Nom Cloud</span>
              <span className="text-[15px] text-[#9CA3AF]">/</span>
              <span className="text-[15px] text-[#9CA3AF]">Admin workspace</span>
            </div>
            <div className="flex items-center gap-4">
              <Bell className="h-5 w-5 text-[#6B7280]" />
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#007AFF] text-[12px] font-semibold text-white">AM</div>
                <span className="absolute -bottom-1.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#007AFF]" />
              </div>
            </div>
          </div>

          {/* Greeting */}
          <div className="mt-10 flex items-start justify-between">
            <div className="min-w-0 flex-1 text-center">
              <p className="text-[13px] text-[#9CA3AF]">Tuesday, 18 June 2024</p>
              <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.02em] text-[#1D1D1F] sm:text-[40px]">Good morning, Ahmed.</h1>
            </div>
            <button
              type="button"
              className="ml-6 flex-shrink-0 rounded-lg bg-[#007AFF] px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_20px_rgba(0,122,255,0.25)]"
            >
              View report
            </button>
          </div>

          {/* Divider */}
          <div className="mt-8 border-t border-[#ECECEC]" />

          {/* Stats */}
          <div className="mt-8 grid grid-cols-2 gap-y-8 text-center sm:grid-cols-4 sm:divide-x sm:divide-[#F2F2F2]">
            {statMetrics.map((metric) => (
              <div key={metric.label}>
                <div className="text-[13px] font-medium text-[#9CA3AF]">{metric.label}</div>
                <div className="mt-1.5 text-[30px] font-semibold tracking-[-0.02em] text-[#1D1D1F]">{metric.value}</div>
              </div>
            ))}
          </div>

          {/* Chart + activity */}
          <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
            {/* Attendance chart */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-[#1D1D1F]">Attendance this term</h3>
                <span className="flex items-center gap-1 text-[13px] font-medium text-[#007AFF]">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  +4.8%
                </span>
              </div>
              <div className="mt-6 flex h-[170px] items-end gap-2">
                {attendanceBars.map((value, index) => (
                  <div
                    key={index}
                    className="flex-1 rounded-t-[6px]"
                    style={{ height: `${value}%`, backgroundColor: barColors[index], animation: `rise 850ms ${index * 80}ms ease-out both` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[12px] text-[#9CA3AF]">
                <span>Week 01</span>
                <span>Week 12</span>
              </div>
            </div>

            {/* Recent activity */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-[#1D1D1F]">Recent activity</h3>
                <ArrowUpRight className="h-4 w-4 text-[#007AFF]" />
              </div>
              <div className="mt-3 divide-y divide-[#F0F0F0]">
                {recentActivity.map((item) => (
                  <div key={item.title} className="flex items-center gap-3 py-3">
                    {item.status === 'success' ? (
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#34A853] text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#D1D5DB]">
                        <span className="h-1 w-1 rounded-full bg-[#9CA3AF]" />
                      </span>
                    )}
                    <span className="text-[14px] text-[#374151]">{item.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
      <style>{`
        @keyframes rise {
          0% { transform: scaleY(0.6); opacity: 0; }
          100% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
