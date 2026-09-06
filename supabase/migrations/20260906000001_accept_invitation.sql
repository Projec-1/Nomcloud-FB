-- =============================================================================
-- Migration 12 — accept_invitation
-- Nom Cloud · Phase 4 authentication
--
-- Creates the only database-side path for redeeming an invitation. SECURITY
-- DEFINER is required because a newly authenticated invite recipient cannot yet
-- write their own profile or membership. Abuse is limited by requiring
-- auth.uid() to equal the supplied user id, reading every tenancy/role/identity
-- value from the locked invitation, validating the invitation state and email,
-- pinning search_path to the empty string, and granting EXECUTE only to
-- authenticated callers.
--
-- The invitation row is locked before any state check. That lock serialises two
-- simultaneous redemptions of the same bearer token; the first transaction marks
-- it accepted and the second observes accepted_at and returns already_accepted.
-- A separate invitation for the same user and role is protected by the
-- memberships unique constraint and is converted to role_already_held.
--
-- Depends on Migration 04 (profiles, memberships, invitations), Migration 07
-- (teacher/guardian composite foreign keys), and Supabase Auth (auth.users).
-- =============================================================================

create type public.invitation_acceptance_outcome as enum (
  'accepted',
  'already_accepted',
  'expired',
  'revoked',
  'not_found',
  'email_mismatch',
  'role_already_held'
);

create or replace function public.accept_invitation(
  p_token_hash text,
  p_authenticated_user_id uuid
)
returns table (outcome public.invitation_acceptance_outcome)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
  v_auth_email text;
  v_profile_school_id uuid;
  v_full_name text;
begin
  if p_token_hash is null
     or length(btrim(p_token_hash)) <> 64
     or p_authenticated_user_id is null
     or auth.uid() is distinct from p_authenticated_user_id then
    raise exception 'invalid invitation acceptance input'
      using errcode = '22023';
  end if;

  select *
    into v_invitation
    from public.invitations
   where token_hash = btrim(p_token_hash)
   for update;

  if not found then
    return query select 'not_found'::public.invitation_acceptance_outcome;
    return;
  end if;

  if v_invitation.accepted_at is not null then
    return query select 'already_accepted'::public.invitation_acceptance_outcome;
    return;
  end if;

  if v_invitation.revoked_at is not null then
    return query select 'revoked'::public.invitation_acceptance_outcome;
    return;
  end if;

  if v_invitation.expires_at <= pg_catalog.now() then
    return query select 'expired'::public.invitation_acceptance_outcome;
    return;
  end if;

  select lower(email)
    into v_auth_email
    from auth.users
   where id = p_authenticated_user_id;

  if v_auth_email is null or v_auth_email <> lower(v_invitation.email::text) then
    return query select 'email_mismatch'::public.invitation_acceptance_outcome;
    return;
  end if;

  select school_id
    into v_profile_school_id
    from public.profiles
   where id = p_authenticated_user_id
   for update;

  if found and v_profile_school_id is not null
     and v_profile_school_id <> v_invitation.school_id then
    raise exception 'authenticated profile belongs to another school'
      using errcode = '23514';
  end if;

  v_full_name := coalesce(
    nullif(pg_catalog.btrim((select raw_user_meta_data ->> 'full_name'
                              from auth.users
                             where id = p_authenticated_user_id)), ''),
    v_auth_email
  );

  insert into public.profiles (id, school_id, full_name, email)
  values (p_authenticated_user_id, v_invitation.school_id, v_full_name, v_auth_email)
  on conflict (id) do update
    set school_id = excluded.school_id,
        email = excluded.email,
        full_name = excluded.full_name,
        updated_at = pg_catalog.now();

  if exists (
    select 1
      from public.memberships
     where user_id = p_authenticated_user_id
       and role = v_invitation.role
  ) then
    return query select 'role_already_held'::public.invitation_acceptance_outcome;
    return;
  end if;

  begin
    insert into public.memberships (
      user_id,
      school_id,
      role,
      teacher_id,
      guardian_id,
      invited_by
    )
    values (
      p_authenticated_user_id,
      v_invitation.school_id,
      v_invitation.role,
      v_invitation.teacher_id,
      v_invitation.guardian_id,
      v_invitation.invited_by
    );
  exception
    when unique_violation then
      return query select 'role_already_held'::public.invitation_acceptance_outcome;
      return;
  end;

  update public.invitations
     set accepted_at = pg_catalog.now(),
         accepted_by = p_authenticated_user_id,
         updated_at = pg_catalog.now()
   where id = v_invitation.id;

  return query select 'accepted'::public.invitation_acceptance_outcome;
end;
$$;

revoke all on function public.accept_invitation(text, uuid) from public;
grant execute on function public.accept_invitation(text, uuid) to authenticated;

