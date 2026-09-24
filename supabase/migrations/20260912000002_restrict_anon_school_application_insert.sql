-- =============================================================================
-- CORRECTIVE — restrict_anon_school_application_insert
-- Nom Cloud
--
-- Corrects 20260912000001_platform_and_identity_rls (Phase 7 RLS batch 1).
-- No design number: per docs/SCHEMA_DESIGN.md standing rule 3, corrective
-- migrations carry no design number and name the migration they correct.
--
-- ---------------------------------------------------------------------------
-- What was wrong
-- ---------------------------------------------------------------------------
-- Batch 1 created school_applications_anon_insert with WITH CHECK (true).
-- The public sign-up form is the only intended writer, and it sends only the
-- genuine application fields. WITH CHECK (true) does not require that. An
-- anonymous caller posting directly to PostgREST could set any column on the
-- row it inserts, including the reviewer/decision columns:
--
--   status              could arrive as 'approved' rather than 'pending'
--   reviewed_by         could name a real platform admin who never reviewed it
--   reviewed_at         could carry a fabricated review timestamp
--   approved_school_id  could point at a real, existing school
--
-- Verified against the live database before this migration: all three of those
-- inserts returned OK rows=1 as anon.
--
-- This granted no read access -- anon still cannot SELECT the table, and
-- approval remains the SECURITY DEFINER approve_school_application function,
-- which re-reads the row and requires an unrevoked platform_admins caller. The
-- damage is to the integrity of the platform review queue: a forged submission
-- can present itself as already vetted, and pollutes the status-based metrics
-- that docs/SCHEMA_DESIGN.md section A.4 says those columns exist to produce.
--
-- It is also looser than the discipline applied everywhere else in this schema:
-- a caller must never be able to write a field that records a decision made
-- about it by someone with more authority.
--
-- ---------------------------------------------------------------------------
-- What this changes
-- ---------------------------------------------------------------------------
-- ALTER POLICY, not DROP + CREATE. ALTER POLICY ... WITH CHECK replaces only
-- the WITH CHECK expression and leaves the policy's name, command (INSERT),
-- role list (anon), and permissive flag exactly as batch 1 created them. An
-- INSERT policy has no USING clause, so WITH CHECK is the only alterable part
-- and nothing else about the policy can drift.
--
-- The four decision columns are pinned to their unset state. Every ordinary
-- application field -- school_name, administrator_name, email, phone,
-- school_size_band, message, country, applicant_position, school_address,
-- campus_count, student_count_band, class_count_band, staff_count_band,
-- curriculum, current_system, reasons -- is deliberately untouched and remains
-- fully settable by the public form.
--
-- status is pinned by equality rather than by relying on its column DEFAULT.
-- A DEFAULT only applies when the caller omits the column; it does nothing
-- about a caller that sends one. The whole point of this migration is to
-- constrain the caller that sends one.
--
-- Nothing else in the schema is touched: no table, column, constraint, trigger,
-- function, grant, or other policy. RLS is not enabled or disabled anywhere,
-- and no table outside school_applications is named.
-- =============================================================================

alter policy school_applications_anon_insert
  on public.school_applications
  with check (
    status = 'pending'::public.application_status
    and reviewed_by is null
    and reviewed_at is null
    and approved_school_id is null
  );

comment on policy school_applications_anon_insert on public.school_applications is
  'Public sign-up form insert. The four reviewer/decision columns are pinned to their unset state so an anonymous submission can only ever be created as a genuinely pending, unreviewed application, whatever the caller sends. All ordinary application fields remain settable. Corrective to 20260912000001.';

-- =============================================================================
-- End of corrective. One policy WITH CHECK clause changed; nothing else.
-- =============================================================================
