-- =============================================================================
-- Phase 7 / Migration 12 — teaching_records_rls  (RLS BATCH 4 of 6)
-- Nom Cloud
--
-- Enables RLS on the five batch-4 tables:
--   attendance_records, grade_records, homework, homework_submissions, exams.
--
-- The 7 remaining unprotected tables are batches 5-6 and are untouched.
-- Nothing from batches 1-3 or the campus/role expansion is altered.
--
-- Adds four SECURITY DEFINER helpers and REUSES six existing ones:
--   is_platform_admin            (Migration 8)
--   is_guardian_of_student       (batch 2)
--   can_manage_class             (batch 3)
--   teaches_class                (batch 3)
--   guardian_has_student_in_class(batch 3)
--   current_teacher_id           (batch 3, used inside the new helpers)
--
-- No FORCE ROW LEVEL SECURITY.
--
-- =============================================================================
-- THE ASSIGNMENT DEFINITION IS REUSED, NOT RE-DERIVED
-- =============================================================================
--
-- Batch 3 concluded that "a teacher is assigned to class C" means the caller's
-- teachers.id appears in classes.class_teacher_id for C, OR in
-- class_subjects.teacher_id for any subject of C, and NEVER in
-- timetable_slots.teacher_id, because deriving the assignment from a slot whose
-- own visibility comes from the assignment is circular.
--
-- That definition lives in public.teaches_class(school_id, class_id). This
-- migration CALLS that function. It does not restate the logic, so the two can
-- never drift.
--
-- -----------------------------------------------------------------------------
-- DECISION 1 — "any subject, not just homeroom" for attendance.
-- -----------------------------------------------------------------------------
-- Attendance is the one table here with no subject_id: it is keyed
-- (school_id, student_id, date), one row per pupil per day, and belongs to a
-- class rather than to a lesson. The locked decision is that any teacher who
-- teaches the class may mark it, explicitly including a teacher who holds only
-- one subject of that class and is not its class_teacher_id.
--
-- teaches_class already returns true for BOTH arms, so attendance uses it
-- unchanged. RLS_FULL_ROLLOUT_PLAN C.4.20 had recommended the narrower
-- class-teacher-only rule and flagged the choice for decision; the decision was
-- taken the other way and this migration implements the decision. The two arms
-- are probed separately: a homeroom teacher with no subject assignment, and a
-- subject-only teacher who is not the homeroom teacher, both succeed on the
-- same class, while a teacher assigned to neither is rejected.
--
-- -----------------------------------------------------------------------------
-- SUBJECT-EXACT WRITES ON THE THREE SUBJECT-BEARING TABLES.
-- -----------------------------------------------------------------------------
-- grade_records, homework and exams each carry subject_id. For these, being
-- assigned to the class is NOT enough to write: the caller must hold that exact
-- (class, subject) pair in class_subjects. This is what stops a Mathematics
-- teacher recording English grades for a class they genuinely teach, which is
-- the harm C.4.21 names. The new predicate is teaches_class_subject.
--
-- A homeroom teacher who teaches no subject of the class therefore cannot write
-- grades, homework or exams for it. That is deliberate: class_teacher_id is a
-- pastoral role, not a licence to enter marks in every subject.
--
-- -----------------------------------------------------------------------------
-- TEACHER READ IS CLASS-LEVEL, WRITE IS SUBJECT-LEVEL. Stated divergence.
-- -----------------------------------------------------------------------------
-- C.4.21 recommends restricting teacher READ on grades to class_subjects
-- matches as well. This migration grants class-level read (teaches_class) and
-- keeps only WRITE subject-exact, for two reasons.
--
-- A homeroom teacher unable to see their own class's grades would be a silent
-- block on the most ordinary pastoral view in the product, and batch 3 already
-- gives them that class's roster and timetable, so the tighter rule would be
-- inconsistent as well as surprising.
--
-- The harm C.4.21 names is a teacher CHANGING marks in a subject that is not
-- theirs, and that is closed by the subject-exact write predicate rather than by
-- the read one. If you would rather have the stricter read, it is a one-line
-- change per table: swap teaches_class for teaches_class_subject in the three
-- *_teacher_select policies on grade_records, homework and exams.
--
-- -----------------------------------------------------------------------------
-- DECISION 2 — guardians never write homework or homework_submissions.
-- -----------------------------------------------------------------------------
-- Homework is physical. A teacher marks it reviewed in person. There is no
-- digital submission by a guardian, and none is inferred here.
--
-- Concretely: this migration creates NO INSERT, UPDATE or DELETE policy naming a
-- guardian on public.homework or public.homework_submissions. Guardians receive
-- exactly one policy on each, and it is FOR SELECT. Because RLS denies by
-- default, the absence of a write policy is the enforcement; there is nothing to
-- revoke. No policy anywhere in this migration names anon.
--
-- The teacher write policies on homework_submissions ARE the "teacher marks it
-- done in person" path: the assigned subject teacher inserts and updates the
-- submission row, setting status, grade and feedback on the pupil's behalf.
--
-- -----------------------------------------------------------------------------
-- ATTRIBUTION COLUMNS ARE NULLABLE — a NULL trap avoided deliberately.
-- -----------------------------------------------------------------------------
-- attendance_records.marked_by, grade_records.recorded_by and
-- homework.created_by are attribution-only single-column references (SCHEMA
-- DESIGN section 13 rows 79, 80, 81) and every one of them is NULLABLE.
--
-- A WITH CHECK written as "marked_by = auth.uid()" would evaluate to NULL, not
-- true, whenever the caller omits the column, and RLS treats a non-true check as
-- a violation. Every insert that did not name the column would be rejected. The
-- checks are therefore written as
--
--     (col is null or col = auth.uid())
--
-- which still makes it impossible to attribute a record to a colleague, while
-- leaving the column genuinely optional as the schema declares it.
--
-- -----------------------------------------------------------------------------
-- TRIGGERS AND RLS.
-- -----------------------------------------------------------------------------
-- None of these five tables has a business-logic trigger. The only trigger on
-- each is <table>_set_updated_at, calling public.set_updated_at(), which assigns
-- NEW.updated_at and reads no table, so RLS cannot affect it. There is no
-- equivalent here of the fee_records.amount_paid aggregation trigger that batch
-- 5 will have to handle, and nothing in this batch needs a SECURITY DEFINER
-- change. Verified against the live catalog before writing this migration.
--
-- -----------------------------------------------------------------------------
-- DELETE IS WITHHELD FROM TEACHERS ON THE ACADEMIC RECORD TABLES.
-- -----------------------------------------------------------------------------
-- attendance_records, grade_records, homework_submissions and exams give
-- teachers INSERT and UPDATE but no DELETE. C.4.21 says so explicitly for
-- grades: "Teacher DELETE denied; correct by update plus audit." The same
-- reasoning covers attendance and submissions, and exams carry a 'cancelled'
-- status so cancelling is an update rather than a deletion. Management roles
-- retain DELETE on all five. homework is the single exception: a teacher may
-- delete homework in their own subject, which is ordinary lesson admin.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Helper predicates
-- -----------------------------------------------------------------------------

create function public.teaches_class_subject(p_school_id uuid, p_class_id uuid, p_subject_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.class_subjects cs
     where cs.school_id = p_school_id
       and cs.class_id = p_class_id
       and cs.subject_id = p_subject_id
       and cs.teacher_id = public.current_teacher_id(p_school_id)
  );
$$;

comment on function public.teaches_class_subject(uuid, uuid, uuid) is
  'True when the caller holds this exact (class, subject) pair in class_subjects. The write predicate for grade_records, homework and exams, all of which carry subject_id. Deliberately narrower than teaches_class: a class teacher who teaches none of the class''s subjects cannot enter marks in them. Returns false when current_teacher_id is NULL, so a non-teacher never matches.';

create function public.can_manage_homework(p_school_id uuid, p_homework_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.can_manage_class(
           p_school_id,
           (select h.class_id
              from public.homework h
             where h.school_id = p_school_id
               and h.id = p_homework_id)
         );
$$;

comment on function public.can_manage_homework(uuid, uuid) is
  'Campus-scoped management predicate for homework_submissions, which carries neither campus_id nor class_id. Resolves the submission''s homework to its class and defers to can_manage_class, so the campus rule stays written once in has_campus_scoped_management.';

create function public.teaches_homework(p_school_id uuid, p_homework_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.homework h
     where h.school_id = p_school_id
       and h.id = p_homework_id
       and public.teaches_class_subject(h.school_id, h.class_id, h.subject_id)
  );
$$;

comment on function public.teaches_homework(uuid, uuid) is
  'True when the caller is the assigned subject teacher of the homework''s (class, subject) pair. The WRITE predicate on homework_submissions, and therefore the mechanism by which a teacher records that physical homework was reviewed in person.';

create function public.teaches_homework_class(p_school_id uuid, p_homework_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.homework h
     where h.school_id = p_school_id
       and h.id = p_homework_id
       and public.teaches_class(h.school_id, h.class_id)
  );
$$;

comment on function public.teaches_homework_class(uuid, uuid) is
  'True when the caller is assigned to the homework''s class in any capacity. The READ predicate on homework_submissions, matching the class-level read / subject-level write split used throughout this migration.';

revoke all on function public.teaches_class_subject(uuid, uuid, uuid) from public;
revoke all on function public.can_manage_homework(uuid, uuid) from public;
revoke all on function public.teaches_homework(uuid, uuid) from public;
revoke all on function public.teaches_homework_class(uuid, uuid) from public;

grant execute on function public.teaches_class_subject(uuid, uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.can_manage_homework(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.teaches_homework(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.teaches_homework_class(uuid, uuid) to anon, authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 1. attendance_records — class-level, no subject. Decision 1 applies here.
-- -----------------------------------------------------------------------------

alter table public.attendance_records enable row level security;

create policy attendance_records_platform_admin_all on public.attendance_records
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy attendance_records_management_select on public.attendance_records
  for select to authenticated
  using (public.can_manage_class(school_id, class_id));

create policy attendance_records_teacher_select on public.attendance_records
  for select to authenticated
  using (public.teaches_class(school_id, class_id));

create policy attendance_records_guardian_select on public.attendance_records
  for select to authenticated
  using (public.is_guardian_of_student(school_id, student_id));

create policy attendance_records_management_insert on public.attendance_records
  for insert to authenticated
  with check (public.can_manage_class(school_id, class_id));

create policy attendance_records_management_update on public.attendance_records
  for update to authenticated
  using (public.can_manage_class(school_id, class_id))
  with check (public.can_manage_class(school_id, class_id));

create policy attendance_records_management_delete on public.attendance_records
  for delete to authenticated
  using (public.can_manage_class(school_id, class_id));

-- Any teacher of the class, homeroom or subject-only. Decision 1.
create policy attendance_records_teacher_insert on public.attendance_records
  for insert to authenticated
  with check (
    public.teaches_class(school_id, class_id)
    and (marked_by is null or marked_by = auth.uid())
  );

create policy attendance_records_teacher_update on public.attendance_records
  for update to authenticated
  using (public.teaches_class(school_id, class_id))
  with check (
    public.teaches_class(school_id, class_id)
    and (marked_by is null or marked_by = auth.uid())
  );


-- -----------------------------------------------------------------------------
-- 2. grade_records — subject-exact write, class-level read.
-- -----------------------------------------------------------------------------

alter table public.grade_records enable row level security;

create policy grade_records_platform_admin_all on public.grade_records
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy grade_records_management_select on public.grade_records
  for select to authenticated
  using (public.can_manage_class(school_id, class_id));

create policy grade_records_teacher_select on public.grade_records
  for select to authenticated
  using (public.teaches_class(school_id, class_id));

create policy grade_records_guardian_select on public.grade_records
  for select to authenticated
  using (public.is_guardian_of_student(school_id, student_id));

create policy grade_records_management_insert on public.grade_records
  for insert to authenticated
  with check (public.can_manage_class(school_id, class_id));

create policy grade_records_management_update on public.grade_records
  for update to authenticated
  using (public.can_manage_class(school_id, class_id))
  with check (public.can_manage_class(school_id, class_id));

create policy grade_records_management_delete on public.grade_records
  for delete to authenticated
  using (public.can_manage_class(school_id, class_id));

create policy grade_records_teacher_insert on public.grade_records
  for insert to authenticated
  with check (
    public.teaches_class_subject(school_id, class_id, subject_id)
    and (recorded_by is null or recorded_by = auth.uid())
  );

create policy grade_records_teacher_update on public.grade_records
  for update to authenticated
  using (public.teaches_class_subject(school_id, class_id, subject_id))
  with check (
    public.teaches_class_subject(school_id, class_id, subject_id)
    and (recorded_by is null or recorded_by = auth.uid())
  );


-- -----------------------------------------------------------------------------
-- 3. homework — subject-exact write. NO guardian write policy exists.
-- -----------------------------------------------------------------------------

alter table public.homework enable row level security;

create policy homework_platform_admin_all on public.homework
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy homework_management_select on public.homework
  for select to authenticated
  using (public.can_manage_class(school_id, class_id));

create policy homework_teacher_select on public.homework
  for select to authenticated
  using (public.teaches_class(school_id, class_id));

-- Guardians read the homework set for their child's class. Read only: decision 2.
create policy homework_guardian_select on public.homework
  for select to authenticated
  using (public.guardian_has_student_in_class(school_id, class_id));

create policy homework_management_insert on public.homework
  for insert to authenticated
  with check (public.can_manage_class(school_id, class_id));

create policy homework_management_update on public.homework
  for update to authenticated
  using (public.can_manage_class(school_id, class_id))
  with check (public.can_manage_class(school_id, class_id));

create policy homework_management_delete on public.homework
  for delete to authenticated
  using (public.can_manage_class(school_id, class_id));

create policy homework_teacher_insert on public.homework
  for insert to authenticated
  with check (
    public.teaches_class_subject(school_id, class_id, subject_id)
    and (created_by is null or created_by = auth.uid())
  );

create policy homework_teacher_update on public.homework
  for update to authenticated
  using (public.teaches_class_subject(school_id, class_id, subject_id))
  with check (
    public.teaches_class_subject(school_id, class_id, subject_id)
    and (created_by is null or created_by = auth.uid())
  );

create policy homework_teacher_delete on public.homework
  for delete to authenticated
  using (public.teaches_class_subject(school_id, class_id, subject_id));


-- -----------------------------------------------------------------------------
-- 4. homework_submissions — the teacher-marks-it-in-person path.
--
-- Guardians get ONE policy here and it is FOR SELECT. No guardian INSERT,
-- UPDATE or DELETE policy is created, so RLS denies those by default. That is
-- decision 2 enforced structurally rather than by revoke.
-- -----------------------------------------------------------------------------

alter table public.homework_submissions enable row level security;

create policy homework_submissions_platform_admin_all on public.homework_submissions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy homework_submissions_management_select on public.homework_submissions
  for select to authenticated
  using (public.can_manage_homework(school_id, homework_id));

create policy homework_submissions_teacher_select on public.homework_submissions
  for select to authenticated
  using (public.teaches_homework_class(school_id, homework_id));

create policy homework_submissions_guardian_select on public.homework_submissions
  for select to authenticated
  using (public.is_guardian_of_student(school_id, student_id));

create policy homework_submissions_management_insert on public.homework_submissions
  for insert to authenticated
  with check (public.can_manage_homework(school_id, homework_id));

create policy homework_submissions_management_update on public.homework_submissions
  for update to authenticated
  using (public.can_manage_homework(school_id, homework_id))
  with check (public.can_manage_homework(school_id, homework_id));

create policy homework_submissions_management_delete on public.homework_submissions
  for delete to authenticated
  using (public.can_manage_homework(school_id, homework_id));

create policy homework_submissions_teacher_insert on public.homework_submissions
  for insert to authenticated
  with check (public.teaches_homework(school_id, homework_id));

create policy homework_submissions_teacher_update on public.homework_submissions
  for update to authenticated
  using (public.teaches_homework(school_id, homework_id))
  with check (public.teaches_homework(school_id, homework_id));


-- -----------------------------------------------------------------------------
-- 5. exams — subject-exact write, cancel by status rather than delete.
-- -----------------------------------------------------------------------------

alter table public.exams enable row level security;

create policy exams_platform_admin_all on public.exams
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy exams_management_select on public.exams
  for select to authenticated
  using (public.can_manage_class(school_id, class_id));

create policy exams_teacher_select on public.exams
  for select to authenticated
  using (public.teaches_class(school_id, class_id));

create policy exams_guardian_select on public.exams
  for select to authenticated
  using (public.guardian_has_student_in_class(school_id, class_id));

create policy exams_management_insert on public.exams
  for insert to authenticated
  with check (public.can_manage_class(school_id, class_id));

create policy exams_management_update on public.exams
  for update to authenticated
  using (public.can_manage_class(school_id, class_id))
  with check (public.can_manage_class(school_id, class_id));

create policy exams_management_delete on public.exams
  for delete to authenticated
  using (public.can_manage_class(school_id, class_id));

create policy exams_teacher_insert on public.exams
  for insert to authenticated
  with check (public.teaches_class_subject(school_id, class_id, subject_id));

create policy exams_teacher_update on public.exams
  for update to authenticated
  using (public.teaches_class_subject(school_id, class_id, subject_id))
  with check (public.teaches_class_subject(school_id, class_id, subject_id));


-- =============================================================================
-- End of Batch 4. No table outside the five listed is enabled for RLS or
-- receives a policy. No grant is changed, no existing function is altered, and
-- no guardian write path is created on homework or homework_submissions.
-- =============================================================================
