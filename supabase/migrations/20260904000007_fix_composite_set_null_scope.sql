-- =============================================================================
-- CORRECTIVE — fix_composite_set_null_scope
-- Corrects: Migration 07 (people) — teachers_school_id_primary_subject_id_fkey
-- Nom Cloud · Phase 3 (production schema)
--
-- This migration carries NO design number. Design numbers 01-11 are reserved for
-- the §I plan, and 08 means classes_and_timetable. See docs/MIGRATIONS.md.
--
-- WHY
-- Migration 07 created, per §13 row 43:
--     FOREIGN KEY (school_id, primary_subject_id)
--     REFERENCES subjects (school_id, id) ON DELETE SET NULL
-- Plain ON DELETE SET NULL nulls EVERY referencing column, school_id included.
-- school_id is NOT NULL on every school-owned table, so deleting a subject that
-- is some teacher's primary subject fails with SQLSTATE 23502 rather than
-- clearing the assignment. That is RESTRICT behaviour wearing a SET NULL label,
-- and it contradicts §13 row 43's stated intent: "losing a subject must not
-- delete staff".
--
-- EVIDENCE — measured on this database, using temp tables that touched nothing
-- in public, reproducing the exact shape (composite FK, NOT NULL leading column):
--
--   plain  ON DELETE SET NULL              -> DELETE FAILED
--          23502: null value in column "school_id" violates not-null constraint
--
--   scoped ON DELETE SET NULL (ref_id)     -> DELETE SUCCEEDED
--          surviving child row: school_id intact, ref_id NULL
--
-- The scoped column-list form (PostgreSQL 15+; this project runs 17) IMPLEMENTS
-- the design's stated behaviour. It does NOT change the design. The ON DELETE
-- action is still SET NULL; only the set of columns it nulls is narrowed from
-- "all referencing columns" to "the reference itself", which is what §13 row 43
-- describes in prose and what a single-column SET NULL would have done natively.
--
-- MIGRATION 07's FILE IS LEFT UNTOUCHED.
-- 20260904000006_people.sql is an applied historical record and is never
-- rewritten. Its description of this one constraint is SUPERSEDED by this
-- header; everything else in that file remains accurate. The other twenty-odd
-- constraints it created are unaffected.
--
-- FORWARD RULE
-- Migration 08 applies the same scoped syntax to §13 rows 50, 55 and 56 —
-- class_subjects (school_id, teacher_id), timetable_slots (school_id, teacher_id)
-- and timetable_slots (school_id, subject_id) — and every later composite
-- SET NULL follows suit. Recorded in docs/MIGRATIONS.md.
--
-- DROP CONSTRAINT is written WITHOUT "IF EXISTS": if the constraint is already
-- absent, the live schema is not what we believe it to be, and this migration
-- must fail loudly rather than pass in silence.
--
-- No column, index, trigger, table or other constraint is affected.
-- Creates NO row-level security policies (Phase 7).
-- =============================================================================

alter table public.teachers
  drop constraint teachers_school_id_primary_subject_id_fkey;

alter table public.teachers
  add constraint teachers_school_id_primary_subject_id_fkey
  foreign key (school_id, primary_subject_id)
  references public.subjects (school_id, id)
  on delete set null (primary_subject_id)
  on update no action;
