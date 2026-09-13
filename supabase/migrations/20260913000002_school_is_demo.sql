-- =============================================================================
-- Phase 8 / Batch 0 — school_is_demo
-- Nom Cloud
--
-- Adds the demo-school marker approved as decision 12 in
-- docs/PHASE8_CONNECTION_PLAN.md section H.9, creates the single demo school,
-- and reserves its shortcode.
--
-- Additive only. One new column with a safe default, two inserted rows. No
-- existing column, constraint, trigger, policy, grant or function is altered,
-- and no other table is touched.
--
-- =============================================================================
-- WHY A COLUMN RATHER THAN INFERRING FROM THE SHORTCODE
-- =============================================================================
-- Section H.9 recommends an explicit marker rather than treating the shortcode
-- 'demo' as the signal. Inferring identity from a name is the mistake
-- AUTH_DESIGN sections 7 and 8 warn about for subdomains: the shortcode is
-- routing and branding, never an authorisation or classification input. A
-- boolean column is a fact about the tenant; a name is a label that could be
-- changed or mimicked.
--
-- NOT NULL DEFAULT false means every existing and future school is real unless
-- someone deliberately says otherwise. There are zero schools in this database
-- today, so the default rewrites nothing.
--
-- =============================================================================
-- WHY THE SCHOOL IS CREATED BEFORE ITS SHORTCODE IS RESERVED
-- =============================================================================
-- public.schools carries
--
--   CREATE TRIGGER schools_reject_reserved_shortcode
--     BEFORE INSERT OR UPDATE OF shortcode ON public.schools
--
-- which raises 23514 when the incoming shortcode appears in
-- reserved_shortcodes. Reserving 'demo' first would therefore make the demo
-- school itself unrepresentable.
--
-- The order below is deliberate and must not be swapped. The demo school takes
-- 'demo' while it is still free; the reservation then stops any *future* school
-- claiming it, because the trigger only inspects rows being written. The demo
-- school keeps the shortcode because the trigger never re-validates rows at
-- rest. A later attempt to UPDATE that school's shortcode to 'demo' would now
-- fail, which is harmless and arguably desirable.
--
-- =============================================================================
-- WHAT THIS MIGRATION DOES NOT DO
-- =============================================================================
-- It does not populate the demo school with students, teachers, classes or any
-- other data. Batch 0 establishes the school and the marker only; demo content
-- is seeded progressively as each later batch connects its data type, so the
-- demo school always exercises exactly the paths that are actually wired.
--
-- It does not restrict who may read or write the demo school. RLS already
-- governs that: the demo school is an ordinary tenant and its members reach it
-- through the same policies as any other school. That is the point of choosing
-- a real tenant over a client-side mock.
--
-- Unreachability in production is a FRONTEND compile-time boundary
-- (import.meta.env.DEV), matching how AUTH_DESIGN section 8 handles demo
-- credentials. The row existing in production is harmless because nothing in a
-- production bundle can route to it.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The marker column
-- -----------------------------------------------------------------------------

alter table public.schools
  add column is_demo boolean not null default false;

comment on column public.schools.is_demo is
  'True only for the sales and demonstration tenant. A fact about the tenant, deliberately not inferred from the shortcode, because a shortcode is routing and branding and never a classification input. Drives the persistent Demo Mode indicator in the application, and is the boundary that keeps demonstration data structurally separate from customer data rather than mixed into it. Phase 8 batch 0, decision 12.';


-- -----------------------------------------------------------------------------
-- 2. The demo school
--
-- Somali defaults are stated explicitly rather than left to the column defaults
-- so the row reads as a deliberate configuration of the first market: a Friday
-- and Saturday weekend, Mogadishu time, SO, USD.
--
-- ON CONFLICT DO NOTHING makes the migration idempotent against a database
-- where a 'demo' school already exists by some other route.
-- -----------------------------------------------------------------------------

insert into public.schools (
  shortcode,
  name,
  is_demo,
  timezone,
  country,
  currency,
  locale,
  weekend_days
)
values (
  'demo',
  'Nom Cloud Demo School',
  true,
  'Africa/Mogadishu',
  'SO',
  'USD',
  'en',
  '{5,6}'
)
on conflict (shortcode) do nothing;


-- -----------------------------------------------------------------------------
-- 3. Reserve the shortcode
--
-- Must run after section 2. See the header.
--
-- Note for a future decision, not acted on here: reserved_shortcodes is
-- otherwise EMPTY. SCHEMA_DESIGN section C table 2 names www, api, admin, mail,
-- app, status and class as intended reservations, but nothing ever seeded them,
-- so the guard currently protects only the value added below. Seeding the rest
-- is a separate change and is out of scope for batch 0.
-- -----------------------------------------------------------------------------

insert into public.reserved_shortcodes (shortcode, reason)
values ('demo', 'Reserved for the Nom Cloud demonstration tenant (schools.is_demo). Phase 8 batch 0.')
on conflict (shortcode) do nothing;


-- =============================================================================
-- End of Phase 8 batch 0 migration. One column added, two rows inserted.
-- =============================================================================
