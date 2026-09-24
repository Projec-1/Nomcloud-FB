-- =============================================================================
-- Campus/role expansion — school application details and approval
-- Nom Cloud
--
-- Extends school_applications with typed fields for the public three-step form,
-- migrates the previous structured message format where it can be parsed, and
-- adds the platform-admin-only approval transaction.
--
-- Depends on Phase 3 Migrations 01, 03, 04, Migration 2 of this expansion, and
-- Migration 1 of this expansion (campuses is intentionally not used here).
-- Creates NO row-level security policies (Phase 7).
-- =============================================================================

alter table public.school_applications
  add column applicant_position text,
  add column school_address text,
  add column campus_count text,
  add column student_count_band text,
  add column class_count_band text,
  add column staff_count_band text,
  add column curriculum text,
  add column current_system text,
  add column reasons text[];

comment on column public.school_applications.applicant_position is
  'Applicant position supplied for review context; it does not grant a membership role.';

comment on column public.school_applications.school_address is
  'Plain-text school identification details. A searchable directory is a future enhancement.';

comment on column public.school_applications.student_count_band is
  'Selectable total-student range from the public application form.';

comment on column public.school_applications.class_count_band is
  'Selectable total-class range from the public application form.';

comment on column public.school_applications.staff_count_band is
  'Selectable teachers/staff range from the public application form.';

comment on column public.school_applications.reasons is
  'Selected reasons supplied by the applicant.';

update public.school_applications
set
  applicant_position = pg_catalog.regexp_replace(pg_catalog.split_part(message, E'\n', 1), '^Position: ', ''),
  school_address = pg_catalog.regexp_replace(pg_catalog.split_part(message, E'\n', 2), '^School address / identifying details: ', ''),
  campus_count = pg_catalog.regexp_replace(pg_catalog.split_part(message, E'\n', 3), '^Number of campuses: ', ''),
  student_count_band = pg_catalog.regexp_replace(pg_catalog.split_part(message, E'\n', 4), '^Total students: ', ''),
  class_count_band = pg_catalog.regexp_replace(pg_catalog.split_part(message, E'\n', 5), '^Total classes: ', ''),
  staff_count_band = pg_catalog.regexp_replace(pg_catalog.split_part(message, E'\n', 6), '^Teachers/staff: ', ''),
  curriculum = pg_catalog.regexp_replace(pg_catalog.split_part(message, E'\n', 7), '^Curriculum: ', ''),
  current_system = pg_catalog.regexp_replace(pg_catalog.split_part(message, E'\n', 8), '^Current system: ', ''),
  reasons = case
    when pg_catalog.split_part(message, E'\n', 9) like 'Main reasons: %'
      then pg_catalog.string_to_array(
        pg_catalog.regexp_replace(pg_catalog.split_part(message, E'\n', 9), '^Main reasons: ', ''),
        ', '
      )
    else null
  end
where message like 'Position: %';

create or replace function public.approve_school_application(
  p_application_id uuid,
  p_shortcode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.school_applications%rowtype;
  v_school_id uuid;
  v_user_id uuid;
  v_temporary_password text;
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

  if exists (
    select 1
    from auth.users
    where lower(email) = lower(v_application.email::text)
  ) then
    raise exception 'An Auth account already exists for this email' using errcode = '23505';
  end if;

  v_school_id := gen_random_uuid();
  v_user_id := gen_random_uuid();
  v_temporary_password := encode(extensions.gen_random_bytes(18), 'hex');

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

  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    'authenticated',
    'authenticated',
    v_application.email::text,
    extensions.crypt(v_temporary_password, extensions.gen_salt('bf')),
    null,
    '{"provider":"email","providers":["email"]}'::jsonb,
    pg_catalog.jsonb_build_object(
      'full_name', v_application.administrator_name,
      'must_change_password', true
    ),
    pg_catalog.now(),
    pg_catalog.now()
  );

  insert into public.profiles (
    id, school_id, full_name, email, phone
  )
  values (
    v_user_id,
    v_school_id,
    v_application.administrator_name,
    v_application.email,
    v_application.phone
  );

  insert into public.memberships (
    user_id, school_id, role, status, invited_by
  )
  values (
    v_user_id,
    v_school_id,
    'administrator',
    'active',
    auth.uid()
  );

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
    'user_id', v_user_id,
    'temporary_password', v_temporary_password
  );
end;
$$;

comment on function public.approve_school_application(uuid, text) is
  'Atomically approves a pending school application for an unrevoked platform admin. The temporary password is returned once and only its hash is stored.';

revoke all on function public.approve_school_application(uuid, text) from public, anon, service_role;
grant execute on function public.approve_school_application(uuid, text) to authenticated;
