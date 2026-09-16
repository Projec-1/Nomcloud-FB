-- =============================================================================
-- CORRECTIVE — accounts_and_ownership
-- Nom Cloud
--
-- Fixes docs/SYSTEM_ISSUES_LIST.md M13, M14, M15 and M16.
--
-- #############################################################################
-- M15 — A NEWLY APPROVED SCHOOL HAS NO OWNER (decision locked: the approved
--       administrator becomes the school's Owner automatically)
-- #############################################################################
--
-- THE QUESTION: memberships.role holds one value. Should the approved person get
-- ONE row with role = 'owner', or TWO rows, 'administrator' and 'owner'?
--
-- TWO ROWS. That is what the six-role model actually is:
--
--   1. The model is multi-role by construction. The key is UNIQUE (user_id, role),
--      not UNIQUE (user_id, school_id): one person may hold several roles at a
--      school, and the interface already unions them
--      (workspacesForMembershipRoles, "a multi-role user lands on the same default
--      view").
--   2. 'owner' has NO frontend workspace. src/lib/roles.ts maps owner, director
--      and principal to null on purpose (CAMPUS_ROLE_DESIGN section C: "admin"
--      must never silently stand in for all organisational roles). A person whose
--      only membership is 'owner' has zero workspaces and could not use the
--      application at all. Creating the membership as 'owner' INSTEAD of
--      'administrator' would lock the approved person out of their own school.
--   3. In the database, owner already includes everything administrator can do
--      (has_school_admin_role, has_school_management_role and
--      has_school_staff_role all list owner), and adds billing
--      (has_school_billing_role: owner, director) and owner management (S8,
--      has_school_owner_role). The 'owner' row therefore adds exactly the missing
--      authority; the 'administrator' row keeps the workspace.
--
-- ONE OWNER PER SCHOOL (J2, memberships_school_id_owner_idx) is untouched. The
-- school is created in this same transaction, so it has zero owners and the
-- insert is the first. Everything else in the function is unchanged.
--
-- EXISTING SCHOOLS are not backfilled here: which person owns an already-running
-- school is not something a migration can know. S8's owner-only path, or a
-- platform administrator, remains the way to name one.
--
-- #############################################################################
-- M13 — EVERY STAFF MEMBER CAN READ PENDING INVITATIONS (with token hashes)
-- #############################################################################
--
-- invitations_staff_select used has_school_staff_role (owner, director,
-- administrator, principal, teacher). It is replaced by invitations_admin_select
-- on has_school_admin_role (owner, director, administrator): the group the
-- invitation INSERT, UPDATE and DELETE policies already use, so the people who
-- may read an invitation are now exactly the people who may send, revoke or
-- delete one. (In this schema "management" — has_school_management_role — also
-- includes principal; the requested group, owner/director/administrator, is the
-- "admin" helper.) Nothing in the application reads invitations outside the
-- administrator workspace, and accepting one goes through accept_invitation,
-- which is SECURITY DEFINER and does not depend on this policy.
-- invitations_platform_admin_all is unchanged.
--
-- #############################################################################
-- M14 — ONLY 'demo' IS RESERVED
-- #############################################################################
--
-- The reservation mechanism exists and works (reserved_shortcodes plus the
-- schools_reject_reserved_shortcode trigger, which also binds
-- approve_school_application because it inserts into schools). Only the data is
-- missing. Reserved here — nothing beyond what the project uses or documents:
--   www, app, api   the login resolver treats these hosts as non-school
--                   (src/lib/schoolShortcode.ts NON_SCHOOL_LABELS); www and app
--                   are the marketing and application hosts in use
--                   (www.nomcloud.academy, app.nomcloud.academy)
--   admin, mail     the standard set, and listed in SCHEMA_DESIGN §2 and the
--   login           platform_core migration's reservation comment
--   status, class   listed in SCHEMA_DESIGN §2 / platform_core as reserved
--                   subdomains ("class" is also the school domain, class.so)
-- The repository has no vercel.json or DNS configuration naming others.
--
-- #############################################################################
-- M16 — AN ADMINISTRATOR CAN SUSPEND THEIR OWN MEMBERSHIP
-- #############################################################################
--
-- THE RULE: a signed-in person may not change THEIR OWN active owner, director
-- or administrator membership so that it stops being one — suspending it,
-- deleting it, or changing its role outside that group — when no OTHER active
-- owner, director or administrator membership would remain at the school.
-- Refused with PT409 (HTTP 409).
--
-- WHY THIS SHAPE:
--   * The group is owner/director/administrator (has_school_admin_role) because
--     it is exactly the group that can manage memberships, invitations and
--     school settings. Principal cannot, so a school left with only a principal
--     is still locked out of administration.
--   * "Other membership", not "other person": someone holding administrator AND
--     owner (every school approved from now on, M15) may give up one of them,
--     because the school is still administered through the other.
--   * Only one's OWN membership is checked. Someone changing another person's
--     membership is themselves an active member of the group (the policies
--     require it), so they can never leave the school with zero. Platform
--     administrators and the service role (auth.uid() is not the member) are
--     unaffected, as are cascades from deleting a school.
--   * Restoring a suspended membership, or any edit that keeps the row an active
--     administrative membership, is never refused.
--   * Concurrency: the school row is locked (FOR NO KEY UPDATE, which does not
--     block foreign-key checks) before counting, so two sole-pair
--     administrators suspending themselves at the same moment are serialised and
--     the second sees the first's change.
--
-- It is a trigger, not a policy, for the reason S6 and the calendar guards give:
-- it is a conditional cross-row rule, and RLS would silently filter instead of
-- saying why. It adds a refusal; no existing policy, including the S8 owner
-- rules, is widened.
--
-- NOTHING ELSE CHANGES.
-- =============================================================================


-- #############################################################################
-- M15
-- #############################################################################

create or replace function public.approve_school_application(p_application_id uuid, p_auth_user_id uuid, p_shortcode text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.school_applications%rowtype;
  v_school_id uuid;
  v_auth_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.platform_admins
    where user_id = auth.uid()
      and revoked_at is null
  ) then
    raise exception 'Platform-admin authority is required' using errcode = '42501';
  end if;

  if p_application_id is null then
    raise exception 'Application id is required' using errcode = '22023';
  end if;

  if p_auth_user_id is null then
    raise exception 'Auth user id is required' using errcode = '22023';
  end if;

  if p_shortcode is null
     or p_shortcode !~ '^[a-z0-9]([a-z0-9-]{1,61})[a-z0-9]$' then
    raise exception 'Shortcode must be DNS-safe, lowercase, and 3-63 characters' using errcode = '22023';
  end if;

  select *
  into v_application
  from public.school_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;

  if v_application.status <> 'pending' then
    raise exception 'Application is no longer pending' using errcode = '55000';
  end if;

  select email::text
  into v_auth_email
  from auth.users
  where id = p_auth_user_id;

  if not found then
    raise exception 'Auth user was not created' using errcode = 'P0002';
  end if;

  if lower(v_auth_email) <> lower(v_application.email::text) then
    raise exception 'Auth user email does not match the application email' using errcode = '22023';
  end if;

  v_school_id := gen_random_uuid();

  -- schools_reject_reserved_shortcode refuses a reserved shortcode here (M14).
  insert into public.schools (
    id, shortcode, name, address, phone, email, country
  )
  values (
    v_school_id,
    p_shortcode,
    v_application.school_name,
    v_application.school_address,
    v_application.phone,
    v_application.email,
    coalesce(v_application.country, 'SO')
  );

  insert into public.profiles (
    id, school_id, full_name, email, phone
  )
  values (
    p_auth_user_id,
    v_school_id,
    v_application.administrator_name,
    v_application.email,
    v_application.phone
  );

  -- M15: administrator (the workspace the application opens) AND owner (billing
  -- and owner management). Two roles for one person, as UNIQUE (user_id, role)
  -- allows. The school was created above, so this is its first and only owner.
  insert into public.memberships (
    user_id, school_id, role, status, invited_by
  )
  values
    (p_auth_user_id, v_school_id, 'administrator', 'active', auth.uid()),
    (p_auth_user_id, v_school_id, 'owner', 'active', auth.uid());

  update public.school_applications
  set
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = pg_catalog.now(),
    approved_school_id = v_school_id
  where id = v_application.id;

  return pg_catalog.jsonb_build_object(
    'application_id', v_application.id,
    'school_id', v_school_id,
    'user_id', p_auth_user_id
  );
end;
$$;


-- #############################################################################
-- M13
-- #############################################################################

drop policy if exists invitations_staff_select on public.invitations;
drop policy if exists invitations_admin_select on public.invitations;

create policy invitations_admin_select on public.invitations
  for select to authenticated
  using (public.has_school_admin_role(school_id));


-- #############################################################################
-- M14
-- #############################################################################

insert into public.reserved_shortcodes (shortcode, reason) values
  ('www',    'Marketing host (www.nomcloud.academy); the login resolver treats it as non-school. SYSTEM_ISSUES_LIST M14.'),
  ('app',    'Application host (app.nomcloud.academy); the login resolver treats it as non-school. SYSTEM_ISSUES_LIST M14.'),
  ('api',    'API host; the login resolver treats it as non-school. SYSTEM_ISSUES_LIST M14.'),
  ('admin',  'Standard infrastructure subdomain; listed in SCHEMA_DESIGN section 2. SYSTEM_ISSUES_LIST M14.'),
  ('login',  'Standard infrastructure subdomain. SYSTEM_ISSUES_LIST M14.'),
  ('mail',   'Mail host; listed in SCHEMA_DESIGN section 2. SYSTEM_ISSUES_LIST M14.'),
  ('status', 'Status page; listed in SCHEMA_DESIGN section 2. SYSTEM_ISSUES_LIST M14.'),
  ('class',  'The school domain itself (class.so); listed in SCHEMA_DESIGN section 2. SYSTEM_ISSUES_LIST M14.')
on conflict (shortcode) do nothing;


-- #############################################################################
-- M16
-- #############################################################################

create or replace function public.keep_school_administered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only an ACTIVE owner/director/administrator membership can matter.
  if old.status <> 'active' or old.role not in ('owner', 'director', 'administrator') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Only a person acting on their OWN membership.
  if auth.uid() is null or old.user_id <> auth.uid() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- An edit that keeps it an active administrative membership is always fine.
  if tg_op = 'UPDATE'
     and new.status = 'active'
     and new.role in ('owner', 'director', 'administrator')
     and new.school_id = old.school_id then
    return new;
  end if;

  perform 1 from public.schools s where s.id = old.school_id for no key update;

  if not exists (
    select 1
      from public.memberships m
     where m.school_id = old.school_id
       and m.id <> old.id
       and m.status = 'active'
       and m.role in ('owner', 'director', 'administrator')
  ) then
    raise exception 'you are the last active owner, director or administrator of this school, so you cannot % your own % membership',
      case when tg_op = 'DELETE' then 'remove' else 'suspend or change' end, old.role
      using errcode = 'PT409',
            hint = 'Give another person an owner, director or administrator role first.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

comment on function public.keep_school_administered() is
  'BEFORE UPDATE OR DELETE on memberships. A person may not suspend, delete or re-role their OWN active owner/director/administrator membership when no other active owner/director/administrator membership remains at the school, which would lock the school out of administration (SYSTEM_ISSUES_LIST M16). Other people''s memberships, platform administrators, the service role and cascades are unaffected. PT409.';

revoke all on function public.keep_school_administered() from public, anon, authenticated;

drop trigger if exists memberships_keep_school_administered on public.memberships;
create trigger memberships_keep_school_administered
  before update or delete on public.memberships
  for each row
  execute function public.keep_school_administered();
