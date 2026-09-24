-- =============================================================================
-- Phase 7 / Migration 13 — finance_rls  (RLS BATCH 5 of 6)
-- Nom Cloud
--
-- Enables RLS on fee_records and fee_payments, adds one helper, closes a money
-- integrity gap that has been open since Phase 3, and makes one change to an
-- existing function because the closure genuinely breaks it otherwise.
--
-- The 5 remaining unprotected tables are batch 6 and are untouched.
--
-- No FORCE ROW LEVEL SECURITY. No Phase 3 CHECK constraint is weakened:
-- amount > 0, amount_paid >= 0 and amount_paid <= amount are all left exactly
-- as Migration 10 created them.
--
-- =============================================================================
-- THE amount_paid GAP, AND WHY THIS MIGRATION CHANGES THE TRIGGER
-- =============================================================================
--
-- SCHEMA_DESIGN section F and MIGRATIONS.md both state that
-- fee_records.amount_paid is trigger-maintained from fee_payments and "never
-- written by the application". That was documented but never enforced.
--
-- MEASURED STATE BEFORE THIS MIGRATION. public.sync_fee_record_amount_paid is
-- SECURITY INVOKER, and both anon and authenticated hold table-level UPDATE on
-- fee_records covering every column, amount_paid included. Phase 3 created no
-- column-level grant. The only constraints on the column are the two CHECKs,
-- which stop a negative value and a value above amount, and stop nothing else.
--
-- Probed on a fee of 1000 with a single payment of 400:
--
--   amount_paid after the payment                     400.00   (trigger worked)
--   administrator runs: update fee_records
--       set amount_paid = 1000                        OK rows=1
--   amount_paid afterwards                           1000.00
--
-- An administrator could therefore mark any fee fully settled with no payment
-- behind it, and no audit trail, by writing one column directly. RLS alone
-- cannot close this: a policy applies to a whole row and cannot make one column
-- immutable. C.5 says exactly that, and names column grants as the instrument.
--
-- -----------------------------------------------------------------------------
-- THE BREAK THAT THE OBVIOUS FIX CAUSES, AND THE PROOF OF IT
-- -----------------------------------------------------------------------------
-- Revoking UPDATE on fee_records and re-granting it column by column, omitting
-- amount_paid, does close the forgery. It also breaks the money path, because
-- the trigger is SECURITY INVOKER: its own
--
--     update public.fee_records set amount_paid = v_total ...
--
-- runs with the privileges of whoever inserted the payment, so it hits the very
-- column restriction just added. Measured, with the column grant in place and
-- the function still SECURITY INVOKER:
--
--   administrator forges amount_paid       FAILED 42501 permission denied
--   administrator inserts a real payment   FAILED 42501 permission denied
--   amount_paid                            400.00  (stale, payment rejected)
--
-- The whole payment insert fails. That is worse than the gap it closes: taking
-- money would stop working.
--
-- -----------------------------------------------------------------------------
-- THE FIX THAT HOLDS, AND THE PROOF OF IT
-- -----------------------------------------------------------------------------
-- Column grant, plus SECURITY DEFINER on the trigger function so its internal
-- write runs as the function owner and is subject to neither the column grant
-- nor the fee_records policies. Measured, same fixture:
--
--   administrator forges amount_paid       FAILED 42501 permission denied
--   administrator inserts payment of 300   OK rows=1
--   amount_paid                            700.00  (400 + 300, correct)
--   administrator updates fee amount       OK rows=1  (ordinary columns fine)
--   administrator deletes a payment        OK rows=1
--   amount_paid                            400.00  (recalculated DOWN, correct)
--
-- This is the specific break and the specific fix, reported before being
-- applied, as required. The change to sync_fee_record_amount_paid is made with
-- ALTER FUNCTION ... SECURITY DEFINER: the body, the signature and the pinned
-- empty search_path are all untouched.
--
-- Why SECURITY DEFINER is safe here. The function reads and writes exactly one
-- fee_records row, identified by the (school_id, fee_record_id) pair carried on
-- the fee_payments row that fired it. The composite foreign key
-- fee_payments (school_id, fee_record_id) -> fee_records (school_id, id)
-- guarantees that pair is real and same-school, so the function cannot be
-- steered at another tenant's row. It takes no caller-supplied argument at all.
--
-- It also removes a second, quieter hazard. As SECURITY INVOKER the function's
-- aggregate, sum(fp.amount) over fee_payments, was itself RLS-filtered, so any
-- future writer whose payment read is narrower than school-wide would have
-- silently computed a short total and written a wrong balance with no error.
-- C.5 flags precisely this. As SECURITY DEFINER the aggregate always sees the
-- true row set, and that hazard is closed structurally rather than by
-- coincidence of the current policy shape.
--
-- =============================================================================
-- CONCLUSION 1 — PRINCIPAL GETS NO ACCESS TO EITHER TABLE.
-- =============================================================================
-- The locked decision named owner, director and administrator. It did not
-- mention principal, and silence is not inclusion, least of all for money.
--
-- The decisive reason is structural rather than a matter of taste. Fees have no
-- campus dimension: CAMPUS_ROLE_DESIGN B.2 refuses campus_id on fee_records and
-- fee_payments and says not to imply one, and batch 2 confirmed there is no
-- student-campus history to derive it from. So "a principal within their scope"
-- is not expressible on these two tables. Any principal access would
-- necessarily be school-wide, which would make a principal strictly more
-- powerful over the school's money than over its classes, where batch 3 confines
-- them to named campuses. That is incoherent, and the conservative reading is
-- the correct one.
--
-- C.5 independently records "P/T, all or selected, no direct read initially".
--
-- If principal finance access is wanted later it is a product decision, and it
-- must be taken knowing it is school-wide or not at all.
--
-- =============================================================================
-- CONCLUSION 2 — TEACHER GETS NO ACCESS TO EITHER TABLE.
-- =============================================================================
-- The design does settle this: C.5 records "no direct read initially" for
-- teacher on both tables. Both options are stated anyway, since the choice has
-- consequences either way.
--
-- OPTION A, implemented here: zero teacher access. Fee status is strictly
-- administrative. A teacher who needs to know whether a pupil owes fees asks the
-- office, and no family's financial position reaches teaching staff. The cost is
-- that any fee-dependent classroom workflow, such as withholding a result, has
-- to be routed through an administrator.
--
-- OPTION B, not implemented: teacher read for pupils in classes they teach.
-- Cheap in policy terms, since batch 3 and 4 already provide the predicates. The
-- cost is that a fee balance is a direct proxy for family financial hardship,
-- and this would expose it to every teacher of that child. It also reads poorly:
-- fee_records keys on student and term, not class, so the predicate needs
-- student -> class_enrollments -> classes -> teaches_class, a chain batch 2
-- measured as non-total, which would show some pupils' fees and silently hide
-- others.
--
-- Option A is implemented because it is what the design says and because the
-- data is sensitive. Switching to B later is additive: one SELECT policy per
-- table, no change to anything else.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. The trigger function's security context
-- -----------------------------------------------------------------------------

alter function public.sync_fee_record_amount_paid() security definer;

comment on function public.sync_fee_record_amount_paid() is
  'Recalculates fee_records.amount_paid from the sum of its fee_payments. Handles a payment being repointed between fee records by recalculating both sides. An overpayment is rejected by the amount_paid <= amount CHECK. SECURITY DEFINER since Phase 7 batch 5: the column-level grant that stops a client writing amount_paid directly would otherwise block this function''s own write, because it runs with the caller''s privileges, and the sum over fee_payments would be RLS-filtered rather than complete. Body, signature and pinned empty search_path are unchanged from Migration 10.';


-- -----------------------------------------------------------------------------
-- 1. Helper — guardian reach from a payment to their own child
-- -----------------------------------------------------------------------------
-- fee_payments carries fee_record_id, not student_id, so the batch-2 guardian
-- predicate cannot be applied to it directly. This resolves the payment's fee
-- record to its student and defers to is_guardian_of_student, so the guardian
-- rule stays written once.

create function public.is_guardian_of_fee_record(p_school_id uuid, p_fee_record_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.fee_records fr
     where fr.school_id = p_school_id
       and fr.id = p_fee_record_id
       and public.is_guardian_of_student(fr.school_id, fr.student_id)
  );
$$;

comment on function public.is_guardian_of_fee_record(uuid, uuid) is
  'True when the caller is the guardian of the student a fee record belongs to. Lets fee_payments, which carries only fee_record_id, reuse the single guardian predicate established in batch 2 rather than restating it.';

revoke all on function public.is_guardian_of_fee_record(uuid, uuid) from public;
grant execute on function public.is_guardian_of_fee_record(uuid, uuid) to anon, authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 2. fee_records
--
-- Guardians read their own child's fees. Owner, director and administrator have
-- full read and write within their school, per the locked decision. Principal
-- and teacher receive no policy at all. No policy names anon.
-- -----------------------------------------------------------------------------

alter table public.fee_records enable row level security;

create policy fee_records_platform_admin_all on public.fee_records
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy fee_records_admin_select on public.fee_records
  for select to authenticated
  using (public.has_school_admin_role(school_id));

create policy fee_records_guardian_select on public.fee_records
  for select to authenticated
  using (public.is_guardian_of_student(school_id, student_id));

create policy fee_records_admin_insert on public.fee_records
  for insert to authenticated
  with check (public.has_school_admin_role(school_id));

create policy fee_records_admin_update on public.fee_records
  for update to authenticated
  using (public.has_school_admin_role(school_id))
  with check (public.has_school_admin_role(school_id));

create policy fee_records_admin_delete on public.fee_records
  for delete to authenticated
  using (public.has_school_admin_role(school_id));

-- The column-level grant. This, not any policy, is what makes amount_paid
-- unwritable by a client. Every other column stays updatable by the roles the
-- policies above admit. anon loses UPDATE entirely and is granted nothing back.
revoke update on table public.fee_records from anon, authenticated;
grant update (school_id, student_id, term_id, category, amount, currency, due_date)
  on table public.fee_records to authenticated;


-- -----------------------------------------------------------------------------
-- 3. fee_payments
--
-- Guardians read the payments recorded against their own child's fees, which is
-- their receipt history. They cannot create one: a guardian-initiated payment
-- belongs to a payment flow, never to a direct INSERT, per C.5.
-- -----------------------------------------------------------------------------

alter table public.fee_payments enable row level security;

create policy fee_payments_platform_admin_all on public.fee_payments
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy fee_payments_admin_select on public.fee_payments
  for select to authenticated
  using (public.has_school_admin_role(school_id));

create policy fee_payments_guardian_select on public.fee_payments
  for select to authenticated
  using (public.is_guardian_of_fee_record(school_id, fee_record_id));

create policy fee_payments_admin_insert on public.fee_payments
  for insert to authenticated
  with check (
    public.has_school_admin_role(school_id)
    and (recorded_by is null or recorded_by = auth.uid())
  );

create policy fee_payments_admin_update on public.fee_payments
  for update to authenticated
  using (public.has_school_admin_role(school_id))
  with check (
    public.has_school_admin_role(school_id)
    and (recorded_by is null or recorded_by = auth.uid())
  );

-- DELETE is granted per the locked decision, which places payment write with
-- owner, director and administrator and adds no further restriction. Note for
-- the record: SCHEMA_DESIGN section 10 classifies fee_payments as the strictest
-- retention class and says it is never a deletion candidate inside the financial
-- window, and C.5 asks for an approved void process. No such process exists yet,
-- so deletion is the only correction path available today and the trigger does
-- recalculate the balance downwards correctly when it is used. Replacing this
-- with a void workflow remains an open item.
create policy fee_payments_admin_delete on public.fee_payments
  for delete to authenticated
  using (public.has_school_admin_role(school_id));


-- =============================================================================
-- End of Batch 5. No table outside fee_records and fee_payments is enabled for
-- RLS or receives a policy. The only existing object altered is the security
-- context of sync_fee_record_amount_paid, which the column grant requires. No
-- CHECK constraint is weakened.
-- =============================================================================
