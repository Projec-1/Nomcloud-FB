-- =============================================================================
-- Campus/role expansion Migration 1 of 8 — campuses
-- Nom Cloud
--
-- This is the first migration outside the original Phase 3 design migrations
-- 01-11. It belongs to the campus/role expansion approved in
-- docs/CAMPUS_ROLE_DESIGN.md.
--
-- Creates ONLY public.campuses. Membership role expansion, campus scope,
-- class campus ownership, and authorization are later migrations.
--
-- Depends on Phase 3 Migration 03 (public.schools) and Migration 01
-- (public.set_updated_at). Creates NO row-level security policies (Phase 7).
-- =============================================================================

create table public.campuses (
  id          uuid               not null default gen_random_uuid(),
  school_id   uuid               not null,
  name        text               not null,
  code        text,
  address     text,
  phone       text,
  email       extensions.citext,
  status      text               not null default 'active',
  created_at  timestamptz        not null default now(),
  updated_at  timestamptz        not null default now(),

  constraint campuses_pkey
    primary key (id),
  constraint campuses_school_id_id_key
    unique (school_id, id),
  constraint campuses_school_id_name_key
    unique (school_id, name),
  constraint campuses_status_check
    check (status in ('active', 'inactive')),
  constraint campuses_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade
);

comment on table public.campuses is
  'School-owned physical campus. Campus/role expansion Migration 1 of 8.';

comment on column public.campuses.status is
  'Campus lifecycle: active or inactive.';

create unique index campuses_school_id_code_idx
  on public.campuses (school_id, code)
  where code is not null;

create trigger campuses_set_updated_at
  before update on public.campuses
  for each row execute function public.set_updated_at();
