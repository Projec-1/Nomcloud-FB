-- =============================================================================
-- CORRECTIVE — payment_reassignment_guards
-- Nom Cloud
--
-- Corrects 20260912000006_finance_rls (Phase 7 RLS batch 5) and
-- 20260914000001_restrict_fee_record_amount_paid_insert (§H.13).
-- Fixes docs/SYSTEM_ISSUES_LIST.md S5 (the "moved" part, sweep F10) and S6.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS WRONG, MEASURED (rolled-back probes, 2026-09-15)
-- ---------------------------------------------------------------------------
-- The two earlier correctives stopped a client WRITING a balance. Neither
-- stopped a client MOVING real money to a different child.
--
-- S5 / F10. fee_payments still carries a table-level UPDATE grant for anon
-- and authenticated covering every column, fee_record_id included, and
-- fee_payments_admin_update admits owner, director and administrator. So
--   update fee_payments set fee_record_id = <Layla's fee>
--    where id = <a WaafiPay-applied payment on Yusuf's fee>
-- returned OK rows=1: Yusuf's amount_paid 60 -> 30, Layla's 0 -> 30, and the
-- payment_events row still pointed at Yusuf's fee. No screen offers it; any
-- administrator session can send it through PostgREST.
--
-- S6 / F12. fee_records.student_id is in the UPDATE column grant, which is
-- correct for an invoice with no money on it. But Admin -> Fees -> Edit lets the
-- Student be changed on ANY fee, and updateFeeRecord sends student_id. On a fee
-- with 60 already paid the update returned OK rows=1 and the fee, with its 60,
-- became another pupil's.
--
-- THE TRIGGER IS NOT PART OF THE BUG. sync_fee_record_amount_paid recalculates
-- the OLD fee_record_id and the NEW one on every UPDATE (measured in F10: both
-- sides correct). It did its job; the job should never have been asked of it.
--
-- ---------------------------------------------------------------------------
-- FIX 1 — fee_payments.fee_record_id is immutable: COLUMN GRANT
-- ---------------------------------------------------------------------------
-- The same instrument, layer and roles the amount_paid guards use: revoke
-- table-level UPDATE from anon and authenticated, re-grant UPDATE to
-- authenticated on an explicit column list that omits fee_record_id. A payment
-- belongs to the fee it was recorded against, permanently.
--
-- A column grant rather than a trigger, for the reason §H.13 gave: it is the
-- instrument already guarding this table pair, a future reader finds one rule
-- in one place, and it closes every client route (named column, upsert DO
-- UPDATE) while leaving the table owner and service_role unbound.
--
-- Also omitted from the new list, because moving them is equally meaningless:
-- id, school_id, created_at, updated_at (the last two are server-maintained).
--
-- DELIBERATELY STILL UPDATABLE: amount, currency, method, reference, paid_on,
-- recorded_by, external_ref. Editing a provider-confirmed payment's amount or
-- external_ref (S5 sweep F9, F16) and currency mismatches (S7) are separate
-- open items and are NOT changed here. anon loses UPDATE entirely.
--
-- ---------------------------------------------------------------------------
-- FIX 2 — fee_records.student_id is frozen once any payment exists: TRIGGER
-- ---------------------------------------------------------------------------
-- A column grant cannot express this rule: student_id must stay editable on a
-- fee with no money against it (a mistaken invoice is corrected before anyone
-- has paid) and must not be editable once it has any. That condition lives in
-- another table, so the instrument is a BEFORE UPDATE OF student_id trigger.
--
-- It is the RESTRICT pattern in trigger form: the existence of dependent
-- financial rows refuses the change loudly with SQLSTATE PT409. That is
-- PostgREST's documented custom-status form (PTxyz is returned as HTTP xyz), so
-- the API answers 409 Conflict rather than 500, and the code is distinct from
-- the 23514/23505/23503 codes updateFeeRecord already maps, so the interface can
-- say exactly what happened. (A first version raised 55000, which PostgREST
-- reports as HTTP 500; changed before commit, see docs/MIGRATIONS.md.)
--
-- Why it binds everyone, table owner included, unlike the grants: there is no
-- legitimate actor for whom silently re-pointing paid money at another child is
-- correct, and a historical import creates fees, it does not move them. The
-- correction for a fee raised against the wrong pupil is a workflow (void or
-- remove the payments, then correct, or raise a new fee), which does not exist
-- yet and is NOT built here.
--
-- SECURITY DEFINER with search_path pinned empty, for the reason migration 13
-- made the sync trigger DEFINER: the existence check must see every payment,
-- not only the rows the caller's RLS happens to admit. The function takes no
-- caller argument and reads exactly the one fee row's payments.
--
-- Fires only when student_id is in the UPDATE's target list AND actually
-- changes, so sync_fee_record_amount_paid (which writes amount_paid only) and
-- ordinary edits that re-send an unchanged student_id are unaffected.
--
-- Nothing else changes: no policy, no CHECK, no other grant, no existing
-- function, and nothing on payment_events.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Fix 1: column-level UPDATE grant on fee_payments without fee_record_id
-- -----------------------------------------------------------------------------

revoke update on table public.fee_payments from anon, authenticated;

grant update (amount, currency, method, reference, paid_on, recorded_by, external_ref)
  on table public.fee_payments to authenticated;

comment on column public.fee_payments.fee_record_id is
  'The fee this payment was recorded against. Immutable to every client role: migration 20260915000006 removed it from the UPDATE column grant, so a payment can never be moved to another fee, and therefore never to another student. sync_fee_record_amount_paid still handles a repoint on both sides should a privileged role ever perform one.';


-- -----------------------------------------------------------------------------
-- Fix 2: refuse re-pointing a fee at another student once money exists
-- -----------------------------------------------------------------------------

create or replace function public.prevent_paid_fee_student_change()
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
    raise exception 'fee % already has payments recorded against it and cannot be moved to a different student', old.id
      using errcode = 'PT409',
            hint = 'Correct the payments first, or raise a new fee for the right student.';
  end if;
  return new;
end;
$$;

comment on function public.prevent_paid_fee_student_change() is
  'BEFORE UPDATE OF student_id trigger on fee_records. Refuses (PT409, HTTP 409) changing the student of a fee that has any fee_payments row, so real money cannot silently become another pupil''s. A fee with no payments can still be corrected. SECURITY DEFINER so the existence check is not narrowed by the caller''s RLS.';

revoke all on function public.prevent_paid_fee_student_change() from public, anon, authenticated;

drop trigger if exists fee_records_prevent_paid_student_change on public.fee_records;

create trigger fee_records_prevent_paid_student_change
  before update of student_id on public.fee_records
  for each row
  when (old.student_id is distinct from new.student_id)
  execute function public.prevent_paid_fee_student_change();
