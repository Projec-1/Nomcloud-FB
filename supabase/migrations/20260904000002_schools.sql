-- =============================================================================
-- Migration 03 — schools
-- Nom Cloud · Phase 3 (production schema)
--
-- Design number 03. See docs/MIGRATIONS.md for the numbering convention:
-- design numbers 01-11 are reserved for the §I plan; corrective migrations carry
-- no design number.
--
--   public.schools               — TENANT ROOT
--   public.school_subscriptions  — SCHOOL-OWNED
--
-- Depends on Migration 01 (public.school_status, public.set_updated_at) and
-- Migration 02 (public.subscription_plans, public.reserved_shortcodes).
--
-- Creates NO row-level security policies (Phase 7).
--
-- FOUR APPROVED AMENDMENTS override the original §C text and are applied here:
--   §12  schools is TENANT ROOT, not "SCHOOL-OWNED (root)". A schools row
--        ESTABLISHES a tenant; it is not owned by one. It carries no school_id.
--   §14  schools.active_academic_year_id is REMOVED entirely. The active year
--        derives from academic_years WHERE status = 'active'. This eliminates the
--        design's only circular FK: schools has ZERO outbound foreign keys.
--   §9   school_subscriptions.status has NO DEFAULT. See the note on that table.
--   §4   schools.weekend_days defaults to '{5,6}' — Friday-Saturday, the Somali
--        weekend — not the Monday-Friday assumption hardcoded in the frontend's
--        schoolCalendar.ts.
--
-- Conventions from §A.1 (id, created_at, updated_at, timestamptz, text) are
-- applied without being repeated per table.
-- citext is qualified as extensions.citext; gen_random_uuid() is not qualified,
-- since PostgreSQL 17 provides it in pg_catalog under every search_path.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Reserved-shortcode guard
--
-- Design §C table 10 requires schools.shortcode to be rejected when it appears in
-- reserved_shortcodes, "enforced by trigger against reserved_shortcodes (a CHECK
-- cannot subquery)". A CHECK constraint may not read another table, so this is
-- the one rule in the table that cannot be declarative.
--
-- Fires on INSERT and on UPDATE OF shortcode: guarding insert alone would let a
-- school claim a legal shortcode and then rename itself to 'www'.
--
-- search_path is pinned to '' and every reference schema-qualified, matching
-- set_updated_at() from Migration 01.
-- -----------------------------------------------------------------------------

create or replace function public.reject_reserved_shortcode()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- EXISTS is a SQL keyword, not a function, so it needs no schema qualification;
  -- the table it reads is qualified instead, which is what search_path = '' requires.
  if exists (
    select 1
    from public.reserved_shortcodes r
    where r.shortcode = new.shortcode
  ) then
    raise exception 'shortcode "%" is reserved and may not be used by a school', new.shortcode
      using errcode = '23514';
  end if;
  return new;
end;
$$;

comment on function public.reject_reserved_shortcode() is
  'Rejects a schools.shortcode that appears in reserved_shortcodes. A trigger rather than a CHECK because a CHECK constraint cannot subquery another table.';


-- -----------------------------------------------------------------------------
-- 2. schools — TENANT ROOT
--
-- Design §C table 10, as amended by §12 and §14.
--
-- No school_id column: reaching the tenant from here means id itself. No outbound
-- foreign keys of any kind — this is the root of the dependency graph as well as
-- the tenancy graph.
--
-- shortcode drives {shortcode}.class.so. Per amendment §8 that URL is routing and
-- branding only and is NEVER the authorisation boundary; tenant identity comes
-- from the authenticated user's school relationship and RLS.
-- -----------------------------------------------------------------------------

create table public.schools (
  id                      uuid                  not null default gen_random_uuid(),
  shortcode               text                  not null,
  name                    text                  not null,
  status                  public.school_status  not null default 'active',
  address                 text,
  phone                   text,
  email                   extensions.citext,
  website                 text,
  logo_path               text,
  primary_color           text                  not null default '#FF5A1F',
  timezone                text                  not null default 'Africa/Mogadishu',
  country                 char(2)               not null default 'SO',
  currency                char(3)               not null default 'USD',
  locale                  text                  not null default 'en',
  weekend_days            smallint[]            not null default '{5,6}'::smallint[],
  grading_scale           text                  not null default 'percentage',
  attendance_cutoff_time  time                  not null default '08:00',
  email_notifications     boolean               not null default true,
  sms_notifications       boolean               not null default true,
  parent_portal_enabled   boolean               not null default true,
  suspended_at            timestamptz,
  suspension_reason       text,
  created_at              timestamptz           not null default now(),
  updated_at              timestamptz           not null default now(),

  constraint schools_pkey
    primary key (id),
  constraint schools_shortcode_key
    unique (shortcode),

  -- DNS-safe, 3-63 characters, lowercase alphanumeric and hyphen, no leading or
  -- trailing hyphen. Identical to reserved_shortcodes_shortcode_check, so the two
  -- vocabularies are directly comparable.
  constraint schools_shortcode_check
    check (shortcode ~ '^[a-z0-9]([a-z0-9-]{1,61})[a-z0-9]$'),
  constraint schools_grading_scale_check
    check (grading_scale in ('letter', 'percentage', 'gpa')),
  constraint schools_weekend_days_check
    check (array_length(weekend_days, 1) between 1 and 3)
);

comment on table public.schools is
  'TENANT ROOT. A row here establishes a tenant; it is not owned by one. No school_id column and no outbound foreign keys.';

comment on column public.schools.weekend_days is
  'ISO day numbers of the school weekend. Defaults to {5,6} — Friday-Saturday, the Somali weekend.';

comment on column public.schools.status is
  'TENANT lifecycle only. Never read as "paying" — the commercial lifecycle lives in school_subscriptions.status, independently.';

-- Design §C table 10: "Index (shortcode) (unique already), (status)".
create index schools_status_idx
  on public.schools (status);

create trigger schools_reject_reserved_shortcode
  before insert or update of shortcode on public.schools
  for each row execute function public.reject_reserved_shortcode();

create trigger schools_set_updated_at
  before update on public.schools
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. school_subscriptions — SCHOOL-OWNED
--
-- Design §C table 11, as amended by §9.
--
-- status HAS NO DEFAULT, deliberately. Amendment §9: a school exists after
-- approval WITHOUT implying it has paid. A default of 'trialing' would assert a
-- commercial fact as a side effect of tenant creation, and a column whose value
-- asserts a commercial fact must never be filled in by omission.
--
-- No school_subscriptions row is created at approval. The ABSENCE of a row is the
-- correct, unambiguous representation of "approved tenant, no commercial
-- relationship yet". Phase 11 billing must treat no-row as a first-class state,
-- never as an error.
--
-- FKs per the §13 audit: school_id is single-column CASCADE (rows 19-41 — the
-- TENANT ROOT is the tenant key, there is nothing to compose it with); plan_id is
-- single-column RESTRICT (row 6 — deleting a plan schools are billed against must
-- be blocked; plans are retired via is_public = false, never deleted).
-- -----------------------------------------------------------------------------

create table public.school_subscriptions (
  id                    uuid         not null default gen_random_uuid(),
  school_id             uuid         not null,
  plan_id               uuid         not null,
  status                text         not null,
  current_period_start  timestamptz  not null,
  current_period_end    timestamptz,
  trial_ends_at         timestamptz,
  cancelled_at          timestamptz,
  external_ref          text,
  created_at            timestamptz  not null default now(),
  updated_at            timestamptz  not null default now(),

  constraint school_subscriptions_pkey
    primary key (id),
  constraint school_subscriptions_status_check
    check (status in ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  constraint school_subscriptions_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,
  constraint school_subscriptions_plan_id_fkey
    foreign key (plan_id) references public.subscription_plans (id) on delete restrict
);

comment on table public.school_subscriptions is
  'COMMERCIAL lifecycle. A school HAS a subscription; a person HAS a membership. Absence of a row means no commercial relationship yet, not an error.';

comment on column public.school_subscriptions.external_ref is
  'Payment-provider identifier, populated in Phase 11.';

-- Design §C table 11: "Unique (school_id) WHERE cancelled_at IS NULL" — one live
-- subscription per school, while cancelled history is retained in full.
create unique index school_subscriptions_school_id_live_idx
  on public.school_subscriptions (school_id)
  where cancelled_at is null;

create trigger school_subscriptions_set_updated_at
  before update on public.school_subscriptions
  for each row execute function public.set_updated_at();


-- =============================================================================
-- FOLLOW-UP — observations recorded, no constraint added
--
--   1. schools_weekend_days_check admits an EMPTY array. array_length('{}', 1)
--      returns NULL, and a CHECK passes on NULL, so weekend_days = '{}' (a school
--      with no weekend at all) satisfies "between 1 and 3". The design specified
--      this constraint exactly as written and it is implemented exactly as
--      written; tightening it would be an unapproved addition.
--
--   2. The same constraint does not restrict element VALUES or reject NULL
--      elements, so '{9}' and '{5,NULL}' are both accepted. Same reasoning.
--
--   3. payment_events (provider event id, event type, received_at, verification
--      status, processed_at, idempotency guard) is DEFERRED from Phase 3 and
--      REQUIRED before production payment integration in Phase 11. Nothing here
--      prevents adding it: external_ref carries the provider reference until then.
-- =============================================================================
