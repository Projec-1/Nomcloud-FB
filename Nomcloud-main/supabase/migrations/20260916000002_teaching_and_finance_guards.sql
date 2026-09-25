-- =============================================================================
-- CORRECTIVE — teaching_and_finance_guards
-- Nom Cloud
--
-- TWO INDEPENDENT GROUPS, kept apart on purpose. They share nothing but this
-- file: different tables, different helpers, different triggers. Either section
-- can be reverted without touching the other.
--
--   GROUP A — teaching records   S10, S11, K3
--                                attendance_records, grade_records,
--                                homework_submissions
--   GROUP B — finance remainder  S7, the open half of S5
--                                fee_payments, fee_records
--
-- Corrects 20260912000005_teaching_records_rls (group A) and
-- 20260912000006_finance_rls / 20260915000006_payment_reassignment_guards
-- (group B).
--
--
-- #############################################################################
-- GROUP A — TEACHING RECORDS (S10, S11, K3)
-- #############################################################################
--
-- WHAT WAS WRONG, MEASURED (rolled-back probes, 2026-09-15)
--
-- The teacher policies on all three tables asked only "do you teach this
-- class?" and never "is this student in it?":
--   K3  Faysal marked attendance for a student of another class, and for a
--       student who had LEFT his class (sweep T4, L4). OK rows=1.
--   S10 Sahra recorded a grade (G1) and a homework submission (H2) for Layla,
--       who is enrolled in 6B, against 5A. OK rows=1 both.
--   S11 Sahra rewrote Faysal's attendance record, set marked_by to NULL, and
--       re-pointed the row to a different student (AT1, AT2). OK rows=1 both.
--
-- FIX 1 — THE MISSING ENROLMENT CHECK, as a helper beside teaches_class.
-- student_enrolled_in_class(school, class, student) is the enrolment half of
-- the pair whose teaching half already exists, and it reuses the same "still
-- enrolled" signal every roster read uses (class_enrollments.left_on IS NULL —
-- the same one teaches_student already relies on). homework_submissions carries
-- homework_id rather than class_id, so homework_class_has_student resolves the
-- homework's class and delegates; it invents nothing.
--
-- Both are SECURITY DEFINER with search_path pinned empty, exactly like
-- teaches_class and teaches_student, because an enrolment check filtered by the
-- caller's own RLS would answer "not enrolled" for rows the caller cannot see
-- and would deny legitimate writes.
--
-- FIX 2 — S11, TWO SEPARATE HOLES.
--   (a) marked_by could be set to NULL. The CHECK read
--       "(marked_by IS NULL OR marked_by = auth.uid())", which exists so a row
--       may omit attribution, not so an editor may erase it. Teacher INSERT and
--       UPDATE now require marked_by = auth.uid(): whoever writes the row owns
--       it, and an edit re-attributes to the editor rather than blanking.
--       NOT NULL on the column was considered and rejected: marked_by is
--       "FK profiles(id) ON DELETE SET NULL — who marked it must survive staff
--       turnover" (SCHEMA_DESIGN table 19), so the column must stay nullable for
--       the case where the marker's profile is deleted. The policy is what stops
--       a live client writing a NULL.
--   (b) student_id could be changed after creation. Same principle as
--       fee_payments.fee_record_id in the S5 fix — a record belongs to what it
--       was created for — but the instrument is a TRIGGER, not a column grant,
--       and the difference matters: saveAttendance upserts, and PostgREST's
--       ON CONFLICT DO UPDATE SET lists every column in the payload, student_id
--       included. A column grant would therefore refuse every re-mark of an
--       existing register (the commonest action on the screen), while a trigger
--       that fires only WHEN the value actually changes leaves the upsert alone.
--
-- FIX 3 — CO-TEACHING, the question the brief asked.
-- The schema does answer this one, so it is not left to guesswork: RLS batch 4
-- decision 1 made attendance deliberately class-level, "one row per pupil per
-- day, so any teacher of the class may mark it", precisely because a homeroom
-- teacher who teaches no subject must still be able to mark the register. A
-- creator-only rule would break that on the first co-taught class and would
-- leave a wrongly-marked register uncorrectable when the marker is away.
-- KEPT: any teacher who currently teaches the class may edit the record.
-- CHANGED: the edit can no longer be anonymous — marked_by becomes the editor
-- (fix 2a), so the register always names who last set it. That turns a silent
-- overwrite into an attributed one, which is the part S11 actually reports.
-- If the school wants creator-only edits instead, that is a product decision,
-- and it is a one-line tightening of the USING clause; it is flagged in
-- SYSTEM_ISSUES_LIST rather than assumed here.
--
-- WHAT GROUP A DOES NOT TOUCH: the management policies (can_manage_class /
-- can_manage_homework). Owner, director, administrator and principal keep
-- school-wide authority over these records by design. Whether management should
-- also be held to the enrolment check is a real question and is recorded as
-- open; it is not this fix, which is scoped to the teacher gap that was
-- measured.
--
--
-- #############################################################################
-- GROUP B — FINANCE REMAINDER (S7, S5 remainder)
-- #############################################################################
--
-- WHAT WAS WRONG, MEASURED
--   S7  A 25 EUR payment was accepted against a USD fee and summed straight
--       into amount_paid (F14), and a fee's currency was changed to SOS while
--       its payments stayed USD (F13).
--   S5  A WaafiPay-confirmed payment's amount (F9) and external_ref/reference
--       (F16) were still editable after the fact; its payment_events row kept
--       the original values, so the two records disagreed.
--
-- FIX 4 — a payment's currency must equal its fee's.
-- A CHECK cannot see another table, so this is a trigger, the same instrument
-- and shape as sync_fee_record_amount_paid: BEFORE INSERT OR UPDATE, SECURITY
-- DEFINER, search_path empty, reading exactly the one parent row.
--
-- FIX 5 — a fee's currency is frozen once any payment exists.
-- The brief offered the S6 pattern and that is what this uses: a second trigger
-- of the same shape as fee_records_prevent_paid_student_change, on the currency
-- column. A SEPARATE trigger and function rather than widening S6's, so each
-- rule reads on its own and either can be dropped without the other. Together
-- with fix 4 the invariant holds from both ends: payments cannot arrive in the
-- wrong currency, and the fee cannot change out from under the payments it has.
--
-- FIX 6 — provider-confirmed payments are not editable.
-- "Provider-confirmed" is not a flag to invent: it is exactly
-- "a payment_events row points at this fee_payments row"
-- (payment_events.fee_payment_id, unique per payment). Once that link exists,
-- amount, external_ref, reference and currency are frozen. The condition lives
-- in another table, so again a trigger rather than a column grant.
--
-- THE MANUAL-CORRECTION PATH IS PRESERVED, deliberately and by construction: a
-- cash, bank or card payment recorded in the office has no payment_events row,
-- so this trigger never fires for it and an administrator can still correct its
-- amount, method, reference or date. Only money a provider confirmed is frozen,
-- which is the distinction the brief asked to confirm.
--
-- All three group B triggers raise PT409, the code PostgREST returns as HTTP
-- 409, matching the S6 guard so the interface can report a conflict rather than
-- a server error.
--
-- NOTHING ELSE CHANGES in either group: no grant, no CHECK, no existing
-- function, and none of the guards from S1, S5, S6, S8 or S9.
-- =============================================================================


-- #############################################################################
-- GROUP A — TEACHING RECORDS
-- #############################################################################

-- -----------------------------------------------------------------------------
-- A1. Helpers — the enrolment half of teaches_class
-- -----------------------------------------------------------------------------

create or replace function public.student_enrolled_in_class(
  p_school_id uuid,
  p_class_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.class_enrollments ce
     where ce.school_id = p_school_id
       and ce.class_id = p_class_id
       and ce.student_id = p_student_id
       and ce.left_on is null
  );
$$;

comment on function public.student_enrolled_in_class(uuid, uuid, uuid) is
  'True when the student has an OPEN enrolment (left_on IS NULL) in that class. The enrolment half of the pair whose teaching half is teaches_class; uses the same "still enrolled" signal as teaches_student and every roster read (SYSTEM_ISSUES_LIST K3, S10, S11).';

create or replace function public.homework_class_has_student(
  p_school_id uuid,
  p_homework_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.homework h
     where h.school_id = p_school_id
       and h.id = p_homework_id
       and public.student_enrolled_in_class(h.school_id, h.class_id, p_student_id)
  );
$$;

comment on function public.homework_class_has_student(uuid, uuid, uuid) is
  'True when the student is currently enrolled in the class this homework was set for. homework_submissions carries homework_id rather than class_id; this resolves the class and delegates to student_enrolled_in_class.';

revoke all on function public.student_enrolled_in_class(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.homework_class_has_student(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.student_enrolled_in_class(uuid, uuid, uuid) to authenticated;
grant execute on function public.homework_class_has_student(uuid, uuid, uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- A2. attendance_records — enrolment + attribution (K3, S11)
-- -----------------------------------------------------------------------------

alter policy attendance_records_teacher_insert on public.attendance_records
  with check (
    public.teaches_class(school_id, class_id)
    and public.student_enrolled_in_class(school_id, class_id, student_id)
    and marked_by = auth.uid()
  );

alter policy attendance_records_teacher_update on public.attendance_records
  using (public.teaches_class(school_id, class_id))
  with check (
    public.teaches_class(school_id, class_id)
    and public.student_enrolled_in_class(school_id, class_id, student_id)
    and marked_by = auth.uid()
  );


-- -----------------------------------------------------------------------------
-- A3. grade_records — enrolment (S10)
-- -----------------------------------------------------------------------------

alter policy grade_records_teacher_insert on public.grade_records
  with check (
    public.teaches_class_subject(school_id, class_id, subject_id)
    and public.student_enrolled_in_class(school_id, class_id, student_id)
    and ((recorded_by is null) or (recorded_by = auth.uid()))
  );

alter policy grade_records_teacher_update on public.grade_records
  using (public.teaches_class_subject(school_id, class_id, subject_id))
  with check (
    public.teaches_class_subject(school_id, class_id, subject_id)
    and public.student_enrolled_in_class(school_id, class_id, student_id)
    and ((recorded_by is null) or (recorded_by = auth.uid()))
  );


-- -----------------------------------------------------------------------------
-- A4. homework_submissions — enrolment (S10)
-- -----------------------------------------------------------------------------

alter policy homework_submissions_teacher_insert on public.homework_submissions
  with check (
    public.teaches_homework(school_id, homework_id)
    and public.homework_class_has_student(school_id, homework_id, student_id)
  );

alter policy homework_submissions_teacher_update on public.homework_submissions
  using (public.teaches_homework(school_id, homework_id))
  with check (
    public.teaches_homework(school_id, homework_id)
    and public.homework_class_has_student(school_id, homework_id, student_id)
  );


-- -----------------------------------------------------------------------------
-- A5. attendance_records.student_id is immutable (S11)
-- -----------------------------------------------------------------------------

create or replace function public.prevent_attendance_student_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'an attendance record cannot be moved to a different student'
    using errcode = 'PT409',
          hint = 'Delete the record and mark the right pupil instead.';
  return new;
end;
$$;

comment on function public.prevent_attendance_student_change() is
  'BEFORE UPDATE OF student_id trigger on attendance_records. A record belongs to the pupil it was created for (SYSTEM_ISSUES_LIST S11). A trigger rather than a column grant because saveAttendance upserts, and PostgREST puts every payload column in ON CONFLICT DO UPDATE SET, so a grant would refuse every legitimate re-mark; the trigger fires only when the value actually changes.';

drop trigger if exists attendance_records_prevent_student_change on public.attendance_records;

create trigger attendance_records_prevent_student_change
  before update of student_id on public.attendance_records
  for each row
  when (old.student_id is distinct from new.student_id)
  execute function public.prevent_attendance_student_change();


-- #############################################################################
-- GROUP B — FINANCE REMAINDER
-- #############################################################################

-- -----------------------------------------------------------------------------
-- B1. A payment's currency must equal its fee's (S7)
-- -----------------------------------------------------------------------------

create or replace function public.enforce_payment_currency_matches_fee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fee_currency character(3);
begin
  select fr.currency
    into v_fee_currency
    from public.fee_records fr
   where fr.school_id = new.school_id
     and fr.id = new.fee_record_id;

  if v_fee_currency is not null and new.currency is distinct from v_fee_currency then
    raise exception 'payment currency % does not match the fee currency %', new.currency, v_fee_currency
      using errcode = 'PT409',
            hint = 'Record the payment in the fee''s own currency.';
  end if;

  return new;
end;
$$;

comment on function public.enforce_payment_currency_matches_fee() is
  'BEFORE INSERT OR UPDATE trigger on fee_payments. A CHECK cannot read another table, so this is the instrument, shaped like sync_fee_record_amount_paid: DEFINER, empty search_path, one parent row. Stops a EUR payment counting toward a USD fee (SYSTEM_ISSUES_LIST S7).';

drop trigger if exists fee_payments_currency_matches_fee on public.fee_payments;

create trigger fee_payments_currency_matches_fee
  before insert or update of currency, fee_record_id on public.fee_payments
  for each row
  execute function public.enforce_payment_currency_matches_fee();


-- -----------------------------------------------------------------------------
-- B2. A fee's currency is frozen once it has payments (S7)
-- -----------------------------------------------------------------------------

create or replace function public.prevent_paid_fee_currency_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.fee_payments fp
     where fp.school_id = old.school_id
       and fp.fee_record_id = old.id
  ) then
    raise exception 'fee % already has payments recorded against it and cannot change currency', old.id
      using errcode = 'PT409',
            hint = 'Correct the payments first, or raise a new fee in the right currency.';
  end if;
  return new;
end;
$$;

comment on function public.prevent_paid_fee_currency_change() is
  'BEFORE UPDATE OF currency trigger on fee_records, the S6 pattern applied to currency: a fee with money against it cannot change the currency that money was taken in (SYSTEM_ISSUES_LIST S7). A separate trigger from fee_records_prevent_paid_student_change so each rule reads on its own.';

drop trigger if exists fee_records_prevent_paid_currency_change on public.fee_records;

create trigger fee_records_prevent_paid_currency_change
  before update of currency on public.fee_records
  for each row
  when (old.currency is distinct from new.currency)
  execute function public.prevent_paid_fee_currency_change();


-- -----------------------------------------------------------------------------
-- B3. Provider-confirmed payments are not editable (S5 remainder)
-- -----------------------------------------------------------------------------

create or replace function public.prevent_confirmed_payment_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.payment_events pe
     where pe.school_id = old.school_id
       and pe.fee_payment_id = old.id
  ) then
    raise exception 'payment % was confirmed by the provider and its amount and references cannot be edited', old.id
      using errcode = 'PT409',
            hint = 'Provider-confirmed money is recorded as it was received. Raise a correcting entry instead.';
  end if;
  return new;
end;
$$;

comment on function public.prevent_confirmed_payment_edit() is
  'BEFORE UPDATE OF amount, currency, external_ref, reference trigger on fee_payments. "Provider-confirmed" is not a new flag: it is a payment_events row pointing at this payment. A manually recorded cash, bank or card payment has no such row, so the office can still correct one — only money a provider confirmed is frozen (SYSTEM_ISSUES_LIST S5).';

drop trigger if exists fee_payments_prevent_confirmed_edit on public.fee_payments;

create trigger fee_payments_prevent_confirmed_edit
  before update of amount, currency, external_ref, reference on public.fee_payments
  for each row
  when (
    old.amount is distinct from new.amount
    or old.currency is distinct from new.currency
    or old.external_ref is distinct from new.external_ref
    or old.reference is distinct from new.reference
  )
  execute function public.prevent_confirmed_payment_edit();
