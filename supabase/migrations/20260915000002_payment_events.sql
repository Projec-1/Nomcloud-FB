-- =============================================================================
-- PAYMENT INTEGRATION 2 of 2 — payment_events
-- Nom Cloud
--
-- One row per message WaafiPay sends us. Designed in
-- docs/PAYMENT_INTEGRATION_PLAN.md and deferred since Phase 3
-- (docs/SCHEMA_DESIGN.md section 11). Depends on 20260915000001, which adds
-- UNIQUE (school_id, id) to fee_payments.
--
-- Locked decisions applied:
--   1. One shared WaafiPay merchant account for the platform. No per-school
--      credential column exists on this table or anywhere else.
--   2. The parent payment flow will be rebuilt later. This migration prepares
--      the database only.
--   3. Owner, director and administrator may read raw payloads, contact details
--      included, within their own school.
--   4. Four payment methods from the start, in one column, as WaafiPay models it.
--
-- =============================================================================
-- THE IDEMPOTENCY KEY: UNIQUE (provider, provider_event_id, event_type)
-- =============================================================================
--
-- THE RISK. The plan proposed UNIQUE (provider, provider_event_id). If WaafiPay
-- sends more than one message for the same transaction id — "pending" first,
-- "approved" later — the approved message would collide with the pending row,
-- ON CONFLICT DO NOTHING would discard it, and a real payment would never be
-- recorded. No WaafiPay account exists yet to check their callback behaviour,
-- so the table must be safe under either behaviour.
--
-- THE RESOLUTION. The key includes event_type. A pending and an approved
-- message for the same transaction are different keys, so both rows are kept
-- and the approval is never silently dropped. The exact same message delivered
-- twice — same provider, same transaction id, same event_type — is the same key
-- and the second insert is refused, which is the duplicate protection the plan
-- needs. If WaafiPay turns out to send only one message per transaction, the
-- wider key costs nothing.
--
-- WHY event_type IS THE PROVIDER'S VOCABULARY, NOT OURS. The brief suggested
-- received / pending / applied / rejected. Two of those — applied and rejected —
-- are things WE do, and received is the state of every row on arrival. A column
-- inside a unique key must never change after insert, yet our processing state
-- changes exactly once per row. So the two concerns are split:
--
--   event_type          what WaafiPay said about the transaction. Immutable.
--                       pending | approved | declined | cancelled
--
--   processing_status   what we did with the message. Changes once.
--                       received | applied | rejected | ignored
--
-- `ignored` covers a message that is valid but needs no action: a pending
-- notice, or an approval that arrives after the fee is already settled. Both
-- vocabularies are CHECK constraints, not enums, so they can grow in a plain
-- ALTER when real WaafiPay documentation is in hand.
--
-- SECOND LINE: ONE EVENT PER PAYMENT ROW. A partial unique index on
-- (school_id, fee_payment_id) means no two events can claim the same
-- fee_payments row, and a CHECK allows a payment link only on an approved
-- event that has been applied. Together these stop a pending message, or a
-- stray second approval, from being wired to money.
--
-- =============================================================================
-- TENANCY
-- =============================================================================
-- SCHOOL-OWNED, per the plan. school_id is NOT NULL and the two relations to
-- finance rows are COMPOSITE, so the database itself forbids an event in one
-- school pointing at a fee or payment in another:
--
--   (school_id, fee_record_id)  -> fee_records  (school_id, id)
--   (school_id, fee_payment_id) -> fee_payments (school_id, id)
--
-- Both are ON DELETE RESTRICT, mirroring fee_payments -> fee_records exactly.
-- Money records are never collateral damage. One consequence is stated plainly:
-- a fee_payments row created from a WaafiPay event cannot be deleted while the
-- event references it. The administrator "remove payment" correction path
-- therefore does not apply to provider-originated money, which is correct —
-- reversing money that really moved is a refund, not a delete — and that
-- refund/void workflow remains the open item C.5 note 5 already records.
--
-- =============================================================================
-- ACCESS
-- =============================================================================
-- Written ONLY by the Edge Function's service-role path, built in a later task.
--
--   READ    owner, director, administrator — own school   (decision 3)
--           platform administrator — read only
--   WRITE   no client role, including administrator and platform administrator
--
-- Two layers, because RLS alone cannot deliver "no client writes":
--
--   1. GRANTS are the ceiling. Supabase's default privileges give anon and
--      authenticated every privilege on a new public table, TRUNCATE included,
--      and RLS does not govern TRUNCATE at all. So INSERT, UPDATE, DELETE,
--      TRUNCATE, REFERENCES and TRIGGER are revoked from both roles, and anon
--      loses SELECT too. service_role keeps its privileges and bypasses RLS,
--      which is the intended write path.
--   2. RLS is the filter on what remains, which is SELECT for authenticated.
--      There are SELECT policies and deliberately no INSERT, UPDATE or DELETE
--      policy for any role.
--
-- A client write therefore fails at the grant with 42501 before RLS is even
-- consulted, which is a louder and safer failure than RLS's silent zero rows.
--
-- =============================================================================
-- THE amount_paid GUARD IS NOT TOUCHED
-- =============================================================================
-- This migration does not reference fee_records.amount_paid, the
-- sync_fee_record_amount_paid function, the fee_payments_sync_amount_paid
-- trigger, or any grant or policy on fee_records or fee_payments. The eventual
-- Edge Function records money by inserting a fee_payments row and letting that
-- trigger recalculate, exactly as migration 13 and the H.13 corrective require.
-- Because service_role bypasses grants and RLS, that function must never write
-- amount_paid itself; this is recorded in docs/PAYMENT_INTEGRATION_PLAN.md.
-- =============================================================================


create table public.payment_events (
  id                 uuid           not null default gen_random_uuid(),
  school_id          uuid           not null,

  provider           text           not null,
  provider_event_id  text           not null,
  payment_method     text           not null,
  event_type         text           not null,

  amount             numeric(12,2)  not null,
  currency           char(3)        not null default 'USD',

  fee_record_id      uuid           not null,
  fee_payment_id     uuid,

  raw_payload        jsonb          not null,
  received_at        timestamptz    not null default now(),

  processing_status  text           not null default 'received',
  processed_at       timestamptz,

  created_at         timestamptz    not null default now(),
  updated_at         timestamptz    not null default now(),

  constraint payment_events_pkey
    primary key (id),

  -- THE IDEMPOTENCY KEY. See the header.
  constraint payment_events_provider_event_key
    unique (provider, provider_event_id, event_type),

  -- Target for any future composite reference, matching the house pattern.
  constraint payment_events_school_id_id_key
    unique (school_id, id),

  -- Decision 1: one platform merchant account. The column exists so a second
  -- provider is an ALTER of this CHECK, not a redesign.
  constraint payment_events_provider_check
    check (provider in ('waafipay')),

  constraint payment_events_provider_event_id_check
    check (btrim(provider_event_id) <> ''),

  -- Decision 4. WaafiPay distinguishes these as payment types
  -- (MWALLET_ACCOUNT, DEBIT_CARD, and so on); the mapping from their codes to
  -- this vocabulary belongs in the Edge Function.
  constraint payment_events_payment_method_check
    check (payment_method in ('mobile_money', 'card', 'ussd', 'bank_agent')),

  constraint payment_events_event_type_check
    check (event_type in ('pending', 'approved', 'declined', 'cancelled')),

  constraint payment_events_processing_status_check
    check (processing_status in ('received', 'applied', 'rejected', 'ignored')),

  constraint payment_events_amount_check
    check (amount > 0),

  -- A payment row is linked if and only if the event has been applied.
  constraint payment_events_applied_link_check
    check ((processing_status = 'applied') = (fee_payment_id is not null)),

  -- Only an approval can ever become money.
  constraint payment_events_link_requires_approved_check
    check (fee_payment_id is null or event_type = 'approved'),

  -- processed_at is set exactly when the row leaves 'received'.
  constraint payment_events_processed_at_check
    check ((processing_status = 'received') = (processed_at is null)),

  -- TENANT ROOT, single-column, as on fee_payments.
  constraint payment_events_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,

  -- COMPOSITE, RESTRICT. Same-school by construction.
  constraint payment_events_school_id_fee_record_id_fkey
    foreign key (school_id, fee_record_id)
    references public.fee_records (school_id, id)
    on delete restrict
    on update no action,

  -- COMPOSITE, RESTRICT. Needs fee_payments_school_id_id_key (20260915000001).
  constraint payment_events_school_id_fee_payment_id_fkey
    foreign key (school_id, fee_payment_id)
    references public.fee_payments (school_id, id)
    on delete restrict
    on update no action
);

comment on table public.payment_events is
  'Every message received from a payment provider. Written only by the service-role Edge Function; readable by owner, director and administrator of the school. Records what the provider said; fee_payments records the money the school accepted.';
comment on column public.payment_events.provider_event_id is
  'The provider''s own transaction id. Part of the idempotency key with provider and event_type.';
comment on column public.payment_events.event_type is
  'What the provider reported about the transaction. Immutable, part of the idempotency key. Distinct from processing_status.';
comment on column public.payment_events.processing_status is
  'What Nom Cloud did with this message: received on arrival, then applied, rejected or ignored exactly once.';
comment on column public.payment_events.fee_payment_id is
  'The fee_payments row this event created. NULL until applied. The balance change itself is made by the fee_payments trigger, never by writing fee_records.amount_paid.';

-- One event per payment row. See the header.
create unique index payment_events_school_id_fee_payment_id_key
  on public.payment_events (school_id, fee_payment_id)
  where fee_payment_id is not null;

-- Access path for the fee_records foreign key and "events for this invoice".
create index payment_events_school_id_fee_record_id_idx
  on public.payment_events (school_id, fee_record_id);

create trigger payment_events_set_updated_at
  before update on public.payment_events
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- Grants: the ceiling. See the header.
-- -----------------------------------------------------------------------------

revoke all on table public.payment_events from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.payment_events from authenticated;
grant select on table public.payment_events to authenticated;


-- -----------------------------------------------------------------------------
-- RLS: the filter. SELECT policies only.
-- -----------------------------------------------------------------------------

alter table public.payment_events enable row level security;

create policy payment_events_admin_select on public.payment_events
  for select to authenticated
  using (public.has_school_admin_role(school_id));

-- Platform operators read for support. Deliberately SELECT, not the FOR ALL
-- pattern other tables use: decision 3 and the brief allow no client writes.
create policy payment_events_platform_admin_select on public.payment_events
  for select to authenticated
  using (public.is_platform_admin());
