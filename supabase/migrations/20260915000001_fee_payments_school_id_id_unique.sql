-- =============================================================================
-- PAYMENT INTEGRATION 1 of 2 — fee_payments_school_id_id_unique
-- Nom Cloud
--
-- Prerequisite for payment_events (20260915000002). No design number: this is
-- not one of the Phase 3 design migrations 01-11 and not a corrective. It
-- delivers exactly what docs/SCHEMA_DESIGN.md section 11 recorded in advance:
--
--   "It is school-owned and would carry school_id plus a composite FK to
--    fee_payments(school_id, id) — which means Phase 11 must first add
--    UNIQUE (school_id, id) to fee_payments."
--
-- WHY IT IS NEEDED. A composite foreign key must reference a set of columns
-- covered by a unique constraint. fee_payments has UNIQUE (id) through its
-- primary key and UNIQUE (school_id, reference), but nothing on
-- (school_id, id). Every other school-owned table that is the target of a
-- composite, same-school foreign key already carries this pair
-- (fee_records_school_id_id_key, homework_school_id_id_key, and so on).
--
-- WHY IT IS PURELY ADDITIVE.
--   - `id` is already the primary key, so (school_id, id) is unique for every
--     row that could ever exist. The constraint cannot reject any current or
--     future row that the primary key would have accepted.
--   - The table holds 0 rows today, verified before writing.
--   - No constraint, index, trigger, policy or grant on fee_payments is
--     altered, dropped or replaced. One unique index is added.
--   - sync_fee_record_amount_paid and the fee_payments_sync_amount_paid trigger
--     are not touched. fee_records.amount_paid is not referenced.
-- =============================================================================

alter table public.fee_payments
  add constraint fee_payments_school_id_id_key unique (school_id, id);

comment on constraint fee_payments_school_id_id_key on public.fee_payments is
  'Target for composite same-school foreign keys, first needed by payment_events (school_id, fee_payment_id). Redundant with the primary key for uniqueness; exists so a reference can bind the tenant as well as the row.';
