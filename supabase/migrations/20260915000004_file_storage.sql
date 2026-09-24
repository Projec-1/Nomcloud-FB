-- =============================================================================
-- FILE STORAGE — buckets, Storage policies and their helpers
-- Nom Cloud
--
-- Implements docs/FILE_STORAGE_PLAN.md with the three decisions locked on
-- 2026-09-15:
--   1. A school's logo shows on the public login page, before sign-in.
--   2. A teacher sees a student's photo ONLY if they teach that student's class,
--      using the relationship attendance marking already uses (teaches_class).
--      Owner, director, administrator and principal keep full access.
--   3. profiles.avatar_url is built now: staff and admins upload their own.
--
-- NOTHING HERE CHANGES A POLICY ON A public TABLE. Every policy below is on
-- storage.objects. The table columns (schools.logo_path, students.photo_path,
-- profiles.avatar_url) keep their existing grants and RLS; they store the
-- object's path inside its bucket, never a URL.
--
-- THREE BUCKETS
--
--   school-branding   PUBLIC   1 MB   png/jpeg/webp   {school_id}/logo/{uuid}.{ext}
--   student-photos    private  2 MB   png/jpeg/webp   {school_id}/{student_id}/{uuid}.{ext}
--   profile-avatars   private  1 MB   png/jpeg/webp   {user_id}/{uuid}.{ext}
--
-- No SVG anywhere: an SVG can carry script.
--
-- HOW DECISION 1 STAYS NARROW. school-branding is a public bucket, which means
-- Storage serves GET /storage/v1/object/public/school-branding/<exact path>
-- without consulting RLS. That is the only thing "public" opens. It is bounded
-- by four facts, each enforced below rather than assumed:
--   a. The bucket can hold nothing but logos. The INSERT policy accepts only
--      names matching {uuid}/logo/{uuid}.(png|jpg|webp), the bucket accepts only
--      image/png, image/jpeg, image/webp up to 1 MB, and no other bucket is
--      public. Student photos and avatars live in private buckets.
--   b. There is NO anon policy on storage.objects, so nobody signed out can list
--      the bucket or discover a path. A logged-in user can list only their own
--      school's folder, and only as an administrator.
--   c. File names are random UUIDs, so a path cannot be guessed.
--   d. The login page learns a path from school_login_branding(shortcode), which
--      returns the name, colour and logo path of exactly the one active school
--      whose shortcode it was given, and no other column. A school's login page
--      therefore only ever asks for its own logo.
-- A logo is, by decision, public information: anyone who knows a school's
-- shortcode may see its logo, exactly as anyone may visit its login page.
--
-- HOW DECISION 2 REUSES, NOT RE-DERIVES. teaches_student() below contains no
-- teaching logic of its own. It finds the student's current enrolments
-- (class_enrollments.left_on IS NULL, the "still enrolled" signal every roster
-- read uses) and asks public.teaches_class(school, class) — the exact function
-- behind attendance_records_teacher_insert/select/update — about each class.
-- "Teaches" therefore means classes.class_teacher_id or class_subjects.teacher_id,
-- never timetable_slots, for the same reason it does for attendance.
--
-- HOW STORAGE POLICIES CALL THE HELPERS. Storage runs each request as the
-- caller's role (anon or authenticated) with the request's JWT claims set, so
-- auth.uid() inside the SECURITY DEFINER helpers resolves to the caller, and
-- the helpers are already EXECUTE-able by authenticated. This is verified by the
-- HTTP probes recorded in docs/MIGRATIONS.md, not assumed.
--
-- MALFORMED NAMES FAIL, THEY DO NOT RAISE. PostgreSQL does not promise to
-- evaluate AND left to right, so a policy must never cast a path segment to
-- uuid directly. storage_path_uuid() returns NULL for a segment that is not a
-- lower-case UUID, and every helper returns false for a NULL id.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helpers
-- -----------------------------------------------------------------------------

create or replace function public.storage_path_uuid(p_name text, p_index integer)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', p_index) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', p_index)::uuid
  end;
$$;

comment on function public.storage_path_uuid(text, integer) is
  'The p_index-th "/" segment of a Storage object name as uuid, or NULL if it is not a lower-case UUID. Lets storage.objects policies read ids from paths without ever raising.';

create or replace function public.teaches_student(p_school_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.class_enrollments ce
     where ce.school_id = p_school_id
       and ce.student_id = p_student_id
       and ce.left_on is null
       and public.teaches_class(ce.school_id, ce.class_id)
  );
$$;

comment on function public.teaches_student(uuid, uuid) is
  'True when the caller teaches a class the student is currently enrolled in. Delegates to teaches_class, the attendance-marking relationship; adds only the enrolment lookup.';

-- The login page's only pre-auth read. One active school, three columns.
create or replace function public.school_login_branding(p_shortcode text)
returns table (name text, primary_color text, logo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.name, s.primary_color, s.logo_path
    from public.schools s
   where s.shortcode = lower(p_shortcode)
     and s.status = 'active';
$$;

comment on function public.school_login_branding(text) is
  'Public branding for one school''s login page: name, primary colour and logo path of the active school with this shortcode, nothing else. Callable by anon.';

-- Supabase's default privileges grant EXECUTE on new functions to anon and
-- authenticated. Revoke by name, then grant exactly what is needed.
revoke all on function public.storage_path_uuid(text, integer) from public, anon, authenticated;
revoke all on function public.teaches_student(uuid, uuid) from public, anon, authenticated;
revoke all on function public.school_login_branding(text) from public, anon, authenticated;

grant execute on function public.storage_path_uuid(text, integer) to authenticated;
grant execute on function public.teaches_student(uuid, uuid) to authenticated;
grant execute on function public.school_login_branding(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Buckets. Size and type limits are enforced by Storage on every upload.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('school-branding', 'school-branding', true,  1048576, array['image/png', 'image/jpeg', 'image/webp']),
  ('student-photos',  'student-photos',  false, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('profile-avatars', 'profile-avatars', false, 1048576, array['image/png', 'image/jpeg', 'image/webp']);

-- -----------------------------------------------------------------------------
-- 3. school-branding — writes mirror schools_admin_update (has_school_admin_role)
-- -----------------------------------------------------------------------------
-- No UPDATE policy: a replacement is a new random name, never an overwrite.

create policy school_branding_admin_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'school-branding'
    and public.has_school_admin_role(public.storage_path_uuid(name, 1))
  );

create policy school_branding_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'school-branding'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/logo/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'
    and public.has_school_admin_role(public.storage_path_uuid(name, 1))
  );

create policy school_branding_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'school-branding'
    and public.has_school_admin_role(public.storage_path_uuid(name, 1))
  );

create policy school_branding_platform_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'school-branding' and public.is_platform_admin())
  with check (bucket_id = 'school-branding' and public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 4. student-photos
--    read:  management (owner/director/administrator/principal)
--           OR teaches_student (decision 2)
--           OR is_guardian_of_student (students_guardian_select)
--    write: management, mirroring students_management_*; the student must exist
--           in the school named by the path.
-- -----------------------------------------------------------------------------

create policy student_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-photos'
    and (
      public.has_school_management_role(public.storage_path_uuid(name, 1))
      or public.teaches_student(public.storage_path_uuid(name, 1), public.storage_path_uuid(name, 2))
      or public.is_guardian_of_student(public.storage_path_uuid(name, 1), public.storage_path_uuid(name, 2))
    )
  );

create policy student_photos_management_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'student-photos'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'
    and public.has_school_management_role(public.storage_path_uuid(name, 1))
    and exists (
      select 1
        from public.students s
       where s.school_id = public.storage_path_uuid(name, 1)
         and s.id = public.storage_path_uuid(name, 2)
    )
  );

create policy student_photos_management_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'student-photos'
    and public.has_school_management_role(public.storage_path_uuid(name, 1))
  );

create policy student_photos_platform_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'student-photos' and public.is_platform_admin())
  with check (bucket_id = 'student-photos' and public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 5. profile-avatars
--    read:  exactly who can read the owner's profiles row. The subquery runs
--           under the caller's own profiles RLS (self, the owner's school
--           administrators, platform admins), so avatar visibility is the
--           profile's visibility by construction, not a second copy of it.
--    write: only into your own folder, and only if you are staff in your
--           current school or a platform admin. Guardians cannot upload.
--    delete: your own folder, always, so a former staff member can remove it.
-- -----------------------------------------------------------------------------

create policy profile_avatars_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-avatars'
    and exists (
      select 1 from public.profiles p where p.id = public.storage_path_uuid(name, 1)
    )
  );

create policy profile_avatars_self_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'
    and public.storage_path_uuid(name, 1) = auth.uid()
    and (
      public.is_platform_admin()
      or public.has_school_staff_role(public.current_school_id())
    )
  );

create policy profile_avatars_self_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-avatars'
    and public.storage_path_uuid(name, 1) = auth.uid()
  );
