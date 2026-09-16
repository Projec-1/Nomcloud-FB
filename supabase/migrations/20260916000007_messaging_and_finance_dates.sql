-- =============================================================================
-- CORRECTIVE — messaging_and_finance_dates
-- Nom Cloud
--
-- Fixes docs/SYSTEM_ISSUES_LIST.md M9, M10, M11, plus two requested rules that
-- are not on the list: a class announcement to a class with no enrolled
-- students, and a fee created already overdue. (The recipient de-duplication is
-- application-only; see communicationService.fetchMessageableUsers.)
--
-- #############################################################################
-- M10 — A PARTICIPANT CAN POST ANONYMOUSLY OR BACK-DATE A MESSAGE
-- #############################################################################
--
-- MEASURED (sweep): M6 sender_id = NULL, OK rows=1. M8 sent_at = 2020-01-01,
-- OK rows=1. Impersonation was already refused (M7, 42501).
--
-- SENDER: the attendance/grade mechanism (S11, M6): the WITH CHECK of the policy
-- that writes the row requires `sender_id = auth.uid()` instead of "NULL or
-- auth.uid()". messages has no UPDATE policy for school roles, so INSERT is the
-- only write path to tighten.
--
-- The same "NULL or self" (or no check) survives on the two other attribution
-- columns of this area, and they get the identical treatment on INSERT:
--   message_threads.created_by   message_threads_admin_insert had no check
--   announcements.created_by     announcements_admin_insert and
--                                announcements_class_management_insert
-- The announcement UPDATE policies are left as they are (see the issues list:
-- what "created_by" should mean on an edit is a separate question).
--
-- TIMESTAMP: the S5/M6 column-grant mechanism. sent_at, created_at and
-- updated_at leave the INSERT column grant on messages, so the database default
-- (now()) is the only possible value and a client that sends one gets 42501.
-- The application never sends them.
--
-- #############################################################################
-- M11 — "ALL STUDENTS" ANNOUNCEMENTS REACH NOBODY
-- #############################################################################
--
-- MEASURED (N1): audience 'students' is accepted, guardian sees 0, teacher sees
-- 0. There is no student role (V1 issues students no logins), and migration 14
-- deliberately made 'students' readable by management only; the parent screens
-- already document that treating it as a parents audience would redirect a
-- message meant for children. So the audience has no readers by design. The
-- honest fix is to stop offering it rather than invent a readership:
-- announcements_audience_check no longer admits 'students', and the form no
-- longer lists it. No row uses it (0 announcements exist), so the constraint is
-- replaced without touching data.
--
-- #############################################################################
-- CLASS ANNOUNCEMENT TO A CLASS WITH NO ENROLLED STUDENTS (requested; not listed)
-- #############################################################################
--
-- The only "message the whole class" feature is an announcement with audience
-- 'class'. Families see it through guardian_has_student_in_class, which since
-- M5 requires an OPEN enrolment, so a class with none reaches no family while
-- the form reports "Announcement published". A BEFORE INSERT OR UPDATE OF
-- audience, class_id trigger now refuses it with PT422 and a sentence saying
-- why. Pinning or editing the text of an existing notice does not fire it.
-- (Fee reminders already handle the empty case: the send button is disabled and
-- the dialog states how many parents can be messaged.)
--
-- #############################################################################
-- M9 — PAYMENTS CAN BE DATED IN THE FUTURE
-- FEE CREATED ALREADY OVERDUE (requested; not listed)
-- #############################################################################
--
-- "Today" is the school's local date, computed exactly as apply_payment_event
-- already stamps provider payments:
--     (now() at time zone coalesce(schools.timezone, 'Africa/Mogadishu'))::date
-- so a provider-confirmed payment can never be refused by this rule, and a school
-- in UTC+3 is not told at 01:00 that today is tomorrow.
--
--   fee_payments.paid_on   may not be after the school's today, on INSERT or
--                          when paid_on is edited. Money cannot have been
--                          received on a date that has not happened. PT422.
--   fee_records.due_date   may not be before the school's today on INSERT.
--                          PT422.
--
-- EDITING due_date TO A PAST DATE STAYS ALLOWED, deliberately:
--   1. The finance decisions already locked in S5/S7 list "amount, due date and
--      category edits on unpaid and paid fees" as STILL ALLOWED. Refusing past
--      dates on edit would reverse a verified decision.
--   2. An edit is the correction path. A fee entered with the wrong due date,
--      or one whose real due date has since passed, must be recordable as it
--      truly is; forcing a future date would make the record false.
--   3. updateFeeRecord re-sends due_date on every edit, so an UPDATE rule would
--      also block unrelated edits (amount, category) to any fee whose due date
--      has legitimately passed.
-- The rule's purpose — a NEW invoice is not born overdue — is fully met at
-- creation.
--
-- Both are triggers, not CHECKs: a CHECK is re-evaluated on every later UPDATE of
-- the row, so a due-date CHECK would make every fee uneditable once its due date
-- passed, and neither CHECK could read the school's time zone.
--
-- NOTHING ELSE CHANGES: no other policy, grant, trigger or function, and none of
-- the earlier guards (S5 amount/fee_record_id grants, S6, S7 currency,
-- confirmed-payment edit, amount_paid sync).
-- =============================================================================


-- #############################################################################
-- M10 — attribution and timestamps
-- #############################################################################

alter policy messages_participant_insert on public.messages
  with check (
    public.is_thread_participant(school_id, thread_id)
    and sender_id = auth.uid()
  );

revoke insert on table public.messages from anon, authenticated;
grant insert (id, school_id, thread_id, sender_id, body) on table public.messages to authenticated;

comment on column public.messages.sent_at is
  'When the message was posted. Always the database default now(): removed from the INSERT column grant in 20260916000007, so a client cannot back-date a message (SYSTEM_ISSUES_LIST M10).';

alter policy message_threads_admin_insert on public.message_threads
  with check (
    public.has_school_admin_role(school_id)
    and created_by = auth.uid()
  );

alter policy announcements_admin_insert on public.announcements
  with check (
    public.has_school_admin_role(school_id)
    and created_by = auth.uid()
  );

alter policy announcements_class_management_insert on public.announcements
  with check (
    audience = 'class'
    and public.can_manage_class(school_id, class_id)
    and created_by = auth.uid()
  );


-- #############################################################################
-- M11 — no 'students' audience
-- #############################################################################

alter table public.announcements drop constraint announcements_audience_check;
alter table public.announcements add constraint announcements_audience_check
  check (audience = any (array['all'::text, 'teachers'::text, 'parents'::text, 'class'::text]));


-- #############################################################################
-- Class announcement must reach at least one enrolled student's family
-- #############################################################################

create or replace function public.assert_class_announcement_has_recipients()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class text;
begin
  if new.audience <> 'class' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.audience = new.audience
     and old.class_id is not distinct from new.class_id then
    return new;
  end if;

  if not exists (
    select 1
      from public.class_enrollments ce
     where ce.school_id = new.school_id
       and ce.class_id = new.class_id
       and ce.left_on is null
  ) then
    select c.name into v_class from public.classes c where c.school_id = new.school_id and c.id = new.class_id;
    raise exception 'class "%" currently has no enrolled students, so this announcement would reach no families; it was not published', coalesce(v_class, '?')
      using errcode = 'PT422',
            hint = 'Enrol students in the class first, or choose another audience.';
  end if;

  return new;
end;
$$;

comment on function public.assert_class_announcement_has_recipients() is
  'BEFORE INSERT OR UPDATE OF audience, class_id on announcements. A class announcement is refused (PT422) when the class has no OPEN enrolment, because guardian_has_student_in_class would give it no family readers and the sender would believe it was delivered.';

revoke all on function public.assert_class_announcement_has_recipients() from public, anon, authenticated;

drop trigger if exists announcements_assert_class_has_recipients on public.announcements;
create trigger announcements_assert_class_has_recipients
  before insert or update of audience, class_id on public.announcements
  for each row
  execute function public.assert_class_announcement_has_recipients();


-- #############################################################################
-- M9 and fee due dates
-- #############################################################################

create or replace function public.school_local_today(p_school_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (pg_catalog.now() at time zone coalesce(s.timezone, 'Africa/Mogadishu'))::date
    from public.schools s
   where s.id = p_school_id;
$$;

comment on function public.school_local_today(uuid) is
  'The school''s current local date, computed as apply_payment_event stamps provider payments: now() at the school''s time zone (default Africa/Mogadishu).';

revoke all on function public.school_local_today(uuid) from public, anon, authenticated;

create or replace function public.assert_payment_not_future_dated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.school_local_today(new.school_id);
begin
  if new.paid_on > v_today then
    raise exception 'a payment cannot be dated % because that is after today (%) at this school', new.paid_on, v_today
      using errcode = 'PT422',
            hint = 'Record the date the money was actually received.';
  end if;
  return new;
end;
$$;

comment on function public.assert_payment_not_future_dated() is
  'BEFORE INSERT OR UPDATE OF paid_on on fee_payments. paid_on may not be after the school''s local today (SYSTEM_ISSUES_LIST M9). PT422.';

revoke all on function public.assert_payment_not_future_dated() from public, anon, authenticated;

drop trigger if exists fee_payments_assert_not_future_dated on public.fee_payments;
create trigger fee_payments_assert_not_future_dated
  before insert or update of paid_on on public.fee_payments
  for each row
  execute function public.assert_payment_not_future_dated();

create or replace function public.assert_fee_not_created_overdue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.school_local_today(new.school_id);
begin
  if new.due_date < v_today then
    raise exception 'a new fee cannot be due on % because that is before today (%) at this school', new.due_date, v_today
      using errcode = 'PT422',
            hint = 'Choose today or a later due date. An existing fee''s due date can still be corrected by editing it.';
  end if;
  return new;
end;
$$;

comment on function public.assert_fee_not_created_overdue() is
  'BEFORE INSERT on fee_records. A new fee may not be due before the school''s local today, so no invoice is created already overdue. Editing an existing fee''s due date is deliberately not restricted (the S5/S7 decision keeps due-date edits allowed as the correction path). PT422.';

revoke all on function public.assert_fee_not_created_overdue() from public, anon, authenticated;

drop trigger if exists fee_records_assert_not_created_overdue on public.fee_records;
create trigger fee_records_assert_not_created_overdue
  before insert on public.fee_records
  for each row
  execute function public.assert_fee_not_created_overdue();
