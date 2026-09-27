-- Announcement lifecycle columns were added after the original table migration.
-- Keep this migration idempotent so existing installations can safely apply it.
alter table public.announcements
  add column if not exists expires_at timestamptz,
  add column if not exists archived_at timestamptz;

create index if not exists announcements_school_id_archived_at_idx
  on public.announcements (school_id, archived_at);

comment on column public.announcements.expires_at is
  'Optional time after which the announcement is hidden from its audience.';

comment on column public.announcements.archived_at is
  'Soft-delete timestamp. Archived announcements remain available to administrators.';
