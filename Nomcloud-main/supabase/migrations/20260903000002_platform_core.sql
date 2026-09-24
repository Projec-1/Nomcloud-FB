-- =============================================================================
-- Migration 02 — platform_core
-- Nom Cloud · Phase 3 (production schema)
--
-- The three PLATFORM-LEVEL tables. None carries school_id: they exist above the
-- tenant boundary, before any school exists, and are shared by all schools.
--
--   1. subscription_plans   — the catalogue behind the public Pricing page
--   2. reserved_shortcodes  — subdomains a school may never claim
--   3. contact_messages     — general enquiries from the public Contact form
--
-- Creates NO row-level security policies (Phase 7) and NO foreign keys outward,
-- per the design's migration plan: "02 platform_core — No FKs outward".
--
-- Depends on Migration 01 for extensions.citext and public.set_updated_at().
--
-- Conventions from design §A.1, applied here and not repeated per table:
--   - id          uuid NOT NULL DEFAULT gen_random_uuid()
--   - created_at  timestamptz NOT NULL DEFAULT now()
--   - updated_at  timestamptz NOT NULL DEFAULT now(), maintained by trigger
--   - text throughout, never varchar(n); money numeric(12,2), never float
-- The per-table column lists in §C omit these deliberately, which is why
-- subscription_plans lists no "id" column yet declares "PK id".
--
-- citext is written as extensions.citext everywhere. The anon and authenticated
-- roles carry no search_path setting, so an unqualified citext would fail to
-- resolve inside the RLS policies added in Phase 7.
-- gen_random_uuid() is left unqualified: PostgreSQL 17 provides it in
-- pg_catalog, which is searched implicitly under every search_path, including ''.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. subscription_plans
--
-- Design §C table 1. Backs the Pricing page, currently hardcoded in Pricing.tsx.
-- Referenced later by school_subscriptions.plan_id ON DELETE RESTRICT — plans are
-- retired by setting is_public = false, never deleted, while schools are billed
-- against them.
-- -----------------------------------------------------------------------------

create table public.subscription_plans (
  id             uuid           not null default gen_random_uuid(),
  code           text           not null,
  name           text           not null,
  description    text,
  price_monthly  numeric(12,2)  not null,
  price_annual   numeric(12,2),
  currency       char(3)        not null default 'USD',
  max_students   integer,
  features       jsonb          not null default '[]'::jsonb,
  is_public      boolean        not null default true,
  sort_order     integer        not null default 0,
  created_at     timestamptz    not null default now(),
  updated_at     timestamptz    not null default now(),

  constraint subscription_plans_pkey
    primary key (id),
  constraint subscription_plans_code_key
    unique (code),
  constraint subscription_plans_price_monthly_check
    check (price_monthly >= 0),
  constraint subscription_plans_max_students_check
    check (max_students > 0)
);

-- NULL max_students means unlimited. The CHECK constrains only non-NULL values,
-- which is the intended behaviour: "> 0" is unknown for NULL, and a CHECK passes
-- on unknown.
comment on column public.subscription_plans.max_students is
  'Seat cap for the plan. NULL means unlimited.';

-- Serves the pricing page's only query: public plans in display order.
create index subscription_plans_is_public_sort_order_idx
  on public.subscription_plans (is_public, sort_order);

create trigger subscription_plans_set_updated_at
  before update on public.subscription_plans
  for each row execute function public.set_updated_at();

comment on table public.subscription_plans is
  'Platform-level plan catalogue. No school_id: plans are shared by every tenant.';


-- -----------------------------------------------------------------------------
-- 2. reserved_shortcodes
--
-- Design §C table 2. Prevents a school claiming www, api, admin, mail, app,
-- status, class and similar as its subdomain.
--
-- shortcode is the natural primary key — no surrogate id, because the value IS
-- the identity. A second row for the same shortcode would be meaningless, and a
-- uuid would only add an indirection with nothing on the other end of it.
-- -----------------------------------------------------------------------------

create table public.reserved_shortcodes (
  shortcode   text         not null,
  reason      text,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),

  constraint reserved_shortcodes_pkey
    primary key (shortcode),

  -- Identical to the pattern that will guard schools.shortcode: DNS-safe,
  -- 3-63 characters, lowercase alphanumeric and hyphen, no leading or trailing
  -- hyphen. Reserving a string a school could never have claimed anyway would
  -- be dead data, so the same rule applies on both sides.
  constraint reserved_shortcodes_shortcode_check
    check (shortcode ~ '^[a-z0-9]([a-z0-9-]{1,61})[a-z0-9]$')
);

create trigger reserved_shortcodes_set_updated_at
  before update on public.reserved_shortcodes
  for each row execute function public.set_updated_at();

comment on table public.reserved_shortcodes is
  'Subdomains no school may claim. Enforced against schools.shortcode by trigger in a later migration, because a CHECK constraint cannot subquery.';


-- -----------------------------------------------------------------------------
-- 3. contact_messages
--
-- Design §C table 4. Backs src/services/contactService.ts.
--
-- Deliberately separate from school_applications: a general enquiry is not an
-- application to run a school, and conflating the two pollutes the approval
-- queue. Retention category DEL in the amended design's retention table —
-- marketing enquiries from non-customers, shortest justifiable retention,
-- anchored on status and handled_at.
--
-- topic is unconstrained text on purpose: Contact.tsx populates it from
-- translated labels (contact.topic.general, .sales, .support, .partnerships),
-- so the stored value is a localised display string, not a stable key.
-- -----------------------------------------------------------------------------

create table public.contact_messages (
  id          uuid              not null default gen_random_uuid(),
  name        text              not null,
  email       extensions.citext not null,
  topic       text              not null,
  message     text              not null,
  status      text              not null default 'new',
  handled_by  uuid,
  handled_at  timestamptz,
  source_ip   inet,
  created_at  timestamptz       not null default now(),
  updated_at  timestamptz       not null default now(),

  constraint contact_messages_pkey
    primary key (id),
  constraint contact_messages_status_check
    check (status in ('new', 'handled'))
);

-- Serves the platform inbox: open enquiries newest first.
create index contact_messages_status_created_at_idx
  on public.contact_messages (status, created_at desc);

create trigger contact_messages_set_updated_at
  before update on public.contact_messages
  for each row execute function public.set_updated_at();

comment on table public.contact_messages is
  'Public contact-form enquiries. Platform-level: submitted before any school relationship exists.';

comment on column public.contact_messages.handled_by is
  'Platform operator who handled the enquiry. FK to profiles(id) ON DELETE SET NULL is added in Migration 04, where profiles is created.';


-- =============================================================================
-- FOLLOW-UP — deferred deliberately, recorded so it is not lost
--
--   1. contact_messages.handled_by has NO foreign key yet. The design specifies
--      handled_by -> profiles(id) ON DELETE SET NULL, but profiles is created in
--      Migration 04. The constraint must be added there. Until then the column
--      accepts any uuid.
--
--   2. contact_messages.status vocabulary. The design fixed the default as 'new'
--      and gave handled_by/handled_at, but never enumerated the full value list.
--      The CHECK admits only the two states those columns evidence. Widening it
--      later is a one-line ALTER of the CHECK, which is precisely why status
--      columns are text rather than enums.
--
--   3. No CHECK on subscription_plans.price_annual. The design specified exactly
--      two checks on this table (price_monthly >= 0, max_students > 0); adding a
--      third here would be inventing constraints the design did not approve.
--
--   4. No CHECK that subscription_plans.features is a JSON array. Same reason.
-- =============================================================================
