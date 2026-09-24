import { Bell, ChevronDown, BookOpen, Wallet, CalendarCheck, MessageCircle } from 'lucide-react'
import PhoneFrame from '@/components/marketing/PhoneFrame'

const quickStats = [
  { label: 'Attendance', value: '98%', icon: CalendarCheck, tint: '#34A853' },
  { label: 'Avg. Grade', value: 'A-', icon: BookOpen, tint: '#0071E3' },
  { label: 'Fee Balance', value: '$0', icon: Wallet, tint: '#FF5A1F' },
]

export default function ParentAppMock() {
  return (
    <PhoneFrame>
      <div className="flex h-full flex-col px-4 pb-4 pt-9 text-[11px]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-graphite">Welcome back</p>
            <p className="font-semibold text-ink dark:text-white">Mrs. Abdullahi</p>
          </div>
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm dark:bg-white/10">
            <Bell className="h-3.5 w-3.5 text-graphite" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-brand" />
          </div>
        </div>

        <button className="mb-4 flex items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-white/10">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">AA</div>
            <div className="text-left">
              <p className="font-medium text-ink dark:text-white">Ahmed Abdullahi</p>
              <p className="text-graphite">Grade 7A</p>
            </div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-graphite" />
        </button>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {quickStats.map((s) => (
            <div key={s.label} className="rounded-xl bg-white p-2.5 text-center shadow-sm dark:bg-white/10">
              <div className="mx-auto mb-1.5 flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: `${s.tint}1A`, color: s.tint }}>
                <s.icon className="h-3 w-3" />
              </div>
              <p className="font-semibold text-ink dark:text-white">{s.value}</p>
              <p className="text-graphite">{s.label}</p>
            </div>
          ))}
        </div>

        <p className="mb-2 font-medium text-ink dark:text-white">Recent Announcements</p>
        <div className="flex-1 space-y-2 overflow-hidden">
          {[
            { title: 'Parent-Teacher Conference — Saturday', tag: 'Important' },
            { title: 'Term 1 Mid-Term Break Schedule', tag: 'School' },
            { title: 'Fee Payment Reminder', tag: 'Urgent' },
          ].map((a) => (
            <div key={a.title} className="rounded-xl bg-white p-3 shadow-sm dark:bg-white/10">
              <p className="mb-1 inline-block rounded-full bg-brand/10 px-2 py-0.5 text-[9px] font-medium text-brand">{a.tag}</p>
              <p className="leading-snug text-ink dark:text-white">{a.title}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-around rounded-2xl bg-white py-2.5 shadow-sm dark:bg-white/10">
          {[BookOpen, CalendarCheck, MessageCircle, Wallet].map((Icon, i) => (
            <Icon key={i} className={`h-4 w-4 ${i === 0 ? 'text-brand' : 'text-graphite'}`} />
          ))}
        </div>
      </div>
    </PhoneFrame>
  )
}
