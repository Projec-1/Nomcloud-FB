-- =============================================================================
-- CORRECTIVE — deleting a class must not destroy its academic records
-- Nom Cloud
--
-- Fixes docs/SYSTEM_ISSUES_LIST.md S1. Corrects design migrations 08 and 09
-- (20260904000008_classes_and_timetable, 20260904000009_teaching_records),
-- which gave every class_id foreign key ON DELETE CASCADE per SCHEMA_DESIGN §13.
--
-- THE DEFECT, MEASURED. An administrator deleting a class that had one
-- attendance record, one grade, one homework and one enrolment got OK rows=1,
-- and all four were gone afterwards. The confirm dialog on that button reads
-- "A class with records attached to it cannot be removed", and
-- classService.deleteClass already translates 23503 into "still has records
-- attached to it and cannot be removed". The interface was written for a
-- restriction the database never had.
--
-- WHY RESTRICT, AND WHY THIS IS NOT A NEW PRODUCT DECISION. Two decisions
-- already on record say these rows must not vanish with their class:
--   - SCHEMA_DESIGN §10 classifies attendance_records, grade_records and exams
--     as ARCHIVAL ("OP → AR"), grade_records as "likely the longest academic
--     retention (transcripts)", and requires that a student's "aggregate
--     history survive". The CASCADE rows in §13 were set per foreign key and
--     never reconciled with §10.
--   - The shipped UI promises that a class with records cannot be removed.
-- RESTRICT makes the database keep the promise both of those already make. It
-- also matches the schema's existing pattern for things that must fail loudly
-- rather than disappear: classes.class_teacher_id and classes.campus_id are
-- RESTRICT, and fee_payments is RESTRICT from fee_records.
--
-- WHAT CHANGES (ON DELETE CASCADE → ON DELETE RESTRICT, same columns, same
-- composite target, same constraint names):
--   attendance_records  archival (§10)
--   grade_records       archival, longest retention (§10)
--   exams               archival, "retained with grades for context" (§10)
--   class_enrollments   the record of which pupils were in the class. Deleting
--                       a class that still has pupils must not silently
--                       un-enrol them; closed enrolments are history too.
--   homework            §10 marks homework OP/DEL (purgeable by age), but
--                       that is purging homework rows directly, which RESTRICT
--                       does not prevent. It does prevent homework, and the
--                       submissions and teacher feedback beneath it, being
--                       destroyed as a side effect of removing a class.
--
-- WHAT DELIBERATELY STAYS CASCADE — class configuration, not history, and
-- meaningless without the class:
--   timetable_slots, class_subjects, announcements (audience = 'class' only;
--   the paired CHECK makes class_id NULL for every other audience).
-- The confirm dialog now says these are removed with the class.
--
-- CONSEQUENCES, MEASURED IN ROLLED-BACK PROBES (the RESTRICT choice on one
-- table before applying; all five tables after applying — see docs/MIGRATIONS.md):
--   - Deleting a class with any of the five record types now fails 23503.
--   - Deleting an empty class still works, and its timetable, subject
--     assignments and class announcements are still removed with it.
--   - Deleting an academic year whose classes hold records now fails 23503
--     too, because academic_years → classes is CASCADE and the class delete
--     it triggers is refused. That is the same history protection, reached
--     one level up.
--   - Deleting a whole school still succeeds: the school's cascade removes the
--     records through their own school_id foreign keys in the same statement.
--
-- WHY RESTRICT RATHER THAN NO ACTION. Both refuse the delete. RESTRICT checks
-- immediately, which is what the existing class_teacher_id, campus_id and
-- fee_payments constraints use; whole-school deletion was verified to succeed
-- with it, so the deferred check of NO ACTION buys nothing here.
--
-- Nothing is added or removed from any policy, grant, index or function.
-- Existing rows already satisfy the constraints; re-adding them validates.
-- =============================================================================

alter table public.attendance_records
  drop constraint attendance_records_school_id_class_id_fkey,
  add constraint attendance_records_school_id_class_id_fkey
    foreign key (school_id, class_id) references public.classes (school_id, id)
    on delete restrict;

alter table public.grade_records
  drop constraint grade_records_school_id_class_id_fkey,
  add constraint grade_records_school_id_class_id_fkey
    foreign key (school_id, class_id) references public.classes (school_id, id)
    on delete restrict;

alter table public.exams
  drop constraint exams_school_id_class_id_fkey,
  add constraint exams_school_id_class_id_fkey
    foreign key (school_id, class_id) references public.classes (school_id, id)
    on delete restrict;

alter table public.class_enrollments
  drop constraint class_enrollments_school_id_class_id_fkey,
  add constraint class_enrollments_school_id_class_id_fkey
    foreign key (school_id, class_id) references public.classes (school_id, id)
    on delete restrict;

alter table public.homework
  drop constraint homework_school_id_class_id_fkey,
  add constraint homework_school_id_class_id_fkey
    foreign key (school_id, class_id) references public.classes (school_id, id)
    on delete restrict;
