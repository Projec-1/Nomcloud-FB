import { Plus, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import type { IsoWeekday, TimetableSlot } from '@/types'
import { cn } from '@/utils/cn'
import { DEFAULT_WEEKEND_DAYS, isoWeekdayLabel, schoolWeekdays } from '@/utils/schoolCalendar'

export const PERIODS: { period: number; startTime: string; endTime: string }[] = [
  { period: 1, startTime: '08:00', endTime: '08:40' },
  { period: 2, startTime: '08:40', endTime: '09:20' },
  { period: 3, startTime: '09:20', endTime: '10:00' },
  { period: 4, startTime: '10:20', endTime: '11:00' },
  { period: 5, startTime: '11:00', endTime: '11:40' },
  { period: 6, startTime: '11:40', endTime: '12:20' },
]

interface TimetableGridProps {
  slots: TimetableSlot[]
  editable?: boolean
  onAddSlot?: (day: IsoWeekday, period: number) => void
  onRemoveSlot?: (id: string) => void
}

export default function TimetableGrid({ slots, editable = false, onAddSlot, onRemoveSlot }: TimetableGridProps) {
  // Columns come from the signed-in school's configured weekend. The Somali
  // default renders Saturday through Wednesday, with Thursday optional.
  const { school } = useAuth()
  const days = schoolWeekdays(school?.weekend_days ?? DEFAULT_WEEKEND_DAYS)
  const periods = Array.from(
    new Map(
      [...PERIODS, ...slots.map((slot) => ({ period: slot.period, startTime: slot.startTime, endTime: slot.endTime }))]
        .sort((a, b) => a.period - b.period)
        .map((period) => [period.period, period]),
    ).values(),
  )

  const find = (day: IsoWeekday, period: number) => slots.find((s) => s.day === day && s.period === period)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-1.5 text-xs">
        <thead>
          <tr>
            <th className="w-20 text-left font-medium text-graphite">Time</th>
            {days.map((day) => (
              <th key={day} className="text-left font-medium text-graphite">{isoWeekdayLabel(day)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p.period}>
              <td className="align-top py-1 text-[11px] text-graphite">
                {p.startTime}
                <br />
                {p.endTime}
              </td>
              {days.map((day) => {
                const slot = find(day, p.period)
                return (
                  <td key={day} className="align-top">
                    {slot ? (
                      <div className="group relative rounded-xl bg-accent/10 p-2.5 text-accent">
                        <p className="font-semibold">{slot.subject}</p>
                        <p className="text-[10px] text-accent/70">{slot.room}</p>
                        {editable && onRemoveSlot && (
                          <button
                            onClick={() => onRemoveSlot(slot.id)}
                            className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white group-hover:flex"
                            aria-label="Remove slot"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ) : editable && onAddSlot ? (
                      <button
                        onClick={() => onAddSlot(day, p.period)}
                        className={cn(
                          'flex h-14 w-full items-center justify-center rounded-xl border border-dashed border-ink/10 text-graphite/40 transition-colors hover:border-accent hover:text-accent dark:border-white/10',
                        )}
                        aria-label="Add class slot"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <div className="h-14 w-full rounded-xl bg-mist/60 dark:bg-white/[0.02]" />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
