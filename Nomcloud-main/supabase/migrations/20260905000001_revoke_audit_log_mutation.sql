-- =============================================================================
-- CORRECTIVE — revoke_audit_log_mutation
-- Corrects: Migration 11 (communication_and_audit) — audit_logs immutability
-- Nom Cloud · Phase 3 (production schema)
--
-- The approved §H design requires UPDATE and DELETE to be revoked from every
-- application role, including service_role. The table remains insertable so
-- audit events can be recorded, but application roles cannot mutate history.
--
-- Migration 11 is an applied historical record and is left untouched.
-- Creates NO row-level security policies.
-- =============================================================================

revoke update, delete on table public.audit_logs from anon, authenticated, service_role;
