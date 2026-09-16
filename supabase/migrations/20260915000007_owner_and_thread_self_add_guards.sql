-- =============================================================================
-- CORRECTIVE — owner_and_thread_self_add_guards
-- Nom Cloud
--
-- Fixes docs/SYSTEM_ISSUES_LIST.md S8 and S9, under two decisions locked on
-- 2026-09-15:
--   1. Only an existing owner may create or remove an owner-role membership.
--      Director and administrator keep full create/edit/remove on every other
--      role.
--   2. No role may add itself as a participant to a thread it was not already
--      part of.
--
-- Corrects migration 8 (memberships and invitations policies, identity/RLS
-- batch 1) and migration 14 (20260913000001_communications_rls). Every change
-- REFINES an existing policy with ALTER POLICY; no policy is created or dropped,
-- and every refinement only narrows. Nothing else is touched.
--
-- ---------------------------------------------------------------------------
-- S8 — WHAT WAS WRONG, MEASURED
-- ---------------------------------------------------------------------------
-- memberships_admin_insert / _update / _delete and invitations_admin_insert /
-- _update / _delete are all `has_school_admin_role(school_id)`, which is true
-- for owner, director AND administrator. The policies never look at the role
-- being written. Rolled-back probes: an administrator invited an email as owner
-- (accepted -> owner membership, billing access), suspended the owner's
-- membership, and deleted it — all OK.
--
-- WHY INVITATIONS ARE PART OF THIS FIX. accept_invitation is SECURITY DEFINER
-- and creates the membership from the invitation's role, bypassing
-- memberships RLS. An owner-role invitation is therefore an owner-role
-- membership one step later; guarding memberships alone would leave the
-- measured route (I3 -> I16) open.
--
-- THE RULE, applied identically to both tables: a row whose role is 'owner'
-- may be inserted, updated (as it was, and as it becomes) or deleted only by
-- someone who holds an ACTIVE owner membership at that school. Rows of every
-- other role are unchanged. UPDATE is included because promoting a membership
-- to owner creates an owner and suspending an owner removes one.
--
-- ONE OWNER PER SCHOOL IS UNCHANGED. CAMPUS_ROLE_DESIGN J2 ("Exactly one Owner
-- is allowed per school") is enforced by memberships_school_id_owner_idx. This
-- migration governs WHO may write owner rows, not how many may exist, so an
-- owner creating a second owner membership is admitted by the policy and then
-- refused by that index (23505), as J2 intends. Transferring ownership
-- therefore needs a deliberate path (platform admin today); none is built here.
--
-- NEW HELPER: has_school_owner_role(school_id) — the owner-only counterpart of
-- has_school_admin_role, same shape: SECURITY DEFINER, search_path pinned
-- empty, reads only the caller's own membership, active status required.
--
-- ---------------------------------------------------------------------------
-- S9 — WHAT WAS WRONG, MEASURED
-- ---------------------------------------------------------------------------
-- Migration 14 states "the self-add prohibition" and relies on there being no
-- self-insert policy. But message_thread_participants_admin_insert checks only
-- has_school_admin_role(school_id): nothing about WHO is being added or whether
-- the actor is in the thread. So the prohibition held for teachers and
-- guardians and not for owner, director or administrator. Measured: an
-- administrator not in a private teacher-parent thread inserted his own
-- participant row (OK) and then read the parent's message. The intent existed;
-- the policy had a gap.
--
-- THE RULE. An owner/director/administrator may insert a participant row only
-- when ONE of these holds:
--   (a) the row is for SOMEONE ELSE, and the actor is already a participant of
--       that thread; or
--   (b) the thread is being SET UP: the actor created it (created_by), and it
--       has no participants and no messages yet. This is how createThread
--       works — thread, then all participants (creator included) in one
--       statement, then the opening message — so opening a conversation and
--       adding yourself plus others keeps working.
-- A row for yourself on a thread you are not in can satisfy neither: (a)
-- excludes yourself, and (b) requires a brand-new, empty thread you created.
-- "No messages" matters: without it, a creator who had left could empty a
-- thread of participants (the DELETE policy allows that) and re-enter a
-- conversation that has history.
--
-- NEW HELPER: can_seed_thread_participants(school_id, thread_id). SECURITY
-- DEFINER because the caller cannot see the thread or its rows through RLS
-- before being a participant — an RLS-filtered check would read "no
-- participants" for every thread the caller is excluded from, which is exactly
-- the wrong answer. STABLE, so within createThread's single multi-row INSERT it
-- evaluates against the statement's snapshot and every row of the setup is
-- judged against the empty thread.
--
-- DELIBERATELY UNCHANGED: message_thread_participants_admin_delete (removing
-- other people from a thread, sweep M14) grants no sight of anything and is not
-- covered by decision 2; it is recorded as still open in SYSTEM_ISSUES_LIST.
-- Participant SELECT, messages, message_threads and every platform-admin policy
-- are untouched.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.has_school_owner_role(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.memberships m
     where m.user_id = auth.uid()
       and m.school_id = p_school_id
       and m.status = 'active'
       and m.role = 'owner'
  );
$$;

comment on function public.has_school_owner_role(uuid) is
  'True when the caller holds an ACTIVE owner membership at the school. Owner-only counterpart of has_school_admin_role; guards writes to owner-role memberships and invitations (migration 20260915000007).';

create or replace function public.can_seed_thread_participants(p_school_id uuid, p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.message_threads t
     where t.school_id = p_school_id
       and t.id = p_thread_id
       and t.created_by = auth.uid()
  )
  and not exists (
    select 1
      from public.message_thread_participants p
     where p.school_id = p_school_id
       and p.thread_id = p_thread_id
  )
  and not exists (
    select 1
      from public.messages msg
     where msg.school_id = p_school_id
       and msg.thread_id = p_thread_id
  );
$$;

comment on function public.can_seed_thread_participants(uuid, uuid) is
  'True only while the caller is setting up a thread they created that has no participants and no messages yet. Lets the thread creator add the initial participants, themselves included, without ever allowing self-add to an existing conversation (migration 20260915000007).';

revoke all on function public.has_school_owner_role(uuid) from public, anon, authenticated;
revoke all on function public.can_seed_thread_participants(uuid, uuid) from public, anon, authenticated;
grant execute on function public.has_school_owner_role(uuid) to authenticated;
grant execute on function public.can_seed_thread_participants(uuid, uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- S8 — memberships: owner rows need an owner
-- -----------------------------------------------------------------------------

alter policy memberships_admin_insert on public.memberships
  with check (
    public.has_school_admin_role(school_id)
    and (role <> 'owner' or public.has_school_owner_role(school_id))
  );

alter policy memberships_admin_update on public.memberships
  using (
    public.has_school_admin_role(school_id)
    and (role <> 'owner' or public.has_school_owner_role(school_id))
  )
  with check (
    public.has_school_admin_role(school_id)
    and (role <> 'owner' or public.has_school_owner_role(school_id))
  );

alter policy memberships_admin_delete on public.memberships
  using (
    public.has_school_admin_role(school_id)
    and (role <> 'owner' or public.has_school_owner_role(school_id))
  );


-- -----------------------------------------------------------------------------
-- S8 — invitations: an owner invitation is an owner membership in waiting
-- -----------------------------------------------------------------------------

alter policy invitations_admin_insert on public.invitations
  with check (
    public.has_school_admin_role(school_id)
    and (role <> 'owner' or public.has_school_owner_role(school_id))
  );

alter policy invitations_admin_update on public.invitations
  using (
    public.has_school_admin_role(school_id)
    and (role <> 'owner' or public.has_school_owner_role(school_id))
  )
  with check (
    public.has_school_admin_role(school_id)
    and (role <> 'owner' or public.has_school_owner_role(school_id))
  );

alter policy invitations_admin_delete on public.invitations
  using (
    public.has_school_admin_role(school_id)
    and (role <> 'owner' or public.has_school_owner_role(school_id))
  );


-- -----------------------------------------------------------------------------
-- S9 — message_thread_participants: never add yourself to a thread you are not in
-- -----------------------------------------------------------------------------

alter policy message_thread_participants_admin_insert on public.message_thread_participants
  with check (
    public.has_school_admin_role(school_id)
    and (
      (user_id is distinct from auth.uid() and public.is_thread_participant(school_id, thread_id))
      or public.can_seed_thread_participants(school_id, thread_id)
    )
  );
