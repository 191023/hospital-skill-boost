-- Course activity photos for course reports and documentation
create table if not exists public.course_activity_photos (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  session_id uuid references public.course_sessions(id) on delete set null,
  photo_url text not null,
  caption text default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_course_activity_photos_course on public.course_activity_photos(course_id, sort_order);

grant select, insert, update, delete on public.course_activity_photos to authenticated;
grant all on public.course_activity_photos to service_role;

alter table public.course_activity_photos enable row level security;

drop policy if exists "read activity photos" on public.course_activity_photos;
create policy "read activity photos"
on public.course_activity_photos for select to authenticated
using (
  public.is_staff(auth.uid())
  or public.can_edit_course(course_id)
  or public.can_access_course(course_id, auth.uid())
);

drop policy if exists "write activity photos" on public.course_activity_photos;
create policy "write activity photos"
on public.course_activity_photos for all to authenticated
using (public.can_edit_course(course_id))
with check (public.can_edit_course(course_id));
