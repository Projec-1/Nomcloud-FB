-- =============================================================================
-- CORRECTIVE — attribution_and_subject_scope
-- Nom Cloud
--
-- Fixes docs/SYSTEM_ISSUES_LIST.md M6 and M7. (M8 is verified, not changed here;
-- see the issues list.)
--
-- #############################################################################
-- M6 — ATTRIBUTION CAN BE ERASED OR FORGED
-- #############################################################################
--
-- MEASURED (rolled-back sweep probes, 2026-09-15):
--   G4  a subject teacher overwrote an administrator's mark and set
--       recorded_by = NULL.                                         OK rows=1
--   H4  management created homework with created_by = another teacher.
--                                                                   OK rows=1
--   I2  management created an invitation with invited_by = another user.
--                                                                   OK rows=1
--
-- THE MECHANISM IS THE ONE ALREADY BUILT FOR ATTENDANCE (S11,
-- 20260916000002): the attribution column must equal auth.uid() in the WITH
-- CHECK of every policy that writes the row. No NULL, no one else's id. On an
-- edit the column becomes the editor, so a record always names who last set it.
--
--   grade_records.recorded_by   teacher insert/update: "(IS NULL OR = auth.uid())"
--                               tightened to "= auth.uid()", exactly as
--                               attendance was. Management insert/update had no
--                               attribution check at all; they gain the same one.
--   homework.created_by         identical treatment, teacher and management.
--   invitations.invited_by      INSERT gains "invited_by = auth.uid()".
--
-- WHY invitations.invited_by DIFFERS ON UPDATE. For marks and homework,
-- "the last editor is recorded" is the right meaning. For an invitation it is
-- not: invited_by means who SENT it, and the one update the application makes —
-- revoking a pending invitation, possibly by a different administrator — must
-- not rewrite that. Re-attributing on UPDATE would falsify the record the fix is
-- meant to protect. So on UPDATE the other already-proven instrument is used,
-- the S5 one (fee_payments.fee_record_id, 20260915000006): invited_by is removed
-- from the UPDATE column grant, making it immutable to every client once set.
-- revokeInvitation sends only revoked_at and is unaffected.
--
-- NOT NULL on these columns was considered and rejected for the same reason as
-- marked_by: recorded_by, created_by and invited_by are FKs to profiles with
-- ON DELETE SET NULL (or CASCADE), so attribution survives staff turnover as a
-- NULL. The policies are what stop a live client writing a NULL or a forgery.
--
-- #############################################################################
-- M7 — A RECORD IN A SUBJECT THE CLASS DOES NOT TAKE
-- #############################################################################
--
-- MEASURED: G6, an administrator recorded an Arabic grade in 5A, which has no
-- Arabic. OK rows=1.
--
-- THE SAME GAP ON HOMEWORK AND EXAMS — investigated, confirmed. All three
-- tables reference (class_id, subject_id). Their TEACHER policies were already
-- safe, because teaches_class_subject requires a class_subjects row naming both.
-- Their MANAGEMENT policies check only can_manage_class, which is class-level
-- and says nothing about the subject. So management could file a grade,
-- homework or exam under a subject the class does not take, on all three.
--
-- THE FIX is a data-integrity rule rather than an authority rule — a grade in a
-- subject the class does not take is wrong whoever writes it — so it is a
-- trigger, the same instrument the previous batch used for M3 (a term from
-- another year): one SECURITY DEFINER function with an empty search_path, shared
-- by all three tables, firing only when subject_id or class_id is written, and
-- raising PT422 (HTTP 422).
--
-- NOTHING ELSE CHANGES: no other policy, grant, trigger or function, and none of
-- the earlier guards.
-- =============================================================================


-- #############################################################################
-- M6 — attribution
-- #############################################################################

-- grade_records.recorded_by -------------------------------------------------

alter policy grade_records_teacher_insert on public.grade_records
  with check (
    public.teaches_class_subject(school_id, class_id, subject_id)
    and public.student_enrolled_in_class(school_id, class_id, student_id)
    and recorded_by = auth.uid()
  );

alter policy grade_records_teacher_update on public.grade_records
  using (public.teaches_class_subject(school_id, class_id, subject_id))
  with check (
    public.teaches_class_subject(school_id, class_id, subject_id)
    and public.student_enrolled_in_class(school_id, class_id, student_id)
    and recorded_by = auth.uid()
  );

alter policy grade_records_management_insert on public.grade_records
  with check (
    public.can_manage_class(school_id, class_id)
    and recorded_by = auth.uid()
  );

alter policy grade_records_management_update on public.grade_records
  using (public.can_manage_class(school_id, class_id))
  with check (
    public.can_manage_class(school_id, class_id)
    and recorded_by = auth.uid()
  );

-- homework.created_by -------------------------------------------------------

alter policy homework_teacher_insert on public.homework
  with check (
    public.teaches_class_subject(school_id, class_id, subject_id)
    and created_by = auth.uid()
  );

alter policy homework_teacher_update on public.homework
  using (public.teaches_class_subject(school_id, class_id, subject_id))
  with check (
    public.teaches_class_subject(school_id, class_id, subject_id)
    and created_by = auth.uid()
  );

alter policy homework_management_insert on public.homework
  with check (
    public.can_manage_class(school_id, class_id)
    and created_by = auth.uid()
  );

alter policy homework_management_update on public.homework
  using (public.can_manage_class(school_id, class_id))
  with check (
    public.can_manage_class(school_id, class_id)
    and created_by = auth.uid()
  );

-- invitations.invited_by ----------------------------------------------------

alter policy invitations_admin_insert on public.invitations
  with check (
    public.has_school_admin_role(school_id)
    and (role <> 'owner' or public.has_school_owner_role(school_id))
    and invited_by = auth.uid()
  );

-- On UPDATE, immutable by column grant (the S5 instrument), so revoking an
-- invitation cannot rewrite who sent it. Every other column keeps the UPDATE
-- privilege it had.
revoke update on table public.invitations from anon, authenticated;
grant update (accepted_at, accepted_by, created_at, email, expires_at, guardian_id, id,
              revoked_at, role, school_id, scope_mode, teacher_id, token_hash, updated_at)
  on table public.invitations to authenticated;

comment on column public.invitations.invited_by is
  'Who sent the invitation. Must be the caller on insert (invitations_admin_insert) and is immutable to every client afterwards (removed from the UPDATE column grant in 20260916000004), so revoking an invitation never rewrites it (SYSTEM_ISSUES_LIST M6).';


-- #############################################################################
-- M7 — subject must be one the class takes
-- #############################################################################

create or replace function public.assert_subject_taught_in_class()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject text;
  v_class text;
begin
  if not exists (
    select 1
      from public.class_subjects cs
     where cs.school_id = new.school_id
       and cs.class_id = new.class_id
       and cs.subject_id = new.subject_id
  ) then
    select s.name into v_subject from public.subjects s where s.school_id = new.school_id and s.id = new.subject_id;
    select c.name into v_class from public.classes c where c.school_id = new.school_id and c.id = new.class_id;
    raise exception 'class "%" does not take subject "%"', coalesce(v_class, '?'), coalesce(v_subject, '?')
      using errcode = 'PT422',
            hint = 'Assign the subject to the class first, or choose one of the class''s subjects.';
  end if;

  return new;
end;
$$;

comment on function public.assert_subject_taught_in_class() is
  'BEFORE INSERT OR UPDATE OF subject_id, class_id on grade_records, homework and exams. A record may only name a subject that has a class_subjects row for its class. The teacher policies already implied this through teaches_class_subject; the management policies are class-level and did not (SYSTEM_ISSUES_LIST M7).';

drop trigger if exists grade_records_assert_subject_taught on public.grade_records;
create trigger grade_records_assert_subject_taught
  before insert or update of subject_id, class_id on public.grade_records
  for each row
  execute function public.assert_subject_taught_in_class();

drop trigger if exists homework_assert_subject_taught on public.homework;
create trigger homework_assert_subject_taught
  before insert or update of subject_id, class_id on public.homework
  for each row
  execute function public.assert_subject_taught_in_class();

drop trigger if exists exams_assert_subject_taught on public.exams;
create trigger exams_assert_subject_taught
  before insert or update of subject_id, class_id on public.exams
  for each row
  execute function public.assert_subject_taught_in_class();
