CREATE OR REPLACE FUNCTION public.get_session_roster(_session uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  division text,
  department text,
  enrolled_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
declare
  v_course uuid;
begin
  select course_id into v_course from course_sessions where id = _session;
  if v_course is null then return; end if;
  if not (
    current_setting('request.jwt.claim.role', true) = 'service_role'
    or public.is_staff(auth.uid())
    or (public.is_approved(auth.uid()) and public.can_access_course(v_course, auth.uid()))
  ) then
    return;
  end if;
  return query
    select
      e.user_id,
      coalesce(p.full_name, 'ไม่ระบุชื่อ'),
      coalesce(p.division, ''),
      coalesce(p.department, ''),
      e.created_at as enrolled_at
    from enrollments e
    left join profiles p on p.id = e.user_id
    where e.session_id = _session
    order by e.created_at asc;
end;
$$;
GRANT EXECUTE ON FUNCTION public.get_session_roster(uuid) TO authenticated;
