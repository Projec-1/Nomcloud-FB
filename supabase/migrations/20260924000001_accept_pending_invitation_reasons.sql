-- ---------------------------------------------------------------------------
-- Why an invitation could not be claimed, not just "no".
--
-- THE PROBLEM. accept_pending_invitation() looked ONLY for a live invitation:
--
--     where lower(i.email) = v_email
--       and i.accepted_at is null
--       and i.revoked_at is null
--       and i.expires_at > now()
--
-- Anything outside that filter came back as 'not_found'. A cancelled
-- invitation, an expired one, an already-used one and a mailbox that was never
-- invited at all were therefore INDISTINGUISHABLE to the activation screen,
-- which had no choice but to show one vague message — "Wrong account: this link
-- opened an account that is not connected to a school" — for all four. That
-- reads as "you used the wrong email" and blames the person for something the
-- school or the clock caused.
--
-- accept_invitation(token_hash, uid) already classifies every one of these
-- correctly and returns 'revoked', 'expired', 'already_accepted' or
-- 'email_mismatch'. The information existed; this function was discarding it.
--
-- THE CHANGE. A live invitation is still found and claimed exactly as before —
-- that path is untouched. Only when there is NO live invitation does this now
-- look again, without the filter, and hand the most recent invitation for the
-- same mailbox to accept_invitation so it can say WHY it cannot be used.
--
-- accept_invitation returns early, writing nothing, for an invitation that is
-- accepted, revoked or expired, so this reports the reason without any risk of
-- claiming something it should not.
--
-- STILL NOT ENUMERABLE. Both lookups match on the CALLER'S OWN email, taken
-- from auth.users by auth.uid(). Nobody learns anything about an invitation
-- addressed to somebody else.
-- ---------------------------------------------------------------------------

create or replace function public.accept_pending_invitation()
returns public.invitation_acceptance_outcome
language plpgsql
security definer
set search_path to ''
as $function$
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

  if v_token_hash is not null then
    select a.outcome into v_outcome from public.accept_invitation(v_token_hash, v_user_id) a;
    return v_outcome;
  end if;

  -- Nothing live. The most recent invitation for this mailbox, whatever state
  -- it is in, so the reason can be reported instead of a bare 'not_found'.
  select i.token_hash
    into v_token_hash
    from public.invitations i
   where lower(i.email::text) = v_email
   order by i.created_at desc
   limit 1;

  if v_token_hash is null then
    return 'not_found'::public.invitation_acceptance_outcome;
  end if;

  select a.outcome into v_outcome from public.accept_invitation(v_token_hash, v_user_id) a;
  return v_outcome;
end;
$function$;

revoke execute on function public.accept_pending_invitation() from public, anon;
grant execute on function public.accept_pending_invitation() to authenticated;
