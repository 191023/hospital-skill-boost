alter table public.courses add column checkin_code text not null default upper(substr(md5(random()::text),1,8));

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  checked_at timestamptz not null default now(),
  unique (course_id, user_id)
);
grant select on public.attendance to authenticated;
grant all on public.attendance to service_role;
alter table public.attendance enable row level security;
create policy "attendance read" on public.attendance for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));

create or replace function public.check_in(_course uuid, _code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_title text; v_at timestamptz; v_new boolean := false;
begin
  if uid is null or not public.is_approved(uid) then raise exception 'บัญชียังไม่ได้รับอนุมัติ'; end if;
  select title into v_title from courses where id=_course and published and checkin_code = upper(trim(_code));
  if v_title is null then raise exception 'QR เช็คชื่อไม่ถูกต้องหรือหมดอายุ'; end if;
  if not public.can_access_course(_course, uid) then raise exception 'คุณไม่มีสิทธิ์เข้าอบรมหลักสูตรนี้'; end if;
  insert into enrollments(user_id, course_id) select uid, _course
    where not exists(select 1 from enrollments where user_id=uid and course_id=_course);
  insert into attendance(course_id, user_id) values (_course, uid)
    on conflict (course_id, user_id) do nothing returning checked_at into v_at;
  if v_at is null then select checked_at into v_at from attendance where course_id=_course and user_id=uid;
  else v_new := true; end if;
  return jsonb_build_object('title', v_title, 'checked_at', v_at, 'new', v_new);
end $$;
revoke execute on function public.check_in(uuid, text) from anon, public;
grant execute on function public.check_in(uuid, text) to authenticated;