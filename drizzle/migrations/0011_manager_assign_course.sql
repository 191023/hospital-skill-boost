-- 0011_manager_assign_course.sql: Allow division and unit managers to enroll their subordinates in courses and sessions
CREATE OR REPLACE FUNCTION public.manager_assign_course(
  _course uuid,
  _session uuid,
  _user_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_mgr uuid := auth.uid();
  v_cap int;
  v_taken int;
  v_sess_course uuid;
  v_round int;
  v_uid uuid;
  v_count_assigned int := 0;
  v_skipped_attended int := 0;
  v_skipped_no_access int := 0;
  v_skipped_no_permission int := 0;
begin
  if v_mgr is null or not public.is_approved(v_mgr) then
    raise exception 'ต้องเข้าสู่ระบบและได้รับการอนุมัติก่อน';
  end if;

  if _course is null then
    raise exception 'ต้องระบุหลักสูตร';
  end if;

  if _user_ids is null or array_length(_user_ids, 1) is null or array_length(_user_ids, 1) = 0 then
    raise exception 'ต้องเลือกสมาชิกอย่างน้อย 1 คน';
  end if;

  -- Validate session if specified
  if _session is not null then
    select course_id, capacity, round_no into v_sess_course, v_cap, v_round
    from course_sessions
    where id = _session
    for update;

    if v_sess_course is null then
      raise exception 'ไม่พบรอบอบรมที่ระบุ';
    end if;

    if v_sess_course <> _course then
      raise exception 'รอบอบรมไม่ตรงกับหลักสูตรที่เลือก';
    end if;
  end if;

  -- Process each user
  foreach v_uid in array _user_ids loop
    -- 1. Check if caller has management authority over target user
    if not public.can_manage_user(v_mgr, v_uid) then
      v_skipped_no_permission := v_skipped_no_permission + 1;
      continue;
    end if;

    -- 2. Check course access permissions
    if not public.can_access_course(_course, v_uid) then
      v_skipped_no_access := v_skipped_no_access + 1;
      continue;
    end if;

    -- 3. Skip if already checked into classroom (preserve existing attendance)
    if exists(select 1 from attendance where course_id = _course and user_id = v_uid) then
      v_skipped_attended := v_skipped_attended + 1;
      continue;
    end if;

    -- 4. Check capacity if session is selected
    if _session is not null and v_cap is not null then
      select count(*) into v_taken from enrollments where session_id = _session and user_id <> v_uid;
      if v_taken >= v_cap then
        raise exception 'ที่นั่งในรอบที่ % เต็มแล้ว (ความจุสูงสุด % ที่นั่ง)', v_round, v_cap;
      end if;
    end if;

    -- 5. Upsert enrollment
    insert into enrollments(user_id, course_id, session_id)
    values (v_uid, _course, _session)
    on conflict (user_id, course_id)
    do update set session_id = coalesce(_session, enrollments.session_id);

    -- 6. Write audit log
    insert into member_audit_log(actor_id, target_id, action, details)
    values (
      v_mgr,
      v_uid,
      'manager_assign_course',
      jsonb_build_object(
        'course_id', _course,
        'session_id', _session,
        'round_no', v_round
      )
    );

    v_count_assigned := v_count_assigned + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'assigned_count', v_count_assigned,
    'skipped_attended', v_skipped_attended,
    'skipped_no_access', v_skipped_no_access,
    'skipped_no_permission', v_skipped_no_permission
  );
end;
$$;

GRANT EXECUTE ON FUNCTION public.manager_assign_course(uuid, uuid, uuid[]) TO authenticated;
