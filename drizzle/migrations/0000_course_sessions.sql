CREATE TABLE public.course_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  round_no integer NOT NULL DEFAULT 1,
  starts_at timestamptz,
  ends_at timestamptz,
  location text NOT NULL DEFAULT '',
  capacity integer,
  checkin_code text NOT NULL DEFAULT upper(substr(md5(random()::text),1,8)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX course_sessions_course_idx ON public.course_sessions(course_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_sessions TO authenticated;
GRANT ALL ON public.course_sessions TO service_role;
ALTER TABLE public.course_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions read" ON public.course_sessions FOR SELECT TO authenticated
  USING (public.can_edit_course(course_id) OR public.is_staff(auth.uid()) OR (public.is_approved(auth.uid()) AND public.can_access_course(course_id, auth.uid())));
CREATE POLICY "sessions write" ON public.course_sessions FOR ALL TO authenticated
  USING (public.can_edit_course(course_id)) WITH CHECK (public.can_edit_course(course_id));

ALTER TABLE public.enrollments ADD COLUMN session_id uuid REFERENCES public.course_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.attendance ADD COLUMN session_id uuid REFERENCES public.course_sessions(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.session_seats(_course uuid)
RETURNS TABLE(session_id uuid, taken integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select s.id, (select count(*)::int from enrollments e where e.session_id = s.id)
  from course_sessions s where s.course_id = _course
    and (public.is_staff(auth.uid()) or (public.is_approved(auth.uid()) and public.can_access_course(_course, auth.uid())))
$$;
GRANT EXECUTE ON FUNCTION public.session_seats(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.choose_session(_session uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare uid uuid := auth.uid(); v_course uuid; v_cap int; v_taken int;
begin
  if uid is null or not public.is_approved(uid) then raise exception 'บัญชียังไม่ได้รับอนุมัติ'; end if;
  select course_id, capacity into v_course, v_cap from course_sessions where id = _session for update;
  if v_course is null then raise exception 'ไม่พบรอบอบรม'; end if;
  if not public.can_access_course(v_course, uid) then raise exception 'คุณไม่มีสิทธิ์เข้าอบรมหลักสูตรนี้'; end if;
  if exists(select 1 from attendance where course_id = v_course and user_id = uid) then raise exception 'คุณเช็คชื่อเข้าอบรมแล้ว เปลี่ยนรอบไม่ได้'; end if;
  select count(*) into v_taken from enrollments where session_id = _session and user_id <> uid;
  if v_cap is not null and v_taken >= v_cap then raise exception 'รอบนี้ที่นั่งเต็มแล้ว'; end if;
  insert into enrollments(user_id, course_id, session_id) select uid, v_course, _session
    where not exists(select 1 from enrollments where user_id = uid and course_id = v_course);
  update enrollments set session_id = _session where user_id = uid and course_id = v_course;
end $$;
GRANT EXECUTE ON FUNCTION public.choose_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_in(_course uuid, _code text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); v_title text; v_at timestamptz; v_new boolean := false; v_sess uuid; v_round int; c text := upper(trim(_code));
begin
  if uid is null or not public.is_approved(uid) then raise exception 'บัญชียังไม่ได้รับอนุมัติ'; end if;
  select id, round_no into v_sess, v_round from course_sessions where course_id = _course and checkin_code = c;
  select title into v_title from courses where id=_course and published and (checkin_code = c or v_sess is not null);
  if v_title is null then raise exception 'QR เช็คชื่อไม่ถูกต้องหรือหมดอายุ'; end if;
  if not public.can_access_course(_course, uid) then raise exception 'คุณไม่มีสิทธิ์เข้าอบรมหลักสูตรนี้'; end if;
  insert into enrollments(user_id, course_id, session_id) select uid, _course, v_sess
    where not exists(select 1 from enrollments where user_id=uid and course_id=_course);
  insert into attendance(course_id, user_id, session_id) values (_course, uid, v_sess)
    on conflict (course_id, user_id) do nothing returning checked_at into v_at;
  if v_at is null then select checked_at into v_at from attendance where course_id=_course and user_id=uid;
  else
    v_new := true;
    if v_sess is not null then update enrollments set session_id = v_sess where user_id=uid and course_id=_course; end if;
  end if;
  return jsonb_build_object('title', v_title, 'checked_at', v_at, 'new', v_new, 'round', v_round);
end $function$;