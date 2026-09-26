import { ArrowUpRight, Bell, BookOpen, CalendarDots as CalendarDays, Check, CaretRight as ChevronRight, Circle, Clock as Clock3, SquaresFour as LayoutGrid, ChatText as MessageSquare, Buildings as School, Info, Users } from '@phosphor-icons/react'
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
  { label: 'Students', value: '1,248' },
  { label: 'Teachers', value: '68' },
  { label: 'Attendance', value: '94.8%' },
  { label: 'Fees', value: '$12,480' },
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
    <BrowserFrame className="relative overflow-hidden">
      <div className="relative bg-mist dark:bg-[#171917]">
        <div className="flex h-[560px] text-ink">
          <aside className="hidden w-[220px] border-r border-[#E7ECF2] bg-white/60 px-4 py-5 backdrop-blur-xl sm:block">
            <div className="mb-8 flex items-center gap-3 px-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-white">
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
                    active ? 'bg-brand/10 text-brand' : 'text-graphite hover:bg-ink/5'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-8 rounded-xl border border-ink/10 bg-white p-3 dark:border-white/10 dark:bg-[#202320]">
              <div className="mb-2 flex items-center justify-between text-[12px] text-[#5F6977]">
                <span>System status</span>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
              </div>
              <div className="text-[22px] font-semibold tracking-[-0.05em] text-[#121A24]">99.9%</div>
            </div>
          </aside>

          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4 pb-5">
              <div className="hidden items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-1.5 text-[11px] font-medium text-graphite sm:flex">
                <Info className="h-3.5 w-3.5 text-brand" />
                Illustrative data
              </div>
              <div className="text-[12px] text-[#697787]">Tuesday, 18 June 2024</div>
              <div className="flex items-center gap-2">
                <button type="button" className="hidden rounded-xl border border-ink/10 bg-white px-3.5 py-2 text-[12px] font-medium text-ink sm:inline-flex">
                  <Bell className="mr-2 h-3.5 w-3.5" />
                  4 alerts
                </button>
                <button type="button" className="rounded-xl bg-brand px-4 py-2.5 text-[12px] font-medium text-white">
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

              <div className="rounded-xl border border-ink/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#202320]">
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

                <div className="mt-5 flex h-[216px] items-end gap-2 rounded-xl bg-mist px-3 pb-3 pt-4 dark:bg-[#292d29]">
                  {attendanceBars.map((value, index) => (
                    <div key={index} className="flex flex-1 flex-col items-center justify-end gap-2">
                      <div
                        className={`w-full rounded-t-md ${index >= 9 ? 'bg-brand' : 'bg-brand/30'}`}
                        style={{ height: `${value}%` }}
                      />
                      {index === 0 || index === attendanceBars.length - 1 ? (
                        <span className="text-[10px] text-[#6F7C8B]">{index === 0 ? 'Week 01' : 'Week 12'}</span>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-mist p-3 dark:bg-[#292d29]">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#728094]">Present</div>
                    <div className="mt-2 text-[22px] font-semibold tracking-[-0.05em] text-[#101827]">831</div>
                  </div>
                  <div className="rounded-xl bg-mist p-3 dark:bg-[#292d29]">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#728094]">Excused</div>
                    <div className="mt-2 text-[22px] font-semibold tracking-[-0.05em] text-[#101827]">92</div>
                  </div>
                  <div className="rounded-xl bg-mist p-3 dark:bg-[#292d29]">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#728094]">Late</div>
                    <div className="mt-2 text-[22px] font-semibold tracking-[-0.05em] text-[#101827]">26</div>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-xl border border-ink/10 bg-white p-4 dark:border-white/10 dark:bg-[#202320]">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] uppercase tracking-[0.2em] text-[#7A8190]">Recent activity</p>
                    <ArrowUpRight className="h-4 w-4 text-[#788294]" />
                  </div>

                  <div className="mt-4 space-y-3">
                    {notifications.map(({ title, time, status }) => (
                      <div key={title} className="flex items-center justify-between rounded-xl bg-mist px-3 py-2.5 dark:bg-[#292d29]">
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

                <div className="rounded-xl border border-ink/10 bg-white p-4 dark:border-white/10 dark:bg-[#202320]">
                  <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.18em] text-graphite">
                    <span>Today</span>
                    <span>3 classes</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {classes.map((item) => (
                      <div key={item.name} className="rounded-xl border border-ink/10 p-3 dark:border-white/10">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[15px] font-medium text-ink dark:text-white">{item.name}</div>
                            <div className="mt-1 text-[12px] text-graphite">{item.room}</div>
                          </div>
                          <div className="rounded-xl bg-mist px-2 py-1 text-[11px] font-medium text-ink dark:bg-[#292d29] dark:text-white">{item.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl bg-mist px-3 py-2 text-[12px] text-graphite dark:bg-[#292d29]">
                    <span className="inline-flex items-center gap-2"><Clock3 className="h-3.5 w-3.5" /> Next check-in</span>
                    <span className="font-medium text-ink dark:text-white">09:25</span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </BrowserFrame>
  )
}
