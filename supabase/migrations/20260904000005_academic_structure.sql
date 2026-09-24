-- =============================================================================
-- Migration 06 — academic_structure
-- Nom Cloud · Phase 3 (production schema)
--
-- Design number 06. See docs/MIGRATIONS.md for the numbering convention.
--
--   public.academic_years — SCHOOL-OWNED
--   public.terms          — SCHOOL-OWNED
--   public.subjects       — SCHOOL-OWNED
--
-- Depends on Migration 01 (public.set_updated_at) and Migration 03
-- (public.schools). Creates NO row-level security policies (Phase 7).
--
-- THIS MIGRATION DOES NOT TOUCH public.schools (§14).
-- The original plan had 06 reaching back to add schools.active_academic_year_id
-- as a delayed-constraint FK. That column was REMOVED from the design entirely.
-- The active year is DERIVED — academic_years WHERE school_id = X AND
-- status = 'active' — never stored as a pointer. There is no ALTER TABLE on
-- schools anywhere in this file, and schools keeps its zero outbound FKs.
--
-- =============================================================================
-- THE FIRST SCHOOL-OWNED MIGRATION — tenancy rules now apply in full
-- =============================================================================
-- 1. Every table carries school_id uuid NOT NULL.
--
-- 2. school_id -> schools(id) ON DELETE CASCADE, SINGLE-COLUMN (§13 rows 19-41).
--    schools is the TENANT ROOT: school_id IS the tenant key, so there is
--    nothing to compose it with. This is the one place a single-column FK to a
--    school-scoped concept is correct.
--
-- 3. Every school-owned -> school-owned reference is COMPOSITE:
--    (school_id, x) -> target(school_id, id). A child can then never reference
--    another school's parent — it is unrepresentable, not merely prevented.
--    In this migration that is terms -> academic_years (§13 row 42).
--
-- 4. Every table that a later migration references compositely carries
--    UNIQUE (school_id, id) as the target. All three tables here need it:
--      academic_years  <- terms (42), classes (46), class_enrollments (53)
--      subjects        <- teachers (43), class_subjects (49), timetable_slots (56),
--                         grade_records (61), homework (64), exams (68)
--      terms           <- grade_records (62), exams (69), fee_records (71)
--    Each is logically implied by PRIMARY KEY (id), but PostgreSQL requires an
--    explicit unique constraint on the exact referenced column list before a
--    composite FK may target it.
--
-- Conventions from §A.1 apply without being repeated. gen_random_uuid() is left
-- unqualified (pg_catalog provides it under every search_path). No citext column
-- is needed in this migration.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. academic_years — SCHOOL-OWNED
--
-- Design §C table 12.
--
-- The partial unique index below is the single most important constraint in this
-- migration. Removing schools.active_academic_year_id (§14) is only safe because
-- the database guarantees AT MOST ONE active year per school — so the derived
-- lookup "the row WHERE status = 'active'" cannot return two rows. Without it,
-- the removal would have traded a stored pointer for an ambiguous query.
-- -----------------------------------------------------------------------------

create table public.academic_years (
  id          uuid         not null default gen_random_uuid(),
  school_id   uuid         not null,
  label       text         not null,
  start_date  date         not null,
  end_date    date         not null,
  status      text         not null default 'upcoming',
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),

  constraint academic_years_pkey
    primary key (id),
  constraint academic_years_school_id_label_key
    unique (school_id, label),

  -- Composite-FK target for terms, classes and class_enrollments.
  constraint academic_years_school_id_id_key
    unique (school_id, id),

  constraint academic_years_dates_check
    check (end_date > start_date),

  -- §C table 12 defines this vocabulary: upcoming / active / closed.
  constraint academic_years_status_check
    check (status in ('upcoming', 'active', 'closed')),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint academic_years_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade
);

comment on table public.academic_years is
  'School-owned academic years. The ACTIVE year is derived from status, never stored as a pointer on schools.';

comment on column public.academic_years.status is
  'upcoming / active / closed. At most one row per school may be active, enforced by academic_years_school_id_active_idx.';

-- AT MOST ONE ACTIVE YEAR PER SCHOOL — enforced by the database rather than
-- hoped for by the application. This is what makes the derived active-year
-- lookup single-valued, and therefore what makes §14 safe.
create unique index academic_years_school_id_active_idx
  on public.academic_years (school_id)
  where status = 'active';

create index academic_years_school_id_status_idx
  on public.academic_years (school_id, status);

create trigger academic_years_set_updated_at
  before update on public.academic_years
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. terms — SCHOOL-OWNED
--
-- Design §C table 13.
--
-- This table is what finally kills the frontend's hardcoded CURRENT_TERM.
-- Phase 3 Stage 2 routed that value through useData(); Phase 8 will resolve it
-- from the active year's current term by date.
-- -----------------------------------------------------------------------------

create table public.terms (
  id                uuid         not null default gen_random_uuid(),
  school_id         uuid         not null,
  academic_year_id  uuid         not null,
  name              text         not null,
  start_date        date         not null,
  end_date          date         not null,
  sort_order        smallint     not null default 1,
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now(),

  constraint terms_pkey
    primary key (id),
  constraint terms_school_id_academic_year_id_name_key
    unique (school_id, academic_year_id, name),

  -- Composite-FK target for grade_records, exams and fee_records.
  constraint terms_school_id_id_key
    unique (school_id, id),

  constraint terms_dates_check
    check (end_date > start_date),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint terms_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 row 42 — COMPOSITE. Carrying school_id into the reference means a term
  -- can never belong to another school's academic year. CASCADE because terms
  -- are wholly owned by their year.
  constraint terms_school_id_academic_year_id_fkey
    foreign key (school_id, academic_year_id)
    references public.academic_years (school_id, id)
    on delete cascade
    on update no action
);

comment on table public.terms is
  'School-owned terms within an academic year. Tenant-bound to their year by a composite foreign key.';

create index terms_school_id_academic_year_id_sort_order_idx
  on public.terms (school_id, academic_year_id, sort_order);

create trigger terms_set_updated_at
  before update on public.terms
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. subjects — SCHOOL-OWNED
--
-- Design §C table 14. Replaces the free-text subject strings currently scattered
-- across six frontend types.
-- -----------------------------------------------------------------------------

create table public.subjects (
  id          uuid         not null default gen_random_uuid(),
  school_id   uuid         not null,
  name        text         not null,
  code        text,
  is_active   boolean      not null default true,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),

  constraint subjects_pkey
    primary key (id),
  constraint subjects_school_id_name_key
    unique (school_id, name),

  -- Composite-FK target for teachers, class_subjects, timetable_slots,
  -- grade_records, homework and exams.
  constraint subjects_school_id_id_key
    unique (school_id, id),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint subjects_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade
);

comment on table public.subjects is
  'School-owned subject catalogue. Replaces free-text subject strings in the frontend.';

create index subjects_school_id_is_active_idx
  on public.subjects (school_id, is_active);

create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function public.set_updated_at();
