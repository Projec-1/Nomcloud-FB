-- =============================================================================
-- Migration 10 — finance
-- Nom Cloud · Phase 3 (production schema)
--
-- Design number 10. See docs/MIGRATIONS.md for the numbering convention.
--
--   public.fee_records   — SCHOOL-OWNED
--   public.fee_payments  — SCHOOL-OWNED
--   public.sync_fee_record_amount_paid()  — the first BUSINESS-LOGIC trigger
--
-- Depends on Migration 01 (public.set_updated_at), 03 (schools), 04 (profiles),
-- 06 (terms) and 07 (students). Creates NO row-level security policies (Phase 7).
--
-- Money is numeric(12,2) throughout, never float.
--
-- =============================================================================
-- 1. fee_records.status IS NOT STORED (§F)
-- =============================================================================
-- There is deliberately NO status column on fee_records. paid / partial /
-- unpaid / overdue is DERIVED from amount, amount_paid and due_date at read
-- time. It cannot even be a generated column, because 'overdue' depends on
-- today's date and a generated column must be IMMUTABLE.
--
-- §F is explicit that a stored copy "drifts and produces wrong money": the row
-- would say 'unpaid' the morning after it silently became overdue, and would say
-- 'partial' forever if a payment write failed to update it. Computing at read
-- cannot drift. No view is created here either — that is Phase 8's job, and the
-- design specifies none.
--
-- =============================================================================
-- 2. fee_records.amount_paid IS TRIGGER-MAINTAINED (§F)
-- =============================================================================
-- Never written by the application. See the function below for the full design
-- rationale; the short version is that a sum maintained by the database from the
-- rows it sums cannot disagree with them.
--
-- =============================================================================
-- 3. TWO RESTRICTS — money movement is never collateral damage
-- =============================================================================
--   row 71  fee_records  (school_id, term_id)        -> terms
--   row 72  fee_payments (school_id, fee_record_id)  -> fee_records
--
-- Row 72 is the one place the design DELIBERATELY breaks the cascade pattern. A
-- fee record with payments against it must not be deletable. Removing a fee
-- requires voiding its payments first, explicitly and auditably. §10 classifies
-- both tables FIN (financial retention) and calls fee_payments "never a deletion
-- candidate while inside the financial window".
--
-- =============================================================================
-- SCOPED SET NULL — derived from §13 rows 70-72
-- =============================================================================
-- Filtering rows 70-72 to ON DELETE SET NULL yields EXACTLY ZERO: they are
-- CASCADE, RESTRICT and RESTRICT. No column-list syntax is needed for any
-- composite FK here. The single SET NULL is audit row 82,
-- fee_payments.recorded_by -> profiles(id), which is SINGLE-COLUMN and
-- attribution-only: it records who keyed the payment and grants no access.
--
-- =============================================================================
-- PAYMENT EVENTS — DEFERRED
-- =============================================================================
-- "payment_events (provider event id, event type, received_at, verification
-- status, processed_at, idempotency guard) is DEFERRED from Phase 3 and REQUIRED
-- before production payment integration in Phase 11."
--
-- Nothing here prevents adding it: it is a new table requiring no change to
-- these two. fee_payments.external_ref already exists as the join point to a
-- provider transaction and is unconstrained in form, and fee_payments carries no
-- unique constraint that would conflict with a later idempotency key.
-- ONE FORWARD REQUIREMENT: amendment §11 states payment_events would reference
-- fee_payments (school_id, id) compositely, so Phase 11 must first add
-- UNIQUE (school_id, id) to fee_payments. It is NOT added now, because nothing
-- in Phase 3 references fee_payments and the design does not specify it.
--
-- Conventions from §A.1 apply without being repeated.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. fee_records — SCHOOL-OWNED
--
-- Design §C table 28.
-- -----------------------------------------------------------------------------

create table public.fee_records (
  id           uuid            not null default gen_random_uuid(),
  school_id    uuid            not null,
  student_id   uuid            not null,
  term_id      uuid            not null,
  category     text            not null,
  amount       numeric(12,2)   not null,
  amount_paid  numeric(12,2)   not null default 0,
  currency     char(3)         not null default 'USD',
  due_date     date            not null,
  created_at   timestamptz     not null default now(),
  updated_at   timestamptz     not null default now(),

  constraint fee_records_pkey
    primary key (id),
  constraint fee_records_school_id_student_id_term_id_category_key
    unique (school_id, student_id, term_id, category),

  -- Composite-FK target for fee_payments (§13 row 72).
  constraint fee_records_school_id_id_key
    unique (school_id, id),

  constraint fee_records_amount_check
    check (amount > 0),
  constraint fee_records_amount_paid_check
    check (amount_paid >= 0),
  constraint fee_records_amount_paid_not_over_check
    check (amount_paid <= amount),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint fee_records_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 row 70 — COMPOSITE, CASCADE.
  constraint fee_records_school_id_student_id_fkey
    foreign key (school_id, student_id)
    references public.students (school_id, id)
    on delete cascade
    on update no action,

  -- §13 row 71 — COMPOSITE, RESTRICT. A term with fees raised against it must
  -- not be deletable.
  constraint fee_records_school_id_term_id_fkey
    foreign key (school_id, term_id)
    references public.terms (school_id, id)
    on delete restrict
    on update no action
);

comment on table public.fee_records is
  'Fees raised against a student for a term. Carries NO status column: paid/partial/unpaid/overdue is derived from amount, amount_paid and due_date at read time (§F).';

comment on column public.fee_records.amount_paid is
  'MAINTAINED BY TRIGGER from fee_payments. Never written by the application — an application-written copy drifts and produces wrong money (§F).';

-- The fee calendar / arrears run.
create index fee_records_school_id_due_date_idx
  on public.fee_records (school_id, due_date);

create trigger fee_records_set_updated_at
  before update on public.fee_records
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. fee_payments — SCHOOL-OWNED
--
-- Design §C table 29.
--
-- UNIQUE (school_id, reference) prevents double-recording the same transaction —
-- the single most likely and most damaging data-entry error in the module.
-- -----------------------------------------------------------------------------

create table public.fee_payments (
  id             uuid            not null default gen_random_uuid(),
  school_id      uuid            not null,
  fee_record_id  uuid            not null,
  amount         numeric(12,2)   not null,
  currency       char(3)         not null default 'USD',
  method         text            not null,
  reference      text            not null,
  paid_on        date            not null,
  recorded_by    uuid,
  external_ref   text,
  created_at     timestamptz     not null default now(),
  updated_at     timestamptz     not null default now(),

  constraint fee_payments_pkey
    primary key (id),

  -- Prevents double-recording the same transaction.
  constraint fee_payments_school_id_reference_key
    unique (school_id, reference),

  constraint fee_payments_amount_check
    check (amount > 0),

  -- §C table 29 defines this vocabulary. evc_plus and edahab are the two
  -- dominant Somali mobile-money rails.
  constraint fee_payments_method_check
    check (method in ('card', 'bank_transfer', 'cash', 'mobile_money', 'evc_plus', 'edahab')),

  -- §13 rows 19-41. TENANT ROOT, single-column.
  constraint fee_payments_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- §13 row 72 — COMPOSITE, RESTRICT. THE DELIBERATE BREAK IN THE CASCADE
  -- PATTERN. A fee record with payments against it cannot be deleted.
  constraint fee_payments_school_id_fee_record_id_fkey
    foreign key (school_id, fee_record_id)
    references public.fee_records (school_id, id)
    on delete restrict
    on update no action,

  -- §13 row 82 — SINGLE-COLUMN, SET NULL. Attribution only; who keyed the
  -- payment must survive staff turnover, and it grants no access.
  constraint fee_payments_recorded_by_fkey
    foreign key (recorded_by) references public.profiles (id) on delete set null
);

comment on table public.fee_payments is
  'Money received against a fee record. ON DELETE RESTRICT from fee_records: money movement is never collateral damage.';

comment on column public.fee_payments.external_ref is
  'Payment-provider transaction id. The join point to the deferred payment_events table (Phase 11). Unconstrained in form.';

create trigger fee_payments_set_updated_at
  before update on public.fee_payments
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. sync_fee_record_amount_paid() — the amount_paid maintenance trigger
--
-- THE FIRST BUSINESS-LOGIC TRIGGER IN THE SCHEMA, as distinct from the purely
-- mechanical set_updated_at. It exists because §F requires amount_paid to be
-- derived from fee_payments rather than written by the application: a sum the
-- database maintains from the rows it sums cannot disagree with them, whereas an
-- application-written copy drifts on any failed or partial write.
--
-- WHICH EVENTS FIRE IT, AND WHY EACH IS NEEDED
--   INSERT  a new payment raises the total
--   UPDATE  the amount may be corrected, or fee_record_id repointed to a
--           different fee, or school_id corrected — any of which changes one or
--           two totals
--   DELETE  a removed payment lowers the total
-- AFTER, not BEFORE: the sum must see the committed effect of the row change.
-- FOR EACH ROW, because the affected fee record is identified per row.
--
-- BEHAVIOUR WHEN fee_record_id ITSELF CHANGES
-- The two blocks below are independent. On UPDATE, the first recalculates the
-- OLD fee record and the second the NEW one, so repointing a payment correctly
-- lowers the old total AND raises the new one. When the payment stays on the
-- same fee record both blocks target it, and the second is a harmless no-op —
-- the guard "amount_paid IS DISTINCT FROM the new total" means no redundant row
-- version is written and fee_records.updated_at is not falsely bumped.
--
-- HARDENING
-- SECURITY INVOKER with search_path pinned to '' and every reference
-- schema-qualified, matching set_updated_at (Migration 01) and
-- reject_reserved_shortcode (Migration 03).
--
-- IF THE RECALCULATED TOTAL WOULD EXCEED amount
-- fee_records_amount_paid_not_over_check (amount_paid <= amount) fires and the
-- UPDATE raises SQLSTATE 23514, which aborts the statement that triggered it —
-- so the offending payment INSERT or UPDATE is REJECTED and rolled back. This is
-- intended: an overpayment cannot be silently recorded. Taking more money than
-- the fee requires means the fee itself is wrong, so the fee's amount must be
-- raised first, in a deliberate and auditable step. No credit-balance concept
-- exists in this design.
--
-- KNOWN LIMIT: a row-level trigger does not fire on TRUNCATE. Truncating
-- fee_payments would leave amount_paid stale. No TRUNCATE trigger is added
-- because the design does not specify one, and §10 classifies these tables FIN —
-- truncating them is not an operation that should ever occur.
-- -----------------------------------------------------------------------------

create or replace function public.sync_fee_record_amount_paid()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total numeric(12,2);
begin
  -- OLD side: the fee record this payment is leaving (DELETE, or UPDATE).
  if tg_op in ('DELETE', 'UPDATE') then
    select coalesce(sum(fp.amount), 0)
      into v_total
      from public.fee_payments fp
     where fp.school_id = old.school_id
       and fp.fee_record_id = old.fee_record_id;

    update public.fee_records fr
       set amount_paid = v_total
     where fr.school_id = old.school_id
       and fr.id = old.fee_record_id
       and fr.amount_paid is distinct from v_total;
  end if;

  -- NEW side: the fee record this payment now belongs to (INSERT, or UPDATE).
  if tg_op in ('INSERT', 'UPDATE') then
    select coalesce(sum(fp.amount), 0)
      into v_total
      from public.fee_payments fp
     where fp.school_id = new.school_id
       and fp.fee_record_id = new.fee_record_id;

    update public.fee_records fr
       set amount_paid = v_total
     where fr.school_id = new.school_id
       and fr.id = new.fee_record_id
       and fr.amount_paid is distinct from v_total;
  end if;

  -- AFTER trigger: the return value is ignored.
  return null;
end;
$$;

comment on function public.sync_fee_record_amount_paid() is
  'Recalculates fee_records.amount_paid from the sum of its fee_payments. Handles a payment being repointed between fee records by recalculating both sides. An overpayment is rejected by the amount_paid <= amount CHECK.';

create trigger fee_payments_sync_amount_paid
  after insert or update or delete on public.fee_payments
  for each row execute function public.sync_fee_record_amount_paid();


-- =============================================================================
-- NULLABILITY DECISIONS WHERE THE DESIGN IS SILENT
--
-- §C table 29 is written in terse prose. Two decisions, both stated so they can
-- be corrected:
--
--   fee_payments.reference  NOT NULL — the design marks external_ref explicitly
--       as "text NULL" and reference simply as "text". Read against that
--       contrast, reference is required. It also has to be: UNIQUE
--       (school_id, reference) cannot prevent double-recording if the column may
--       be NULL, because NULLs do not collide.
--   fee_payments.currency   char(3) NOT NULL DEFAULT 'USD' — matching
--       fee_records.currency and schools.currency, which the design specifies.
--
-- NOTE ON INDEXES NOT CREATED
--   fee_records (school_id, student_id)
--       served by fee_records_school_id_student_id_term_id_category_key
--       (btree on (school_id, student_id, term_id, category) — leading columns
--       match), per the §C table 10 "(unique already)" precedent.
-- =============================================================================
