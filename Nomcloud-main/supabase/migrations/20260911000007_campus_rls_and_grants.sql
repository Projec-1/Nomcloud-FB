-- =============================================================================
-- Campus/role expansion Migration 8 of 8 — campus_rls_and_grants
-- Nom Cloud
--
-- Enables row-level security and writes policies for the SIX campus/role
-- tables only: schools, campuses, memberships, membership_campus_scopes,
-- invitations, invitation_campus_scopes.
--
-- Full Phase 7 RLS across the remaining 31 public tables is a SEPARATE future
-- task. Those tables keep RLS disabled and broad grants; nothing here changes
-- them. In particular school_applications is deliberately untouched, so the
-- anonymous public INSERT restored by 20260911000001 keeps working.
--
-- ---------------------------------------------------------------------------
-- Campus scope and these six tables
-- ---------------------------------------------------------------------------
-- Campus scope does NOT filter these tables. They are school-level identity
-- records, not campus-owned ones: section B.2 names classes as the only
-- campus-bearing table, and neither memberships nor invitations carries a
-- campus_id. Section D.2 applies campus scope "where the role is campus-
-- scoped", meaning the operational records that scope governs, which this
-- migration does not touch. Filtering identity rows by campus is also
-- incoherent for scope_mode = 'all' memberships, which belong to no campus,
-- and would hide a director from a principal's own staff list. Campus scope
-- becomes an access predicate in the future migration covering classes,
-- students, attendance and grades.
--
-- ---------------------------------------------------------------------------
-- Who can do what
-- ---------------------------------------------------------------------------
--   platform admin (unrevoked platform_admins row)
--       ALL commands, all six tables, every school.
--   owner / director / administrator, in their own school
--       read everything, and write memberships, scopes and invitations.
--   principal / teacher, in their own school
--       read everything; NO write on the authorisation tables. Write access
--       there would let a teacher insert an owner membership for themselves,
--       which no school boundary would stop.
--   guardian
--       their own membership row and their own school row, nothing else. Full
--       denial was considered and rejected: AuthContext reads the signed-in
--       user's memberships and school on every sign-in, so denying it would
--       silently bounce guardians back to the login page.
--   anon
--       nothing on these six tables. No policy names anon, and anonymous
--       INSERT on invitations is not required: invitations are created by
--       authenticated staff.
--
-- ---------------------------------------------------------------------------
-- Recursion
-- ---------------------------------------------------------------------------
-- A policy ON memberships that reads memberships recurses forever. Every
-- helper below is SECURITY DEFINER with a pinned empty search_path, so it runs
-- as the owner and is not itself subject to RLS. This is the reason the helpers
-- exist at all; they are not a convenience.
--
-- No FORCE ROW LEVEL SECURITY anywhere, so the existing SECURITY DEFINER
-- functions accept_invitation and approve_school_application continue to
-- bypass these policies as their owner. The accompanying probes run both end
-- to end rather than assuming it.
--
-- Creates NO new tables, columns, constraints or triggers, and weakens nothing
-- from Migrations 1-7.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper predicates
-- -----------------------------------------------------------------------------

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.platform_admins pa
     where pa.user_id = auth.uid()
       and pa.revoked_at is null
  );
$$;

comment on function public.is_platform_admin() is
  'True when the caller holds an unrevoked platform_admins row. Security definer so RLS policies can call it without recursing through the tables they protect.';

create function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.school_id
    from public.profiles p
   where p.id = auth.uid();
$$;

comment on function public.current_school_id() is
  'The caller''s school from profiles.school_id, which AUTH_DESIGN section 1 makes authoritative. Null for a platform operator.';

create function public.has_school_staff_role(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.memberships m
     where m.user_id = auth.uid()
       and m.school_id = p_school_id
       and m.status = 'active'
       and m.role in ('owner', 'director', 'administrator', 'principal', 'teacher')
  );
$$;

comment on function public.has_school_staff_role(uuid) is
  'True when the caller holds an active staff membership in the given school. Guardian is excluded by naming the five staff roles positively rather than relying on default deny.';

create function public.has_school_admin_role(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.memberships m
     where m.user_id = auth.uid()
       and m.school_id = p_school_id
       and m.status = 'active'
       and m.role in ('owner', 'director', 'administrator')
  );
$$;

comment on function public.has_school_admin_role(uuid) is
  'True when the caller holds an active organisation-wide membership in the given school. This is the write predicate for the authorisation tables; principal and teacher are deliberately absent.';

revoke all on function public.is_platform_admin() from public;
revoke all on function public.current_school_id() from public;
revoke all on function public.has_school_staff_role(uuid) from public;
revoke all on function public.has_school_admin_role(uuid) from public;

grant execute on function public.is_platform_admin() to anon, authenticated, service_role;
grant execute on function public.current_school_id() to anon, authenticated, service_role;
grant execute on function public.has_school_staff_role(uuid) to anon, authenticated, service_role;
grant execute on function public.has_school_admin_role(uuid) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- schools
-- -----------------------------------------------------------------------------

alter table public.schools enable row level security;

create policy schools_platform_admin_all on public.schools
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Every member of the school, guardians included, may read their own school.
-- AuthContext loads it on every sign-in.
create policy schools_member_select on public.schools
  for select to authenticated
  using (id = public.current_school_id());

create policy schools_admin_update on public.schools
  for update to authenticated
  using (public.has_school_admin_role(id))
  with check (public.has_school_admin_role(id));

-- -----------------------------------------------------------------------------
-- campuses
-- -----------------------------------------------------------------------------

alter table public.campuses enable row level security;

create policy campuses_platform_admin_all on public.campuses
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy campuses_staff_select on public.campuses
  for select to authenticated
  using (public.has_school_staff_role(school_id));

create policy campuses_admin_insert on public.campuses
  for insert to authenticated
  with check (public.has_school_admin_role(school_id));

create policy campuses_admin_update on public.campuses
  for update to authenticated
  using (public.has_school_admin_role(school_id))
  with check (public.has_school_admin_role(school_id));

create policy campuses_admin_delete on public.campuses
  for delete to authenticated
  using (public.has_school_admin_role(school_id));

-- -----------------------------------------------------------------------------
-- memberships
-- -----------------------------------------------------------------------------

alter table public.memberships enable row level security;

create policy memberships_platform_admin_all on public.memberships
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Self-read. This is the guardian's only reach into these tables, and it is
-- what makes sign-in work for every role.
create policy memberships_self_select on public.memberships
  for select to authenticated
  using (user_id = auth.uid());

create policy memberships_staff_select on public.memberships
  for select to authenticated
  using (public.has_school_staff_role(school_id));

create policy memberships_admin_insert on public.memberships
  for insert to authenticated
  with check (public.has_school_admin_role(school_id));

create policy memberships_admin_update on public.memberships
  for update to authenticated
  using (public.has_school_admin_role(school_id))
  with check (public.has_school_admin_role(school_id));

create policy memberships_admin_delete on public.memberships
  for delete to authenticated
  using (public.has_school_admin_role(school_id));

-- -----------------------------------------------------------------------------
-- membership_campus_scopes
-- -----------------------------------------------------------------------------

alter table public.membership_campus_scopes enable row level security;

create policy membership_campus_scopes_platform_admin_all on public.membership_campus_scopes
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy membership_campus_scopes_staff_select on public.membership_campus_scopes
  for select to authenticated
  using (public.has_school_staff_role(school_id));

create policy membership_campus_scopes_admin_insert on public.membership_campus_scopes
  for insert to authenticated
  with check (public.has_school_admin_role(school_id));

create policy membership_campus_scopes_admin_update on public.membership_campus_scopes
  for update to authenticated
  using (public.has_school_admin_role(school_id))
  with check (public.has_school_admin_role(school_id));

create policy membership_campus_scopes_admin_delete on public.membership_campus_scopes
  for delete to authenticated
  using (public.has_school_admin_role(school_id));

-- -----------------------------------------------------------------------------
-- invitations
-- -----------------------------------------------------------------------------
-- No anon policy. Invitations are created by authenticated staff, and an
-- invitee accepts through accept_invitation, which is SECURITY DEFINER and
-- therefore never consults these policies.

alter table public.invitations enable row level security;

create policy invitations_platform_admin_all on public.invitations
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy invitations_staff_select on public.invitations
  for select to authenticated
  using (public.has_school_staff_role(school_id));

create policy invitations_admin_insert on public.invitations
  for insert to authenticated
  with check (public.has_school_admin_role(school_id));

create policy invitations_admin_update on public.invitations
  for update to authenticated
  using (public.has_school_admin_role(school_id))
  with check (public.has_school_admin_role(school_id));

create policy invitations_admin_delete on public.invitations
  for delete to authenticated
  using (public.has_school_admin_role(school_id));

-- -----------------------------------------------------------------------------
-- invitation_campus_scopes
-- -----------------------------------------------------------------------------

alter table public.invitation_campus_scopes enable row level security;

create policy invitation_campus_scopes_platform_admin_all on public.invitation_campus_scopes
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy invitation_campus_scopes_staff_select on public.invitation_campus_scopes
  for select to authenticated
  using (public.has_school_staff_role(school_id));

create policy invitation_campus_scopes_admin_insert on public.invitation_campus_scopes
  for insert to authenticated
  with check (public.has_school_admin_role(school_id));

create policy invitation_campus_scopes_admin_update on public.invitation_campus_scopes
  for update to authenticated
  using (public.has_school_admin_role(school_id))
  with check (public.has_school_admin_role(school_id));

create policy invitation_campus_scopes_admin_delete on public.invitation_campus_scopes
  for delete to authenticated
  using (public.has_school_admin_role(school_id));
