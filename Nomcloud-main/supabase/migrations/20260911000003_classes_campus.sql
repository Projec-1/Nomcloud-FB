-- =============================================================================
-- Campus/role expansion Migration 4 of 8 — classes_campus
-- Nom Cloud
--
-- Adds campus ownership to public.classes, and only to public.classes.
--
-- Per docs/CAMPUS_ROLE_DESIGN.md §B.2 and §B.3, `classes` is the single campus
-- anchor: class_subjects, class_enrollments, timetable_slots,
-- attendance_records, grade_records, homework, homework_submissions and exams
-- all reach campus by following their existing composite foreign key to
-- classes. Repeating campus_id on those tables would create a second
-- consistency obligation for a value that is already derivable, so none of
-- them is touched here.
--
-- Depends on Migration 1 (public.campuses) and Phase 3 Migration 08
-- (public.classes). Does NOT touch memberships, membership_campus_scopes,
-- invitations or accept_invitation (Migrations 3, 6 and 7).
--
-- Creates NO row-level security policies (Phase 7).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- classes.campus_id
-- -----------------------------------------------------------------------------
-- Nullable on purpose. Classes created before campuses existed have no campus
-- and must not be silently assigned one. There are zero rows in this database
-- today, but the column stays nullable so the same migration is correct against
-- any deployment that already holds classes. Making it NOT NULL is a separate
-- decision that belongs after campus assignment is an actual product workflow.

alter table public.classes
  add column campus_id uuid;

comment on column public.classes.campus_id is
  'Physical campus offering this class. Null means no campus has been assigned yet, which is the state of every class created before campuses existed. Class descendants derive campus through their composite foreign key to classes and must not carry campus_id of their own (CAMPUS_ROLE_DESIGN.md B.3).';

-- -----------------------------------------------------------------------------
-- Composite tenancy
-- -----------------------------------------------------------------------------
-- ON DELETE RESTRICT, matching classes_school_id_class_teacher_id_fkey.
--
-- Deleting a campus that still has classes must fail loudly. CASCADE would
-- destroy the class and, through the existing cascades, its enrolments,
-- attendance and grade history. SET NULL would silently detach the academic
-- record from the site it was taught at, losing that fact with no trace.
-- Campuses already carry an active/inactive lifecycle (Migration 1), so the
-- intended way to retire a site is to deactivate it, not delete it. RESTRICT
-- forces classes to be reassigned or removed first.

alter table public.classes
  add constraint classes_school_id_campus_id_fkey
  foreign key (school_id, campus_id)
  references public.campuses (school_id, id)
  on delete restrict;

-- -----------------------------------------------------------------------------
-- Campus-aware class naming
-- -----------------------------------------------------------------------------
-- Replaces UNIQUE (school_id, academic_year_id, name) so two campuses in one
-- school may each run their own 'Grade 5A' in the same academic year.
--
-- NULLS NOT DISTINCT is the point of this form. Postgres treats NULLs as
-- distinct in a unique index by default, so the plain campus-aware constraint
-- would let unlimited duplicate names accumulate among classes that have no
-- campus assigned, quietly weakening the guarantee that exists today. Treating
-- NULL campus ids as equal keeps the old protection for unassigned classes
-- while granting the new per-campus freedom. Requires Postgres 15 or later;
-- this project runs 17.6.

alter table public.classes
  drop constraint classes_school_id_academic_year_id_name_key;

create unique index classes_school_id_campus_id_academic_year_id_name_key
  on public.classes (school_id, campus_id, academic_year_id, name)
  nulls not distinct;

-- -----------------------------------------------------------------------------
-- Campus lookup index
-- -----------------------------------------------------------------------------
-- No existing index on classes leads with (school_id, campus_id): the others
-- lead with (id), (school_id, id) and (school_id, academic_year_id, name), and
-- the new unique index above leads with (school_id, campus_id) but is not
-- relied on here because its shape may change independently. An explicit index
-- supports campus-filtered class listing and the RESTRICT check on campus
-- delete.

create index classes_school_id_campus_id_idx
  on public.classes (school_id, campus_id);
