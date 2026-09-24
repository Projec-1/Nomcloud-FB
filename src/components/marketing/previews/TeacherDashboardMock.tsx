import { CheckCircle2, Circle, Clock, Users } from 'lucide-react'
import BrowserFrame from '@/components/marketing/BrowserFrame'

const schedule = [
  { time: '8:00', subject: 'Mathematics', room: 'Room 102', status: 'done' },
  { time: '9:40', subject: 'Grade 7A Homeroom', room: 'Room 102', status: 'done' },
  { time: '11:00', subject: 'Mathematics — Grade 7B', room: 'Room 103', status: 'active' },
  { time: '1:30', subject: 'Mathematics — Grade 8A', room: 'Room 104', status: 'upcoming' },
]

const students = [
  { name: 'Ahmed Abdullahi', score: 92 },
  { name: 'Grace Achieng', score: 78 },
  { name: 'Brian Mutua', score: 65 },
  { name: 'Fatuma Mohamed', score: 88 },
]

export default function TeacherDashboardMock() {
  return (
    <BrowserFrame url="app.nomcloud.academy/teacher">
      <div className="grid gap-4 p-5 text-[11px] sm:grid-cols-5 sm:p-6">
        <div className="sm:col-span-3">
          <p className="mb-3 font-medium text-ink dark:text-white">Today's Schedule — Amina Yusuf</p>
          <div className="space-y-2">
            {schedule.map((s) => (
              <div
                key={s.time}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  s.status === 'active'
                    ? 'border-brand/30 bg-brand/5'
                    : 'border-ink/5 bg-white dark:border-white/10 dark:bg-[#141416]'
                }`}
              >
                <div className="flex w-12 flex-col items-center text-graphite">
                  <Clock className="mb-1 h-3 w-3" />
                  {s.time}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-ink dark:text-white">{s.subject}</p>
                  <p className="text-graphite">{s.room}</p>
                </div>
                {s.status === 'done' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Circle className={`h-4 w-4 ${s.status === 'active' ? 'text-brand' : 'text-graphite/40'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-medium text-ink dark:text-white">Grade 7A · Mathematics</p>
            <Users className="h-3.5 w-3.5 text-graphite" />
          </div>
          <div className="space-y-2 rounded-xl border border-ink/5 bg-white p-3 dark:border-white/10 dark:bg-[#141416]">
            {students.map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <span className="text-ink dark:text-white">{s.name}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink/5 dark:bg-white/10">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${s.score}%` }} />
                  </div>
                  <span className="w-6 text-right text-graphite">{s.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}
