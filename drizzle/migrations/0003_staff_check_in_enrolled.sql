CREATE OR REPLACE FUNCTION public.staff_check_in(_course uuid, _user uuid, _session uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_attendance public.attendance%ROWTYPE;
  v_title text;
  v_new boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_edit_course(_course) THEN
    RAISE EXCEPTION 'คุณไม่มีสิทธิ์เช็คชื่อให้ผู้เรียนในหลักสูตรนี้';
  END IF;
  SELECT title INTO v_title FROM public.courses WHERE id = _course AND published;
  IF v_title IS NULL THEN RAISE EXCEPTION 'หลักสูตรยังไม่เปิดอบรม'; END IF;
  IF NOT public.is_approved(_user) THEN
    RAISE EXCEPTION 'ผู้เรียนยังไม่ได้รับอนุมัติบัญชี';
  END IF;
  IF _session IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.course_sessions WHERE id = _session AND course_id = _course) THEN
    RAISE EXCEPTION 'ไม่พบรอบอบรมของหลักสูตรนี้';
  END IF;
  SELECT * INTO v_enrollment FROM public.enrollments WHERE course_id = _course AND user_id = _user FOR UPDATE;
  IF NOT FOUND OR v_enrollment.session_id IS DISTINCT FROM _session THEN
    RAISE EXCEPTION 'ผู้เรียนไม่ได้ลงทะเบียนในรอบนี้ กรุณาอัปเดตรายชื่อ';
  END IF;
  INSERT INTO public.attendance(course_id, user_id, session_id, is_demo)
    VALUES (_course, _user, _session, false)
    ON CONFLICT (course_id, user_id) DO NOTHING
    RETURNING * INTO v_attendance;
  IF FOUND THEN
    v_new := true;
  ELSE
    SELECT * INTO v_attendance FROM public.attendance WHERE course_id = _course AND user_id = _user FOR UPDATE;
    IF v_attendance.session_id IS DISTINCT FROM _session THEN
      RAISE EXCEPTION 'ผู้เรียนเช็คชื่อในรอบอื่นแล้ว';
    END IF;
    IF v_attendance.is_demo THEN
      UPDATE public.attendance SET is_demo = false, checked_at = now()
        WHERE id = v_attendance.id RETURNING * INTO v_attendance;
      v_new := true;
    END IF;
  END IF;
  RETURN jsonb_build_object('title', v_title, 'checked_at', v_attendance.checked_at, 'new', v_new);
END;
$function$;