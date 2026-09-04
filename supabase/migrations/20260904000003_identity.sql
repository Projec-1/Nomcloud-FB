-- =============================================================================
-- Migration 04 — identity
-- Nom Cloud · Phase 3 (production schema)
--
-- Design number 04. See docs/MIGRATIONS.md for the numbering convention.
--
--   public.profiles         — IDENTITY (one row per authenticated human)
--   public.platform_admins  — PLATFORM (§B row 5; grouped into this migration by §I)
--   public.memberships      — IDENTITY · the tenancy join
--   public.invitations      — IDENTITY
--
-- Plus the FK deferred from Migration 02:
--   contact_messages.handled_by -> profiles(id) ON DELETE SET NULL
--
-- Depends on Migration 01 (public.user_role, public.set_updated_at), Migration 02
-- (public.contact_messages) and Migration 03 (public.schools). Also depends on
-- auth.users, which Supabase Auth owns.
--
-- Creates NO row-level security policies (Phase 7).
--
-- The ORIGINAL §C tables 5, 7, 8 and 9 are SUPERSEDED by amendments §2, §3, §4,
-- §15, §16 and §17 wherever they differ. The amendment wins throughout.
--
-- =============================================================================
-- THE ONE-SCHOOL IDENTITY MODEL (§2, §3) — the structure Phase 7 resolves through
-- =============================================================================
-- V1 rule: one authenticated human belongs to ONE school, but MAY hold several
-- roles at that same school. This is enforced DECLARATIVELY — no trigger:
--
--   profiles.school_id                         the single authoritative answer
--   UNIQUE (id, school_id) on profiles         the composite-FK target
--   memberships (user_id, school_id)
--     -> profiles (id, school_id)              CASCADE / ON UPDATE NO ACTION
--
-- Because memberships.user_id and .school_id are both NOT NULL, the composite FK
-- is always checked — there is no MATCH SIMPLE null-skip escape. Exactly one
-- profiles row can match (id is the primary key), so memberships.school_id CANNOT
-- hold any value other than that user's assigned school. Cross-school membership
-- is not "prevented"; it is UNREPRESENTABLE.
--
-- memberships.school_id is therefore NOT a second source of truth (§3). It is a
-- declaratively constrained projection of profiles.school_id, kept for RLS
-- performance (no join), as the composite-FK target for teacher_id/guardian_id,
-- and for uniform tenancy across every school-scoped table.
--
-- profiles.school_id IS NULL means NO SCHOOL ASSIGNMENT YET. It does NOT mean
-- platform operator (§4) — that is determined SOLELY by an unrevoked
-- platform_admins row. With school_id NULL the composite FK admits no membership
-- at all, so school-less accounts are structurally school-less.
--
-- Conventions from §A.1 apply without being repeated per table. citext is
-- qualified as extensions.citext; gen_random_uuid() is not qualified.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. profiles — IDENTITY
--
-- Amended table 7 (§2). One row per authenticated human, id EQUAL TO auth.users.id
-- and deliberately NOT generated — this table is strictly derived from Supabase
-- Auth, which owns the identity lifecycle.
--
-- NO password or password_hash column, ever (§7). Supabase Auth holds credentials;
-- MFA factors live in auth.mfa_factors, managed by Supabase and not modelled here.
-- -----------------------------------------------------------------------------

create table public.profiles (
  id            uuid               not null,
  school_id     uuid,
  full_name     text               not null,
  email         extensions.citext  not null,
  phone         text,
  locale        text               not null default 'en',
  avatar_url    text,
  last_seen_at  timestamptz,
  created_at    timestamptz        not null default now(),
  updated_at    timestamptz        not null default now(),

  constraint profiles_pkey
    primary key (id),
  constraint profiles_email_key
    unique (email),

  -- Logically implied by PRIMARY KEY (id), but PostgreSQL requires an explicit
  -- unique constraint on the exact referenced column list before a composite FK
  -- may target it. One redundant index is the whole price of making cross-school
  -- membership unrepresentable.
  constraint profiles_id_school_id_key
    unique (id, school_id),

  -- §13 audit row 7. Supabase Auth owns the identity lifecycle.
  constraint profiles_id_fkey
    foreign key (id) references auth.users (id) on delete cascade,

  -- §13 audit row 8. RESTRICT, not CASCADE: hard-deleting a school that still has
  -- users assigned must be blocked, not silently propagated into identity.
  constraint profiles_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete restrict
);

comment on table public.profiles is
  'One row per authenticated human, id mirroring auth.users.id. Holds no credentials — Supabase Auth owns those.';

comment on column public.profiles.school_id is
  'The single authoritative answer to which school a user belongs to. NULL means no school assignment yet; it does NOT mean platform operator, which is determined solely by an unrevoked platform_admins row.';

-- Every tenant user list and the Phase 7 RLS resolution path.
-- The design also lists an index on (email); profiles_email_key already provides
-- it, so no second object is created — the same reasoning §C table 10 states
-- explicitly as "Index (shortcode) (unique already)".
create index profiles_school_id_idx
  on public.profiles (school_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. platform_admins — PLATFORM
--
-- §C table 5, retained by §15. Who may approve schools. An explicit table rather
-- than a role string on profiles, so platform privilege is a deliberate row
-- insertion — auditable and revocable, never a value an application bug can set.
--
-- §15 semantics: revoked_at is the NORMAL mechanism for removing platform access.
-- It preserves the grant history and records when authority ended. Hard deletion
-- of a profiles row is EXCEPTIONAL — an erasure request or account purge — and
-- cascading the grant away is then correct, since a grant to a non-existent
-- principal is meaningless. No audit history is lost: audit_logs preserves
-- platform actions independently via snapshotted actor_role and actor_email, so
-- the record of WHAT an operator did survives the deletion of WHO they were.
-- -----------------------------------------------------------------------------

create table public.platform_admins (
  id          uuid         not null default gen_random_uuid(),
  user_id     uuid         not null,
  granted_by  uuid,
  granted_at  timestamptz  not null default now(),
  revoked_at  timestamptz,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),

  constraint platform_admins_pkey
    primary key (id),

  -- §13 audit row 4. CASCADE per §15.
  constraint platform_admins_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade,

  -- §13 audit row 5. Attribution only; the grant survives its granter's removal.
  constraint platform_admins_granted_by_fkey
    foreign key (granted_by) references public.profiles (id) on delete set null
);

comment on table public.platform_admins is
  'The SOLE determinant of platform-operator status. Never inferred from profiles.school_id being NULL.';

comment on column public.platform_admins.revoked_at is
  'Normal mechanism for ending platform access — preserves grant history. Hard deletion of the profile is exceptional and audited.';

-- One ACTIVE grant per person; revoked history is retained in full.
create unique index platform_admins_user_id_active_idx
  on public.platform_admins (user_id)
  where revoked_at is null;

create trigger platform_admins_set_updated_at
  before update on public.platform_admins
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. memberships — IDENTITY · the tenancy join
--
-- Amended table 8 (§2, §16). One row per (person, role) — see the uniqueness note
-- below. This table replaces the frontend's AuthUser.teacherId / parentId /
-- schoolId triple.
--
-- UNIQUE (user_id, role), NOT (user_id, school_id, role) (§2). Under the
-- one-school rule school_id is functionally dependent on user_id — the composite
-- FK guarantees every membership for a user carries that user's single school —
-- so including it in the key can only ever hold one value per user and adds
-- nothing. (user_id, role) states the real rule: a person holds each role at most
-- once. Fadumo's teacher AND parent memberships remain legal; only duplicates of
-- the same role are excluded.
-- -----------------------------------------------------------------------------

create table public.memberships (
  id           uuid              not null default gen_random_uuid(),
  user_id      uuid              not null,
  school_id    uuid              not null,
  role         public.user_role  not null,
  status       text              not null default 'active',
  teacher_id   uuid,
  guardian_id  uuid,
  invited_by   uuid,
  joined_at    timestamptz       not null default now(),
  created_at   timestamptz       not null default now(),
  updated_at   timestamptz       not null default now(),

  constraint memberships_pkey
    primary key (id),
  constraint memberships_user_id_role_key
    unique (user_id, role),

  -- §C table 8 defines this vocabulary: active / suspended.
  constraint memberships_status_check
    check (status in ('active', 'suspended')),

  -- §16 POSITIVE enforcement: each role REQUIRES its identity column, rather than
  -- merely prohibiting the other. An admin membership carrying a teacher_id, or a
  -- teacher membership carrying none, is unrepresentable.
  constraint memberships_role_identity_check
    check (
         (role = 'teacher' and teacher_id is not null and guardian_id is null)
      or (role = 'parent'  and guardian_id is not null and teacher_id is null)
      or (role = 'admin'   and teacher_id is null and guardian_id is null)
    ),

  -- §13 audit row 9 — THE ONE-SCHOOL ENFORCEMENT.
  -- ON UPDATE NO ACTION is stated explicitly rather than left to the default:
  -- ON UPDATE CASCADE would silently drag a user's memberships into a different
  -- school when profiles.school_id changed — catastrophic and near-invisible.
  -- With NO ACTION, moving a person between schools requires deliberately
  -- removing their memberships first.
  constraint memberships_user_id_school_id_fkey
    foreign key (user_id, school_id)
    references public.profiles (id, school_id)
    on delete cascade
    on update no action,

  -- §13 audit row 10. Guarantees the school is real.
  constraint memberships_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 audit row 13. Attribution only; grants no access.
  constraint memberships_invited_by_fkey
    foreign key (invited_by) references public.profiles (id) on delete set null
);

comment on table public.memberships is
  'The tenancy join. One row per (person, role) at that person''s single school. Cross-school membership is unrepresentable, not merely prevented.';

comment on column public.memberships.school_id is
  'NOT a second source of truth. A declaratively constrained projection of profiles.school_id, pinned by the composite FK; it cannot hold a different value.';

-- §2 amended index list. The design also names (user_id); memberships_user_id_role_key
-- is a btree on (user_id, role) whose leading column already serves it, so no
-- second object is created.
create index memberships_school_id_role_idx
  on public.memberships (school_id, role);

create index memberships_school_id_status_idx
  on public.memberships (school_id, status);

create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. invitations — IDENTITY
--
-- §C table 9 as amended by §17. The missing link between "admin adds a teacher"
-- and "teacher has an account".
--
-- STORE ONLY token_hash, NEVER THE TOKEN. An invitation token is a bearer
-- credential; a database dump must not yield working invites.
--
-- §17: this table has NO SET NULL behaviour at all. Every FK cascades, so no
-- NOT NULL / SET NULL contradiction is possible now or after future edits. The
-- table either holds a fully-formed invitation or no row.
--   invited_by   NOT NULL + CASCADE — an invite is a bearer credential and dies
--                with its issuer, rather than remaining redeemable with no
--                accountable issuer.
--   accepted_by  nullable + CASCADE — SET NULL would leave accepted_at populated
--                with accepted_by null, a half-state asserting "accepted by
--                nobody". Once accepted, the durable artifacts are the membership
--                and the audit log entry.
-- -----------------------------------------------------------------------------

create table public.invitations (
  id           uuid               not null default gen_random_uuid(),
  school_id    uuid               not null,
  email        extensions.citext  not null,
  role         public.user_role   not null,
  teacher_id   uuid,
  guardian_id  uuid,
  token_hash   text               not null,
  expires_at   timestamptz        not null,
  accepted_at  timestamptz,
  accepted_by  uuid,
  invited_by   uuid               not null,
  revoked_at   timestamptz,
  created_at   timestamptz        not null default now(),
  updated_at   timestamptz        not null default now(),

  constraint invitations_pkey
    primary key (id),

  -- §13 audit row 14. Invitations are wholly owned by the tenant.
  constraint invitations_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 audit row 17.
  constraint invitations_invited_by_fkey
    foreign key (invited_by) references public.profiles (id) on delete cascade,

  -- §13 audit row 18.
  constraint invitations_accepted_by_fkey
    foreign key (accepted_by) references public.profiles (id) on delete cascade
);

comment on table public.invitations is
  'Pending account invitations. Holds only a hash of the bearer token, never the token itself.';

comment on column public.invitations.token_hash is
  'Hash of the invitation token. The token itself is never stored, so a database dump yields no working invites.';

-- §C table 9: one live invite per person per role.
create unique index invitations_school_id_email_role_live_idx
  on public.invitations (school_id, email, role)
  where accepted_at is null and revoked_at is null;

-- §C table 9 index list: redemption lookup, and the school's invite list.
create index invitations_token_hash_idx
  on public.invitations (token_hash);

create index invitations_school_id_email_idx
  on public.invitations (school_id, email);

create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 5. Deferred FK from Migration 02
--
-- §13 audit row 3, single-column: platform identity, and the enquiry is
-- pre-tenant, so there is no tenant to compose the key with. Migration 02 created
-- the column but could not create this constraint, because profiles did not yet
-- exist. It exists now.
-- -----------------------------------------------------------------------------

alter table public.contact_messages
  add constraint contact_messages_handled_by_fkey
  foreign key (handled_by) references public.profiles (id) on delete set null;


-- =============================================================================
-- FOLLOW-UP — FOUR FOREIGN KEYS OWED BY MIGRATION 07 (people)
--
-- teachers and guardians do not exist until Migration 07, so four composite FKs
-- specified by the design CANNOT be created here. The COLUMNS and the positive
-- role/identity CHECK exist now; only these constraints are deferred. Until they
-- are added, teacher_id and guardian_id accept any uuid.
--
-- MIGRATION 07 MUST ADD, all four ON DELETE CASCADE:
--   1. memberships (school_id, teacher_id)  -> teachers  (school_id, id)   §13 row 11, §16
--   2. memberships (school_id, guardian_id) -> guardians (school_id, id)   §13 row 12, §16
--   3. invitations (school_id, teacher_id)  -> teachers  (school_id, id)   §13 row 15, §17
--   4. invitations (school_id, guardian_id) -> guardians (school_id, id)   §13 row 16, §17
--
-- Each requires UNIQUE (school_id, id) on teachers and on guardians as the
-- composite-FK target, exactly as profiles carries UNIQUE (id, school_id) here.
--
-- CASCADE is deliberate, not a way to silence the CHECK (§16): deleting a
-- teachers row ENDS that teacher membership, because the membership had no
-- meaning without the employment record it describes. The person's profiles row
-- survives, and any other role membership at the same school survives with it.
-- status='inactive' on the teachers/guardians row is the normal path; hard
-- deletion is exceptional and audited.
--
-- Also recorded in docs/MIGRATIONS.md.
-- =============================================================================
