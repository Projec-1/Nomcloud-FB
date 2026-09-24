-- =============================================================================
-- Campus/role expansion Migration 7 of 8 — accept_invitation_role_scope
-- Nom Cloud
--
-- Teaches public.accept_invitation to carry campus scope across acceptance.
--
-- Before this migration the function copied role, teacher_id and guardian_id
-- from the invitation but knew nothing about scope, because scope_mode and the
-- scope tables did not exist when it was written. A membership created by
-- acceptance therefore took the scope_mode column default of 'all', so a
-- 'selected' invitation for a principal or teacher silently produced an
-- organisation-wide membership. That is a widening of what the invitation
-- granted, and closing it is the point of this migration.
--
-- Role needed no change. The function never enumerated role values; it reads
-- v_invitation.role and inserts it, so Migration 2's retyping of both
-- invitations.role and memberships.role to the six-value enum already made all
-- six transfer correctly. The probes in the accompanying report exercise each
-- of the six explicitly rather than assuming it.
--
-- Ordering note: the membership row is inserted before its scope rows, which
-- momentarily leaves a 'selected' membership naming no campus. That is exactly
-- the state Migration 5's constraint trigger is DEFERRABLE INITIALLY DEFERRED
-- for: the assertion runs once at commit, by which time the scope rows exist.
-- If an invitation were ever 'selected' with no intent rows, the membership
-- would name no campus and that same trigger would reject the acceptance,
-- which is the safe outcome.
--
-- Depends on Phase 4 Migration 20260906000001 (accept_invitation),
-- Migration 3 (memberships.scope_mode, membership_campus_scopes),
-- Migration 5 (the deferred assertion) and Migration 6
-- (invitations.scope_mode, invitation_campus_scopes).
--
-- Alters only the function body. No table, column, constraint, trigger or
-- grant is changed. SECURITY DEFINER and the pinned empty search_path are
-- preserved, as is every validity check, in the same order, with the same
-- outcomes. Role and scope are read from the invitation row only; no caller
-- parameter influences either.
--
-- Creates NO row-level security policies (Phase 7).
-- =============================================================================

create or replace function public.accept_invitation(
  p_token_hash text,
  p_authenticated_user_id uuid
)
returns table(outcome public.invitation_acceptance_outcome)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
  v_auth_email text;
  v_profile_school_id uuid;
  v_full_name text;
  v_membership_id uuid;
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
      invited_by,
      scope_mode
    )
    values (
      p_authenticated_user_id,
      v_invitation.school_id,
      v_invitation.role,
      v_invitation.teacher_id,
      v_invitation.guardian_id,
      v_invitation.invited_by,
      v_invitation.scope_mode
    )
    returning id into v_membership_id;
  exception
    when unique_violation then
      return query select 'role_already_held'::public.invitation_acceptance_outcome;
      return;
  end;

  -- Copy the invitation's intended campuses onto the real membership, in this
  -- same transaction. The set is taken from invitation_campus_scopes, never
  -- from anything the caller supplied.
  if v_invitation.scope_mode = 'selected' then
    insert into public.membership_campus_scopes (
      school_id,
      membership_id,
      campus_id
    )
    select
      v_invitation.school_id,
      v_membership_id,
      s.campus_id
      from public.invitation_campus_scopes s
     where s.school_id = v_invitation.school_id
       and s.invitation_id = v_invitation.id;
  end if;

  update public.invitations
     set accepted_at = pg_catalog.now(),
         accepted_by = p_authenticated_user_id,
         updated_at = pg_catalog.now()
   where id = v_invitation.id;

  return query select 'accepted'::public.invitation_acceptance_outcome;
end;
$$;

comment on function public.accept_invitation(text, uuid) is
  'Transactionally accepts an invitation: upserts the profile, creates the membership with the role, person link and scope_mode named by the invitation, and copies invitation_campus_scopes onto membership_campus_scopes when the scope is selected. Every value comes from the invitation row; no caller parameter can choose a role or a campus. Campus/role expansion Migration 7 of 8.';
