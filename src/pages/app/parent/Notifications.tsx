import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Megaphone, BookOpen, CalendarCheck, Wallet, ClipboardCheck, MessageSquare } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import type { NotificationItem } from '@/types'
import { timeAgo } from '@/utils/format'
import { cn } from '@/utils/cn'

const iconByType: Record<NotificationItem['type'], typeof Bell> = {
  announcement: Megaphone,
  grade: BookOpen,
  attendance: CalendarCheck,
  fee: Wallet,
  homework: ClipboardCheck,
  message: MessageSquare,
}

export default function ParentNotifications() {
  const { activeMembership } = useAuth()
  const { notificationsFor, markNotificationRead, markAllNotificationsRead, scopeKey } = useData()
  const navigate = useNavigate()

  const scope = scopeKey('parent', undefined, activeMembership?.guardian_id ?? undefined)
  const notifications = notificationsFor(scope)
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'You\'re all caught up'}
        actions={
          unread > 0 ? (
            <Button variant="outline" size="sm" onClick={() => markAllNotificationsRead(scope)} icon={<CheckCheck className="h-4 w-4" />}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="Updates about grades, attendance, fees and more will show up here." />
      ) : (
        <div className="card divide-y divide-ink/5 dark:divide-white/5">
          {notifications.map((n) => {
            const Icon = iconByType[n.type]
            return (
              <button
                key={n.id}
                onClick={() => {
                  markNotificationRead(n.id)
                  if (n.link) navigate(n.link)
                }}
                className={cn('flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-ink/[0.03] dark:hover:bg-white/5', !n.read && 'bg-accent/[0.04]')}
              >
                <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink dark:bg-white/10 dark:text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-ink dark:text-white">{n.title}</span>
                    {!n.read && <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-brand" />}
                  </span>
                  <span className="mt-0.5 block text-sm text-graphite">{n.body}</span>
                  <span className="mt-1.5 block text-xs text-graphite/70">{timeAgo(n.date)}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
