ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS require_pretest boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_posttest boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_survey boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS issue_certificate boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.try_issue_certificate(_course uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); c record; v_lessons int; v_done int; v_best numeric; v_id uuid;
begin
  if uid is null or not public.is_approved(uid) then return null; end if;
  select * into c from courses where id = _course;
  if c.id is null or not c.issue_certificate then return null; end if;
  if not exists(select 1 from enrollments where user_id=uid and course_id=_course) then return null; end if;
  select id into v_id from certificates where user_id=uid and course_id=_course;
  if v_id is not null then return v_id; end if;
  select count(*) into v_lessons from lessons where course_id=_course;
  select count(*) into v_done from lesson_progress lp join lessons l on l.id=lp.lesson_id where l.course_id=_course and lp.user_id=uid;
  if v_done < v_lessons then return null; end if;
  select max(percent) into v_best from test_attempts where user_id=uid and course_id=_course and kind='post';
  if c.require_posttest and exists(select 1 from questions where course_id=_course) and (v_best is null or v_best < c.pass_score) then return null; end if;
  if c.require_survey and exists(select 1 from survey_questions where course_id=_course)
     and not exists(select 1 from survey_responses where user_id=uid and course_id=_course) then return null; end if;
  insert into certificates(user_id, course_id, cert_no, score)
  values (uid, _course, 'CERT-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(md5(random()::text),1,6)), case when c.require_posttest then v_best end)
  on conflict (user_id, course_id) do nothing returning id into v_id;
  if v_id is null then select id into v_id from certificates where user_id=uid and course_id=_course; end if;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.submit_test(_course uuid, _kind text, _answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  v_total int; v_score int := 0; v_pct numeric; v_pass int; v_passed boolean; cert_id uuid; r record;
begin
  if uid is null or not public.is_approved(uid) then raise exception 'not allowed'; end if;
  if _kind not in ('pre','post') then raise exception 'bad kind'; end if;
  if not exists(select 1 from public.enrollments where user_id=uid and course_id=_course) then raise exception 'not enrolled'; end if;
  if _kind = 'pre' and exists(select 1 from public.test_attempts where user_id=uid and course_id=_course and kind='pre') then
    raise exception 'pre-test already taken';
  end if;
  if exists(select 1 from public.courses where id=_course and ((_kind='pre' and not require_pretest) or (_kind='post' and not require_posttest))) then
    raise exception 'test disabled for this course';
  end if;
  select pass_score into v_pass from public.courses where id=_course;
  select count(*) into v_total from public.questions where course_id=_course;
  if v_total = 0 then raise exception 'no questions'; end if;
  for r in select id, correct_index from public.questions where course_id=_course loop
    if (_answers->>(r.id::text))::int = r.correct_index then v_score := v_score + 1; end if;
  end loop;
  v_pct := round(v_score::numeric * 100 / v_total, 1);
  v_passed := v_pct >= v_pass;
  insert into public.test_attempts(user_id, course_id, kind, score, total, percent, passed)
  values (uid, _course, _kind, v_score, v_total, v_pct, v_passed);
  if _kind = 'post' and v_passed then
    update public.certificates set score = greatest(coalesce(score,0), v_pct) where user_id=uid and course_id=_course;
    cert_id := public.try_issue_certificate(_course);
  end if;
  return jsonb_build_object('score', v_score, 'total', v_total, 'percent', v_pct, 'passed', v_passed, 'certificate_id', cert_id);
end $function$;

GRANT EXECUTE ON FUNCTION public.try_issue_certificate(uuid) TO authenticated;