-- =============================================================================
-- Migration 05 — school_applications
-- Nom Cloud · Phase 3 (production schema)
--
-- Design number 05. See docs/MIGRATIONS.md for the numbering convention.
--
--   public.school_applications — PLATFORM-LEVEL
--
-- Depends on Migration 01 (public.application_status), Migration 03
-- (public.schools) and Migration 04 (public.profiles).
--
-- Creates NO row-level security policies (Phase 7).
--
-- PLATFORM-LEVEL: no school_id column, pre-tenant BY DEFINITION. An application
-- has no school because the school does not exist until the application is
-- approved. This is why the migration plan places 05 AFTER 03 and 04 — so both
-- foreign keys land in one step rather than being deferred.
--
-- =============================================================================
-- THREE LIFECYCLES, NEVER CONFLATED (§9)
-- =============================================================================
--   school_applications.status   APPLICATION lifecycle — pending / approved /
--                                rejected / withdrawn. The lifecycle of a REQUEST.
--   schools.status               TENANT lifecycle — active / suspended / closed.
--   school_subscriptions.status  COMMERCIAL lifecycle — trialing / active /
--                                past_due / cancelled / expired.
--
-- Approval CREATES A TENANT. It does NOT create a subscription row. The absence
-- of a school_subscriptions row is the correct post-approval state: an approved
-- school exists without implying it has paid. Nothing here may be read as
-- commercial standing.
--
-- The application and tenant vocabularies are deliberately DISJOINT (§A.4): a
-- schools row only comes into existence at approval, so 'pending' and 'rejected'
-- are unrepresentable for a tenant, and 'suspended' is meaningless for a request.
--
-- Conventions from §A.1 apply without being repeated. citext is qualified as
-- extensions.citext; gen_random_uuid() is not qualified.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- school_applications — PLATFORM
--
-- Design §C table 3. Receives the BookDemo form.
--
-- Deliberately separate from contact_messages: a general enquiry is not an
-- application to run a school, and conflating the two pollutes the approval
-- queue.
--
-- Retention (§10): category AR + DEL. Holds applicant PII for people who may
-- never become customers; rejected and withdrawn applications are strong
-- deletion candidates, with status + reviewed_at providing the age anchor.
-- -----------------------------------------------------------------------------

create table public.school_applications (
  id                  uuid                      not null default gen_random_uuid(),
  school_name         text                      not null,
  administrator_name  text                      not null,
  email               extensions.citext         not null,
  phone               text                      not null,
  school_size_band    text                      not null,
  message             text,
  country             char(2),
  status              public.application_status not null default 'pending',
  reviewed_by         uuid,
  reviewed_at         timestamptz,
  rejection_reason    text,
  approved_school_id  uuid,
  source_ip           inet,
  created_at          timestamptz               not null default now(),
  updated_at          timestamptz               not null default now(),

  constraint school_applications_pkey
    primary key (id),

  -- §13 audit row 1. SET NULL: the decision record must survive a platform admin
  -- leaving. Losing WHO approved is worse than a dangling name.
  constraint school_applications_reviewed_by_fkey
    foreign key (reviewed_by) references public.profiles (id) on delete set null,

  -- §13 audit row 2. SET NULL: if a school is ever purged, the application
  -- history stays as a business record. §10 requires approved_school_id to
  -- survive as NULL rather than take the application row with it.
  constraint school_applications_approved_school_id_fkey
    foreign key (approved_school_id) references public.schools (id) on delete set null,

  -- Together these two make "approved but no school created" UNREPRESENTABLE —
  -- the failure mode most likely to occur if approval is ever done in two steps
  -- instead of one transaction. status is NOT NULL, so neither implication can
  -- evaluate to NULL and pass by accident.
  constraint school_applications_approved_requires_school_check
    check (status <> 'approved' or approved_school_id is not null),
  constraint school_applications_rejected_requires_reason_check
    check (status <> 'rejected' or rejection_reason is not null)
);

comment on table public.school_applications is
  'Requests to join the platform. PLATFORM-LEVEL: no school_id, because the school does not exist until approval.';

comment on column public.school_applications.status is
  'APPLICATION lifecycle only. Approval creates a tenant; it never implies a subscription. Never read as commercial standing.';

comment on column public.school_applications.approved_school_id is
  'The tenant created by approving this application. Retained as NULL if that school is later purged, so the application history survives.';

-- Design §C table 3: the review queue — oldest-first is wrong here, the queue is
-- worked newest-first within each status.
create index school_applications_status_created_at_idx
  on public.school_applications (status, created_at desc);

-- Duplicate-application detection.
create index school_applications_email_idx
  on public.school_applications (email);

create trigger school_applications_set_updated_at
  before update on public.school_applications
  for each row execute function public.set_updated_at();
