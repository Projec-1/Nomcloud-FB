-- =============================================================================
-- Migration 09 — teaching_records
-- Nom Cloud · Phase 3 (production schema)
--
-- Design number 09. See docs/MIGRATIONS.md for the numbering convention.
--
--   public.attendance_records     — SCHOOL-OWNED (highest volume in the design)
--   public.grade_records          — SCHOOL-OWNED
--   public.homework               — SCHOOL-OWNED
--   public.homework_submissions   — SCHOOL-OWNED
--   public.exams                  — SCHOOL-OWNED
--
-- Depends on Migration 01 (public.attendance_status, public.set_updated_at),
-- 03 (schools), 04 (profiles), 06 (subjects, terms), 07 (students) and
-- 08 (classes). Creates NO row-level security policies (Phase 7).
--
-- =============================================================================
-- SCOPED SET NULL — derived from §13 rows 57-69
-- =============================================================================
-- Filtering rows 57-69 to ON DELETE SET NULL yields EXACTLY ZERO. All thirteen
-- are CASCADE or RESTRICT, so no column-list syntax is required anywhere in this
-- migration's composite foreign keys.
--
-- The three SET NULL foreign keys here are audit rows 79, 80 and 81 —
-- attendance_records.marked_by, grade_records.recorded_by and homework.created_by
-- — and all are SINGLE-COLUMN to profiles(id). They are attribution-only: they
-- record who did something and grant no access, so they are deliberately NOT
-- tenant-bound. A single-column SET NULL nulls only that one nullable column and
-- needs no list. Row 79's audit note says as much: making them composite would
-- have forced the column-list form to avoid nulling the NOT NULL school_id.
--
-- =============================================================================
-- FIVE RESTRICTS — academic history is never collateral damage
-- =============================================================================
--   row 61  grade_records (school_id, subject_id) -> subjects
--   row 62  grade_records (school_id, term_id)    -> terms
--   row 64  homework      (school_id, subject_id) -> subjects
--   row 68  exams         (school_id, subject_id) -> subjects
--   row 69  exams         (school_id, term_id)    -> terms
--
-- Deleting a subject or a term that has academic records against it must BLOCK.
-- These are not an inconsistency with the CASCADEs beside them: a student
-- leaving takes their own records with them, but retiring a subject must never
-- silently erase the grades earned in it. Subjects are retired with
-- is_active = false, terms by closing their academic year.
--
-- =============================================================================
-- NO DERIVED VALUES ARE STORED (§F)
-- =============================================================================
-- grade_records carries NO letter-grade column. A letter is derived from
-- score / max_score under the school's grading_scale at read time. Storing it
-- would mean a later scale change silently invalidates every historical record.
-- Only an issued report card may snapshot a letter, and that is Phase 8+.
--
-- Conventions from §A.1 apply without being repeated. gen_random_uuid() is left
-- unqualified. No citext column is needed in this migration.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. attendance_records — SCHOOL-OWNED
--
-- Design §C table 23. THE HIGHEST-VOLUME TABLE IN THE DESIGN:
-- roughly 200 students x 200 school days = ~40,000 rows per school per year.
-- Indexing here matters more than anywhere else in the schema, which is why all
-- three access paths below are explicit rather than left to a shared prefix.
--
-- status is the attendance_status ENUM from Migration 01, not text: the
-- vocabulary is fixed and shared, which is exactly when an enum is correct.
-- -----------------------------------------------------------------------------

create table public.attendance_records (
  id          uuid                       not null default gen_random_uuid(),
  school_id   uuid                       not null,
  student_id  uuid                       not null,
  class_id    uuid                       not null,
  date        date                       not null,
  status      public.attendance_status   not null,
  note        text,
  marked_by   uuid,
  marked_at   timestamptz                not null default now(),
  created_at  timestamptz                not null default now(),
  updated_at  timestamptz                not null default now(),

  constraint attendance_records_pkey
    primary key (id),

  -- ONE RECORD PER STUDENT PER DAY. See §J for the per-period caveat.
  constraint attendance_records_school_id_student_id_date_key
    unique (school_id, student_id, date),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint attendance_records_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 row 57 — COMPOSITE, CASCADE.
  constraint attendance_records_school_id_student_id_fkey
    foreign key (school_id, student_id)
    references public.students (school_id, id)
    on delete cascade
    on update no action,

  -- §13 row 58 — COMPOSITE, CASCADE.
  constraint attendance_records_school_id_class_id_fkey
    foreign key (school_id, class_id)
    references public.classes (school_id, id)
    on delete cascade
    on update no action,

  -- §13 row 79 — SINGLE-COLUMN, SET NULL. Attribution only; who marked it must
  -- survive staff turnover. Not tenant-bound, so no column list is needed.
  constraint attendance_records_marked_by_fkey
    foreign key (marked_by) references public.profiles (id) on delete set null
);

comment on table public.attendance_records is
  'Daily attendance. Highest-volume table in the design: roughly 40k rows per school per year.';

-- The attendance marker screen: one class, one day.
create index attendance_records_school_id_class_id_date_idx
  on public.attendance_records (school_id, class_id, date);

-- The parent view: one student, most recent first.
create index attendance_records_school_id_student_id_date_idx
  on public.attendance_records (school_id, student_id, date desc);

-- School-wide reporting for a date.
create index attendance_records_school_id_date_idx
  on public.attendance_records (school_id, date);

create trigger attendance_records_set_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. grade_records — SCHOOL-OWNED
--
-- Design §C table 24.
--
-- NO LETTER-GRADE COLUMN (§F). Derived from score / max_score under the school's
-- grading_scale at read time.
--
-- The unique key means re-entering a score UPDATES rather than duplicates, which
-- the current frontend cannot guarantee.
-- -----------------------------------------------------------------------------

create table public.grade_records (
  id           uuid           not null default gen_random_uuid(),
  school_id    uuid           not null,
  student_id   uuid           not null,
  class_id     uuid           not null,
  subject_id   uuid           not null,
  term_id      uuid           not null,
  assessment   text           not null,
  score        numeric(6,2)   not null,
  max_score    numeric(6,2)   not null default 100,
  comment      text,
  recorded_by  uuid,
  recorded_at  timestamptz    not null default now(),
  created_at   timestamptz    not null default now(),
  updated_at   timestamptz    not null default now(),

  constraint grade_records_pkey
    primary key (id),
  constraint grade_records_school_id_student_subject_term_assessment_key
    unique (school_id, student_id, subject_id, term_id, assessment),

  constraint grade_records_score_check
    check (score >= 0 and score <= max_score),
  constraint grade_records_max_score_check
    check (max_score > 0),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint grade_records_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 row 59 — COMPOSITE, CASCADE.
  constraint grade_records_school_id_student_id_fkey
    foreign key (school_id, student_id)
    references public.students (school_id, id)
    on delete cascade
    on update no action,

  -- §13 row 60 — COMPOSITE, CASCADE.
  constraint grade_records_school_id_class_id_fkey
    foreign key (school_id, class_id)
    references public.classes (school_id, id)
    on delete cascade
    on update no action,

  -- §13 row 61 — COMPOSITE, RESTRICT. Retiring a subject must not erase grades.
  constraint grade_records_school_id_subject_id_fkey
    foreign key (school_id, subject_id)
    references public.subjects (school_id, id)
    on delete restrict
    on update no action,

  -- §13 row 62 — COMPOSITE, RESTRICT. Same, for terms.
  constraint grade_records_school_id_term_id_fkey
    foreign key (school_id, term_id)
    references public.terms (school_id, id)
    on delete restrict
    on update no action,

  -- §13 row 80 — SINGLE-COLUMN, SET NULL. Attribution only.
  constraint grade_records_recorded_by_fkey
    foreign key (recorded_by) references public.profiles (id) on delete set null
);

comment on table public.grade_records is
  'Assessment scores. Carries NO letter grade: it is derived from score/max_score under the school grading scale at read time (§F).';

comment on column public.grade_records.score is
  'Raw score. The letter grade is never stored — a scale change must not invalidate history.';

-- A student's report for a term.
create index grade_records_school_id_student_id_term_id_idx
  on public.grade_records (school_id, student_id, term_id);

-- A teacher's mark book: one class, one subject, one term.
create index grade_records_school_id_class_subject_term_idx
  on public.grade_records (school_id, class_id, subject_id, term_id);

create trigger grade_records_set_updated_at
  before update on public.grade_records
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. homework — SCHOOL-OWNED
--
-- Design §C table 25.
-- -----------------------------------------------------------------------------

create table public.homework (
  id             uuid         not null default gen_random_uuid(),
  school_id      uuid         not null,
  class_id       uuid         not null,
  subject_id     uuid         not null,
  title          text         not null,
  description    text,
  assigned_date  date         not null,
  due_date       date         not null,
  created_by     uuid,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now(),

  constraint homework_pkey
    primary key (id),

  -- Composite-FK target for homework_submissions (§13 row 65).
  constraint homework_school_id_id_key
    unique (school_id, id),

  constraint homework_dates_check
    check (due_date >= assigned_date),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint homework_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 row 63 — COMPOSITE, CASCADE.
  constraint homework_school_id_class_id_fkey
    foreign key (school_id, class_id)
    references public.classes (school_id, id)
    on delete cascade
    on update no action,

  -- §13 row 64 — COMPOSITE, RESTRICT. Retiring a subject must not erase the work
  -- set in it.
  constraint homework_school_id_subject_id_fkey
    foreign key (school_id, subject_id)
    references public.subjects (school_id, id)
    on delete restrict
    on update no action,

  -- §13 row 81 — SINGLE-COLUMN, SET NULL. Attribution only.
  constraint homework_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null
);

comment on table public.homework is
  'Assignments set to a class. due_date >= assigned_date is enforced.';

create trigger homework_set_updated_at
  before update on public.homework
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. homework_submissions — SCHOOL-OWNED
--
-- Design §C table 26.
--
-- Promotes the frontend's embedded HomeworkSubmission[] ARRAY INTO ROWS. This is
-- not a stylistic preference: per-student RLS is impossible against an embedded
-- array. A parent must see their own child's submission and NOT the other 29 in
-- the same class, and Phase 7 can only express that if each submission is its
-- own row carrying its own student_id.
--
-- "grade" here is the teacher's mark on this piece of work, recorded as given.
-- It is NOT the derived letter grade forbidden by §F, which concerns
-- grade_records and is computed from score/max_score.
-- -----------------------------------------------------------------------------

create table public.homework_submissions (
  id            uuid         not null default gen_random_uuid(),
  school_id     uuid         not null,
  homework_id   uuid         not null,
  student_id    uuid         not null,
  status        text         not null,
  submitted_at  timestamptz,
  grade         text,
  feedback      text,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),

  constraint homework_submissions_pkey
    primary key (id),

  -- One submission row per student per assignment.
  constraint homework_submissions_school_id_homework_id_student_id_key
    unique (school_id, homework_id, student_id),

  -- §C table 26 defines this vocabulary.
  constraint homework_submissions_status_check
    check (status in ('pending', 'submitted', 'late', 'graded')),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint homework_submissions_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 row 65 — COMPOSITE, CASCADE.
  constraint homework_submissions_school_id_homework_id_fkey
    foreign key (school_id, homework_id)
    references public.homework (school_id, id)
    on delete cascade
    on update no action,

  -- §13 row 66 — COMPOSITE, CASCADE.
  constraint homework_submissions_school_id_student_id_fkey
    foreign key (school_id, student_id)
    references public.students (school_id, id)
    on delete cascade
    on update no action
);

comment on table public.homework_submissions is
  'One row per student per assignment. Rows rather than an embedded array, because per-student RLS in Phase 7 requires it.';

comment on column public.homework_submissions.grade is
  'The teacher mark on this piece of work, as given. Not a derived letter grade — that is forbidden on grade_records by §F.';

create trigger homework_submissions_set_updated_at
  before update on public.homework_submissions
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 5. exams — SCHOOL-OWNED
--
-- Design §C table 27.
-- -----------------------------------------------------------------------------

create table public.exams (
  id                uuid           not null default gen_random_uuid(),
  school_id         uuid           not null,
  class_id          uuid           not null,
  subject_id        uuid           not null,
  term_id           uuid           not null,
  name              text           not null,
  exam_date         date           not null,
  start_time        time,
  duration_minutes  integer,
  max_score         numeric(6,2),
  status            text           not null,
  room              text,
  created_at        timestamptz    not null default now(),
  updated_at        timestamptz    not null default now(),

  constraint exams_pkey
    primary key (id),
  constraint exams_school_id_class_subject_term_name_key
    unique (school_id, class_id, subject_id, term_id, name),

  constraint exams_duration_minutes_check
    check (duration_minutes > 0),
  constraint exams_max_score_check
    check (max_score > 0),

  -- §C table 27 defines this vocabulary.
  constraint exams_status_check
    check (status in ('scheduled', 'completed', 'cancelled')),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint exams_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 row 67 — COMPOSITE, CASCADE.
  constraint exams_school_id_class_id_fkey
    foreign key (school_id, class_id)
    references public.classes (school_id, id)
    on delete cascade
    on update no action,

  -- §13 row 68 — COMPOSITE, RESTRICT.
  constraint exams_school_id_subject_id_fkey
    foreign key (school_id, subject_id)
    references public.subjects (school_id, id)
    on delete restrict
    on update no action,

  -- §13 row 69 — COMPOSITE, RESTRICT.
  constraint exams_school_id_term_id_fkey
    foreign key (school_id, term_id)
    references public.terms (school_id, id)
    on delete restrict
    on update no action
);

comment on table public.exams is
  'Scheduled examinations. Schedule metadata only; results live in grade_records.';

-- The exam calendar for a school.
create index exams_school_id_exam_date_idx
  on public.exams (school_id, exam_date);

create trigger exams_set_updated_at
  before update on public.exams
  for each row execute function public.set_updated_at();


-- =============================================================================
-- NULLABILITY DECISIONS WHERE THE DESIGN IS SILENT
--
-- §C tables 25, 26 and 27 are written in terse prose rather than the column
-- tables used elsewhere, so nullability is not stated for several columns. The
-- rule applied, consistently: a column that IDENTIFIES or DEFINES the record is
-- NOT NULL; optional descriptive detail is nullable. Every such decision:
--
--   homework.title              NOT NULL  — an assignment without a title is not
--                                           an assignment
--   homework.description        NULL      — optional detail
--   homework_submissions.status NOT NULL, NO DEFAULT — vocabulary is given but no
--                                           default is; stating it at insert is
--                                           the conservative reading
--   exams.name, exams.exam_date NOT NULL  — both are part of the unique key or
--                                           define when the exam happens
--   exams.status                NOT NULL, NO DEFAULT — as above
--   exams.start_time,
--   exams.duration_minutes,
--   exams.max_score, exams.room NULL      — a scheduled exam may be announced
--                                           before its time, length, marks or
--                                           room are settled
--
-- The two exams CHECKs constrain only non-NULL values, which is the intended
-- behaviour: an unset duration is unknown, not invalid.
--
-- NOTE ON INDEXES NOT CREATED
-- grade_records (school_id, student_id, term_id) IS created despite the unique
-- key starting (school_id, student_id): that key continues with subject_id, so
-- it cannot serve a term-scoped lookup across subjects.
-- No index was skipped in this migration.
-- =============================================================================
