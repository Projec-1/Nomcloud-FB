-- =============================================================================
-- accept_pending_invitation
-- Nom Cloud
--
-- The invitation a person is redeeming, claimed WITHOUT a token in the link.
--
-- WHY THIS EXISTS. Activation now happens through Supabase Auth's own invite
-- email (the path proved in the administrator work): the link opens a session
-- for exactly the invited address and carries its material in the URL fragment,
-- never a query string. That link proves the mailbox; it says nothing about the
-- school, the role, or which teacher or guardian record the person is.
--
-- Those facts live in public.invitations, keyed by (school, email, role) with a
-- partial unique index over the live ones. So the invitation does not need to be
-- carried in the link at all: once Supabase has proved the mailbox, the pending
-- invitation for THAT MAILBOX can be looked up here and accepted.
--
-- WHAT IT DOES NOT CHANGE. accept_invitation(text, uuid) keeps its signature,
-- its behaviour and its seven outcomes, and remains the token path. This
-- function only finds the right token hash for the caller and hands it over, so
-- there is exactly one implementation of "what accepting an invitation means":
-- the email match, the school binding, the role, the campus scopes and the
-- single-use marking all still happen there.
--
-- SECURITY. SECURITY DEFINER with an empty search_path. The caller is taken from
-- auth.uid() and never from an argument, so nobody can accept somebody else's
-- invitation. The token hash is read inside the function and never returned.
-- Anonymous callers hold no EXECUTE.
-- =============================================================================

create or replace function public.accept_pending_invitation()
returns public.invitation_acceptance_outcome
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_token_hash text;
  v_outcome public.invitation_acceptance_outcome;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  select lower(u.email::text) into v_email from auth.users u where u.id = v_user_id;
  if v_email is null then
    return 'not_found'::public.invitation_acceptance_outcome;
  end if;

  -- The live invitation for this mailbox: not accepted, not revoked, not
  -- expired. The partial unique index allows one per (school, email, role); the
  -- oldest is taken first so a resend cannot jump a queue.
  select i.token_hash
    into v_token_hash
    from public.invitations i
   where lower(i.email::text) = v_email
     and i.accepted_at is null
     and i.revoked_at is null
     and i.expires_at > pg_catalog.now()
   order by i.created_at
   limit 1;

  if v_token_hash is null then
    return 'not_found'::public.invitation_acceptance_outcome;
  end if;

  select a.outcome into v_outcome from public.accept_invitation(v_token_hash, v_user_id) a;
  return v_outcome;
end;
$$;

comment on function public.accept_pending_invitation() is
  'Accepts the live invitation belonging to the signed-in account''s own email address, for activation links that carry no token (Supabase Auth invite emails). Delegates every rule to accept_invitation: email match, school and role binding, campus scopes, single use. The caller comes from auth.uid() only.';

revoke all on function public.accept_pending_invitation() from public, anon, authenticated;
grant execute on function public.accept_pending_invitation() to authenticated;
