create policy announcements_teacher_insert on public.announcements
  for insert to authenticated
  with check (
    audience = 'class'
    and public.teaches_class(school_id, class_id)
    and (created_by is null or created_by = auth.uid())
  );

create policy announcements_teacher_update on public.announcements
  for update to authenticated
  using (
    audience = 'class'
    and public.teaches_class(school_id, class_id)
  )
  with check (
    audience = 'class'
    and public.teaches_class(school_id, class_id)
    and (created_by is null or created_by = auth.uid())
  );

create policy announcements_teacher_archive on public.announcements
  for update to authenticated
  using (
    audience = 'class'
    and public.teaches_class(school_id, class_id)
  )
  with check (
    audience = 'class'
    and public.teaches_class(school_id, class_id)
  );

create policy announcements_teacher_delete on public.announcements
  for delete to authenticated
  using (
    audience = 'class'
    and public.teaches_class(school_id, class_id)
  );
