-- =============================================================================
-- CORRECTIVE — people_access_guards
-- Nom Cloud
--
-- Fixes docs/SYSTEM_ISSUES_LIST.md S2 and S3. S4 is a behaviour decision that
-- needs no DDL; the note at the end records it and why.
--
-- Corrects the identity and people migrations, each of which chose CASCADE or
-- SET NULL for a link that turns out to carry either login access or family
-- history: memberships (teacher_id, guardian_id), class_subjects.teacher_id and
-- student_guardians.guardian_id.
--
-- ---------------------------------------------------------------------------
-- S3 — WHAT WAS WRONG, MEASURED (rolled-back probes, 2026-09-15)
-- ---------------------------------------------------------------------------
-- Deleting a teacher row deleted that person's MEMBERSHIP through
-- memberships (school_id, teacher_id) -> teachers ON DELETE CASCADE, so their
-- login silently stopped working, and their class_subjects assignment was
-- quietly set to NULL. Measured: Sahra's membership 1 -> 0 and 5A Mathematics
-- teacher -> NULL, while the confirmation dialog claimed "A teacher still
-- assigned to a class cannot be removed until they are unassigned" — true only
-- for a homeroom teacher, whose classes.class_teacher_id FK is already RESTRICT.
-- Deleting a guardian did the same to a parent's membership and to their link
-- with their child.
--
-- THE FIX — the S1 pattern, again. Migration 20260915000005 changed the class_id
-- foreign keys of academic records from CASCADE to RESTRICT so history cannot
-- disappear as a side effect. The same instrument applies here, for the same
-- reason, to the four links that carry access or family history:
--
--   memberships (school_id, teacher_id)       -> teachers   CASCADE  -> RESTRICT
--   memberships (school_id, guardian_id)      -> guardians  CASCADE  -> RESTRICT
--   class_subjects (school_id, teacher_id)    -> teachers   SET NULL -> RESTRICT
--   student_guardians (school_id, guardian_id)-> guardians  CASCADE  -> RESTRICT
--
-- After this, deleting the person record fails loudly (23503) while they still
-- hold a login, a subject assignment, or a linked child. Removing access became
-- a separate, deliberate act — see the S4 note below.
--
-- GUARDIANS ARE TREATED THE SAME AS TEACHERS, deliberately. The brief asked
-- whether they should differ: they should not. A guardian row carries the same
-- two things a teacher row does — a login (memberships.guardian_id) and a
-- relationship record (student_guardians) — and SCHEMA_DESIGN §10 classifies
-- guardians as OP -> AR with anonymisation, not deletion, as the erasure path.
-- Unlinking the children first is the same deliberate step as unassigning a
-- teacher's classes.
--
-- WHAT STAYS AS IT WAS, and why:
--   timetable_slots.teacher_id  SET NULL. A timetable slot is schedule
--     configuration, not an assignment that grants anything: teaches_class has
--     never consulted it (RLS batch 3). A slot losing its teacher is a gap in a
--     timetable, not lost history.
--   invitations.teacher_id / .guardian_id  CASCADE. A pending invitation to
--     become a person who no longer exists is meaningless, and accepting one is
--     what creates a membership, which is now itself RESTRICT.
--   classes.class_teacher_id  RESTRICT already, unchanged.
--   Deleting a SCHOOL still works: the school's own cascade removes
--   memberships, class_subjects and student_guardians through their school_id
--   foreign keys in the same statement (measured, as in 20260915000005).
--
-- ---------------------------------------------------------------------------
-- S2 — WHAT WAS WRONG, AND WHY TWO FUNCTIONS
-- ---------------------------------------------------------------------------
-- student_guardians carries a partial unique index, one primary guardian per
-- student. The Students form's "New guardian" path always sent is_primary =
-- true, so for a student who already had a primary the insert failed 23505 —
-- and linkGuardianToStudent swallowed EVERY 23505, so the page reported
-- "Student updated" while the guardian was created and linked to nobody.
--
-- The client fix is in guardianService and Students.tsx. These two functions
-- exist because the correct behaviour needs one transaction, which a browser
-- cannot open:
--
--   link_guardian_to_student(...)  demotes the student's current primary and
--     promotes the new link together, so the student is never left with two
--     primaries or none. Re-linking a pair that already exists is reported as
--     already_linked instead of being hidden by a blind 23505 catch.
--     It opens with an explicit has_school_management_role check and asserts the
--     promotion touched exactly one row. Both matter because this function is
--     INVOKER: a caller without write access has its UPDATEs filtered to zero
--     rows SILENTLY by RLS, and returning 'promoted' after changing nothing
--     would rebuild the silent failure this fix exists to remove (measured: a
--     teacher calling it got a result instead of an error before this check).
--
--   create_and_link_guardian(...)  creates the guardian row and its link in one
--     transaction, so a failed link can no longer leave an orphaned guardian
--     belonging to no student.
--
-- BOTH ARE SECURITY INVOKER, deliberately. They must not widen access: the
-- existing guardians and student_guardians policies (management only) apply to
-- the caller exactly as they do today, so a teacher or guardian calling either
-- function gets the same 42501 they would get writing the tables directly.
-- search_path is pinned empty and EXECUTE is granted to authenticated only.
--
-- ---------------------------------------------------------------------------
-- S4 — NO DDL, ON PURPOSE
-- ---------------------------------------------------------------------------
-- teachers.status ('active'/'inactive') is an EMPLOYMENT record; a membership's
-- status ('active'/'suspended') is LOGIN ACCESS. They stay two separate facts,
-- controlled separately, for three reasons: most teachers have no login at all,
-- so status cannot stand in for access; a trigger tying them would make
-- re-activating employment silently restore a login, a security regression in
-- the opposite direction; and a hidden side effect is precisely what S3 was
-- about. Instead the interface now shows BOTH states side by side, offers an
-- explicit "Also revoke their app access" when a teacher is marked inactive
-- while their login is active, and adds a dedicated Revoke / Restore access
-- action. That action is an ordinary UPDATE of memberships.status, which the
-- existing memberships_admin_update policy already allows for non-owner roles
-- (migration 20260915000007 narrowed owner rows only), so no new privilege is
-- created and invitations remain the only way to GRANT access in the first
-- place.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- S3: the four links become RESTRICT
-- -----------------------------------------------------------------------------

alter table public.memberships
  drop constraint memberships_school_id_teacher_id_fkey,
  add constraint memberships_school_id_teacher_id_fkey
    foreign key (school_id, teacher_id) references public.teachers (school_id, id)
    on delete restrict;

alter table public.memberships
  drop constraint memberships_school_id_guardian_id_fkey,
  add constraint memberships_school_id_guardian_id_fkey
    foreign key (school_id, guardian_id) references public.guardians (school_id, id)
    on delete restrict;

alter table public.class_subjects
  drop constraint class_subjects_school_id_teacher_id_fkey,
  add constraint class_subjects_school_id_teacher_id_fkey
    foreign key (school_id, teacher_id) references public.teachers (school_id, id)
    on delete restrict;

alter table public.student_guardians
  drop constraint student_guardians_school_id_guardian_id_fkey,
  add constraint student_guardians_school_id_guardian_id_fkey
    foreign key (school_id, guardian_id) references public.guardians (school_id, id)
    on delete restrict;


-- -----------------------------------------------------------------------------
-- S2: linking a guardian, atomically
-- -----------------------------------------------------------------------------

create or replace function public.link_guardian_to_student(
  p_school_id uuid,
  p_student_id uuid,
  p_guardian_id uuid,
  p_make_primary boolean default false
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing_is_primary boolean;
  v_rows integer;
begin
  -- The caller must be able to write this student's links. RLS says the same
  -- thing underneath, but a filtered UPDATE affects zero rows SILENTLY, and a
  -- function that then reported 'promoted' would be the very silent failure
  -- S2 is about. Same predicate the student_guardians policies use.
  if not public.has_school_management_role(p_school_id) then
    raise exception 'only school management may link a guardian to a student'
      using errcode = '42501';
  end if;

  select sg.is_primary
    into v_existing_is_primary
    from public.student_guardians sg
   where sg.school_id = p_school_id
     and sg.student_id = p_student_id
     and sg.guardian_id = p_guardian_id;

  -- Demote the student's current primary first, so the insert or promotion
  -- below can never collide with
  -- student_guardians_school_id_student_id_primary_idx.
  if coalesce(p_make_primary, false) then
    update public.student_guardians sg
       set is_primary = false
     where sg.school_id = p_school_id
       and sg.student_id = p_student_id
       and sg.guardian_id <> p_guardian_id
       and sg.is_primary;
  end if;

  if v_existing_is_primary is not null then
    if coalesce(p_make_primary, false) and not v_existing_is_primary then
      update public.student_guardians sg
         set is_primary = true
       where sg.school_id = p_school_id
         and sg.student_id = p_student_id
         and sg.guardian_id = p_guardian_id;
      get diagnostics v_rows = row_count;
      if v_rows <> 1 then
        raise exception 'the primary guardian could not be changed'
          using errcode = '42501';
      end if;
      return 'promoted';
    end if;
    return 'already_linked';
  end if;

  insert into public.student_guardians (school_id, student_id, guardian_id, is_primary)
  values (p_school_id, p_student_id, p_guardian_id, coalesce(p_make_primary, false));

  return case when coalesce(p_make_primary, false) then 'linked_primary' else 'linked' end;
end;
$$;

comment on function public.link_guardian_to_student(uuid, uuid, uuid, boolean) is
  'Links a guardian to a student. When p_make_primary is true it demotes the student''s current primary and promotes this one in the same transaction. Returns linked / linked_primary / promoted / already_linked. SECURITY INVOKER: the student_guardians policies (management only) still decide who may call it (SYSTEM_ISSUES_LIST S2).';

create or replace function public.create_and_link_guardian(
  p_school_id uuid,
  p_student_id uuid,
  p_full_name text,
  p_phone text,
  p_email text default null,
  p_make_primary boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_guardian_id uuid;
begin
  insert into public.guardians (school_id, full_name, phone, email)
  values (p_school_id, p_full_name, p_phone, nullif(pg_catalog.btrim(p_email), ''))
  returning id into v_guardian_id;

  perform public.link_guardian_to_student(p_school_id, p_student_id, v_guardian_id, p_make_primary);

  return v_guardian_id;
end;
$$;

comment on function public.create_and_link_guardian(uuid, uuid, text, text, text, boolean) is
  'Creates a guardian and links them to a student in ONE transaction, so a failed link can no longer leave a guardian belonging to no student (SYSTEM_ISSUES_LIST S2). SECURITY INVOKER; the guardians and student_guardians policies still apply.';

revoke all on function public.link_guardian_to_student(uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.create_and_link_guardian(uuid, uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.link_guardian_to_student(uuid, uuid, uuid, boolean) to authenticated;
grant execute on function public.create_and_link_guardian(uuid, uuid, text, text, text, boolean) to authenticated;
