import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { deriveResourceState, type ResourceState } from '@/lib/resourceState'
import {
  fetchAnnouncements,
  fetchNotifications,
  fetchThreads,
  type AnnouncementView,
  type NotificationView,
  type ThreadView,
} from '@/services/communicationService'
import { toError } from '@/utils/errorMessage'

// ---------------------------------------------------------------------------
// Communications reads through the four-state contract. Phase 8 batch 7.
//
// All three are `denied` only when the caller holds no school or no user
// identity, never from an empty result. Each has a specific reason:
//
//   announcements   a school that has published nothing is `empty`
//   threads         a user in no conversations is `empty`, which is the normal
//                   state for almost everyone, since only an administrator can
//                   open a thread
//   notifications   ALWAYS empty today, because nothing writes one
//
// The notifications case is the sharpest illustration of why `denied` must come
// from identity. The table has no INSERT policy for any role and holds no rows,
// so a row count can only ever be zero. A screen inferring access from that
// would tell every user they lack permission to see their own notifications.
// ---------------------------------------------------------------------------

/** True for owner, director and administrator — the roles that may open a thread. */
const ADMIN_ROLES = ['owner', 'director', 'administrator'] as const

export interface UseAnnouncementsResult {
  state: ResourceState<AnnouncementView[]>
  announcements: AnnouncementView[]
  /** Whether this user may publish, pin or delete. Management only. */
  canManage: boolean
  schoolId: string | null
  reload: () => void
}

export function useAnnouncements(): UseAnnouncementsResult {
  const { activeMembership, school, authState } = useAuth()
  const schoolId = school?.id ?? null
  const role = activeMembership?.role ?? null
  const canManage = role !== null && (ADMIN_ROLES as readonly string[]).includes(role)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [announcements, setAnnouncements] = useState<AnnouncementView[]>([])
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    if (authState !== 'ready') return
    if (!schoolId) {
      setIsLoading(false)
      setAnnouncements([])
      return
    }

    setIsLoading(true)
    setError(null)

    fetchAnnouncements(schoolId)
      .then((rows) => {
        if (!cancelled) setAnnouncements(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toError(err))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [schoolId, authState, nonce])

  const state = deriveResourceState<AnnouncementView[]>({
    isLoading: authState !== 'ready' || isLoading,
    canAccess: authState !== 'ready' ? undefined : schoolId !== null,
    error,
    data: announcements,
    retry: reload,
  })

  return { state, announcements, canManage, schoolId, reload }
}

export interface UseThreadsResult {
  state: ResourceState<ThreadView[]>
  threads: ThreadView[]
  /** Only owner, director and administrator may open a conversation. */
  canStartThread: boolean
  schoolId: string | null
  userId: string | null
  reload: () => void
}

export function useMessageThreads(): UseThreadsResult {
  const { activeMembership, school, authUser, authState } = useAuth()
  const schoolId = school?.id ?? null
  const userId = authUser?.id ?? null
  const role = activeMembership?.role ?? null
  const canStartThread = role !== null && (ADMIN_ROLES as readonly string[]).includes(role)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [threads, setThreads] = useState<ThreadView[]>([])
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    if (authState !== 'ready') return
    if (!schoolId || !userId) {
      setIsLoading(false)
      setThreads([])
      return
    }

    setIsLoading(true)
    setError(null)

    fetchThreads(schoolId, userId)
      .then((rows) => {
        if (!cancelled) setThreads(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toError(err))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [schoolId, userId, authState, nonce])

  const state = deriveResourceState<ThreadView[]>({
    isLoading: authState !== 'ready' || isLoading,
    canAccess: authState !== 'ready' ? undefined : schoolId !== null && userId !== null,
    error,
    data: threads,
    retry: reload,
  })

  return { state, threads, canStartThread, schoolId, userId, reload }
}

export interface UseNotificationsResult {
  state: ResourceState<NotificationView[]>
  notifications: NotificationView[]
  unreadCount: number
  schoolId: string | null
  userId: string | null
  reload: () => void
}

export function useNotifications(): UseNotificationsResult {
  const { school, authUser, authState } = useAuth()
  const schoolId = school?.id ?? null
  const userId = authUser?.id ?? null

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [notifications, setNotifications] = useState<NotificationView[]>([])
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    if (authState !== 'ready') return
    if (!schoolId || !userId) {
      setIsLoading(false)
      setNotifications([])
      return
    }

    setIsLoading(true)
    setError(null)

    fetchNotifications(schoolId, userId)
      .then((rows) => {
        if (!cancelled) setNotifications(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toError(err))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [schoolId, userId, authState, nonce])

  const state = deriveResourceState<NotificationView[]>({
    isLoading: authState !== 'ready' || isLoading,
    canAccess: authState !== 'ready' ? undefined : schoolId !== null && userId !== null,
    error,
    data: notifications,
    retry: reload,
  })

  return {
    state,
    notifications,
    unreadCount: notifications.filter((n) => !n.readAt).length,
    schoolId,
    userId,
    reload,
  }
}
