-- =============================================================================
-- Campus/role expansion Migration 6 of 8 — invitation_role_scope_expansion
-- Nom Cloud
--
-- Lets an invitation express the same campus-scope shape a membership carries,
-- so Migration 7 (accept_invitation_role_scope) can transfer it faithfully.
--
-- invitations.role is already the six-value public.user_role enum; Migration 2
-- retyped it alongside memberships.role, so no role retyping happens here.
--
-- Intended campuses are stored in a mirror table rather than an array column.
-- An array cannot carry a composite foreign key, so it could name a campus in
-- another school or one that no longer exists, defeating the structural
-- cross-tenant prevention section D.2 requires. The mirror shape also makes
-- Migration 7 a row-for-row transfer onto membership_campus_scopes.
--
-- SECURITY: this migration adds no token column of any kind. The existing
-- token_hash-only pattern is untouched; nothing here stores or exposes a
-- bearer token.
--
-- Depends on Migration 1 (public.campuses), Migration 2 (six-value user_role)
-- and Phase 3 Migration 12 (public.invitations). Does NOT touch
-- accept_invitation, memberships, membership_campus_scopes or classes.
--
-- Creates NO row-level security policies (Phase 7).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Composite-FK target on invitations
-- -----------------------------------------------------------------------------
-- invitations points outward compositely to teachers and guardians, but nothing
-- points back at it, so it has no (school_id, id) unique to reference. The
-- intent table needs one, exactly as memberships gained in Migration 3.

alter table public.invitations
  add constraint invitations_school_id_id_key
  unique (school_id, id);

-- -----------------------------------------------------------------------------
-- invitations.scope_mode
-- -----------------------------------------------------------------------------
-- Same vocabulary and same role restriction as memberships.scope_mode. An
-- invitation for an organisation-wide role cannot claim selected scope, for the
-- same reason the membership it becomes cannot.

alter table public.invitations
  add column scope_mode text not null default 'all';

alter table public.invitations
  add constraint invitations_scope_mode_check
  check (scope_mode in ('all', 'selected'));

alter table public.invitations
  add constraint invitations_scope_mode_role_check
  check (
    scope_mode = 'all'
    or (scope_mode = 'selected' and role in ('principal', 'teacher'))
  );

comment on column public.invitations.scope_mode is
  'Campus breadth this invitation intends to grant: all campuses, or only those listed in invitation_campus_scopes. Transferred onto memberships.scope_mode at acceptance by Migration 7. Only principal and teacher may be selected.';

-- -----------------------------------------------------------------------------
-- invitation_campus_scopes
-- -----------------------------------------------------------------------------
-- Intent only. No membership_campus_scopes row exists until acceptance.
--
-- The campus foreign key cascades: if a campus is deleted, an accepted or
-- revoked invitation's intent rows are history and should simply go. A live
-- invitation is protected instead by the trigger below, which rejects the
-- deletion loudly rather than silently shrinking what the invitation grants.

create table public.invitation_campus_scopes (
  id             uuid         not null default gen_random_uuid(),
  school_id      uuid         not null,
  invitation_id  uuid         not null,
  campus_id      uuid         not null,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now(),

  constraint invitation_campus_scopes_pkey
    primary key (id),
  constraint invitation_campus_scopes_school_invitation_campus_key
    unique (school_id, invitation_id, campus_id),
  constraint invitation_campus_scopes_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,
  constraint invitation_campus_scopes_school_id_invitation_id_fkey
    foreign key (school_id, invitation_id)
    references public.invitations (school_id, id) on delete cascade,
  constraint invitation_campus_scopes_school_id_campus_id_fkey
    foreign key (school_id, campus_id)
    references public.campuses (school_id, id) on delete cascade
);

comment on table public.invitation_campus_scopes is
  'Campuses a not-yet-accepted invitation intends to grant. Campus/role expansion Migration 6 of 8. Intent only: the real grant is written to membership_campus_scopes at acceptance by Migration 7. Contains no token material of any kind.';

create index invitation_campus_scopes_school_id_campus_id_idx
  on public.invitation_campus_scopes (school_id, campus_id);

create trigger invitation_campus_scopes_set_updated_at
  before update on public.invitation_campus_scopes
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Selected invitations must name at least one campus
-- -----------------------------------------------------------------------------
-- Same requirement Migration 5 applies to memberships, but scoped to LIVE
-- invitations only.
--
-- Creation is still a single transaction, so deferring to commit lets the
-- invitation and its intent rows be written in either order. What invitations
-- add is the window between creation and acceptance, which memberships do not
-- have: a campus can disappear during it. Restricting the assertion to
-- accepted_at is null and revoked_at is null means a pending invitation blocks
-- that campus deletion loudly, while an already accepted or revoked invitation
-- never does, because its intent rows are a historical record.
--
-- expires_at is deliberately excluded from the liveness test. A constraint
-- whose truth changes with the clock alone is a hazard, and the existing
-- invitations_school_id_email_role_live_idx sets the same precedent.

create function public.assert_selected_invitation_names_campus()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_school_id     uuid;
  v_invitation_id uuid;
  v_scope_mode    text;
  v_live          boolean;
begin
  if tg_table_name = 'invitations' then
    v_school_id     := new.school_id;
    v_invitation_id := new.id;
  else
    v_school_id     := old.school_id;
    v_invitation_id := old.invitation_id;
  end if;

  select i.scope_mode, (i.accepted_at is null and i.revoked_at is null)
  into v_scope_mode, v_live
  from public.invitations i
  where i.school_id = v_school_id
    and i.id = v_invitation_id;

  -- The invitation itself was deleted in this transaction, which cascaded its
  -- intent rows. There is nothing left to assert about it.
  if not found then
    return null;
  end if;

  -- Accepted or revoked: the intent rows are history, not a live grant.
  if not v_live then
    return null;
  end if;

  if v_scope_mode is distinct from 'selected' then
    return null;
  end if;

  if not exists (
    select 1
    from public.invitation_campus_scopes s
    where s.school_id = v_school_id
      and s.invitation_id = v_invitation_id
  ) then
    raise exception
      'invitation % declares scope_mode ''selected'' but names no campus; add at least one invitation_campus_scopes row, or set scope_mode to ''all'', in the same transaction',
      v_invitation_id
      using errcode = '23514';
  end if;

  return null;
end;
$$;

comment on function public.assert_selected_invitation_names_campus() is
  'Constraint-trigger body asserting that a live invitation with scope_mode = selected names at least one campus. Deferred to commit so an invitation and its intent rows can be written together, and limited to invitations that are neither accepted nor revoked so historical intent never blocks a campus deletion. Security invoker, correct while no table has row-level security; Phase 7 must re-evaluate it, as an integrity assertion has to observe the true row set rather than an RLS-filtered view.';

create constraint trigger invitations_selected_scope_names_campus
  after insert or update on public.invitations
  deferrable initially deferred
  for each row execute function public.assert_selected_invitation_names_campus();

create constraint trigger invitation_campus_scopes_selected_scope_names_campus
  after delete or update on public.invitation_campus_scopes
  deferrable initially deferred
  for each row execute function public.assert_selected_invitation_names_campus();
