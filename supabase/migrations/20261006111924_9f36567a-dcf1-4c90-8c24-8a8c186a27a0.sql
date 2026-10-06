alter table public.courses
  add column hospital_logo_url text,
  add column course_logo_url text,
  add column instructor_signature_url text,
  add column instructor_name text default '',
  add column instructor_title text default '';

drop policy if exists "course files staff insert" on storage.objects;
drop policy if exists "course files staff delete" on storage.objects;

create policy "course editors upload files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'course-files'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and public.can_edit_course(((storage.foldername(name))[1])::uuid)
);

create policy "course editors delete files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'course-files'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and public.can_edit_course(((storage.foldername(name))[1])::uuid)
);