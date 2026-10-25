-- Ensure course-files bucket exists
insert into storage.buckets (id, name, public, file_size_limit)
values ('course-files', 'course-files', false, 20971520)
on conflict (id) do nothing;

-- Ensure course editors can update/overwrite files
drop policy if exists "course editors update files" on storage.objects;
create policy "course editors update files"
on storage.objects for update to authenticated
using (
  bucket_id = 'course-files'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and public.can_edit_course(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'course-files'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and public.can_edit_course(((storage.foldername(name))[1])::uuid)
);
