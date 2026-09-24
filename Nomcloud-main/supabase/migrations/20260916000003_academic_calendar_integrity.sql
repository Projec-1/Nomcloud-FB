-- =============================================================================
-- CORRECTIVE — academic_calendar_integrity
-- Nom Cloud
--
-- Fixes docs/SYSTEM_ISSUES_LIST.md K2, K4, K5, M1, M2, M3 and the database half
-- of K1 and K6 (both of which are otherwise interface work).
--
-- THE ROOT PROBLEM. A school could not create a year from the app, switching the
-- active year was two statements with a window of none, and nothing tied a
-- record to the year it belongs to: terms could sit outside their year or
-- overlap each other, classes and enrolments could be created inside a CLOSED
-- year, attendance could be dated outside any year, and a grade or exam could
-- name a term from a different year than its class.
--
-- SHAPE OF THIS MIGRATION. Seven validation triggers (six functions — grade_records
-- and exams share one) and one atomic function.
-- Every trigger is BEFORE, SECURITY DEFINER with search_path pinned empty (the
-- sibling rows they read must be seen in full, not narrowed by the caller's own
-- RLS), and fires only on the columns that matter, so unrelated updates —
-- including the enrolment closing this migration's own function performs — do
-- not re-run them.
--
-- ERROR CODES. Validations raise PT422, which PostgREST returns as HTTP 422
-- (unprocessable): these are malformed requests, not conflicts. The earlier
-- money and attendance guards keep PT409 for genuine conflicts, and 42501 stays
-- the permission answer. The interface maps all three.
--
-- WHAT THIS DOES NOT DO: it changes no policy, no grant and no existing
-- function, and it hides nothing. A closed year and everything recorded in it
-- stay fully readable — the restrictions are on WRITING into a closed year, and
-- the default-to-current-year behaviour is a query filter in the interface, not
-- a policy.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- M1 — a term sits inside its year, and terms of a year do not overlap
-- -----------------------------------------------------------------------------

create or replace function public.assert_term_within_year()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year_start date;
  v_year_end date;
  v_label text;
  v_clash text;
begin
  select y.start_date, y.end_date, y.label
    into v_year_start, v_year_end, v_label
    from public.academic_years y
   where y.school_id = new.school_id
     and y.id = new.academic_year_id;

  if v_year_start is null then
    raise exception 'academic year not found for this school'
      using errcode = 'PT422';
  end if;

  if new.start_date < v_year_start or new.end_date > v_year_end then
    raise exception 'term "%" (% to %) falls outside its academic year % (% to %)',
      new.name, new.start_date, new.end_date, v_label, v_year_start, v_year_end
      using errcode = 'PT422',
            hint = 'Give the term dates inside the academic year it belongs to.';
  end if;

  select t.name
    into v_clash
    from public.terms t
   where t.school_id = new.school_id
     and t.academic_year_id = new.academic_year_id
     and t.id is distinct from new.id
     and daterange(t.start_date, t.end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
   limit 1;

  if v_clash is not null then
    raise exception 'term "%" overlaps the dates of term "%"', new.name, v_clash
      using errcode = 'PT422',
            hint = 'Terms in the same year must not overlap; the current term is worked out from today''s date.';
  end if;

  return new;
end;
$$;

comment on function public.assert_term_within_year() is
  'BEFORE INSERT OR UPDATE on terms. A term must lie inside its academic year and must not overlap another term of that year, because the current term is derived from dates and overlaps make it ambiguous (SYSTEM_ISSUES_LIST M1).';

drop trigger if exists terms_assert_within_year on public.terms;

create trigger terms_assert_within_year
  before insert or update of academic_year_id, start_date, end_date on public.terms
  for each row
  execute function public.assert_term_within_year();


-- -----------------------------------------------------------------------------
-- M1 — two academic years of one school do not overlap
-- -----------------------------------------------------------------------------

create or replace function public.assert_year_no_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clash text;
begin
  select y.label
    into v_clash
    from public.academic_years y
   where y.school_id = new.school_id
     and y.id is distinct from new.id
     and daterange(y.start_date, y.end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
   limit 1;

  if v_clash is not null then
    raise exception 'academic year "%" (% to %) overlaps academic year "%"',
      new.label, new.start_date, new.end_date, v_clash
      using errcode = 'PT422',
            hint = 'Academic years at one school must not overlap.';
  end if;

  return new;
end;
$$;

comment on function public.assert_year_no_overlap() is
  'BEFORE INSERT OR UPDATE on academic_years. Two years of the same school may not cover the same dates (SYSTEM_ISSUES_LIST M1).';

drop trigger if exists academic_years_assert_no_overlap on public.academic_years;

create trigger academic_years_assert_no_overlap
  before insert or update of start_date, end_date on public.academic_years
  for each row
  execute function public.assert_year_no_overlap();


-- -----------------------------------------------------------------------------
-- M2 — closed means closed: no new classes, no new enrolments
-- -----------------------------------------------------------------------------

create or replace function public.assert_class_year_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_label text;
begin
  select y.status, y.label
    into v_status, v_label
    from public.academic_years y
   where y.school_id = new.school_id
     and y.id = new.academic_year_id;

  if v_status = 'closed' then
    raise exception 'academic year "%" is closed and cannot take new classes', v_label
      using errcode = 'PT422',
            hint = 'Create the class in the current academic year.';
  end if;

  return new;
end;
$$;

comment on function public.assert_class_year_open() is
  'BEFORE INSERT OR UPDATE OF academic_year_id on classes. A closed year is history and takes no new classes (SYSTEM_ISSUES_LIST M2). Existing classes in a closed year stay readable and editable in every other respect.';

drop trigger if exists classes_assert_year_open on public.classes;

create trigger classes_assert_year_open
  before insert or update of academic_year_id on public.classes
  for each row
  execute function public.assert_class_year_open();


create or replace function public.assert_enrolment_year()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_label text;
  v_class_year uuid;
begin
  select y.status, y.label
    into v_status, v_label
    from public.academic_years y
   where y.school_id = new.school_id
     and y.id = new.academic_year_id;

  if v_status = 'closed' then
    raise exception 'academic year "%" is closed and cannot take new enrolments', v_label
      using errcode = 'PT422',
            hint = 'Enrol the pupil in the current academic year.';
  end if;

  -- The enrolment must name the SAME year as its class. Without this, closing a
  -- year would miss enrolments filed under a different year (K5), and a roster
  -- could belong to two years at once.
  select c.academic_year_id
    into v_class_year
    from public.classes c
   where c.school_id = new.school_id
     and c.id = new.class_id;

  if v_class_year is not null and v_class_year is distinct from new.academic_year_id then
    raise exception 'this enrolment names a different academic year than its class'
      using errcode = 'PT422',
            hint = 'Enrol the pupil using the class''s own academic year.';
  end if;

  return new;
end;
$$;

comment on function public.assert_enrolment_year() is
  'BEFORE INSERT OR UPDATE OF academic_year_id, class_id on class_enrollments. The year must be open, and must be the class''s own year so that closing a year reaches every enrolment in it (SYSTEM_ISSUES_LIST M2, K5). Closing an enrolment writes left_on only, so this never fires for it.';

drop trigger if exists class_enrollments_assert_year on public.class_enrollments;

create trigger class_enrollments_assert_year
  before insert or update of academic_year_id, class_id on public.class_enrollments
  for each row
  execute function public.assert_enrolment_year();


-- -----------------------------------------------------------------------------
-- K4 — attendance falls inside its class's academic year
-- -----------------------------------------------------------------------------

create or replace function public.assert_attendance_within_year()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date;
  v_end date;
  v_label text;
begin
  select y.start_date, y.end_date, y.label
    into v_start, v_end, v_label
    from public.classes c
    join public.academic_years y
      on y.school_id = c.school_id
     and y.id = c.academic_year_id
   where c.school_id = new.school_id
     and c.id = new.class_id;

  if v_start is not null and (new.date < v_start or new.date > v_end) then
    raise exception 'attendance dated % falls outside academic year "%" (% to %)',
      new.date, v_label, v_start, v_end
      using errcode = 'PT422',
            hint = 'Attendance can only be marked on a date inside the class''s academic year.';
  end if;

  return new;
end;
$$;

comment on function public.assert_attendance_within_year() is
  'BEFORE INSERT OR UPDATE OF date, class_id on attendance_records. attendance_records carries no year of its own; its year is the class''s. This refuses a date outside that window, including one in a year that has not started (SYSTEM_ISSUES_LIST K4).';

drop trigger if exists attendance_records_assert_within_year on public.attendance_records;

create trigger attendance_records_assert_within_year
  before insert or update of date, class_id on public.attendance_records
  for each row
  execute function public.assert_attendance_within_year();


-- -----------------------------------------------------------------------------
-- M3 — a grade's and an exam's term belongs to its class's year
-- -----------------------------------------------------------------------------

create or replace function public.assert_term_matches_class_year()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_year uuid;
  v_term_year uuid;
  v_term_name text;
  v_class_label text;
begin
  select c.academic_year_id, c.name
    into v_class_year, v_class_label
    from public.classes c
   where c.school_id = new.school_id
     and c.id = new.class_id;

  select t.academic_year_id, t.name
    into v_term_year, v_term_name
    from public.terms t
   where t.school_id = new.school_id
     and t.id = new.term_id;

  if v_class_year is not null and v_term_year is not null and v_class_year is distinct from v_term_year then
    raise exception 'term "%" belongs to a different academic year than class "%"', v_term_name, v_class_label
      using errcode = 'PT422',
            hint = 'Choose a term from the class''s own academic year.';
  end if;

  return new;
end;
$$;

comment on function public.assert_term_matches_class_year() is
  'BEFORE INSERT OR UPDATE OF term_id, class_id on grade_records and exams. A mark or an exam filed under another year''s term would land in the wrong transcript period (SYSTEM_ISSUES_LIST M3).';

drop trigger if exists grade_records_assert_term_year on public.grade_records;

create trigger grade_records_assert_term_year
  before insert or update of term_id, class_id on public.grade_records
  for each row
  execute function public.assert_term_matches_class_year();

drop trigger if exists exams_assert_term_year on public.exams;

create trigger exams_assert_term_year
  before insert or update of term_id, class_id on public.exams
  for each row
  execute function public.assert_term_matches_class_year();


-- -----------------------------------------------------------------------------
-- K2 + K5 — switching the active year, atomically
-- -----------------------------------------------------------------------------
--
-- WHY A FUNCTION. academic_years carries a partial unique index, one active year
-- per school, so a switch is necessarily "close the old, activate the new" —
-- two statements a browser cannot wrap in a transaction. Phase 8 batch 2 left
-- the control out of the interface for exactly this reason. Here both happen in
-- one transaction, so there is never a moment with no active year, and a failure
-- leaves the school exactly as it was.
--
-- K5 IN THE SAME TRANSACTION. Every still-open enrolment of the year being
-- closed gets left_on, so a pupil cannot hold an open enrolment in the old year
-- and another in the new one. The date is the day the enrolment really ended:
-- the year's end_date, or today when the switch happens mid-year, never before
-- the pupil enrolled.
--
-- AUTHORISATION. has_school_management_role, the same predicate as the
-- academic_years write policies. SECURITY DEFINER is required because the
-- function must see and close every enrolment of the year, and must be able to
-- write academic_years regardless of which management role called it; the
-- explicit check is what keeps that from widening access.
-- -----------------------------------------------------------------------------

create or replace function public.activate_academic_year(
  p_school_id uuid,
  p_academic_year_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.academic_years%rowtype;
  v_previous public.academic_years%rowtype;
  v_closed_enrolments integer := 0;
begin
  if not public.has_school_management_role(p_school_id) then
    raise exception 'only school management may switch the academic year'
      using errcode = '42501';
  end if;

  -- Serialise concurrent switches for this school.
  perform 1
     from public.academic_years y
    where y.school_id = p_school_id
    for update;

  select * into v_target
    from public.academic_years y
   where y.school_id = p_school_id
     and y.id = p_academic_year_id;

  if not found then
    raise exception 'academic year not found at this school'
      using errcode = 'PT422';
  end if;

  if v_target.status = 'active' then
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_active',
      'activated_year_id', v_target.id,
      'activated_year_label', v_target.label,
      'previous_year_id', null,
      'previous_year_label', null,
      'enrolments_closed', 0
    );
  end if;

  select * into v_previous
    from public.academic_years y
   where y.school_id = p_school_id
     and y.status = 'active';

  -- Close the outgoing year FIRST: the one-active-year index admits no overlap.
  if v_previous.id is not null then
    update public.academic_years
       set status = 'closed'
     where school_id = p_school_id
       and id = v_previous.id;

    -- K5: the outgoing year's open enrolments end with it.
    update public.class_enrollments ce
       -- GREATEST, LEAST and CURRENT_DATE are SQL keywords, not functions, so
       -- they are not schema-qualified and are unaffected by the empty
       -- search_path.
       set left_on = greatest(
             ce.enrolled_on,
             least(v_previous.end_date, current_date)
           )
     where ce.school_id = p_school_id
       and ce.academic_year_id = v_previous.id
       and ce.left_on is null;

    get diagnostics v_closed_enrolments = row_count;
  end if;

  update public.academic_years
     set status = 'active'
   where school_id = p_school_id
     and id = v_target.id;

  return pg_catalog.jsonb_build_object(
    'outcome', 'switched',
    'activated_year_id', v_target.id,
    'activated_year_label', v_target.label,
    'previous_year_id', v_previous.id,
    'previous_year_label', v_previous.label,
    'enrolments_closed', v_closed_enrolments
  );
end;
$$;

comment on function public.activate_academic_year(uuid, uuid) is
  'Activates an academic year and closes the outgoing one in ONE transaction, closing that year''s still-open enrolments with it (SYSTEM_ISSUES_LIST K2, K5). Management only, checked explicitly. Returns the outcome, both years and how many enrolments were closed.';

revoke all on function public.activate_academic_year(uuid, uuid) from public, anon, authenticated;
grant execute on function public.activate_academic_year(uuid, uuid) to authenticated;
