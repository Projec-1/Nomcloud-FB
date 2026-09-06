-- =============================================================================
-- Migration 12 corrective — revoke anonymous accept_invitation execution
-- Nom Cloud · Phase 4 authentication
--
-- The project-level default privileges explicitly grant EXECUTE to anon on new
-- functions. Remove that grant explicitly; only authenticated recipients may
-- redeem invitations.
-- =============================================================================

revoke execute on function public.accept_invitation(text, uuid) from anon;
revoke execute on function public.accept_invitation(text, uuid) from public;
grant execute on function public.accept_invitation(text, uuid) to authenticated;

