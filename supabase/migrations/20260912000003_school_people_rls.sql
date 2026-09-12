-- =============================================================================
-- Phase 7 / Migration 10 — school_people_rls  (RLS BATCH 2 of 6)
-- Nom Cloud
--
-- Enables RLS on the eight batch-2 tables named in
-- docs/RLS_FULL_ROLLOUT_PLAN.md section E:
--   school_subscriptions, academic_years, terms, subjects,
--   teachers, guardians, students, student_guardians.
--
-- The 16 remaining unprotected tables are batches 3-6 and are untouched. No
-- table protected by 20260911000007 or 20260912000001 is altered.
--
-- Adds five SECURITY DEFINER helper predicates and reuses the three existing
-- ones (is_platform_admin, has_school_staff_role, has_school_admin_role). All
-- helpers pin search_path to the empty string. They are SECURITY DEFINER for
-- the same reason Migration 8 gave: a policy on student_guardians that reads
-- student_guardians would recurse, and a policy that reads memberships must not
-- re-enter the memberships policies.
--
-- No FORCE ROW LEVEL SECURITY. accept_invitation and approve_school_application
-- remain owner-bypass SECURITY DEFINER transactions.
--
-- =============================================================================
-- THREE FINDINGS THAT SHAPED THIS MIGRATION
-- =============================================================================
--
-- 1. PRINCIPAL CAMPUS SCOPE IS NOT EXPRESSIBLE ON PEOPLE TABLES.
--
--    CAMPUS_ROLE_DESIGN section B.2 refuses campus_id on teachers, students,
--    guardians and student_guardians in four separate rows, with reasons: a
--    teacher may work at several campuses, a student may move between them, and
--    guardian access must stay independent of campus. Confirmed against the live
--    catalog: among operational tables only classes carries campus_id, and it is
--    NULLABLE.
--
--    The only route from a person to a campus is through class assignment, and
--    that route is not total. Measured on fixture data:
--
--      student enrolled in a campus class      -> North Campus
--      student enrolled in a NULL-campus class -> NO CAMPUS REACHABLE
--      newly admitted student, no enrollment   -> NO CAMPUS REACHABLE
--      teacher assigned to a campus class      -> North Campus
--      newly hired teacher, no assignment      -> NO CAMPUS REACHABLE
--
--    For READ, a campus predicate would hide exactly the records a principal
--    most needs: new admissions and unassigned staff.
--
--    For WRITE it is not merely undesirable, it is impossible. A principal
--    creating a student produces a row with no enrollment, therefore no campus,
--    so a campus-filtered WITH CHECK could never pass and the INSERT could never
--    succeed. The approved decision that a principal may create and edit people
--    is only satisfiable school-wide.
--
--    CONCLUSION: principal access on these eight tables is school-wide,
--    independent of scope_mode. Campus scope becomes a real access boundary in
--    batch 3, on classes, which actually carries campus_id. Revisit when the
--    campus-history model of CAMPUS_ROLE_DESIGN J7 exists.
--
-- 2. GUARDIANS DO NEED READ ON academic_years, terms AND subjects.
--
--    RLS_FULL_ROLLOUT_PLAN C.2 records "Guardian no direct read" for these three,
--    on the assumption that the labels arrive already joined through the child's
--    records. They do not. RLS is applied to every table in a query, including
--    joined ones, so a parent-portal query is filtered at the reference table.
--    Measured, with terms and subjects readable by ODA only and a guardian
--    reading their own child's grade:
--
--      no reference join             -> 1 row, score visible
--      INNER JOIN terms + subjects   -> ZERO ROWS, the grade vanished entirely
--      LEFT JOIN terms               -> NULL LABEL, term name unreadable
--
--    Denying these reads does not hide a label, it deletes the child's record
--    from the parent's view. All three tables are reference data carrying no
--    personal information: a year label, a term name, a subject name.
--
--    CONCLUSION: every active member of a school, guardians included, may read
--    these three. This corrects C.2 and is recorded there.
--
-- 3. school_subscriptions IS RESTRICTED TO OWNER AND DIRECTOR.
--
--    This diverges from the otherwise-consistent ODA grouping and from
--    RLS_FULL_ROLLOUT_PLAN C.2.8, which says "ODA own school". It is applied on
--    explicit instruction. Stated plainly so the record is accurate: no
--    commercial-sensitivity note restricting billing visibility by role exists in
--    SCHEMA_DESIGN.md, and CAMPUS_ROLE_DESIGN J3 records the Director/
--    Administrator permission matrix as an open question. This is therefore the
--    first place in the system where director and administrator differ, and it
--    sets a precedent on J3. Nothing reads this table today, so the restriction
--    breaks no workflow and widening it later is a one-line policy change.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Helper predicates
-- -----------------------------------------------------------------------------

create function public.is_school_member(p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
     where m.user_id = auth.uid()
       and m.school_id = p_school_id
       and m.status = 'active'
  );
$$;

comment on function public.is_school_member(uuid) is
  'True when the caller holds any active membership in the given school, guardian included. Used for school-wide reference data (academic years, terms, subjects) that every member needs in order to render their own records.';

create function public.has_school_management_role(p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
     where m.user_id = auth.uid()
       and m.school_id = p_school_id
       and m.status = 'active'
       and m.role in ('owner', 'director', 'administrator', 'principal')
  );
$$;

comment on function public.has_school_management_role(uuid) is
  'True when the caller holds an active owner, director, administrator or principal membership in the given school. This is the write predicate for academic structure and people records. Teacher and guardian are deliberately absent: a teacher must not create or edit a person record.';

create function public.has_school_billing_role(p_school_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
     where m.user_id = auth.uid()
       and m.school_id = p_school_id
       and m.status = 'active'
       and m.role in ('owner', 'director')
  );
$$;

comment on function public.has_school_billing_role(uuid) is
  'True when the caller holds an active owner or director membership in the given school. Narrower than has_school_admin_role by one role: administrator is excluded from commercial data. This is the first place director and administrator diverge; see CAMPUS_ROLE_DESIGN J3.';

create function public.current_guardian_id(p_school_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  select m.guardian_id
    from public.memberships m
   where m.user_id = auth.uid()
     and m.school_id = p_school_id
     and m.status = 'active'
     and m.role = 'guardian'
   limit 1;
$$;

comment on function public.current_guardian_id(uuid) is
  'The guardians.id attached to the caller''s active guardian membership in the given school, or NULL. UNIQUE (user_id, role) on memberships means there is at most one. Security definer so a policy on guardians or student_guardians does not re-enter the memberships policies.';

create function public.is_guardian_of_student(p_school_id uuid, p_student_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.student_guardians sg
      join public.memberships m
        on m.guardian_id = sg.guardian_id
       and m.school_id = sg.school_id
     where sg.school_id = p_school_id
       and sg.student_id = p_student_id
       and m.user_id = auth.uid()
       and m.status = 'active'
       and m.role = 'guardian'
  );
$$;

comment on function public.is_guardian_of_student(uuid, uuid) is
  'True when the caller is linked to the given student through student_guardians. This is THE guardian access predicate for every later batch: attendance, grades, homework and fees all resolve guardian visibility through this function. Security definer because student_guardians is itself RLS-protected and an invoker-rights read would see an RLS-filtered view of the very link it is testing.';

revoke all on function public.is_school_member(uuid) from public;
revoke all on function public.has_school_management_role(uuid) from public;
revoke all on function public.has_school_billing_role(uuid) from public;
revoke all on function public.current_guardian_id(uuid) from public;
revoke all on function public.is_guardian_of_student(uuid, uuid) from public;

grant execute on function public.is_school_member(uuid) to anon, authenticated, service_role;
grant execute on function public.has_school_management_role(uuid) to anon, authenticated, service_role;
grant execute on function public.has_school_billing_role(uuid) to anon, authenticated, service_role;
grant execute on function public.current_guardian_id(uuid) to anon, authenticated, service_role;
grant execute on function public.is_guardian_of_student(uuid, uuid) to anon, authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 1. school_subscriptions — commercial; owner/director read, no school write
-- -----------------------------------------------------------------------------

alter table public.school_subscriptions enable row level security;

create policy school_subscriptions_platform_admin_all on public.school_subscriptions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy school_subscriptions_billing_select on public.school_subscriptions
  for select to authenticated
  using (public.has_school_billing_role(school_id));

-- No INSERT, UPDATE or DELETE policy for any school role. A school administrator
-- setting their own subscription status to 'active', or extending
-- current_period_end, would be granting their own school a commercial
-- entitlement. Billing writes belong to the platform and to Phase 11.


-- -----------------------------------------------------------------------------
-- 2. academic_years — school-wide reference data
-- -----------------------------------------------------------------------------

alter table public.academic_years enable row level security;

create policy academic_years_platform_admin_all on public.academic_years
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy academic_years_member_select on public.academic_years
  for select to authenticated
  using (public.is_school_member(school_id));

create policy academic_years_management_insert on public.academic_years
  for insert to authenticated
  with check (public.has_school_management_role(school_id));

create policy academic_years_management_update on public.academic_years
  for update to authenticated
  using (public.has_school_management_role(school_id))
  with check (public.has_school_management_role(school_id));

create policy academic_years_management_delete on public.academic_years
  for delete to authenticated
  using (public.has_school_management_role(school_id));


-- -----------------------------------------------------------------------------
-- 3. terms — school-wide reference data
-- -----------------------------------------------------------------------------

alter table public.terms enable row level security;

create policy terms_platform_admin_all on public.terms
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy terms_member_select on public.terms
  for select to authenticated
  using (public.is_school_member(school_id));

create policy terms_management_insert on public.terms
  for insert to authenticated
  with check (public.has_school_management_role(school_id));

create policy terms_management_update on public.terms
  for update to authenticated
  using (public.has_school_management_role(school_id))
  with check (public.has_school_management_role(school_id));

create policy terms_management_delete on public.terms
  for delete to authenticated
  using (public.has_school_management_role(school_id));


-- -----------------------------------------------------------------------------
-- 4. subjects — school-wide reference data
-- -----------------------------------------------------------------------------

alter table public.subjects enable row level security;

create policy subjects_platform_admin_all on public.subjects
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy subjects_member_select on public.subjects
  for select to authenticated
  using (public.is_school_member(school_id));

create policy subjects_management_insert on public.subjects
  for insert to authenticated
  with check (public.has_school_management_role(school_id));

create policy subjects_management_update on public.subjects
  for update to authenticated
  using (public.has_school_management_role(school_id))
  with check (public.has_school_management_role(school_id));

create policy subjects_management_delete on public.subjects
  for delete to authenticated
  using (public.has_school_management_role(school_id));


-- -----------------------------------------------------------------------------
-- 5. teachers — staff directory
--
-- All five staff roles read the school roster; a teacher needs to know who else
-- works there. Guardians get no policy at all: a parent has no business reading
-- employment records, and the teacher names a parent legitimately needs will be
-- served in batch 3 through the class relationship, not from this table.
-- -----------------------------------------------------------------------------

alter table public.teachers enable row level security;

create policy teachers_platform_admin_all on public.teachers
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy teachers_staff_select on public.teachers
  for select to authenticated
  using (public.has_school_staff_role(school_id));

create policy teachers_management_insert on public.teachers
  for insert to authenticated
  with check (public.has_school_management_role(school_id));

create policy teachers_management_update on public.teachers
  for update to authenticated
  using (public.has_school_management_role(school_id))
  with check (public.has_school_management_role(school_id));

create policy teachers_management_delete on public.teachers
  for delete to authenticated
  using (public.has_school_management_role(school_id));


-- -----------------------------------------------------------------------------
-- 6. guardians — staff read the contact list; a guardian reads only itself
-- -----------------------------------------------------------------------------

alter table public.guardians enable row level security;

create policy guardians_platform_admin_all on public.guardians
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy guardians_staff_select on public.guardians
  for select to authenticated
  using (public.has_school_staff_role(school_id));

create policy guardians_self_select on public.guardians
  for select to authenticated
  using (id = public.current_guardian_id(school_id));

create policy guardians_management_insert on public.guardians
  for insert to authenticated
  with check (public.has_school_management_role(school_id));

create policy guardians_management_update on public.guardians
  for update to authenticated
  using (public.has_school_management_role(school_id))
  with check (public.has_school_management_role(school_id));

create policy guardians_management_delete on public.guardians
  for delete to authenticated
  using (public.has_school_management_role(school_id));


-- -----------------------------------------------------------------------------
-- 7. students — staff read the roll; a guardian reads only linked children
-- -----------------------------------------------------------------------------

alter table public.students enable row level security;

create policy students_platform_admin_all on public.students
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy students_staff_select on public.students
  for select to authenticated
  using (public.has_school_staff_role(school_id));

create policy students_guardian_select on public.students
  for select to authenticated
  using (public.is_guardian_of_student(school_id, id));

create policy students_management_insert on public.students
  for insert to authenticated
  with check (public.has_school_management_role(school_id));

create policy students_management_update on public.students
  for update to authenticated
  using (public.has_school_management_role(school_id))
  with check (public.has_school_management_role(school_id));

create policy students_management_delete on public.students
  for delete to authenticated
  using (public.has_school_management_role(school_id));


-- -----------------------------------------------------------------------------
-- 8. student_guardians — THE guardian access boundary
--
-- This join decides what a guardian may see in every later batch. Inserting a
-- row here grants sight of a child's attendance, grades, homework and fees. It
-- is an authorisation table wearing a demographic table's clothes, and it gets
-- the same treatment Migration 8 gave memberships: a guardian may READ its own
-- links and may never write any. A guardian able to insert here could attach
-- itself to any student in the school, which is the single most direct
-- self-privilege-escalation path in the schema.
--
-- Teachers read but never write, for the same reason.
-- -----------------------------------------------------------------------------

alter table public.student_guardians enable row level security;

create policy student_guardians_platform_admin_all on public.student_guardians
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy student_guardians_staff_select on public.student_guardians
  for select to authenticated
  using (public.has_school_staff_role(school_id));

create policy student_guardians_guardian_select on public.student_guardians
  for select to authenticated
  using (guardian_id = public.current_guardian_id(school_id));

create policy student_guardians_management_insert on public.student_guardians
  for insert to authenticated
  with check (public.has_school_management_role(school_id));

create policy student_guardians_management_update on public.student_guardians
  for update to authenticated
  using (public.has_school_management_role(school_id))
  with check (public.has_school_management_role(school_id));

create policy student_guardians_management_delete on public.student_guardians
  for delete to authenticated
  using (public.has_school_management_role(school_id));


-- =============================================================================
-- End of Batch 2. No table outside the eight listed is enabled for RLS or
-- receives a policy. No grant on any table is changed. No existing function is
-- altered.
-- =============================================================================
