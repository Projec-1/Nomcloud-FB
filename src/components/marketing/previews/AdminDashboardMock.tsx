import {
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  LayoutGrid,
  MessageSquare,
  School,
  Sparkles,
  Users,
} from 'lucide-react'
import BrowserFrame from '@/components/marketing/BrowserFrame'

const navItems = [
  { icon: LayoutGrid, label: 'Overview', active: true },
  { icon: Users, label: 'Students' },
  { icon: BookOpen, label: 'Teachers' },
  { icon: CalendarDays, label: 'Attendance' },
  { icon: School, label: 'Academics' },
  { icon: MessageSquare, label: 'Messages' },
]

const statCards = [
  { label: 'Students', value: '1,248', tone: 'from-[#0A7CFF] to-[#72B5FF]' },
  { label: 'Teachers', value: '68', tone: 'from-[#6B7CFF] to-[#A1A9FF]' },
  { label: 'Attendance', value: '94.8%', tone: 'from-[#18B37D] to-[#5FD4A5]' },
  { label: 'Fees', value: '$12,480', tone: 'from-[#FF9D5C] to-[#FFC38C]' },
]

const attendanceBars = [42, 54, 48, 66, 58, 72, 68, 80, 88, 74, 90, 97]

const notifications = [
  { title: 'Attendance submitted', time: '2 min ago', status: 'success' },
  { title: 'New student enrolled', time: '17 min ago', status: 'neutral' },
  { title: 'Grades published', time: '1 hr ago', status: 'success' },
  { title: 'Payment recorded', time: '2 hrs ago', status: 'success' },
]

const classes = [
  { name: 'Math 6A', time: '08:30', room: 'Room 12' },
  { name: 'Science Lab', time: '10:15', room: 'Lab 4' },
  { name: 'English Club', time: '13:00', room: 'Library' },
]

export default function AdminDashboardMock() {
  return (
    <BrowserFrame className="relative overflow-hidden shadow-[0_30px_90px_rgba(15,23,42,0.12)]">
      <div className="relative bg-[radial-gradient(circle_at_top_left,_rgba(0,113,227,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(17,24,39,0.08),_transparent_30%),#F5F7FA]">
        <div className="flex h-[560px] bg-transparent text-[#171A1F]">
          <aside className="hidden w-[220px] border-r border-[#E7ECF2] bg-white/60 px-4 py-5 backdrop-blur-xl sm:block">
            <div className="mb-8 flex items-center gap-3 px-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0A7CFF] text-sm font-semibold text-white shadow-[0_12px_24px_rgba(10,124,255,0.35)]">
                N
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#77818B]">School</div>
                <div className="text-[15px] font-semibold text-[#121A24]">Nom Cloud</div>
              </div>
            </div>

            <nav className="space-y-1.5">
              {navItems.map(({ icon: Icon, label, active }) => (
                <button
                  key={label}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[14px] transition-all duration-300 ${
                    active ? 'bg-[#EAF2FF] text-[#111827] shadow-[inset_0_0_0_1px_rgba(10,124,255,0.06)]' : 'text-[#4F5867] hover:bg-white/80'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-8 rounded-2xl border border-[#E7ECF2] bg-white/80 p-3 shadow-[0_12px_20px_rgba(15,23,42,0.04)]">
              <div className="mb-2 flex items-center justify-between text-[12px] text-[#5F6977]">
                <span>System status</span>
                <span className="h-2.5 w-2.5 rounded-full bg-[#2ACD89]" />
              </div>
              <div className="text-[22px] font-semibold tracking-[-0.05em] text-[#121A24]">99.9%</div>
            </div>
          </aside>

          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4 pb-5">
              <div className="hidden items-center gap-2 rounded-full border border-[#E2E8F0] bg-white/80 px-3 py-1.5 text-[11px] font-medium text-[#5F6977] shadow-sm sm:flex">
                <Sparkles className="h-3.5 w-3.5 text-[#0A7CFF]" />
                Live overview
              </div>
              <div className="text-[12px] text-[#697787]">Tuesday, 18 June 2024</div>
              <div className="flex items-center gap-2">
                <button type="button" className="hidden rounded-full border border-[#DEE5EF] bg-white/80 px-3.5 py-2 text-[12px] font-medium text-[#1F2937] shadow-sm sm:inline-flex">
                  <Bell className="mr-2 h-3.5 w-3.5" />
                  4 alerts
                </button>
                <button type="button" className="rounded-full bg-[#0A7CFF] px-4 py-2.5 text-[12px] font-medium text-white shadow-[0_12px_24px_rgba(10,124,255,0.32)]">
                  View report
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-6 border-b border-[#E7ECF2] pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7A8190]">Operations overview</p>
                <h1 className="mt-3 text-[32px] font-semibold leading-none tracking-[-0.07em] text-[#111827] sm:text-[44px] lg:text-[56px]">
                  Good morning, Ahmed.
                </h1>
              </div>

              <div className="rounded-[24px] border border-[#E2E8F0] bg-white/80 px-4 py-3 shadow-[0_18px_35px_rgba(15,23,42,0.06)] backdrop-blur-xl">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">Attendance</div>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-[28px] font-semibold tracking-[-0.06em] text-[#111827]">94.8%</span>
                  <span className="mb-1 text-[12px] font-medium text-[#1DB26A]">+4.8%</span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {statCards.map((stat, index) => (
                <div
                  key={stat.label}
                  className="rounded-[24px] border border-[#E9EEF5] bg-white/85 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.04)] transition-all duration-500 hover:-translate-y-1"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[#687485]">{stat.label}</span>
                    <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${stat.tone}`} />
                  </div>
                  <div className="mt-4 text-[30px] font-semibold tracking-[-0.06em] text-[#101827]">{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[1.7fr_0.9fr]">
              <div className="rounded-[28px] border border-[#E9EEF5] bg-white/90 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.06)] md:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] uppercase tracking-[0.2em] text-[#7B8290]">Attendance this term</p>
                    <p className="mt-1 text-[24px] font-semibold tracking-[-0.06em] text-[#101827]">82.4% average</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-[#EAF8F1] px-2.5 py-1.5 text-[11px] font-semibold text-[#17A66B]">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    +4.8%
                  </div>
                </div>

                <div className="mt-5 flex h-[216px] items-end gap-2 rounded-[22px] bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF3F8_100%)] px-3 pb-3 pt-4">
                  {attendanceBars.map((value, index) => (
                    <div key={index} className="flex flex-1 flex-col items-center justify-end gap-2">
                      <div
                        className={`w-full rounded-t-[10px] bg-gradient-to-t ${index >= 9 ? 'from-[#0A7CFF] to-[#7FC3FF]' : 'from-[#B9DBFF] to-[#7BB9FF]'} shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-all duration-700`}
                        style={{ height: `${value}%`, animation: `rise 850ms ${index * 80}ms ease-out both` }}
                      />
                      {index === 0 || index === attendanceBars.length - 1 ? (
                        <span className="text-[10px] text-[#6F7C8B]">{index === 0 ? 'Week 01' : 'Week 12'}</span>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[#F7FAFF] p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#728094]">Present</div>
                    <div className="mt-2 text-[22px] font-semibold tracking-[-0.05em] text-[#101827]">831</div>
                  </div>
                  <div className="rounded-2xl bg-[#F4F9F5] p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#728094]">Excused</div>
                    <div className="mt-2 text-[22px] font-semibold tracking-[-0.05em] text-[#101827]">92</div>
                  </div>
                  <div className="rounded-2xl bg-[#FFF7F2] p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#728094]">Late</div>
                    <div className="mt-2 text-[22px] font-semibold tracking-[-0.05em] text-[#101827]">26</div>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-[28px] border border-[#E9EEF5] bg-white/90 p-4 shadow-[0_18px_35px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] uppercase tracking-[0.2em] text-[#7A8190]">Recent activity</p>
                    <ArrowUpRight className="h-4 w-4 text-[#788294]" />
                  </div>

                  <div className="mt-4 space-y-3">
                    {notifications.map(({ title, time, status }) => (
                      <div key={title} className="flex items-center justify-between rounded-2xl bg-[#F7F9FC] px-3 py-2.5 transition-transform duration-300 hover:-translate-y-0.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full ${
                              status === 'success' ? 'bg-[#EAF8F1] text-[#1CB26C]' : 'bg-[#EEF3F9] text-[#5B697A]'
                            }`}
                          >
                            {status === 'success' ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3 fill-current" />}
                          </span>
                          <div>
                            <div className="text-[13px] font-medium text-[#171A1F]">{title}</div>
                            <div className="text-[11px] text-[#748094]">{time}</div>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-[#8A94A4]" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#E9EEF5] bg-[#101827] p-4 text-white shadow-[0_18px_35px_rgba(15,23,42,0.16)]">
                  <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.18em] text-white/60">
                    <span>Today</span>
                    <span>3 classes</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {classes.map((item) => (
                      <div key={item.name} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[15px] font-medium text-white">{item.name}</div>
                            <div className="mt-1 text-[12px] text-white/65">{item.room}</div>
                          </div>
                          <div className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-medium text-white/80">{item.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2 text-[12px] text-white/75">
                    <span className="inline-flex items-center gap-2"><Clock3 className="h-3.5 w-3.5" /> Next check-in</span>
                    <span className="font-medium text-white">09:25</span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      <style>{`
        @keyframes rise {
          0% { transform: scaleY(0.6); opacity: 0; }
          100% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </BrowserFrame>
  )
}
