-- Add soft delete columns to enrollments
alter table public.enrollments
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id);

create index if not exists idx_enrollments_deleted_at on public.enrollments(course_id, deleted_at);

-- Grant permissions on enrollments to authenticated
grant select, insert, update, delete on public.enrollments to authenticated;
grant all on public.enrollments to service_role;

-- RLS policies for course editors on enrollments
drop policy if exists "staff update enrollments" on public.enrollments;
create policy "staff update enrollments"
on public.enrollments for update to authenticated
using (public.can_edit_course(course_id))
with check (public.can_edit_course(course_id));

drop policy if exists "staff delete enrollments" on public.enrollments;
create policy "staff delete enrollments"
on public.enrollments for delete to authenticated
using (public.can_edit_course(course_id));

-- Soft delete enrollment function
create or replace function public.staff_soft_delete_enrollment(_course uuid, _user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.can_edit_course(_course) then
    raise exception 'คุณไม่มีสิทธิ์จัดการรายชื่อในหลักสูตรนี้';
  end if;
  update public.enrollments
  set deleted_at = now(), deleted_by = auth.uid()
  where course_id = _course and user_id = _user;
  return true;
end;
$$;
revoke execute on function public.staff_soft_delete_enrollment(uuid, uuid) from anon, public;
grant execute on function public.staff_soft_delete_enrollment(uuid, uuid) to authenticated;

-- Restore soft deleted enrollment function
create or replace function public.staff_restore_enrollment(_course uuid, _user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.can_edit_course(_course) then
    raise exception 'คุณไม่มีสิทธิ์จัดการรายชื่อในหลักสูตรนี้';
  end if;
  update public.enrollments
  set deleted_at = null, deleted_by = null
  where course_id = _course and user_id = _user;
  return true;
end;
$$;
revoke execute on function public.staff_restore_enrollment(uuid, uuid) from anon, public;
grant execute on function public.staff_restore_enrollment(uuid, uuid) to authenticated;

-- Remove attendance / undo check-in function
create or replace function public.staff_remove_attendance(_course uuid, _user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.can_edit_course(_course) then
    raise exception 'คุณไม่มีสิทธิ์ยกเลิกการเช็คชื่อในหลักสูตรนี้';
  end if;
  delete from public.attendance
  where course_id = _course and user_id = _user;
  return true;
end;
$$;
revoke execute on function public.staff_remove_attendance(uuid, uuid) from anon, public;
grant execute on function public.staff_remove_attendance(uuid, uuid) to authenticated;

-- Manual staff enroll user function (for walk-in attendees)
create or replace function public.staff_enroll_user(_course uuid, _user uuid, _session uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.can_edit_course(_course) then
    raise exception 'คุณไม่มีสิทธิ์ลงทะเบียนให้ผู้เรียนในหลักสูตรนี้';
  end if;
  if not public.is_approved(_user) then
    raise exception 'ผู้ใช้งานยังไม่ได้รับอนุมัติบัญชี';
  end if;
  if _session is not null and not exists (select 1 from public.course_sessions where id = _session and course_id = _course) then
    raise exception 'ไม่พบรอบอบรมที่ระบุ';
  end if;

  insert into public.enrollments(course_id, user_id, session_id, deleted_at, deleted_by)
  values (_course, _user, _session, null, null)
  on conflict (user_id, course_id) do update
  set session_id = coalesce(excluded.session_id, public.enrollments.session_id),
      deleted_at = null,
      deleted_by = null;

  return true;
end;
$$;
revoke execute on function public.staff_enroll_user(uuid, uuid, uuid) from anon, public;
grant execute on function public.staff_enroll_user(uuid, uuid, uuid) to authenticated;

-- Update staff_check_in to support checking in and handling soft-deleted guard
create or replace function public.staff_check_in(_course uuid, _user uuid, _session uuid default null::uuid)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_enrollment public.enrollments%rowtype;
  v_attendance public.attendance%rowtype;
  v_title text;
  v_new boolean := false;
begin
  if auth.uid() is null or not public.can_edit_course(_course) then
    raise exception 'คุณไม่มีสิทธิ์เช็คชื่อให้ผู้เรียนในหลักสูตรนี้';
  end if;
  select title into v_title from public.courses where id = _course and published;
  if v_title is null then raise exception 'หลักสูตรยังไม่เปิดอบรม'; end if;
  if not public.is_approved(_user) then
    raise exception 'ผู้เรียนยังไม่ได้รับอนุมัติบัญชี';
  end if;
  if _session is not null and not exists (select 1 from public.course_sessions where id = _session and course_id = _course) then
    raise exception 'ไม่พบรอบอบรมของหลักสูตรนี้';
  end if;

  select * into v_enrollment from public.enrollments where course_id = _course and user_id = _user for update;
  if not found then
    raise exception 'ผู้เรียนยังไม่ได้ลงทะเบียนในหลักสูตรนี้';
  end if;
  if v_enrollment.deleted_at is not null then
    raise exception 'ผู้เรียนถูกยกเลิกการลงทะเบียน (กรุณากู้คืนรายชื่อก่อนเช็คชื่อ)';
  end if;
  if _session is not null and v_enrollment.session_id is distinct from _session then
    update public.enrollments set session_id = _session where id = v_enrollment.id;
  end if;

  insert into public.attendance(course_id, user_id, session_id, is_demo)
    values (_course, _user, coalesce(_session, v_enrollment.session_id), false)
    on conflict (course_id, user_id) do nothing
    returning * into v_attendance;
  if found then
    v_new := true;
  else
    select * into v_attendance from public.attendance where course_id = _course and user_id = _user for update;
    if v_attendance.is_demo then
      update public.attendance set is_demo = false, checked_at = now(), session_id = coalesce(_session, v_attendance.session_id)
        where id = v_attendance.id returning * into v_attendance;
      v_new := true;
    end if;
  end if;
  return jsonb_build_object('title', v_title, 'checked_at', v_attendance.checked_at, 'new', v_new);
end;
$function$;
