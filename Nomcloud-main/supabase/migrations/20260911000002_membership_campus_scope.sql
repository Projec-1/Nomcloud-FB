-- =============================================================================
-- Campus/role expansion Migration 3 of 8 — membership_campus_scope
-- Nom Cloud
--
-- Adds the explicit campus scope model from docs/CAMPUS_ROLE_DESIGN.md §D:
--
--   1. memberships.scope_mode — 'all' or 'selected'. §D.1 rejects a nullable
--      scalar campus reference, because "all campuses" and "these specific
--      campuses" are different cardinalities and a NULL would be an ambiguous
--      sentinel. The mode is stated, never inferred from join-row count.
--   2. membership_campus_scopes — the join table naming which campuses a
--      'selected' membership covers, under the same composite-tenancy
--      discipline as the rest of the schema (§D.2), so a membership in school
--      A can never reference a campus in school B even if a caller supplies
--      both ids.
--
-- Depends on Migration 1 (public.campuses), Migration 2
-- (public.user_role six-value enum), Phase 3 Migration 03 (public.memberships)
-- and Migration 01 (public.set_updated_at).
--
-- Does NOT touch classes, student_guardians, invitations or accept_invitation
-- (Migrations 4, 6 and 7). Does NOT enforce that a 'selected' membership has at
-- least one scope row: §J open question 6 (selected-with-zero-rows behaviour)
-- is still unresolved, and §I assigns that consistency work to Migration 5
-- (campus_scope_integrity).
--
-- Creates NO row-level security policies (Phase 7).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Composite-FK target on memberships
-- -----------------------------------------------------------------------------
-- memberships already carries composite FKs outward, to teachers and guardians,
-- but nothing yet points back at it compositely, so it has no (school_id, id)
-- unique constraint to serve as a referenced key. The scope join table needs
-- one, exactly as campuses_school_id_id_key serves campuses.

alter table public.memberships
  add constraint memberships_school_id_id_key
  unique (school_id, id);

-- -----------------------------------------------------------------------------
-- memberships.scope_mode
-- -----------------------------------------------------------------------------

alter table public.memberships
  add column scope_mode text not null default 'all';

alter table public.memberships
  add constraint memberships_scope_mode_check
  check (scope_mode in ('all', 'selected'));

-- Only Principal and Teacher may be campus-scoped.
--
-- Owner, Director and Administrator are organisation-wide by nature (§C, §D.1);
-- scoping an Owner to selected campuses contradicts the role, so 'selected' is
-- rejected for them outright rather than left to application code.
--
-- Guardian is excluded as a consequence of this positive rule, not by a
-- guardian-specific branch. Guardian access is per-student through
-- student_guardians (§E) and never consults campus scope, so a guardian must
-- not be able to carry campus scope that a later reader could mistake for
-- authority.
alter table public.memberships
  add constraint memberships_scope_mode_role_check
  check (
    scope_mode = 'all'
    or (scope_mode = 'selected' and role in ('principal', 'teacher'))
  );

comment on column public.memberships.scope_mode is
  'Campus breadth of this membership: all campuses, or only those listed in membership_campus_scopes. Stated explicitly, never inferred from the number of scope rows. Only principal and teacher may be selected. Guardian access does not use campus scope at all; it runs through student_guardians.';

-- -----------------------------------------------------------------------------
-- membership_campus_scopes
-- -----------------------------------------------------------------------------

create table public.membership_campus_scopes (
  id             uuid         not null default gen_random_uuid(),
  school_id      uuid         not null,
  membership_id  uuid         not null,
  campus_id      uuid         not null,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now(),

  constraint membership_campus_scopes_pkey
    primary key (id),
  constraint membership_campus_scopes_school_membership_campus_key
    unique (school_id, membership_id, campus_id),
  constraint membership_campus_scopes_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,
  constraint membership_campus_scopes_school_id_membership_id_fkey
    foreign key (school_id, membership_id)
    references public.memberships (school_id, id) on delete cascade,
  constraint membership_campus_scopes_school_id_campus_id_fkey
    foreign key (school_id, campus_id)
    references public.campuses (school_id, id) on delete cascade
);

comment on table public.membership_campus_scopes is
  'Campuses covered by a membership whose scope_mode is selected. Campus/role expansion Migration 3 of 8. Composite foreign keys keep the membership and the campus in the same school. This table records explicit grants only; a teacher effective scope is the union of these grants and class-derived access (CAMPUS_ROLE_DESIGN.md J5), computed in Phase 7, not here.';

-- The unique constraint already indexes (school_id, membership_id) leftmost.
-- The campus side needs its own index so campus deletes and campus-to-member
-- lookups do not sequentially scan.
create index membership_campus_scopes_school_id_campus_id_idx
  on public.membership_campus_scopes (school_id, campus_id);

create trigger membership_campus_scopes_set_updated_at
  before update on public.membership_campus_scopes
  for each row execute function public.set_updated_at();
