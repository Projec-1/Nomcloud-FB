// ---------------------------------------------------------------------------
// Communications. Phase 8 batch 7 — the last five tables.
//
// message_threads, message_thread_participants, messages, announcements,
// notifications. The access model is RLS migration 14's
// (20260913000001_communications_rls), restated so the interface offers only
// what the database accepts. Nothing here is re-derived.
//
// ---------------------------------------------------------------------------
// MESSAGING IS PARTICIPATION-ONLY FOR EVERY ROLE, INCLUDING OWNERS
// ---------------------------------------------------------------------------
// This is the part most likely to be got wrong by someone assuming an
// administrator sees everything. They do not. All three messaging tables gate
// SELECT on `is_thread_participant(school_id, thread_id)`, which tests for a
// row in message_thread_participants naming auth.uid(). An owner who is not in
// a thread cannot read it. That was corrected from school-wide before migration
// 14 was committed, and this module must not quietly restore the wider model.
//
//   message_threads       SELECT  is_thread_participant
//                         INSERT  has_school_admin_role          <- ODA only
//                         no UPDATE, no DELETE policy at all
//   message_thread_        SELECT  is_thread_participant
//     participants        INSERT  has_school_admin_role          <- no self-add
//                         UPDATE  user_id = auth.uid(), and the column grant
//                                 allows only last_read_at
//   messages              SELECT  is_thread_participant
//                         INSERT  is_thread_participant AND sender is self
//                         no UPDATE, no DELETE policy at all
//
// Two consequences the interface must respect:
//
// 1. ONLY AN ADMINISTRATOR CAN START A CONVERSATION. Creating a thread needs
//    INSERT on message_threads AND on message_thread_participants, and both are
//    has_school_admin_role. A teacher or guardian can reply in any thread they
//    are in, but cannot open one. This settles open decision 7 in favour of
//    "restrict conversation-starting in the interface too": the alternative was
//    a thread-creation function, and none is needed to match what the policies
//    already allow.
//
// 2. MESSAGES AND THREADS ARE IMMUTABLE. Neither table has an UPDATE or DELETE
//    policy for any school role, so nothing offers editing or unsending. That
//    is a deliberate property of a conversation record, not a missing feature.
//
// ---------------------------------------------------------------------------
// NOTIFICATIONS ARE READ-ONLY BECAUSE NOTHING CREATES THEM
// ---------------------------------------------------------------------------
// notifications has SELECT, UPDATE and DELETE policies, all keyed on
// `user_id = auth.uid()`, and NO INSERT POLICY FOR ANY SCHOOL ROLE. Migration 14
// established that deliberately after confirming nothing in the system writes
// one: no migration inserts, no trigger, no edge function, and the table holds
// zero rows.
//
// So this module reads them and marks them read, and offers no way to create
// one. `markNotificationRead` is not a contradiction: the UPDATE column grant
// admits exactly `read_at`, so a user can mark their own notification seen and
// change nothing else about it. Until an emitter exists (open decision 8) every
// notification surface renders empty, which is honest rather than broken.
//
// ---------------------------------------------------------------------------
// ANNOUNCEMENT VISIBILITY IS FILTERED BY AUDIENCE, IN THE DATABASE
// ---------------------------------------------------------------------------
// announcements.audience is CHECKed to 'all', 'teachers', 'parents', 'students'
// or 'class', and migration 14 wrote one SELECT policy per readership rather
// than inventing a rule. A guardian sees 'all', 'parents', and class notices for
// their own child's class. A teacher sees 'all', 'teachers', and class notices
// for classes they teach. 'students' is visible to management only, because V1
// issues students no logins.
//
// This module therefore does NOT filter by audience. It asks for the caller's
// own school and lets the policies decide readership, which is the one case in
// Phase 8 where that is correct rather than lazy: the filter is a per-role
// disjunction of five policies that the client cannot restate without
// duplicating the whole matrix and drifting from it.
//
// CAMPUS: see the note on fetchAnnouncements.
//
// TENANT SCOPING. Every read pins school_id. Where a narrower key exists it is
// pinned too.
// ---------------------------------------------------------------------------

import { supabase } from '@/lib/supabase'

/** The audiences `announcements_audience_check` allows. */
export type AnnouncementAudience = 'all' | 'teachers' | 'parents' | 'students' | 'class'

/** The priorities `announcements_priority_check` allows. */
export type AnnouncementPriority = 'normal' | 'important' | 'urgent'

export interface AnnouncementView {
  id: string
  title: string
  body: string
  audience: AnnouncementAudience
  classId: string | null
  priority: AnnouncementPriority
  pinned: boolean
  publishedAt: string | null
  createdAt: string
  createdBy: string | null
  authorName: string
}

export interface AnnouncementInput {
  title: string
  body: string
  audience: AnnouncementAudience
  classId: string | null
  priority: AnnouncementPriority
}

/**
 * The signed-in auth user id, which is what auth.uid() returns inside a policy.
 *
 * announcements.created_by, message_threads.created_by and messages.sender_id
 * are all attribution columns referencing profiles(id), and the matching
 * policies accept only NULL or auth.uid(). Batch 5 found the prototype passing
 * a teachers.id and a person's name into columns of exactly this kind, so this
 * is resolved from the session and never accepted from a caller.
 */
async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

/** Resolves profile display names for a set of user ids, best effort. */
async function profileNames(schoolId: string, userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return names

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('school_id', schoolId)
    .in('id', ids)

  // Deliberately non-fatal. A name that cannot be resolved renders as a fallback
  // rather than failing the whole conversation view.
  if (error) return names
  for (const p of (data ?? []) as { id: string; full_name: string }[]) names.set(p.id, p.full_name)
  return names
}

// ===========================================================================
// ANNOUNCEMENTS
// ===========================================================================

/**
 * Announcements the signed-in user may read, newest first, pinned first.
 *
 * NO AUDIENCE FILTER IS APPLIED HERE, and that is the correct choice rather
 * than a shortcut. See the header: readership is a five-policy disjunction that
 * varies by role, and restating it client-side would duplicate the matrix and
 * drift from it. The query pins the caller's own school, which is the scope the
 * frontend legitimately knows.
 *
 * CAMPUS SCOPE, AND HOW IT INTERACTS WITH DECISION 2. Announcements are
 * campus-scoped for exactly one audience value. The CHECK
 *
 *   (audience = 'class' AND class_id IS NOT NULL)
 *   OR (audience <> 'class' AND class_id IS NULL)
 *
 * makes class_id NULL by construction for every other audience, so a
 * school-wide notice is structurally not a campus row and cannot be
 * campus-filtered, while a class notice always reaches a campus through
 * class_id -> classes.campus_id.
 *
 * Locked decision 2 says the frontend does not become campus-aware in this
 * phase, and it does not: this query sends no campus and filters on none. For a
 * principal holding scope_mode='selected', the announcements policies narrow
 * class notices to their own campuses server-side, so the result arrives
 * correctly scoped without the client knowing campuses exist. The two decisions
 * do not collide — one is about what the client asks for, the other about what
 * the database will answer.
 */
export async function fetchAnnouncements(schoolId: string): Promise<AnnouncementView[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, audience, class_id, priority, pinned, published_at, created_at, created_by')
    .eq('school_id', schoolId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = (data ?? []) as {
    id: string
    title: string
    body: string
    audience: AnnouncementAudience
    class_id: string | null
    priority: AnnouncementPriority
    pinned: boolean
    published_at: string | null
    created_at: string
    created_by: string | null
  }[]
  if (rows.length === 0) return []

  const names = await profileNames(schoolId, rows.map((r) => r.created_by ?? ''))

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    audience: r.audience,
    classId: r.class_id,
    priority: r.priority,
    pinned: r.pinned,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    createdBy: r.created_by,
    authorName: (r.created_by && names.get(r.created_by)) || 'School Administration',
  }))
}

/**
 * Publishes an announcement.
 *
 * The audience/class_id pairing is enforced by `announcements_audience_class_check`
 * in both directions, so a class notice without a class, or a school-wide notice
 * carrying one, is refused with 23514 rather than stored inconsistently. The
 * caller normalises class_id to null for every non-class audience.
 */
export async function createAnnouncement(schoolId: string, input: AnnouncementInput): Promise<void> {
  const createdBy = await currentUserId()

  const { error } = await supabase.from('announcements').insert({
    school_id: schoolId,
    title: input.title,
    body: input.body,
    audience: input.audience,
    class_id: input.audience === 'class' ? input.classId : null,
    priority: input.priority,
    created_by: createdBy,
    published_at: new Date().toISOString(),
  })

  if (error) throw error
}

/** Pins or unpins an announcement. Management only, per the UPDATE policies. */
export async function setAnnouncementPinned(schoolId: string, id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .update({ pinned })
    .eq('school_id', schoolId)
    .eq('id', id)

  if (error) throw error
}

export async function deleteAnnouncement(schoolId: string, id: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('school_id', schoolId).eq('id', id)
  if (error) throw error
}

// ===========================================================================
// MESSAGING
// ===========================================================================

export interface ThreadParticipant {
  userId: string
  name: string
  lastReadAt: string | null
}

export interface MessageView {
  id: string
  threadId: string
  senderId: string | null
  senderName: string
  body: string
  sentAt: string
}

export interface ThreadView {
  id: string
  subject: string
  studentId: string | null
  lastMessageAt: string | null
  createdAt: string
  participants: ThreadParticipant[]
  /** The most recent message, for the list preview. */
  preview: string
  unread: boolean
}

/**
 * Every thread the signed-in user participates in, most recent first.
 *
 * The query pins school_id and relies on `is_thread_participant` for the
 * participation boundary, which is the one predicate a client cannot express:
 * it tests a row in message_thread_participants against auth.uid(), and that
 * table is itself readable only to participants. Asking for the school's threads
 * and receiving only one's own is the policy working exactly as designed, not a
 * broad query narrowed by luck.
 */
export async function fetchThreads(schoolId: string, userId: string): Promise<ThreadView[]> {
  const { data, error } = await supabase
    .from('message_threads')
    .select('id, subject, student_id, last_message_at, created_at')
    .eq('school_id', schoolId)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) throw error

  const rows = (data ?? []) as {
    id: string
    subject: string
    student_id: string | null
    last_message_at: string | null
    created_at: string
  }[]
  if (rows.length === 0) return []

  const threadIds = rows.map((r) => r.id)

  // Separate scoped reads rather than embedded selects: these tables reach one
  // another through composite foreign keys, and a silent embedding failure
  // would look like an empty inbox.
  const [participants, lastMessages] = await Promise.all([
    supabase
      .from('message_thread_participants')
      .select('thread_id, user_id, last_read_at')
      .eq('school_id', schoolId)
      .in('thread_id', threadIds),
    supabase
      .from('messages')
      .select('thread_id, body, sent_at')
      .eq('school_id', schoolId)
      .in('thread_id', threadIds)
      .order('sent_at', { ascending: false }),
  ])

  if (participants.error) throw participants.error
  if (lastMessages.error) throw lastMessages.error

  const partRows = (participants.data ?? []) as { thread_id: string; user_id: string; last_read_at: string | null }[]
  const names = await profileNames(schoolId, partRows.map((p) => p.user_id))

  const byThread = new Map<string, ThreadParticipant[]>()
  for (const p of partRows) {
    byThread.set(p.thread_id, [
      ...(byThread.get(p.thread_id) ?? []),
      { userId: p.user_id, name: names.get(p.user_id) ?? 'School member', lastReadAt: p.last_read_at },
    ])
  }

  const previewByThread = new Map<string, { body: string; sentAt: string }>()
  for (const m of (lastMessages.data ?? []) as { thread_id: string; body: string; sent_at: string }[]) {
    if (!previewByThread.has(m.thread_id)) previewByThread.set(m.thread_id, { body: m.body, sentAt: m.sent_at })
  }

  return rows.map((r) => {
    const parts = byThread.get(r.id) ?? []
    const mine = parts.find((p) => p.userId === userId)
    const preview = previewByThread.get(r.id)
    return {
      id: r.id,
      subject: r.subject,
      studentId: r.student_id,
      lastMessageAt: r.last_message_at,
      createdAt: r.created_at,
      participants: parts,
      preview: preview?.body ?? '',
      unread: Boolean(
        preview && (!mine?.lastReadAt || new Date(preview.sentAt) > new Date(mine.lastReadAt)),
      ),
    }
  })
}

/** Every message in one thread, oldest first. */
export async function fetchMessages(schoolId: string, threadId: string): Promise<MessageView[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, thread_id, sender_id, body, sent_at')
    .eq('school_id', schoolId)
    .eq('thread_id', threadId)
    .order('sent_at', { ascending: true })

  if (error) throw error

  const rows = (data ?? []) as {
    id: string
    thread_id: string
    sender_id: string | null
    body: string
    sent_at: string
  }[]
  const names = await profileNames(schoolId, rows.map((r) => r.sender_id ?? ''))

  return rows.map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    senderId: r.sender_id,
    senderName: (r.sender_id && names.get(r.sender_id)) || 'School member',
    body: r.body,
    sentAt: r.sent_at,
  }))
}

/**
 * Posts a message into a thread.
 *
 * Any participant may do this, including teachers and guardians. Only thread
 * CREATION is administrator-restricted, and the distinction is deliberate: it
 * controls who may open a channel, not who may speak in one.
 *
 * `last_message_at` is maintained by this function rather than a trigger,
 * because no trigger exists for it. A failure to update it leaves the message
 * itself safely stored, so it is not allowed to fail the send.
 */
export async function sendMessage(schoolId: string, threadId: string, body: string): Promise<void> {
  const senderId = await currentUserId()

  const { error } = await supabase.from('messages').insert({
    school_id: schoolId,
    thread_id: threadId,
    sender_id: senderId,
    body,
  })

  if (error) throw error

  await supabase
    .from('message_threads')
    .update({ last_message_at: new Date().toISOString() })
    .eq('school_id', schoolId)
    .eq('id', threadId)
}

/**
 * Marks a thread read for the signed-in user.
 *
 * The UPDATE policy on message_thread_participants is `user_id = auth.uid()`
 * and the column grant admits only `last_read_at`, so this can touch nobody
 * else's row and nothing else on their own.
 */
export async function markThreadRead(schoolId: string, threadId: string, userId: string): Promise<void> {
  await supabase
    .from('message_thread_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('school_id', schoolId)
    .eq('thread_id', threadId)
    .eq('user_id', userId)
}

export interface MessageableUser {
  userId: string
  name: string
  role: string
}

/**
 * People an administrator can open a conversation with.
 *
 * A participant row references a USER, so only people who have accepted their
 * invitation and hold a profile can be added. A guardian who exists as a
 * guardians row but has never signed in has no user id and cannot be messaged;
 * that is a real limit of the model, not an omission here, and the reminder
 * feature below reports it rather than silently skipping.
 */
export async function fetchMessageableUsers(schoolId: string, excludeUserId: string): Promise<MessageableUser[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('user_id, role')
    .eq('school_id', schoolId)
    .eq('status', 'active')

  if (error) throw error

  const rows = (data ?? []) as { user_id: string; role: string }[]
  const names = await profileNames(schoolId, rows.map((r) => r.user_id))

  return rows
    .filter((r) => r.user_id !== excludeUserId)
    .map((r) => ({ userId: r.user_id, name: names.get(r.user_id) ?? 'School member', role: r.role }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The guardian membership user id for each guardian, where one exists. */
export async function fetchGuardianUserIds(schoolId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('memberships')
    .select('user_id, guardian_id')
    .eq('school_id', schoolId)
    .eq('role', 'guardian')
    .eq('status', 'active')

  if (error) throw error

  const byGuardian = new Map<string, string>()
  for (const m of (data ?? []) as { user_id: string; guardian_id: string | null }[]) {
    if (m.guardian_id) byGuardian.set(m.guardian_id, m.user_id)
  }
  return byGuardian
}

/**
 * Opens a conversation. ADMINISTRATOR ONLY, enforced by the database.
 *
 * Three writes, in order, none of them transactional from a browser:
 *   1. the thread            INSERT message_threads        (ODA only)
 *   2. the participants      INSERT message_thread_participants (ODA only)
 *   3. the opening message   INSERT messages               (participants only)
 *
 * Step 3 depends on step 2 having named the sender, which is why the creator is
 * always added as a participant. An administrator who opened a thread without
 * adding themselves could not then post into it, and could not even read it
 * back.
 *
 * If step 2 or 3 fails the thread is removed again, so a half-built
 * conversation is not left behind. That cleanup is best effort: message_threads
 * has no DELETE policy for a school role, so it will only succeed for a platform
 * administrator. The failure is reported either way, which is the part that
 * matters.
 */
export async function createThread(
  schoolId: string,
  subject: string,
  participantUserIds: string[],
  firstMessage: string,
  studentId?: string | null,
): Promise<string> {
  const creator = await currentUserId()
  if (!creator) throw new Error('You must be signed in to start a conversation.')

  const { data, error } = await supabase
    .from('message_threads')
    .insert({
      school_id: schoolId,
      subject,
      student_id: studentId ?? null,
      created_by: creator,
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw error
  const threadId = (data as { id: string }).id

  // The creator is always a participant. See above.
  const userIds = Array.from(new Set([creator, ...participantUserIds]))

  const { error: partError } = await supabase.from('message_thread_participants').insert(
    userIds.map((userId) => ({ school_id: schoolId, thread_id: threadId, user_id: userId })),
  )

  if (partError) {
    await supabase.from('message_threads').delete().eq('school_id', schoolId).eq('id', threadId)
    throw partError
  }

  const { error: msgError } = await supabase.from('messages').insert({
    school_id: schoolId,
    thread_id: threadId,
    sender_id: creator,
    body: firstMessage,
  })

  if (msgError) {
    await supabase.from('message_threads').delete().eq('school_id', schoolId).eq('id', threadId)
    throw msgError
  }

  return threadId
}

// ===========================================================================
// NOTIFICATIONS — READ AND MARK READ. NOTHING CREATES THEM.
// ===========================================================================

export interface NotificationView {
  id: string
  title: string
  body: string
  type: string
  link: string | null
  readAt: string | null
  createdAt: string
}

/**
 * The signed-in user's own notifications, newest first.
 *
 * Scoped by user_id explicitly as well as school_id, even though the policy is
 * already `user_id = auth.uid()`. The standing rule from the RLS rollout is that
 * a query states its own scope and RLS makes a mistake safe, rather than RLS
 * being what makes the query correct. On a table where every row belongs to
 * exactly one person, that is worth being literal about.
 *
 * Expect this to be empty. No emitter exists (open decision 8) and the table
 * holds no rows; the surfaces render an honest empty state until one is built.
 */
export async function fetchNotifications(schoolId: string, userId: string): Promise<NotificationView[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, type, link, read_at, created_at')
    .eq('school_id', schoolId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as {
    id: string
    title: string
    body: string
    type: string
    link: string | null
    read_at: string | null
    created_at: string
  }[]).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    link: n.link,
    readAt: n.read_at,
    createdAt: n.created_at,
  }))
}

/**
 * Marks notifications read.
 *
 * Not a contradiction of "read-only": the UPDATE column grant admits exactly
 * `read_at`, and the policy restricts it to the caller's own rows, so this can
 * neither create a notification nor alter its content.
 */
export async function markNotificationsRead(schoolId: string, userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('school_id', schoolId)
    .eq('user_id', userId)
    .in('id', ids)

  if (error) throw error
}

// ===========================================================================
// FEE REMINDERS — batch 6 removed this, batch 7 restores it for real
// ===========================================================================
// Batch 6 deleted the reminder control because it wrote message threads to the
// mock store: it would have reported "12 parents notified" while sending
// nothing. Now that threads are real and an administrator can open one, it is
// rebuilt on the same three writes createThread uses, all of which an
// administrator legitimately holds.
//
// TWO HONEST LIMITS, REPORTED RATHER THAN HIDDEN.
//
// 1. A participant row references a USER. A guardian who exists as a guardians
//    row but has never accepted their invitation has no user id and cannot be
//    put in a thread. Those guardians are counted and named back to the caller
//    instead of being silently dropped.
//
// 2. There is no transaction. Each reminder is its own thread, so a failure
//    part-way through leaves earlier reminders sent. The result reports how many
//    succeeded and how many did not, rather than claiming all or nothing.

export interface ReminderRecipient {
  guardianId: string
  userId: string
  name: string
  studentName: string
}

export interface ReminderResult {
  sent: number
  failed: number
  /** Guardians with no user account, who cannot be messaged at all. */
  unreachable: string[]
}

/**
 * Resolves who can actually be reminded about the given students' fees.
 *
 * students -> student_guardians -> guardians -> memberships.user_id. The last
 * hop is the one that can fail, and its failures are what `unreachable`
 * reports.
 */
export async function resolveReminderRecipients(
  schoolId: string,
  studentIds: string[],
): Promise<{ recipients: ReminderRecipient[]; unreachable: string[] }> {
  if (studentIds.length === 0) return { recipients: [], unreachable: [] }

  const [links, students, guardianUsers] = await Promise.all([
    supabase
      .from('student_guardians')
      .select('student_id, guardian_id')
      .eq('school_id', schoolId)
      .in('student_id', studentIds),
    supabase.from('students').select('id, full_name').eq('school_id', schoolId).in('id', studentIds),
    fetchGuardianUserIds(schoolId),
  ])

  if (links.error) throw links.error
  if (students.error) throw students.error

  const studentNames = new Map<string, string>()
  for (const s of (students.data ?? []) as { id: string; full_name: string }[]) studentNames.set(s.id, s.full_name)

  const linkRows = (links.data ?? []) as { student_id: string; guardian_id: string }[]
  const guardianIds = Array.from(new Set(linkRows.map((l) => l.guardian_id)))
  if (guardianIds.length === 0) return { recipients: [], unreachable: [] }

  const { data: guardians, error: gErr } = await supabase
    .from('guardians')
    .select('id, full_name')
    .eq('school_id', schoolId)
    .in('id', guardianIds)
  if (gErr) throw gErr

  const guardianNames = new Map<string, string>()
  for (const g of (guardians ?? []) as { id: string; full_name: string }[]) guardianNames.set(g.id, g.full_name)

  const recipients: ReminderRecipient[] = []
  const unreachable: string[] = []
  const seen = new Set<string>()

  for (const link of linkRows) {
    if (seen.has(link.guardian_id)) continue
    seen.add(link.guardian_id)
    const name = guardianNames.get(link.guardian_id) ?? 'Guardian'
    const userId = guardianUsers.get(link.guardian_id)
    if (!userId) {
      unreachable.push(name)
      continue
    }
    recipients.push({
      guardianId: link.guardian_id,
      userId,
      name,
      studentName: studentNames.get(link.student_id) ?? '',
    })
  }

  return { recipients, unreachable }
}

/**
 * Opens one reminder conversation per guardian.
 *
 * Sequential rather than parallel, so a partial failure is easy to reason about
 * and the count reported back is accurate.
 */
export async function sendFeeReminders(
  schoolId: string,
  recipients: ReminderRecipient[],
  subject: string,
  body: string,
  unreachable: string[],
): Promise<ReminderResult> {
  let sent = 0
  let failed = 0

  for (const r of recipients) {
    try {
      await createThread(schoolId, subject, [r.userId], body)
      sent += 1
    } catch {
      failed += 1
    }
  }

  return { sent, failed, unreachable }
}
