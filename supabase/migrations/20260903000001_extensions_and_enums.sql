-- =============================================================================
-- Migration 01 — extensions_and_enums
-- Nom Cloud · Phase 3 (production schema)
--
-- Creates the shared primitives every later migration depends on:
--   1. PostgreSQL extensions
--   2. Enum types
--   3. The shared set_updated_at() trigger function
--
-- Creates NO tables, NO row-level security policies, and NO triggers on tables.
-- Later migrations attach set_updated_at() to each table as they create it.
--
-- Assumes the "extensions" schema exists. Supabase provides it on both hosted
-- projects and the local development stack.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Extensions
--
-- Installed into the "extensions" schema, per Supabase convention, so that the
-- public schema holds application objects only.
-- -----------------------------------------------------------------------------

-- gen_random_uuid() for primary keys across every table, and digest() for
-- hashing invitation tokens (design: invitations.token_hash).
create extension if not exists pgcrypto with schema extensions;

-- citext: case-insensitive text. Used for every email column so that
-- "Fadumo@example.com" and "fadumo@example.com" are the same address.
create extension if not exists citext with schema extensions;


-- -----------------------------------------------------------------------------
-- 2. Enum types
--
-- Only vocabularies that are stable and shared across the design are enums.
-- Table-local lifecycles (students.status, teachers.status, academic_years.status,
-- school_subscriptions.status, ...) are text + CHECK in their own migrations, so
-- they can evolve without an ALTER TYPE against a live database.
-- -----------------------------------------------------------------------------

-- Roles a person may hold within a school.
-- Design: approved decisions ("Roles: admin, teacher, parent only") and §B, table 8.
-- A person may hold more than one of these at the SAME school — one membership
-- row per role — but never across schools (V1 single-school user tenancy, §2).
create type public.user_role as enum ('admin', 'teacher', 'parent');

-- Tenant lifecycle — schools.status. Design §A.4.
-- Deliberately DISJOINT from application_status: a schools row exists only after
-- approval, so 'pending' and 'rejected' are unrepresentable states for a tenant.
create type public.school_status as enum ('active', 'suspended', 'closed');

-- Application lifecycle — school_applications.status. Design §A.4.
-- Deliberately DISJOINT from school_status: 'suspended' is meaningless for a
-- request that has not yet become a tenant.
create type public.application_status as enum ('pending', 'approved', 'rejected', 'withdrawn');

-- Attendance marking — attendance_records.status. Design §C, table 23.
create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');


-- -----------------------------------------------------------------------------
-- 3. Shared updated_at trigger function
--
-- Every table in the design carries "updated_at timestamptz NOT NULL DEFAULT now()".
-- Keeping it current is the database's job, never the application's.
--
-- search_path is pinned to '' so the function cannot be redirected by a
-- caller-controlled search_path; now() is therefore schema-qualified.
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Sets NEW.updated_at to the current UTC time. Attached BEFORE UPDATE to every table carrying updated_at.';
