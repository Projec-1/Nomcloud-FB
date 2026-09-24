-- =============================================================================
-- Restore anonymous public submission of school applications
-- Nom Cloud
--
-- On 2026-09-11 at 16:35:20Z, row-level security was enabled on
-- public.school_applications directly from the Supabase dashboard, outside the
-- migration chain and without any accompanying policy. RLS with zero policies
-- denies every row to anon and authenticated regardless of table grants, so:
--
--   * the public three-step sign-up form began failing. PostgREST reported
--     42501 "new row violates row-level security policy", which it returns as
--     HTTP 401 for the anon role;
--   * the platform-admin pending-applications list silently returned zero rows.
--
-- No migration caused this. Migrations 20260908000002, 20260908000003 and
-- 20260909000001, and the approve-school-application Edge Function, do not
-- touch this table's RLS state or its grants.
--
-- This migration restores the documented pre-Phase-7 posture, in which no table
-- in this schema has RLS enabled. Phase 7 enables RLS across all tables at once
-- together with the policies that go with it. Enabling it on a single table
-- ahead of that is not a partial safeguard, it is an outage.
--
-- Creates NO row-level security policies (Phase 7).
-- =============================================================================

alter table public.school_applications disable row level security;

comment on table public.school_applications is
  'Public sign-up applications. Anonymous INSERT is intentional and is what the public sign-up form uses. RLS stays disabled here until Phase 7 enables it schema-wide together with its policies; do not enable it on this table alone.';
