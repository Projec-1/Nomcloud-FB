import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Megaphone, BookOpen, CalendarCheck, Wallet, ClipboardCheck, MessageSquare } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { timeAgo } from '@/utils/format'
import { cn } from '@/utils/cn'
import EmptyState from '@/components/ui/EmptyState'
import type { NotificationItem } from '@/types'

const iconByType: Record<NotificationItem['type'], typeof Bell> = {
  announcement: Megaphone,
  grade: BookOpen,
  attendance: CalendarCheck,
  fee: Wallet,
  homework: ClipboardCheck,
  message: MessageSquare,
}

export default function NotificationsDropdown() {
  const { activeMembership, activeRole } = useAuth()
  const { notificationsFor, markNotificationRead, markAllNotificationsRead, scopeKey } = useData()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const scope = scopeKey(activeRole ?? 'admin', activeMembership?.teacher_id ?? undefined, activeMembership?.guardian_id ?? undefined)
  const notifications = notificationsFor(scope)
  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-graphite hover:bg-ink/5 dark:hover:bg-white/10"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-floaty animate-fade-up dark:border-white/10 dark:bg-[#161618] sm:w-96">
          <div className="flex items-center justify-between border-b border-ink/5 px-4 py-3 dark:border-white/10">
            <p className="text-sm font-semibold text-ink dark:text-white">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllNotificationsRead(scope)}
                className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={Bell} title="You're all caught up" description="New notifications will show up here." />
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = iconByType[n.type]
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      markNotificationRead(n.id)
                      setOpen(false)
                      if (n.link) navigate(n.link)
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-ink/5 px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-ink/[0.03] dark:border-white/5 dark:hover:bg-white/5',
                      !n.read && 'bg-accent/[0.04]',
                    )}
                  >
                    <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink dark:bg-white/10 dark:text-white">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-ink dark:text-white">{n.title}</span>
                        {!n.read && <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-brand" />}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-graphite">{n.body}</span>
                      <span className="mt-1 block text-[11px] text-graphite/70">{timeAgo(n.date)}</span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
