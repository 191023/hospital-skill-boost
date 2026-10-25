-- Course documents and attachments (approval, expenses, handouts, general)
create table if not exists public.course_documents (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  category text not null default 'general',
  title text not null,
  file_url text not null,
  file_name text not null,
  file_size bigint default 0,
  file_type text default '',
  amount numeric(12,2),
  visibility text not null default 'staff_only',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_course_documents_course on public.course_documents(course_id, category);

grant select, insert, update, delete on public.course_documents to authenticated;
grant all on public.course_documents to service_role;

alter table public.course_documents enable row level security;

drop policy if exists "read course documents" on public.course_documents;
create policy "read course documents"
on public.course_documents for select to authenticated
using (
  public.is_staff(auth.uid())
  or public.can_edit_course(course_id)
  or (visibility = 'public' and public.can_access_course(course_id, auth.uid()))
);

drop policy if exists "write course documents" on public.course_documents;
create policy "write course documents"
on public.course_documents for all to authenticated
using (public.can_edit_course(course_id))
with check (public.can_edit_course(course_id));
