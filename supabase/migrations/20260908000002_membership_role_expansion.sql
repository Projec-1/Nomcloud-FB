-- =============================================================================
-- Campus/role expansion Migration 2 of 8 — membership_role_expansion
-- Nom Cloud
--
-- Renames the Phase 3 role values outright:
--   admin  -> administrator
--   parent -> guardian
-- There is no compatibility alias period. Existing rows are transformed by the
-- enum value rename itself before the six-way identity constraint is restored.
--
-- Depends on Phase 3 Migration 04 (public.memberships, public.invitations).
-- Creates NO row-level security policies (Phase 7).
-- =============================================================================

create type public.user_role_expanded as enum (
  'owner',
  'director',
  'administrator',
  'principal',
  'teacher',
  'guardian'
);

alter table public.memberships
  drop constraint memberships_role_identity_check;

alter table public.memberships
  alter column role type public.user_role_expanded
  using (
    case role::text
      when 'admin' then 'administrator'
      when 'parent' then 'guardian'
      else role::text
    end::public.user_role_expanded
  );

alter table public.invitations
  alter column role type public.user_role_expanded
  using (
    case role::text
      when 'admin' then 'administrator'
      when 'parent' then 'guardian'
      else role::text
    end::public.user_role_expanded
  );

drop type public.user_role;
alter type public.user_role_expanded rename to user_role;

alter table public.memberships
  add constraint memberships_role_identity_check
  check (
       (role = 'teacher'      and teacher_id is not null and guardian_id is null)
    or (role = 'guardian'     and guardian_id is not null and teacher_id is null)
    or (role in ('owner', 'director', 'administrator', 'principal')
        and teacher_id is null and guardian_id is null)
  );

create unique index memberships_school_id_owner_idx
  on public.memberships (school_id)
  where role = 'owner';
