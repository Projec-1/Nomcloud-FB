-- =============================================================================
-- Phase 7 / Migration 9 — platform_and_identity_rls
-- Nom Cloud
--
-- Enables RLS only on the first seven tables in the full Phase 7 rollout:
--   subscription_plans, reserved_shortcodes, school_applications,
--   contact_messages, platform_admins, audit_logs, profiles.
--
-- The remaining 24 non-RLS tables are deliberately untouched. In particular,
-- this migration does not alter the six campus/role tables protected by
-- 20260911000007, nor does it alter any Phase 3/4 function except the one
-- reserved-shortcode trigger function whose SECURITY INVOKER context would
-- otherwise be made incorrect by RLS on its lookup table.
--
-- Existing helper predicates from campus_rls_and_grants are reused:
--   public.is_platform_admin()
--   public.current_school_id()
--   public.has_school_admin_role(uuid)
-- They are SECURITY DEFINER with search_path pinned to '', so membership and
-- platform-admin checks do not recurse through their protected tables.
--
-- No FORCE ROW LEVEL SECURITY is used. accept_invitation and
-- approve_school_application remain SECURITY DEFINER owner-bypass transactions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Reserved shortcode guard — RLS-safe lookup context
--
-- schools_reject_reserved_shortcode fires during an otherwise allowed school
-- update. Once reserved_shortcodes has RLS, its former SECURITY INVOKER body
-- would see only rows visible to the caller and could falsely accept a reserved
-- shortcode. The function is made narrowly SECURITY DEFINER; its pinned empty
-- search_path and schema-qualified lookup are retained. This is the sole
-- existing-function change in this migration, and is required by the new RLS
-- boundary rather than a redesign of the guard.
-- -----------------------------------------------------------------------------

create or replace function public.reject_reserved_shortcode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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
  'Rejects a schools.shortcode that appears in reserved_shortcodes. SECURITY DEFINER is required so the schools trigger always sees the complete reserved list after RLS protects the lookup table; search_path is pinned to the empty string.';

-- -----------------------------------------------------------------------------
-- 1. subscription_plans — PLATFORM
--
-- Pricing remains frontend-hardcoded today, so there is no anonymous/public
-- SELECT policy. Only a platform administrator may manage or inspect plans.
-- -----------------------------------------------------------------------------

alter table public.subscription_plans enable row level security;

create policy subscription_plans_platform_admin_all on public.subscription_plans
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 2. reserved_shortcodes — PLATFORM
--
-- The table itself is platform-only. The schools trigger above is the sole
-- non-platform read path and bypasses RLS safely as its owner.
-- -----------------------------------------------------------------------------

alter table public.reserved_shortcodes enable row level security;

create policy reserved_shortcodes_platform_admin_all on public.reserved_shortcodes
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 3. school_applications — PLATFORM / pre-tenant
--
-- Public application submission remains anonymous INSERT-only, preserving the
-- corrective 20260911000001 behavior. No anonymous read/update/delete policy
-- exists. Approval is the existing SECURITY DEFINER function.
-- -----------------------------------------------------------------------------

alter table public.school_applications enable row level security;

create policy school_applications_platform_admin_all on public.school_applications
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy school_applications_anon_insert on public.school_applications
  for insert to anon
  with check (true);

-- -----------------------------------------------------------------------------
-- 4. contact_messages — PLATFORM
--
-- Public contact submission is anonymous INSERT-only. Handling is restricted to
-- platform administrators; no school member sees marketing enquiries.
-- -----------------------------------------------------------------------------

alter table public.contact_messages enable row level security;

create policy contact_messages_platform_admin_all on public.contact_messages
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy contact_messages_anon_insert on public.contact_messages
  for insert to anon
  with check (true);

-- -----------------------------------------------------------------------------
-- 5. platform_admins — PLATFORM
--
-- Platform administrators retain full platform access. The policy uses the
-- existing non-recursive SECURITY DEFINER predicate; no school role receives a
-- policy on this authority table.
-- -----------------------------------------------------------------------------

alter table public.platform_admins enable row level security;

create policy platform_admins_platform_admin_all on public.platform_admins
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 6. audit_logs — PLATFORM, school-scoped when school_id is non-NULL
--
-- PA receives the existing all-command policy shape. ODA receives SELECT only
-- for its own school's non-NULL entries; Principal, Teacher, and Guardian have
-- no audit policy. UPDATE, DELETE, and TRUNCATE stay denied by the existing
-- table-grant revokes from 20260905000001/2 — no revoke is repeated, removed,
-- or weakened here.
--
-- service_role retains its existing INSERT grant and has BYPASSRLS, so the
-- trusted server-side audit writer path remains usable without an application
-- client INSERT policy. No policy names anon for audit_logs.
-- -----------------------------------------------------------------------------

alter table public.audit_logs enable row level security;

create policy audit_logs_platform_admin_all on public.audit_logs
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy audit_logs_school_admin_select on public.audit_logs
  for select to authenticated
  using (
    school_id is not null
    and public.has_school_admin_role(school_id)
  );

-- -----------------------------------------------------------------------------
-- 7. profiles — IDENTITY
--
-- Every authenticated user reads and updates its own profile. ODA may read all
-- profiles in its school, while P/T/Guardian receive no generic school directory
-- policy in this batch. The permissive self and staff SELECT policies compose
-- safely: self-read works for every role; ODA additionally reads other rows.
--
-- UPDATE is constrained at both levels: RLS retains the current school assignment
-- and grants expose only approved self-service profile fields. The existing
-- SECURITY DEFINER invitation/approval functions continue to create/update all
-- required fields as their owner, without FORCE RLS.
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy profiles_platform_admin_all on public.profiles
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy profiles_self_select on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_school_admin_select on public.profiles
  for select to authenticated
  using (
    school_id is not null
    and public.has_school_admin_role(school_id)
  );

create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and school_id is not distinct from public.current_school_id()
  );

-- The prior broad UPDATE grant would let an own-row policy alter identity or
-- tenancy columns. Restrict browser/API updates to the approved self-service
-- fields. service_role grants are deliberately untouched for trusted server work.
revoke update on table public.profiles from anon, authenticated;
grant update (full_name, phone, locale, avatar_url)
  on table public.profiles to authenticated;

-- =============================================================================
-- End of Batch 1. No other public table is enabled for RLS or receives a policy.
-- =============================================================================
