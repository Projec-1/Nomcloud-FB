-- =============================================================================
-- Phase 7 / Migration 14 — communications_rls  (RLS BATCH 6 of 6 — FINAL)
-- Nom Cloud
--
-- Enables RLS on the last five unprotected tables:
--   message_threads, message_thread_participants, messages,
--   announcements, notifications.
--
-- ON COMPLETION ALL 37 PUBLIC TABLES CARRY ROW-LEVEL SECURITY. This closes the
-- Phase 7 rollout begun in 20260911000007 and continued through batches 1-5.
--
-- Adds one SECURITY DEFINER helper and reuses eight existing ones:
--   is_platform_admin, has_school_staff_role, has_school_admin_role  (Mig. 8)
--   is_school_member, current_guardian_id                            (batch 2)
--   can_manage_class, teaches_class, guardian_has_student_in_class   (batch 3)
--
-- No FORCE ROW LEVEL SECURITY. The access-granting versus attribution-only
-- classification is REUSED, not re-derived: message_thread_participants.user_id
-- and notifications.user_id are access-granting and composite tenant-bound
-- (SCHEMA_DESIGN section 13 rows 78 and 77); messages.sender_id,
-- message_threads.created_by and announcements.created_by are attribution-only
-- (rows 85, 84, 83). Authorship never grants sight.
--
-- =============================================================================
-- CONCLUSION 1 — CAMPUS SCOPING
-- =============================================================================
--
-- MESSAGING IS NOT CAMPUS-SCOPED, and cannot be.
--
-- There is no chain from a thread to a campus. message_threads carries no
-- class_id and no campus_id; its only location-adjacent column is a nullable
-- student_id, which section 13 row 74 makes a scoped SET NULL reference and
-- which C.6 calls "context, not a grant". Unlike batch 3, where classes.campus_id
-- gave a real predicate, and unlike batch 4, where every table reached a campus
-- through its class, there is simply nothing to filter on here.
--
-- It would also be wrong if it were possible. A conversation is not held at a
-- site; its participants are people, and cross-campus conversations are ordinary
-- (a director at one campus messaging a teacher at another). Participation is
-- the boundary, and it is a complete one. C.6 records "Campus: not meaningful"
-- on all three messaging tables independently.
--
-- ANNOUNCEMENTS ARE CAMPUS-SCOPED FOR EXACTLY ONE AUDIENCE VALUE.
--
-- announcements carries class_id, and reaches a campus through
-- class_id -> classes.campus_id. But the paired CHECK constraint
--
--   (audience = 'class' AND class_id IS NOT NULL)
--   OR (audience <> 'class' AND class_id IS NULL)
--
-- makes class_id NULL by construction for every other audience. So a
-- school-wide announcement is structurally not a campus row and cannot be
-- campus-filtered, while a class-targeted one always can. A principal with
-- scope_mode = 'selected' therefore sees every school-wide notice plus only
-- those class notices whose class sits at a campus they hold. That is what C.6
-- says, and the constraint forces it rather than merely permitting it.
--
-- =============================================================================
-- CONCLUSION 2 — ANNOUNCEMENT VISIBILITY IS FILTERED, NOT SCHOOL-WIDE
-- =============================================================================
--
-- Announcements can be scoped, and the mechanism already exists: the audience
-- column, CHECKed to 'all', 'teachers', 'parents', 'students' or 'class'. It is
-- the one table in this schema where the design encodes the intended readership
-- in a column, so the policies mirror that column rather than inventing a rule.
--
-- NOT all announcements in a school are visible to all guardians. A guardian
-- sees 'all', 'parents', and class notices for a class their own child is
-- enrolled in. They do not see 'teachers' notices, nor another class's notices.
--
--   audience      ODA   Principal            Teacher        Guardian
--   'all'         yes   yes                  yes            yes
--   'teachers'    yes   yes                  yes            no
--   'parents'     yes   no (staff notice)    no             yes
--   'class'       yes   own campus only      taught classes own child's class
--   'students'    yes   no                   no             no
--
-- 'students' is visible to ODA only. SCHEMA_DESIGN section J records that
-- students receive no logins in V1, so the value has no reachable recipient.
-- C.6 is explicit that it "does not automatically mean Guardians", and treating
-- it as a guardian audience would silently redirect a message meant for children
-- to their parents. ODA retain sight of the rows so they remain manageable.
--
-- Teacher is given 'all' and 'teachers' but not 'parents', per C.6: a notice
-- addressed to parents is addressed to parents. This is the one place the model
-- is arguably tighter than a staffroom would be, and widening it later is one
-- predicate.
--
-- =============================================================================
-- CONCLUSION 3 — NOTHING CREATES NOTIFICATIONS, AND THIS MIGRATION ADDS NO
-- WRITE PATH
-- =============================================================================
--
-- Investigated before writing. There is no notification-sending feature:
--
--   no migration inserts into public.notifications;
--   no trigger writes them (the only trigger on the table is
--       notifications_set_updated_at, calling set_updated_at);
--   no edge function references them;
--   the frontend notification UI reads src/context/DataContext.tsx, a
--       client-side mock seeded from src/data/mockData.ts, and there is no
--       supabase.from('notifications') call anywhere in src/;
--   the table holds zero rows.
--
-- So this migration creates NO INSERT policy for any school role on
-- notifications, and no SECURITY DEFINER creation path. Building one now would
-- be implementing a feature that does not exist, which the brief forbids.
--
-- The trusted-writer posture is the same one batch 1 established for audit_logs,
-- which is also written by nothing yet: service_role keeps its INSERT grant and
-- carries BYPASSRLS, and a platform admin can write through the platform-admin
-- policy. When a notification feature is built it must deliver through one of
-- those, or through a new SECURITY DEFINER function, because fan-out writes a
-- row into somebody else's inbox and no ordinary user may do that. An
-- unrestricted client INSERT would be a phishing primitive inside the product.
--
-- =============================================================================
-- MESSAGING IS PARTICIPATION-ONLY FOR EVERY ROLE, INCLUDING ODA
-- =============================================================================
--
-- No role has school-wide read or write on message_threads,
-- message_thread_participants or messages. Owner, director and administrator
-- reach a conversation exactly the way a guardian does: by being a participant
-- in it. is_thread_participant is the single predicate, applied uniformly.
--
-- This follows C.6 entry 29, which calls it "a deliberate private-message
-- exception to generic organisation-wide read", and SCHEMA_DESIGN section 10,
-- which classifies messages as "free-text personal communication, the
-- highest-sensitivity content in the system". An administrator cannot read a
-- conversation between a teacher and a parent about a child unless they were
-- put into it.
--
-- History, recorded so the reasoning is not lost. This migration was first
-- written with owner/director/administrator holding FOR ALL policies on the
-- three tables, giving school-wide read and write. That was corrected to
-- participation-only before the migration was committed, on the design
-- document's own C.6 recommendation. The file was edited in place rather than
-- superseded by a corrective migration precisely because nothing had been
-- committed yet; the standing rule that applied files are never edited applies
-- from the commit, not from the apply.
--
-- Two capabilities remain with owner, director and administrator, because
-- neither can be derived from participation and the feature is inert without
-- them:
--
--   message_threads INSERT              someone must be able to open a thread
--   message_thread_participants
--     INSERT and DELETE                 someone must decide who is in it
--
-- Both are write-only in shape. Neither grants sight of anything: an
-- administrator who opens a thread and adds a teacher and a parent, without
-- adding themselves, cannot then read it. That is the intended behaviour and it
-- is probed.
--
-- The self-add prohibition is unchanged and is the reason participant INSERT is
-- restricted at all: a user who could insert their own participant row could
-- join any conversation in the school.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Helper — thread participation, non-recursive
--
-- A policy ON message_thread_participants that reads message_thread_participants
-- recurses forever. This helper is SECURITY DEFINER for the same reason the
-- Migration 8 membership helpers are, and C.6 entry 30 calls for exactly it.
-- -----------------------------------------------------------------------------

create function public.is_thread_participant(p_school_id uuid, p_thread_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.message_thread_participants p
     where p.school_id = p_school_id
       and p.thread_id = p_thread_id
       and p.user_id = auth.uid()
  );
$$;

comment on function public.is_thread_participant(uuid, uuid) is
  'True when the caller holds a message_thread_participants row for the given thread. This join is the visibility boundary for threads and messages (SCHEMA_DESIGN section 13 row 78), so the predicate must not be derived from message_threads.created_by: authoring a thread does not grant sight of it. Security definer to avoid a policy on message_thread_participants recursing through itself.';

revoke all on function public.is_thread_participant(uuid, uuid) from public;
grant execute on function public.is_thread_participant(uuid, uuid) to anon, authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 1. message_threads
-- -----------------------------------------------------------------------------

alter table public.message_threads enable row level security;

create policy message_threads_platform_admin_all on public.message_threads
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Participation, never authorship, is what lets ANY member read a thread. There
-- is no role exemption: owner, director and administrator reach a thread the
-- same way a guardian does, by being in it.
create policy message_threads_participant_select on public.message_threads
  for select to authenticated
  using (public.is_thread_participant(school_id, id));

-- Thread creation is the one capability that cannot come from participation,
-- because a thread has no participants until it exists. It is INSERT only and
-- restricted to owner, director and administrator, which pairs with the
-- participant INSERT restriction below: the same roles that may set a
-- conversation up are the only ones that may populate it. Creating a thread
-- confers no sight of it; the creator reads it only if they are also added as a
-- participant. created_by is attribution only (section 13 row 84).
create policy message_threads_admin_insert on public.message_threads
  for insert to authenticated
  with check (public.has_school_admin_role(school_id));


-- -----------------------------------------------------------------------------
-- 2. message_thread_participants — THE visibility boundary
--
-- Inserting a row here grants sight of a thread's entire history. It gets the
-- treatment Migration 8 gave memberships and batch 2 gave student_guardians:
-- only owner, director and administrator write it. There is deliberately NO
-- self-insert policy, so a user cannot add themselves to an arbitrary thread,
-- which is the most direct self-privilege-escalation path in this batch.
--
-- A participant may update its own last_read_at and nothing else, enforced by
-- the column grant below rather than by a policy, since RLS is row-level.
-- -----------------------------------------------------------------------------

alter table public.message_thread_participants enable row level security;

create policy message_thread_participants_platform_admin_all on public.message_thread_participants
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy message_thread_participants_participant_select on public.message_thread_participants
  for select to authenticated
  using (public.is_thread_participant(school_id, thread_id));

-- Participant management. INSERT and DELETE only, never ALL: these two roles
-- decide who is in a conversation, but that authority does not extend to reading
-- the rosters of conversations they are not in. A participant row is visible to
-- them only through the participation policy above, like anyone else.
create policy message_thread_participants_admin_insert on public.message_thread_participants
  for insert to authenticated
  with check (public.has_school_admin_role(school_id));

create policy message_thread_participants_admin_delete on public.message_thread_participants
  for delete to authenticated
  using (public.has_school_admin_role(school_id));

create policy message_thread_participants_self_update on public.message_thread_participants
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 3. messages
--
-- A participant posts into a thread they belong to, attributed to themselves.
-- sender_id is nullable, so the check is written (is null or = auth.uid()):
-- the equality form alone would evaluate NULL and reject every insert that
-- omits the column, the trap batch 4 documented.
--
-- No participant UPDATE or DELETE. Section 10 classifies messages as the
-- highest-sensitivity content and an editable message is a repudiation problem
-- in a safeguarding context.
-- -----------------------------------------------------------------------------

alter table public.messages enable row level security;

create policy messages_platform_admin_all on public.messages
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy messages_participant_select on public.messages
  for select to authenticated
  using (public.is_thread_participant(school_id, thread_id));

create policy messages_participant_insert on public.messages
  for insert to authenticated
  with check (
    public.is_thread_participant(school_id, thread_id)
    and (sender_id is null or sender_id = auth.uid())
  );


-- -----------------------------------------------------------------------------
-- 4. announcements — the audience column is the visibility model
-- -----------------------------------------------------------------------------

alter table public.announcements enable row level security;

create policy announcements_platform_admin_all on public.announcements
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ODA see and manage every audience, 'students' included.
create policy announcements_admin_select on public.announcements
  for select to authenticated
  using (public.has_school_admin_role(school_id));

-- Staff, principal and teacher included, see school-wide staff-facing notices.
create policy announcements_staff_select on public.announcements
  for select to authenticated
  using (
    audience in ('all', 'teachers')
    and public.has_school_staff_role(school_id)
  );

-- Class notices: principals within campus scope, ODA everywhere.
create policy announcements_class_management_select on public.announcements
  for select to authenticated
  using (
    audience = 'class'
    and public.can_manage_class(school_id, class_id)
  );

-- Class notices: the teachers who actually teach that class.
create policy announcements_class_teacher_select on public.announcements
  for select to authenticated
  using (
    audience = 'class'
    and public.teaches_class(school_id, class_id)
  );

-- Guardians: school-wide parent-facing notices.
create policy announcements_guardian_select on public.announcements
  for select to authenticated
  using (
    audience in ('all', 'parents')
    and public.current_guardian_id(school_id) is not null
  );

-- Guardians: class notices for a class their own child is enrolled in.
create policy announcements_guardian_class_select on public.announcements
  for select to authenticated
  using (
    audience = 'class'
    and public.guardian_has_student_in_class(school_id, class_id)
  );

create policy announcements_admin_insert on public.announcements
  for insert to authenticated
  with check (
    public.has_school_admin_role(school_id)
    and (created_by is null or created_by = auth.uid())
  );

create policy announcements_admin_update on public.announcements
  for update to authenticated
  using (public.has_school_admin_role(school_id))
  with check (
    public.has_school_admin_role(school_id)
    and (created_by is null or created_by = auth.uid())
  );

create policy announcements_admin_delete on public.announcements
  for delete to authenticated
  using (public.has_school_admin_role(school_id));

-- A principal may post and manage class notices at their own campuses only.
-- USING tests the old row and WITH CHECK the new one, so a class notice cannot
-- be moved to another campus's class, and the audience = 'class' term on both
-- sides means it cannot be widened into a school-wide notice either.
create policy announcements_class_management_insert on public.announcements
  for insert to authenticated
  with check (
    audience = 'class'
    and public.can_manage_class(school_id, class_id)
    and (created_by is null or created_by = auth.uid())
  );

create policy announcements_class_management_update on public.announcements
  for update to authenticated
  using (
    audience = 'class'
    and public.can_manage_class(school_id, class_id)
  )
  with check (
    audience = 'class'
    and public.can_manage_class(school_id, class_id)
    and (created_by is null or created_by = auth.uid())
  );

create policy announcements_class_management_delete on public.announcements
  for delete to authenticated
  using (
    audience = 'class'
    and public.can_manage_class(school_id, class_id)
  );


-- -----------------------------------------------------------------------------
-- 5. notifications — the strictest rule in the rollout
--
-- A user reads only their own notifications. No role is exempt: not owner, not
-- director, not administrator. A notification inbox is personal, and the row
-- names its recipient, which section 13 row 77 calls access-granting. A
-- school-wide notification reader would be a colleague's inbox.
--
-- The platform-admin policy exists for support, consistent with every other
-- table in this rollout, and is the single exception.
--
-- There is NO insert policy for any school role. See conclusion 3.
-- -----------------------------------------------------------------------------

alter table public.notifications enable row level security;

create policy notifications_platform_admin_all on public.notifications
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy notifications_self_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_self_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Dismissing a notification. Section 10 classifies notifications as ephemeral
-- with no downstream references, so a recipient may remove their own.
create policy notifications_self_delete on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 6. Column grants — what RLS cannot express
--
-- A row-level policy cannot stop a permitted UPDATE from rewriting any column of
-- that row. Without these, notifications_self_update would let a recipient
-- rewrite their own notification's title, body, type or link, and
-- message_thread_participants_self_update would let a participant rewrite
-- thread_id or user_id. Both are closed the same way batch 1 closed
-- profiles.school_id and batch 5 closed fee_records.amount_paid.
--
-- Note on the set_updated_at triggers: they assign NEW.updated_at inside a
-- BEFORE trigger rather than issuing their own UPDATE statement, so column
-- privileges, which are checked against the statement's target list, do not
-- apply to them. Proven by probe rather than assumed, after batch 5.
--
-- Note on scope: this narrows UPDATE for every role including platform admin,
-- which is intended. Nobody rewrites a delivered notification. Participant
-- management is done by insert and delete, not by updating thread_id or user_id,
-- so nothing legitimate is lost.
-- -----------------------------------------------------------------------------

revoke update on table public.notifications from anon, authenticated;
grant update (read_at) on table public.notifications to authenticated;

revoke update on table public.message_thread_participants from anon, authenticated;
grant update (last_read_at) on table public.message_thread_participants to authenticated;


-- =============================================================================
-- End of Batch 6, and end of the Phase 7 RLS rollout. All 37 public tables now
-- carry row-level security. No table outside the five listed is touched, no
-- existing function is altered, and no constraint is weakened.
-- =============================================================================
