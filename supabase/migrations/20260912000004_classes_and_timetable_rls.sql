-- =============================================================================
-- Phase 7 / Migration 11 — classes_and_timetable_rls  (RLS BATCH 3 of 6)
-- Nom Cloud
--
-- Enables RLS on the four batch-3 tables:
--   classes, class_subjects, class_enrollments, timetable_slots.
--
-- The 12 remaining unprotected tables are batches 4-6 and are untouched.
-- Nothing from batches 1-2 or the campus/role expansion is altered, and no
-- constraint from Migrations 4, 5 or 8 is weakened.
--
-- Adds five SECURITY DEFINER helpers and reuses is_platform_admin and
-- is_guardian_of_student. All pin search_path to the empty string.
--
-- No FORCE ROW LEVEL SECURITY.
--
-- =============================================================================
-- THIS IS WHERE CAMPUS SCOPE BECOMES A REAL BOUNDARY
-- =============================================================================
--
-- Batch 2 concluded that principal campus scope is not expressible on people
-- tables, because none of them carries campus_id and the chain through class
-- assignment is not total. That conclusion does not apply here. classes carries
-- campus_id directly (Migration 4), so scope_mode = 'selected' becomes a real,
-- enforceable predicate for the first time.
--
-- -----------------------------------------------------------------------------
-- CONCLUSION 1 — classes.campus_id IS NULL is NOT visible to a selected-scope
-- principal.
-- -----------------------------------------------------------------------------
-- Migration 4 states the column is "Nullable on purpose. Classes created before
-- campuses existed have no campus and must not be silently assigned one." NULL
-- therefore means "no campus assigned yet", a transitional state, not "every
-- campus". Migration 4 reinforces this by making the naming index NULLS NOT
-- DISTINCT, which treats NULL as one specific bucket rather than as unknown.
-- RLS_FULL_ROLLOUT_PLAN section A.2 already records the rule in the same terms:
-- "NULL is not a campus grant."
--
-- The alternative, making NULL-campus classes visible to every principal, was
-- considered and rejected. It would convert "not yet assigned" into "readable
-- and writable by every principal at every campus", which widens access rather
-- than scoping it, and it would do so precisely for the rows whose ownership is
-- least established. Security defaults deny on unknown.
--
-- Unassigned classes are not orphaned: owner, director, administrator and any
-- principal with scope_mode = 'all' retain full read and write on them, and
-- assigning a campus is exactly the act those roles should perform.
--
-- The rule is applied symmetrically. A selected-scope principal cannot CREATE a
-- class with a NULL campus either, because the INSERT WITH CHECK requires an
-- in-scope campus. Without that, a principal could mint classes that escape
-- campus accounting entirely and that they themselves could not then see.
--
-- -----------------------------------------------------------------------------
-- CONCLUSION 2 — what "a teacher is assigned to a class" means here.
-- -----------------------------------------------------------------------------
-- Three columns in this schema associate a teacher with a class:
--
--   classes.class_teacher_id      the homeroom/class teacher, one per class
--   class_subjects.teacher_id     the subject teacher for one (class, subject)
--   timetable_slots.teacher_id    who takes one scheduled period
--
-- "Assigned to teach class C" is defined as the caller's teachers.id appearing
-- in class_teacher_id for C, OR in class_subjects.teacher_id for any subject of
-- C. This is the union CAMPUS_ROLE_DESIGN J5 calls "class-derived scope", and it
-- is what the locked batch-4 decision requires: any teacher who teaches a class,
-- any subject and not only the homeroom, must resolve as connected to it.
--
-- timetable_slots.teacher_id is deliberately EXCLUDED from the definition, for
-- two reasons. It would be circular: slot visibility is derived from teaching
-- the class, so deriving "teaches the class" from the slot would make each grant
-- the other. And RLS_FULL_ROLLOUT_PLAN C.3.19 classifies that column as
-- "attribution/schedule assignment, not a user grant". A teacher covering a
-- single period still reads that slot, through a separate own-slot policy on
-- timetable_slots, so the cover case is served without the circularity.
--
-- -----------------------------------------------------------------------------
-- CONCLUSION 3 — teacher scope_mode = 'selected' does not further restrict
-- anything in this batch, and cannot.
-- -----------------------------------------------------------------------------
-- CAMPUS_ROLE_DESIGN J5 resolves teacher scope as the UNION of explicit
-- membership_campus_scopes grants and class-derived scope, "whichever is
-- broader, not either source exclusively". Assignment is strictly the narrower
-- predicate: a teacher reaches a class only by being assigned to it. Applying a
-- campus filter on top could only subtract classes the school explicitly
-- assigned them, which is the opposite of what J5 requires.
--
-- So a teacher's access here is determined by assignment alone and is identical
-- under scope_mode 'all' and 'selected'. The combination is reachable in data
-- but is not a distinct authorisation case, and the probes assert exactly that.
--
-- -----------------------------------------------------------------------------
-- CONCLUSION 4 — the three descendants derive campus through classes, never
-- independently.
-- -----------------------------------------------------------------------------
-- class_subjects, class_enrollments and timetable_slots carry no campus_id, by
-- CAMPUS_ROLE_DESIGN B.2/B.3, and none is added here. Their policies call
-- can_manage_class(school_id, class_id), which resolves the parent class and
-- applies the single campus rule to its campus_id. Campus logic is written once,
-- in has_campus_scoped_management, and is never restated on a table that does
-- not carry the column.
--
-- -----------------------------------------------------------------------------
-- WRITE ACCESS — teachers are read-only on all four tables.
-- -----------------------------------------------------------------------------
-- This follows RLS_FULL_ROLLOUT_PLAN C.3, which records "ODA only" for classes,
-- class_subjects and class_enrollments, and "Teacher direct schedule changes
-- denied" for timetable_slots. It is also required by the standing
-- self-privilege-escalation discipline of Migration 8:
--
--   class_subjects.teacher_id IS the batch-4 attendance grant. A teacher able to
--   write this table could assign themselves to any class and thereby grant
--   themselves the right to record that class's attendance and grades.
--   class_enrollments controls which students are in a teacher's class, and so
--   which students they may later write records about.
--   timetable_slots writes would let a teacher claim periods and rooms, and the
--   table's partial unique index exists to prevent exactly that kind of clash.
--   classes writes would let a teacher change campus_id or class_teacher_id.
--
-- Each is a role granting itself capability beyond its own. Teachers therefore
-- read these four tables and write none of them.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Helper predicates
-- -----------------------------------------------------------------------------

create function public.current_teacher_id(p_school_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  select m.teacher_id
    from public.memberships m
   where m.user_id = auth.uid()
     and m.school_id = p_school_id
     and m.status = 'active'
     and m.role = 'teacher'
   limit 1;
$$;

comment on function public.current_teacher_id(uuid) is
  'The teachers.id attached to the caller''s active teacher membership in the given school, or NULL. UNIQUE (user_id, role) on memberships means there is at most one. Security definer so class policies do not re-enter the memberships policies.';

create function public.has_campus_scoped_management(p_school_id uuid, p_campus_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.memberships m
     where m.user_id = auth.uid()
       and m.school_id = p_school_id
       and m.status = 'active'
       and (
         m.role in ('owner', 'director', 'administrator')
         or (m.role = 'principal' and m.scope_mode = 'all')
         or (
           m.role = 'principal'
           and m.scope_mode = 'selected'
           and p_campus_id is not null
           and exists (
             select 1
               from public.membership_campus_scopes s
              where s.school_id = m.school_id
                and s.membership_id = m.id
                and s.campus_id = p_campus_id
           )
         )
       )
  );
$$;

comment on function public.has_campus_scoped_management(uuid, uuid) is
  'The single campus rule for this schema. True when the caller may manage something at the given campus: owner, director and administrator at any campus including an unassigned one; a principal with scope_mode = all likewise; a principal with scope_mode = selected only at a campus named in membership_campus_scopes. A NULL campus is in scope for the organisation-wide roles only, because NULL means "not yet assigned" and is not a campus grant.';

create function public.can_manage_class(p_school_id uuid, p_class_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.has_campus_scoped_management(
           p_school_id,
           (select c.campus_id
              from public.classes c
             where c.school_id = p_school_id
               and c.id = p_class_id)
         );
$$;

comment on function public.can_manage_class(uuid, uuid) is
  'Resolves a class to its campus and applies has_campus_scoped_management. This is how class_subjects, class_enrollments and timetable_slots inherit campus restriction: they carry no campus_id of their own (CAMPUS_ROLE_DESIGN B.2/B.3) and must never restate the campus rule. Returns false for a class id that does not exist in the school.';

create function public.teaches_class(p_school_id uuid, p_class_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.classes c
     where c.school_id = p_school_id
       and c.id = p_class_id
       and c.class_teacher_id = public.current_teacher_id(p_school_id)
  )
  or exists (
    select 1
      from public.class_subjects cs
     where cs.school_id = p_school_id
       and cs.class_id = p_class_id
       and cs.teacher_id = public.current_teacher_id(p_school_id)
  );
$$;

comment on function public.teaches_class(uuid, uuid) is
  'True when the caller is assigned to the given class as its class teacher or as the teacher of any of its subjects. This is the class-derived scope of CAMPUS_ROLE_DESIGN J5 and the relationship batch 4 attendance and grade policies will depend on. timetable_slots.teacher_id is deliberately not consulted: slot visibility derives from teaching the class, so deriving the assignment from the slot would be circular. Returns false when current_teacher_id is NULL, so a non-teacher never matches.';

create function public.guardian_has_student_in_class(p_school_id uuid, p_class_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.class_enrollments ce
      join public.student_guardians sg
        on sg.school_id = ce.school_id
       and sg.student_id = ce.student_id
      join public.memberships m
        on m.school_id = sg.school_id
       and m.guardian_id = sg.guardian_id
     where ce.school_id = p_school_id
       and ce.class_id = p_class_id
       and m.user_id = auth.uid()
       and m.status = 'active'
       and m.role = 'guardian'
  );
$$;

comment on function public.guardian_has_student_in_class(uuid, uuid) is
  'True when the caller is the guardian of a student enrolled in the given class. Used for the class, its subject list and its timetable, none of which name another child. It is deliberately NOT used for class_enrollments: that table is per-student, and a guardian reading it through a class predicate would see the whole roster. Enrollment history is included rather than filtered to left_on IS NULL, because a past class is a legitimate part of a parent view and RLS_FULL_ROLLOUT_PLAN A.2 records that "current enrollment" is not yet a settled definition.';

revoke all on function public.current_teacher_id(uuid) from public;
revoke all on function public.has_campus_scoped_management(uuid, uuid) from public;
revoke all on function public.can_manage_class(uuid, uuid) from public;
revoke all on function public.teaches_class(uuid, uuid) from public;
revoke all on function public.guardian_has_student_in_class(uuid, uuid) from public;

grant execute on function public.current_teacher_id(uuid) to anon, authenticated, service_role;
grant execute on function public.has_campus_scoped_management(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.can_manage_class(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.teaches_class(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.guardian_has_student_in_class(uuid, uuid) to anon, authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 1. classes — the sole direct campus carrier
--
-- The UPDATE policy names the same predicate in USING and WITH CHECK. USING is
-- evaluated against the OLD row and WITH CHECK against the NEW one, so a
-- selected-scope principal can neither claim a class from a campus outside their
-- scope nor move one of their own classes out to a campus they do not hold. That
-- is the old-row/new-row test RLS_FULL_ROLLOUT_PLAN C.3.18 asks for, and it also
-- blocks setting campus_id to NULL as an escape.
-- -----------------------------------------------------------------------------

alter table public.classes enable row level security;

create policy classes_platform_admin_all on public.classes
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy classes_management_select on public.classes
  for select to authenticated
  using (public.has_campus_scoped_management(school_id, campus_id));

create policy classes_teacher_select on public.classes
  for select to authenticated
  using (public.teaches_class(school_id, id));

create policy classes_guardian_select on public.classes
  for select to authenticated
  using (public.guardian_has_student_in_class(school_id, id));

create policy classes_management_insert on public.classes
  for insert to authenticated
  with check (public.has_campus_scoped_management(school_id, campus_id));

create policy classes_management_update on public.classes
  for update to authenticated
  using (public.has_campus_scoped_management(school_id, campus_id))
  with check (public.has_campus_scoped_management(school_id, campus_id));

create policy classes_management_delete on public.classes
  for delete to authenticated
  using (public.has_campus_scoped_management(school_id, campus_id));


-- -----------------------------------------------------------------------------
-- 2. class_subjects — which teacher teaches which subject in which class
--
-- This is the relationship batch 4 depends on. A teacher may read their own
-- assignments and every assignment of a class they teach, so "which teachers
-- teach this class, for which subject" is answerable under RLS. Writing it is
-- management-only: teacher_id here is the batch-4 attendance grant.
-- -----------------------------------------------------------------------------

alter table public.class_subjects enable row level security;

create policy class_subjects_platform_admin_all on public.class_subjects
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy class_subjects_management_select on public.class_subjects
  for select to authenticated
  using (public.can_manage_class(school_id, class_id));

create policy class_subjects_teacher_select on public.class_subjects
  for select to authenticated
  using (public.teaches_class(school_id, class_id));

create policy class_subjects_guardian_select on public.class_subjects
  for select to authenticated
  using (public.guardian_has_student_in_class(school_id, class_id));

create policy class_subjects_management_insert on public.class_subjects
  for insert to authenticated
  with check (public.can_manage_class(school_id, class_id));

create policy class_subjects_management_update on public.class_subjects
  for update to authenticated
  using (public.can_manage_class(school_id, class_id))
  with check (public.can_manage_class(school_id, class_id));

create policy class_subjects_management_delete on public.class_subjects
  for delete to authenticated
  using (public.can_manage_class(school_id, class_id));


-- -----------------------------------------------------------------------------
-- 3. class_enrollments — the roster
--
-- The guardian policy is per-student, not per-class. Using the class predicate
-- here would show a parent every child enrolled alongside their own, which is
-- exactly the leak RLS_FULL_ROLLOUT_PLAN C.3.18 guards against with
-- "Guardian Own-student only". is_guardian_of_student is the batch-2 helper and
-- resolves through student_guardians.
-- -----------------------------------------------------------------------------

alter table public.class_enrollments enable row level security;

create policy class_enrollments_platform_admin_all on public.class_enrollments
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy class_enrollments_management_select on public.class_enrollments
  for select to authenticated
  using (public.can_manage_class(school_id, class_id));

create policy class_enrollments_teacher_select on public.class_enrollments
  for select to authenticated
  using (public.teaches_class(school_id, class_id));

create policy class_enrollments_guardian_select on public.class_enrollments
  for select to authenticated
  using (public.is_guardian_of_student(school_id, student_id));

create policy class_enrollments_management_insert on public.class_enrollments
  for insert to authenticated
  with check (public.can_manage_class(school_id, class_id));

create policy class_enrollments_management_update on public.class_enrollments
  for update to authenticated
  using (public.can_manage_class(school_id, class_id))
  with check (public.can_manage_class(school_id, class_id));

create policy class_enrollments_management_delete on public.class_enrollments
  for delete to authenticated
  using (public.can_manage_class(school_id, class_id));


-- -----------------------------------------------------------------------------
-- 4. timetable_slots — the schedule
--
-- A teacher reads the timetable of any class they teach, plus any individual
-- slot assigned to them personally. The second policy is what serves a cover
-- teacher who takes one period of a class they are not otherwise assigned to,
-- without letting that slot count as teaching the class (see conclusion 2).
-- -----------------------------------------------------------------------------

alter table public.timetable_slots enable row level security;

create policy timetable_slots_platform_admin_all on public.timetable_slots
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy timetable_slots_management_select on public.timetable_slots
  for select to authenticated
  using (public.can_manage_class(school_id, class_id));

create policy timetable_slots_teacher_class_select on public.timetable_slots
  for select to authenticated
  using (public.teaches_class(school_id, class_id));

create policy timetable_slots_teacher_own_select on public.timetable_slots
  for select to authenticated
  using (teacher_id is not null and teacher_id = public.current_teacher_id(school_id));

create policy timetable_slots_guardian_select on public.timetable_slots
  for select to authenticated
  using (public.guardian_has_student_in_class(school_id, class_id));

create policy timetable_slots_management_insert on public.timetable_slots
  for insert to authenticated
  with check (public.can_manage_class(school_id, class_id));

create policy timetable_slots_management_update on public.timetable_slots
  for update to authenticated
  using (public.can_manage_class(school_id, class_id))
  with check (public.can_manage_class(school_id, class_id));

create policy timetable_slots_management_delete on public.timetable_slots
  for delete to authenticated
  using (public.can_manage_class(school_id, class_id));


-- =============================================================================
-- End of Batch 3. No table outside the four listed is enabled for RLS or
-- receives a policy. No grant is changed, no existing function is altered, and
-- no constraint from Migrations 4, 5 or 8 is weakened.
-- =============================================================================
