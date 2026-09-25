-- =============================================================================
-- CORRECTIVE — guardian_visibility_and_relationship
-- Nom Cloud
--
-- Fixes docs/SYSTEM_ISSUES_LIST.md M5 and the database half of C2. (M4 and C1
-- are interface-only; see the issues list.)
--
-- #############################################################################
-- M5 — A GUARDIAN KEEPS SEEING A CLASS AFTER THEIR CHILD LEAVES IT
-- #############################################################################
--
-- MEASURED (sweep L2): with Yusuf's 5A enrolment closed, guardian Amina still
-- read 5A's homework (2), timetable (1), class subjects (2) and the class row
-- (1). The same helper gates 5A's exams and class announcements.
--
-- CAUSE: guardian_has_student_in_class joins class_enrollments without
-- `left_on IS NULL`, so a closed enrolment counts as membership forever.
--
-- THE FIX IS THE TEACHER-SIDE PATTERN, UNCHANGED: `ce.left_on is null` on the
-- enrolment join, exactly as teaches_student (20260915000004) and
-- student_enrolled_in_class (20260916000002) already have. Nothing else in the
-- function moves: same signature, same SECURITY DEFINER, same empty
-- search_path, so every policy that calls it (classes, class_subjects,
-- timetable_slots, homework, exams, announcements with audience 'class')
-- tightens at once. CREATE OR REPLACE keeps the existing EXECUTE grants.
--
-- WHAT A GUARDIAN STILL SEES. Records about their OWN child are gated by
-- is_guardian_of_student, not by this helper, and are untouched: grades,
-- attendance, homework submissions, fees and the enrolment rows (history
-- included). Only the class-wide material of a class the child has left
-- disappears. The parent screens read classes through OPEN enrolments only
-- (guardianService), so nothing they show depends on the old behaviour.
--
-- #############################################################################
-- C2 — GUARDIAN RELATIONSHIP CANNOT BE SET
-- #############################################################################
--
-- student_guardians.relationship (free text) exists, but both linking paths go
-- through RPCs (S2, 20260916000001) that have no parameter for it, so every
-- link made from the interface stores NULL. Both functions gain
-- `p_relationship text default null`. The body is otherwise the S2 body:
--   * a new link stores the relationship;
--   * promoting an existing link to primary also records a relationship given;
--   * an existing link given a DIFFERENT relationship is updated and reports
--     'relationship_updated' (row count asserted, as the S2 promotion is, so an
--     RLS-filtered update cannot report success);
--   * a blank value is stored as NULL, never as ''.
-- Adding a parameter changes the signature, so the old functions are dropped and
-- recreated, and their grants re-applied exactly as S2 set them. The default
-- keeps every existing call working.
--
-- The column stays free text. The interface offers Mother / Father / Other, the
-- vocabulary the demo data and the bulk-import plan already use; no CHECK is
-- added, so existing and imported values are not invalidated.
--
-- NOTHING ELSE CHANGES: no policy, grant or other function, and none of the
-- earlier guards.
-- =============================================================================


-- #############################################################################
-- M5
-- #############################################################################

create or replace function public.guardian_has_student_in_class(p_school_id uuid, p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
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
       and ce.left_on is null
       and m.user_id = auth.uid()
       and m.status = 'active'
       and m.role = 'guardian'
  );
$$;

comment on function public.guardian_has_student_in_class(uuid, uuid) is
  'True when the caller is an active guardian of a student with an OPEN enrolment (left_on IS NULL) in the class. Gates class-wide material for guardians: the class row, class subjects, timetable, homework, exams and class announcements. Uses the same "still enrolled" signal as teaches_student and student_enrolled_in_class, so a guardian stops seeing a class once their child leaves it (SYSTEM_ISSUES_LIST M5). Records about the child themselves are gated by is_guardian_of_student and are unaffected.';


-- #############################################################################
-- C2
-- #############################################################################

drop function if exists public.create_and_link_guardian(uuid, uuid, text, text, text, boolean);
drop function if exists public.link_guardian_to_student(uuid, uuid, uuid, boolean);

create function public.link_guardian_to_student(
  p_school_id uuid,
  p_student_id uuid,
  p_guardian_id uuid,
  p_make_primary boolean default false,
  p_relationship text default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing_is_primary boolean;
  v_existing_relationship text;
  v_relationship text := nullif(pg_catalog.btrim(p_relationship), '');
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

  select sg.is_primary, sg.relationship
    into v_existing_is_primary, v_existing_relationship
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
         set is_primary = true,
             relationship = coalesce(v_relationship, sg.relationship)
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

    if v_relationship is not null and v_relationship is distinct from v_existing_relationship then
      update public.student_guardians sg
         set relationship = v_relationship
       where sg.school_id = p_school_id
         and sg.student_id = p_student_id
         and sg.guardian_id = p_guardian_id;
      get diagnostics v_rows = row_count;
      if v_rows <> 1 then
        raise exception 'the guardian''s relationship could not be changed'
          using errcode = '42501';
      end if;
      return 'relationship_updated';
    end if;

    return 'already_linked';
  end if;

  insert into public.student_guardians (school_id, student_id, guardian_id, is_primary, relationship)
  values (p_school_id, p_student_id, p_guardian_id, coalesce(p_make_primary, false), v_relationship);

  return case when coalesce(p_make_primary, false) then 'linked_primary' else 'linked' end;
end;
$$;

comment on function public.link_guardian_to_student(uuid, uuid, uuid, boolean, text) is
  'Links a guardian to a student, with their relationship (Mother / Father / Other in the interface). When p_make_primary is true it demotes the student''s current primary and promotes this one in the same transaction. Returns linked / linked_primary / promoted / relationship_updated / already_linked. SECURITY INVOKER: the student_guardians policies (management only) still decide who may call it (SYSTEM_ISSUES_LIST S2, C2).';

create function public.create_and_link_guardian(
  p_school_id uuid,
  p_student_id uuid,
  p_full_name text,
  p_phone text,
  p_email text default null,
  p_make_primary boolean default false,
  p_relationship text default null
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

  perform public.link_guardian_to_student(p_school_id, p_student_id, v_guardian_id, p_make_primary, p_relationship);

  return v_guardian_id;
end;
$$;

comment on function public.create_and_link_guardian(uuid, uuid, text, text, text, boolean, text) is
  'Creates a guardian and links them to a student, with their relationship, in ONE transaction, so a failed link can no longer leave a guardian belonging to no student (SYSTEM_ISSUES_LIST S2, C2). SECURITY INVOKER; the guardians and student_guardians policies still apply.';

revoke all on function public.link_guardian_to_student(uuid, uuid, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.create_and_link_guardian(uuid, uuid, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.link_guardian_to_student(uuid, uuid, uuid, boolean, text) to authenticated;
grant execute on function public.create_and_link_guardian(uuid, uuid, text, text, text, boolean, text) to authenticated;
