-- =============================================================================
-- Migration 11 — communication_and_audit
-- Nom Cloud · Phase 3 (production schema)
--
-- Design number 11. See docs/MIGRATIONS.md for the numbering convention.
--
--   public.announcements                    — SCHOOL-OWNED
--   public.notifications                    — SCHOOL-OWNED
--   public.message_threads                  — SCHOOL-OWNED
--   public.message_thread_participants     — SCHOOL-OWNED
--   public.messages                         — SCHOOL-OWNED
--   public.audit_logs                       — PLATFORM, optionally school-scoped
--
-- Depends on Migration 01 (public.set_updated_at), Migration 03 (schools),
-- Migration 04 (profiles), Migration 07 (students) and Migration 08 (classes).
--
-- Creates NO row-level security policies (Phase 7).
--
-- The authoritative design is docs/SCHEMA_DESIGN.md. In particular:
--   - notifications.user_id and message_thread_participants.user_id are
--     access-granting composite references to profiles(id, school_id);
--   - author/sender references are attribution-only single-column references;
--   - audit_logs is append-only, has nullable school_id for platform actions,
--     and snapshots actor_role and actor_email.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. announcements — SCHOOL-OWNED
-- -----------------------------------------------------------------------------

create table public.announcements (
  id           uuid         not null default gen_random_uuid(),
  school_id    uuid         not null,
  title        text         not null,
  body         text         not null,
  audience     text         not null,
  class_id     uuid,
  priority     text         not null,
  created_by   uuid,
  published_at timestamptz,
  pinned       boolean      not null default false,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now(),

  constraint announcements_pkey
    primary key (id),
  constraint announcements_audience_check
    check (audience in ('all', 'teachers', 'parents', 'students', 'class')),
  constraint announcements_audience_class_check
    check (
         (audience = 'class' and class_id is not null)
      or (audience <> 'class' and class_id is null)
    ),
  constraint announcements_priority_check
    check (priority in ('normal', 'important', 'urgent')),

  constraint announcements_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,
  constraint announcements_school_id_class_id_fkey
    foreign key (school_id, class_id)
    references public.classes (school_id, id)
    on delete cascade
    on update no action,
  constraint announcements_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null
);

create index announcements_school_id_published_at_idx
  on public.announcements (school_id, published_at desc);

create index announcements_school_id_pinned_idx
  on public.announcements (school_id, pinned)
  where pinned;

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. notifications — SCHOOL-OWNED
-- -----------------------------------------------------------------------------

create table public.notifications (
  id          uuid         not null default gen_random_uuid(),
  school_id   uuid         not null,
  user_id     uuid         not null,
  title       text         not null,
  body        text         not null,
  type        text         not null,
  link        text,
  read_at     timestamptz,
  entity_type text,
  entity_id   uuid,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),

  constraint notifications_pkey
    primary key (id),

  constraint notifications_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,
  constraint notifications_user_id_school_id_fkey
    foreign key (user_id, school_id)
    references public.profiles (id, school_id)
    on delete cascade
    on update no action
);

create index notifications_user_id_school_id_created_at_idx
  on public.notifications (user_id, school_id, created_at desc);

create index notifications_user_id_unread_idx
  on public.notifications (user_id)
  where read_at is null;

create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. message_threads — SCHOOL-OWNED
-- -----------------------------------------------------------------------------

create table public.message_threads (
  id               uuid         not null default gen_random_uuid(),
  school_id        uuid         not null,
  subject          text         not null,
  student_id       uuid,
  created_by       uuid,
  last_message_at  timestamptz,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now(),

  constraint message_threads_pkey
    primary key (id),
  constraint message_threads_school_id_id_key
    unique (school_id, id),

  constraint message_threads_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,
  constraint message_threads_school_id_student_id_fkey
    foreign key (school_id, student_id)
    references public.students (school_id, id)
    on delete set null (student_id)
    on update no action,
  constraint message_threads_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null
);

create index message_threads_school_id_last_message_at_idx
  on public.message_threads (school_id, last_message_at desc);

create trigger message_threads_set_updated_at
  before update on public.message_threads
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. message_thread_participants — SCHOOL-OWNED (join)
-- -----------------------------------------------------------------------------

create table public.message_thread_participants (
  id            uuid         not null default gen_random_uuid(),
  school_id     uuid         not null,
  thread_id     uuid         not null,
  user_id       uuid         not null,
  last_read_at  timestamptz,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),

  constraint message_thread_participants_pkey
    primary key (id),
  constraint message_thread_participants_school_id_thread_id_user_id_key
    unique (school_id, thread_id, user_id),

  constraint message_thread_participants_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,
  constraint message_thread_participants_school_id_thread_id_fkey
    foreign key (school_id, thread_id)
    references public.message_threads (school_id, id)
    on delete cascade
    on update no action,
  constraint message_thread_participants_user_id_school_id_fkey
    foreign key (user_id, school_id)
    references public.profiles (id, school_id)
    on delete cascade
    on update no action
);

create index message_thread_participants_user_id_school_id_idx
  on public.message_thread_participants (user_id, school_id);

create trigger message_thread_participants_set_updated_at
  before update on public.message_thread_participants
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 5. messages — SCHOOL-OWNED
-- -----------------------------------------------------------------------------

create table public.messages (
  id          uuid         not null default gen_random_uuid(),
  school_id   uuid         not null,
  thread_id   uuid         not null,
  sender_id   uuid,
  body        text         not null,
  sent_at     timestamptz  not null default now(),
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),

  constraint messages_pkey
    primary key (id),

  constraint messages_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete cascade,
  constraint messages_school_id_thread_id_fkey
    foreign key (school_id, thread_id)
    references public.message_threads (school_id, id)
    on delete cascade
    on update no action,
  constraint messages_sender_id_fkey
    foreign key (sender_id) references public.profiles (id) on delete set null
);

create index messages_school_id_thread_id_sent_at_idx
  on public.messages (school_id, thread_id, sent_at);

create trigger messages_set_updated_at
  before update on public.messages
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 6. audit_logs — PLATFORM, optionally school-scoped
--
-- audit_logs is append-only. It deliberately has no updated_at column and no
-- set_updated_at trigger. actor_role and actor_email are snapshots, so the log
-- remains readable after the actor profile is removed.
-- -----------------------------------------------------------------------------

create table public.audit_logs (
  id            uuid            not null default gen_random_uuid(),
  school_id     uuid,
  actor_user_id uuid,
  actor_role    text,
  actor_email   extensions.citext,
  action        text            not null,
  entity_type   text            not null,
  entity_id     uuid,
  summary       text,
  changes       jsonb,
  ip_address    inet,
  user_agent    text,
  request_id    uuid,
  created_at    timestamptz     not null default now(),

  constraint audit_logs_pkey
    primary key (id),

  constraint audit_logs_school_id_fkey
    foreign key (school_id) references public.schools (id) on delete set null,
  constraint audit_logs_actor_user_id_fkey
    foreign key (actor_user_id) references public.profiles (id) on delete set null
);

create index audit_logs_school_id_created_at_idx
  on public.audit_logs (school_id, created_at desc);

create index audit_logs_entity_type_entity_id_created_at_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

create index audit_logs_actor_user_id_created_at_idx
  on public.audit_logs (actor_user_id, created_at desc);

create index audit_logs_action_created_at_idx
  on public.audit_logs (action, created_at desc);
