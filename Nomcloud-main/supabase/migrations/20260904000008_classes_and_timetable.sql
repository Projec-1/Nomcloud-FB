-- =============================================================================
-- Migration 08 — classes_and_timetable
-- Nom Cloud · Phase 3 (production schema)
--
-- Design number 08. See docs/MIGRATIONS.md for the numbering convention.
--
--   public.classes            — SCHOOL-OWNED
--   public.class_subjects     — SCHOOL-OWNED (join)
--   public.class_enrollments  — SCHOOL-OWNED (time-scoped)
--   public.timetable_slots    — SCHOOL-OWNED
--
-- Depends on Migration 01 (public.set_updated_at), Migration 03 (public.schools),
-- Migration 06 (public.academic_years, public.subjects) and Migration 07
-- (public.teachers, public.students).
--
-- Creates NO row-level security policies (Phase 7).
--
-- Tenancy rules, applied in full (§13):
--   - every table carries school_id uuid NOT NULL
--   - school_id -> schools(id) ON DELETE CASCADE, single-column (rows 19-41)
--   - every school-owned -> school-owned reference is COMPOSITE (rows 46-56)
--   - classes carries UNIQUE (school_id, id): referenced compositely by
--     class_subjects (48), class_enrollments (51), timetable_slots (54), and
--     later by homework (63), exams (67) and announcements (73)
--
-- =============================================================================
-- SCOPED SET NULL — derived from §13 rows 46-56, not assumed
-- =============================================================================
-- Of the eleven FKs in rows 46-56, all are composite. Filtering to ON DELETE
-- SET NULL yields exactly three, and each uses the scoped column-list form:
--
--   row 50  class_subjects  (school_id, teacher_id) -> teachers   SET NULL (teacher_id)
--   row 55  timetable_slots (school_id, teacher_id) -> teachers   SET NULL (teacher_id)
--   row 56  timetable_slots (school_id, subject_id) -> subjects   SET NULL (subject_id)
--
-- Plain composite SET NULL would null EVERY referencing column, school_id
-- included; school_id is NOT NULL, so the parent delete would fail with 23502 —
-- RESTRICT behaviour under a SET NULL label. The scoped form nulls only the
-- reference and preserves the tenant, which is what §13 describes. Established
-- and measured in CORRECTIVE 20260904000007; recorded in docs/MIGRATIONS.md.
--
-- The remaining eight FKs are CASCADE or RESTRICT and take no column list.
--
-- Conventions from §A.1 apply without being repeated. gen_random_uuid() is left
-- unqualified. No citext column is needed in this migration.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. classes — SCHOOL-OWNED
--
-- Design §C table 19.
--
-- class_teacher_id is the ONLY RESTRICT in this migration (§13 row 47), and it
-- is deliberate. Removing a teacher who still owns a class must FAIL LOUDLY and
-- force reassignment, rather than silently orphaning a class mid-term. It is not
-- an inconsistency with the CASCADEs around it — it is the one relationship
-- where losing the parent must block, because a class without a teacher is an
-- operational emergency rather than a tidy-up.
-- -----------------------------------------------------------------------------

create table public.classes (
  id                uuid         not null default gen_random_uuid(),
  school_id         uuid         not null,
  academic_year_id  uuid         not null,
  name              text         not null,
  grade             text         not null,
  section           text,
  class_teacher_id  uuid,
  capacity          integer,
  room              text,
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now(),

  constraint classes_pkey
    primary key (id),
  constraint classes_school_id_academic_year_id_name_key
    unique (school_id, academic_year_id, name),

  -- Composite-FK target for class_subjects (48), class_enrollments (51),
  -- timetable_slots (54), homework (63), exams (67) and announcements (73).
  constraint classes_school_id_id_key
    unique (school_id, id),

  constraint classes_capacity_check
    check (capacity > 0),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint classes_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 row 46 — COMPOSITE, CASCADE. A class belongs wholly to its year.
  constraint classes_school_id_academic_year_id_fkey
    foreign key (school_id, academic_year_id)
    references public.academic_years (school_id, id)
    on delete cascade
    on update no action,

  -- §13 row 47 — COMPOSITE, RESTRICT. See the note above: this must block.
  constraint classes_school_id_class_teacher_id_fkey
    foreign key (school_id, class_teacher_id)
    references public.teachers (school_id, id)
    on delete restrict
    on update no action
);

comment on table public.classes is
  'School-owned classes within an academic year.';

comment on column public.classes.class_teacher_id is
  'ON DELETE RESTRICT: deleting a teacher who still owns a class fails loudly and forces reassignment, rather than orphaning the class mid-term.';

create trigger classes_set_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. class_subjects — SCHOOL-OWNED (join)
--
-- Design §C table 20. Replaces the frontend's SchoolClass.subject: string[].
--
-- teacher_id is nullable: a subject may be timetabled for a class before anyone
-- is assigned to teach it.
-- -----------------------------------------------------------------------------

create table public.class_subjects (
  id          uuid         not null default gen_random_uuid(),
  school_id   uuid         not null,
  class_id    uuid         not null,
  subject_id  uuid         not null,
  teacher_id  uuid,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),

  constraint class_subjects_pkey
    primary key (id),
  constraint class_subjects_school_id_class_id_subject_id_key
    unique (school_id, class_id, subject_id),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint class_subjects_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 row 48 — COMPOSITE, CASCADE.
  constraint class_subjects_school_id_class_id_fkey
    foreign key (school_id, class_id)
    references public.classes (school_id, id)
    on delete cascade
    on update no action,

  -- §13 row 49 — COMPOSITE, CASCADE.
  constraint class_subjects_school_id_subject_id_fkey
    foreign key (school_id, subject_id)
    references public.subjects (school_id, id)
    on delete cascade
    on update no action,

  -- §13 row 50 — COMPOSITE, SET NULL, SCOPED to teacher_id so school_id survives.
  constraint class_subjects_school_id_teacher_id_fkey
    foreign key (school_id, teacher_id)
    references public.teachers (school_id, id)
    on delete set null (teacher_id)
    on update no action
);

comment on table public.class_subjects is
  'Which subjects a class studies, and who teaches each. Replaces the frontend SchoolClass.subject string array.';

create trigger class_subjects_set_updated_at
  before update on public.class_subjects
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. class_enrollments — SCHOOL-OWNED
--
-- Design §C table 21. THIS TABLE IS WHAT REPLACES students.class_id.
--
-- Class membership is TIME-SCOPED: a student sits in a class for an academic
-- year and then moves on, and the record of where they sat must survive the
-- move. left_on IS NULL means "currently enrolled"; a set left_on is history and
-- is retained without limit.
--
-- The partial unique below is the structural guarantee that a student sits in
-- exactly ONE active class per academic year. It is partial precisely so that
-- historical enrollments do not collide with the current one.
-- -----------------------------------------------------------------------------

create table public.class_enrollments (
  id                uuid         not null default gen_random_uuid(),
  school_id         uuid         not null,
  class_id          uuid         not null,
  student_id        uuid         not null,
  academic_year_id  uuid         not null,
  enrolled_on       date         not null default current_date,
  left_on           date,
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now(),

  constraint class_enrollments_pkey
    primary key (id),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint class_enrollments_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 row 51 — COMPOSITE, CASCADE.
  constraint class_enrollments_school_id_class_id_fkey
    foreign key (school_id, class_id)
    references public.classes (school_id, id)
    on delete cascade
    on update no action,

  -- §13 row 52 — COMPOSITE, CASCADE.
  constraint class_enrollments_school_id_student_id_fkey
    foreign key (school_id, student_id)
    references public.students (school_id, id)
    on delete cascade
    on update no action,

  -- §13 row 53 — COMPOSITE, CASCADE.
  constraint class_enrollments_school_id_academic_year_id_fkey
    foreign key (school_id, academic_year_id)
    references public.academic_years (school_id, id)
    on delete cascade
    on update no action
);

comment on table public.class_enrollments is
  'Time-scoped class membership. Replaces students.class_id: left_on IS NULL means currently enrolled, and past enrollments are retained.';

-- ONE ACTIVE CLASS PER STUDENT PER YEAR, enforced structurally.
create unique index class_enrollments_school_id_student_id_year_active_idx
  on public.class_enrollments (school_id, student_id, academic_year_id)
  where left_on is null;

-- The class roster query: who is in this class right now.
create index class_enrollments_school_id_class_id_active_idx
  on public.class_enrollments (school_id, class_id)
  where left_on is null;

-- A student's full enrollment history, current and past. Not served by the
-- partial index above, which by design excludes departed rows.
create index class_enrollments_school_id_student_id_idx
  on public.class_enrollments (school_id, student_id);

create trigger class_enrollments_set_updated_at
  before update on public.class_enrollments
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. timetable_slots — SCHOOL-OWNED
--
-- Design §C table 22.
--
-- day_of_week is smallint carrying ISO day numbers, 1 = Monday through
-- 7 = Sunday — NOT the frontend's 'Monday'|...|'Friday' string union. Storing
-- ISO numbers is what allows schools.weekend_days = '{5,6}' (Friday-Saturday,
-- the Somali weekend) to work at all; a Monday-to-Friday string union cannot
-- represent a Saturday lesson, let alone a Friday weekend.
--
-- Two uniques, doing different jobs:
--   - one class cannot hold two lessons in the same period
--   - one TEACHER cannot be booked into two rooms in the same period, which the
--     current frontend cannot detect at all
-- -----------------------------------------------------------------------------

create table public.timetable_slots (
  id           uuid         not null default gen_random_uuid(),
  school_id    uuid         not null,
  class_id     uuid         not null,
  teacher_id   uuid,
  subject_id   uuid,
  day_of_week  smallint     not null,
  period       smallint     not null,
  start_time   time         not null,
  end_time     time         not null,
  room         text,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now(),

  constraint timetable_slots_pkey
    primary key (id),

  -- One class, one lesson per period.
  constraint timetable_slots_school_id_class_id_day_period_key
    unique (school_id, class_id, day_of_week, period),

  -- ISO 8601 day numbering: 1 = Monday ... 7 = Sunday.
  constraint timetable_slots_day_of_week_check
    check (day_of_week between 1 and 7),
  constraint timetable_slots_times_check
    check (end_time > start_time),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint timetable_slots_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 row 54 — COMPOSITE, CASCADE.
  constraint timetable_slots_school_id_class_id_fkey
    foreign key (school_id, class_id)
    references public.classes (school_id, id)
    on delete cascade
    on update no action,

  -- §13 row 55 — COMPOSITE, SET NULL, SCOPED to teacher_id.
  constraint timetable_slots_school_id_teacher_id_fkey
    foreign key (school_id, teacher_id)
    references public.teachers (school_id, id)
    on delete set null (teacher_id)
    on update no action,

  -- §13 row 56 — COMPOSITE, SET NULL, SCOPED to subject_id.
  constraint timetable_slots_school_id_subject_id_fkey
    foreign key (school_id, subject_id)
    references public.subjects (school_id, id)
    on delete set null (subject_id)
    on update no action
);

comment on table public.timetable_slots is
  'Weekly timetable. day_of_week is ISO 1=Monday..7=Sunday, which is what allows a Friday-Saturday weekend to be represented.';

comment on column public.timetable_slots.day_of_week is
  'ISO 8601 day number: 1 = Monday through 7 = Sunday. Never a day name.';

-- PREVENTS DOUBLE-BOOKING A TEACHER: the same person cannot be timetabled twice
-- in one period. Partial, because an unassigned slot (teacher_id NULL) must not
-- collide with any other unassigned slot.
create unique index timetable_slots_school_id_teacher_id_day_period_idx
  on public.timetable_slots (school_id, teacher_id, day_of_week, period)
  where teacher_id is not null;

create trigger timetable_slots_set_updated_at
  before update on public.timetable_slots
  for each row execute function public.set_updated_at();


-- =============================================================================
-- NOTE ON INDEXES NOT CREATED
--
-- The design's index lists name required ACCESS PATHS, not distinct index
-- objects — §C table 10 states this itself with "Index (shortcode) (unique
-- already)". Where a constraint's own index already serves a listed path as its
-- leading columns, no duplicate object is created:
--
--   classes (school_id, academic_year_id)
--       served by classes_school_id_academic_year_id_name_key
--       (btree on (school_id, academic_year_id, name) — leading columns match)
--   classes (school_id)
--       served by classes_school_id_id_key
--
-- class_enrollments (school_id, student_id) IS created despite the partial
-- unique on (school_id, student_id, academic_year_id): that index is PARTIAL and
-- excludes departed enrollments, so it cannot serve a query over a student's
-- full history.
-- =============================================================================
