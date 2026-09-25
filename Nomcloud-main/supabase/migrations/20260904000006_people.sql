-- =============================================================================
-- Migration 07 — people
-- Nom Cloud · Phase 3 (production schema)
--
-- Design number 07. See docs/MIGRATIONS.md for the numbering convention.
--
--   public.teachers           — SCHOOL-OWNED
--   public.guardians          — SCHOOL-OWNED
--   public.students           — SCHOOL-OWNED
--   public.student_guardians  — SCHOOL-OWNED (join)
--
-- Plus the FOUR composite foreign keys owed since Migration 04 — see the section
-- at the end of this file.
--
-- Depends on Migration 01 (public.set_updated_at), Migration 03 (public.schools),
-- Migration 04 (public.memberships, public.invitations) and Migration 06
-- (public.subjects). Creates NO row-level security policies (Phase 7).
--
-- Tenancy rules, applied in full (§13):
--   - every table carries school_id uuid NOT NULL
--   - school_id -> schools(id) ON DELETE CASCADE, single-column (rows 19-41):
--     schools is the TENANT ROOT, school_id IS the tenant key
--   - every school-owned -> school-owned reference is COMPOSITE
--   - teachers, guardians and students each carry UNIQUE (school_id, id), since
--     migrations 04 and 08-11 reference all three compositely
--
-- Conventions from §A.1 apply without being repeated. citext is qualified as
-- extensions.citext; gen_random_uuid() is not qualified.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. teachers — SCHOOL-OWNED
--
-- Design §C table 15. The EMPLOYMENT record.
--
-- It EXISTS BEFORE AN ACCOUNT DOES: a school records a teacher long before that
-- person signs in, and some never do. There is deliberately NO user_id column
-- here — the person-to-employment link lives on memberships.teacher_id, which is
-- also what allows one human to hold both a teacher and a parent membership at
-- the same school.
-- -----------------------------------------------------------------------------

create table public.teachers (
  id                  uuid               not null default gen_random_uuid(),
  school_id           uuid               not null,
  full_name           text               not null,
  email               extensions.citext,
  phone               text,
  staff_no            text,
  primary_subject_id  uuid,
  status              text               not null default 'active',
  joined_date         date               not null default current_date,
  created_at          timestamptz        not null default now(),
  updated_at          timestamptz        not null default now(),

  constraint teachers_pkey
    primary key (id),

  -- Composite-FK target for memberships (§13 row 11), invitations (row 15),
  -- classes.class_teacher_id (row 47) and class_subjects.teacher_id (row 50).
  constraint teachers_school_id_id_key
    unique (school_id, id),

  -- §C table 15 defines this vocabulary: active / inactive.
  constraint teachers_status_check
    check (status in ('active', 'inactive')),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint teachers_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 row 43 — COMPOSITE, SET NULL. Retiring a subject must never delete
  -- staff; the teacher simply loses their primary-subject assignment.
  constraint teachers_school_id_primary_subject_id_fkey
    foreign key (school_id, primary_subject_id)
    references public.subjects (school_id, id)
    on delete set null
    on update no action
);

comment on table public.teachers is
  'Employment record, school-owned. Exists before an account does — the person link lives on memberships.teacher_id, not here.';

-- Partial uniques: both columns are optional, and NULL must not collide with
-- NULL. A school may hold many teachers with no email and no staff number.
create unique index teachers_school_id_email_idx
  on public.teachers (school_id, email)
  where email is not null;

create unique index teachers_school_id_staff_no_idx
  on public.teachers (school_id, staff_no)
  where staff_no is not null;

create index teachers_school_id_status_idx
  on public.teachers (school_id, status);

create trigger teachers_set_updated_at
  before update on public.teachers
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. guardians — SCHOOL-OWNED
--
-- Design §C table 16. Named GUARDIANS, not parents: many are grandparents,
-- aunts, or legal guardians. Renaming now is free; renaming after launch is not.
--
-- status carries NO CHECK. §C table 16 gives the column and its 'active' default
-- but names no vocabulary, unlike teachers and students which both enumerate
-- theirs. Under the standing rule a status column is constrained only where the
-- design defines the values, so this one stays plain text until they are.
-- -----------------------------------------------------------------------------

create table public.guardians (
  id          uuid               not null default gen_random_uuid(),
  school_id   uuid               not null,
  full_name   text               not null,
  email       extensions.citext,
  phone       text               not null,
  status      text               not null default 'active',
  created_at  timestamptz        not null default now(),
  updated_at  timestamptz        not null default now(),

  constraint guardians_pkey
    primary key (id),

  -- Composite-FK target for memberships (§13 row 12), invitations (row 16) and
  -- student_guardians (row 45).
  constraint guardians_school_id_id_key
    unique (school_id, id),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint guardians_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade
);

comment on table public.guardians is
  'Named guardians, not parents — many are grandparents, aunts or legal guardians.';

comment on column public.guardians.status is
  'Plain text, deliberately unconstrained: the design defines no vocabulary for this column. Add a CHECK only once one is approved.';

create unique index guardians_school_id_email_idx
  on public.guardians (school_id, email)
  where email is not null;

create trigger guardians_set_updated_at
  before update on public.guardians
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. students — SCHOOL-OWNED
--
-- Design §C table 17.
--
-- NO class_id COLUMN. Class membership is TIME-SCOPED — a student belongs to a
-- class for an academic year, and moves on — so it lives in class_enrollments
-- (Migration 08). This is the largest single divergence from the frontend, which
-- currently stores one class per student, and is called out in design §E.
-- -----------------------------------------------------------------------------

create table public.students (
  id             uuid         not null default gen_random_uuid(),
  school_id      uuid         not null,
  full_name      text         not null,
  admission_no   text         not null,
  gender         text,
  date_of_birth  date,
  status         text         not null default 'active',
  enrolled_date  date         not null default current_date,
  photo_path     text,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now(),

  constraint students_pkey
    primary key (id),

  -- PER-SCHOOL uniqueness: two schools may each issue admission number '001'.
  constraint students_school_id_admission_no_key
    unique (school_id, admission_no),

  -- Composite-FK target for student_guardians (§13 row 44) and
  -- class_enrollments (row 52).
  constraint students_school_id_id_key
    unique (school_id, id),

  constraint students_gender_check
    check (gender in ('male', 'female', 'other')),

  -- CURRENT_DATE is STABLE, not IMMUTABLE. PostgreSQL permits it in a CHECK, but
  -- the constraint is evaluated only on write: an existing row is never
  -- re-validated, so a date of birth stays valid as the clock moves forward.
  -- That is the intended behaviour here — this guards data entry, not history.
  constraint students_date_of_birth_check
    check (date_of_birth < current_date),

  -- §C table 17 defines this vocabulary.
  constraint students_status_check
    check (status in ('active', 'inactive', 'graduated', 'transferred')),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint students_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade
);

comment on table public.students is
  'School-owned student records. No class_id: class membership is time-scoped and lives in class_enrollments.';

comment on column public.students.admission_no is
  'Unique within the school only. Two schools may both issue 001.';

create index students_school_id_status_idx
  on public.students (school_id, status);

create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. student_guardians — SCHOOL-OWNED (join)
--
-- Design §C table 18. Replaces the frontend's one-parent-per-student
-- (Student.parentId) with the many-to-many reality: two parents, separated
-- households, and siblings sharing guardians.
-- -----------------------------------------------------------------------------

create table public.student_guardians (
  id            uuid         not null default gen_random_uuid(),
  school_id     uuid         not null,
  student_id    uuid         not null,
  guardian_id   uuid         not null,
  relationship  text,
  is_primary    boolean      not null default false,
  can_pickup    boolean      not null default true,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),

  constraint student_guardians_pkey
    primary key (id),
  constraint student_guardians_school_id_student_id_guardian_id_key
    unique (school_id, student_id, guardian_id),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint student_guardians_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 row 44 — COMPOSITE, CASCADE.
  constraint student_guardians_school_id_student_id_fkey
    foreign key (school_id, student_id)
    references public.students (school_id, id)
    on delete cascade
    on update no action,

  -- §13 row 45 — COMPOSITE, CASCADE.
  constraint student_guardians_school_id_guardian_id_fkey
    foreign key (school_id, guardian_id)
    references public.guardians (school_id, id)
    on delete cascade
    on update no action
);

comment on table public.student_guardians is
  'Many-to-many link between students and guardians. Replaces the frontend one-parent-per-student assumption.';

-- ONE PRIMARY CONTACT PER STUDENT. Partial, so any number of non-primary
-- guardians may be attached alongside.
create unique index student_guardians_school_id_student_id_primary_idx
  on public.student_guardians (school_id, student_id)
  where is_primary;

-- Drives the entire parent portal: every screen a guardian sees starts here.
create index student_guardians_school_id_guardian_id_idx
  on public.student_guardians (school_id, guardian_id);

create trigger student_guardians_set_updated_at
  before update on public.student_guardians
  for each row execute function public.set_updated_at();


-- =============================================================================
-- 5. THE FOUR COMPOSITE FKs OWED SINCE MIGRATION 04
--
-- Migration 04 created memberships.teacher_id / guardian_id and
-- invitations.teacher_id / guardian_id, together with the positive role/identity
-- CHECK, but could not constrain them: teachers and guardians did not exist.
-- Until this point those columns accepted ANY uuid. They no longer do.
--
-- Each is COMPOSITE — (school_id, x) -> target(school_id, id) — so a membership
-- or invitation can never reference another school's teacher or guardian.
--
-- ON DELETE CASCADE is deliberate (§16), not a way to satisfy the positive
-- CHECK. Deleting a teachers row ENDS that teacher membership, because the
-- membership had no meaning without the employment record it describes. The
-- person's profiles row SURVIVES, and any other role membership at the same
-- school survives with it — Fadumo's parent membership is untouched by the
-- deletion of her teachers row. status='inactive' on the teachers/guardians row
-- is the NORMAL path; hard deletion is exceptional and audited.
--
-- These four ALTER statements are the only ALTERs in this migration, they touch
-- only memberships and invitations, and each adds a FOREIGN KEY and nothing else.
-- =============================================================================

-- §13 row 11, §16.
alter table public.memberships
  add constraint memberships_school_id_teacher_id_fkey
  foreign key (school_id, teacher_id)
  references public.teachers (school_id, id)
  on delete cascade
  on update no action;

-- §13 row 12, §16.
alter table public.memberships
  add constraint memberships_school_id_guardian_id_fkey
  foreign key (school_id, guardian_id)
  references public.guardians (school_id, id)
  on delete cascade
  on update no action;

-- §13 row 15, §17.
alter table public.invitations
  add constraint invitations_school_id_teacher_id_fkey
  foreign key (school_id, teacher_id)
  references public.teachers (school_id, id)
  on delete cascade
  on update no action;

-- §13 row 16, §17.
alter table public.invitations
  add constraint invitations_school_id_guardian_id_fkey
  foreign key (school_id, guardian_id)
  references public.guardians (school_id, id)
  on delete cascade
  on update no action;


-- =============================================================================
-- NOTE ON INDEXES NOT CREATED
--
-- The design's index lists name required ACCESS PATHS, not distinct index
-- objects — §C table 10 states this itself with "Index (shortcode) (unique
-- already)". Where a constraint's own index already serves a listed path as its
-- leading columns, no duplicate object is created here:
--
--   teachers (school_id)                     served by teachers_school_id_id_key
--   guardians (school_id)                    served by guardians_school_id_id_key
--   students (school_id)                     served by students_school_id_id_key
--   students (school_id, admission_no)       served by students_school_id_admission_no_key
--   student_guardians (school_id, student_id)
--                served by student_guardians_school_id_student_id_guardian_id_key
--
-- Duplicating these would add write cost on the highest-volume tables in the
-- schema for no read benefit.
-- =============================================================================
