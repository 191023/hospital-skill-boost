-- Migration: try_issue_certificate and integration with submit_test, survey_responses, lesson_progress
-- Implements AGENTS.md architectural rule:
-- "Per-course step switches (pre/post-test, survey, certificate) live on courses; certificates are issued only by the try_issue_certificate DB function (also called from submit_test) — keeps completion rules server-side."

create or replace function public.try_issue_certificate(
  _course uuid,
  _user uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course record;
  v_lessons int := 0;
  v_done int := 0;
  v_post_passed boolean := false;
  v_best_score numeric := null;
  v_survey_done boolean := false;
  v_cert_id uuid := null;
begin
  -- 1. Fetch course settings
  select * into v_course from public.courses where id = _course and deleted_at is null;
  if not found then
    return null;
  end if;

  -- 2. Check if course issues certificate
  if not coalesce(v_course.issue_certificate, false) then
    return null;
  end if;

  -- 3. Check enrollment
  if not exists(select 1 from public.enrollments where user_id = _user and course_id = _course) then
    return null;
  end if;

  -- 4. Check lessons completion
  select count(*) into v_lessons from public.lessons where course_id = _course;
  if v_lessons > 0 then
    select count(*) into v_done
    from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
    where l.course_id = _course and lp.user_id = _user;

    if v_done < v_lessons then
      return null;
    end if;
  end if;

  -- 5. Check post-test requirement
  if coalesce(v_course.require_posttest, false) then
    select exists(
      select 1 from public.test_attempts
      where user_id = _user and course_id = _course and kind = 'post' and passed = true
    ), coalesce(max(percent), null)
    into v_post_passed, v_best_score
    from public.test_attempts
    where user_id = _user and course_id = _course and kind = 'post' and passed = true;

    if not coalesce(v_post_passed, false) then
      return null;
    end if;
  else
    v_best_score := 100;
  end if;

  -- 6. Check survey requirement
  if coalesce(v_course.require_survey, false) then
    select exists(
      select 1 from public.survey_responses
      where user_id = _user and course_id = _course
    ) into v_survey_done;

    if not v_survey_done then
      return null;
    end if;
  end if;

  -- 7. All requirements met -> issue or update certificate
  insert into public.certificates(user_id, course_id, cert_no, score)
  values (
    _user,
    _course,
    'CERT-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6)),
    coalesce(v_best_score, 100)
  )
  on conflict (user_id, course_id) do update set
    score = greatest(public.certificates.score, excluded.score)
  returning id into v_cert_id;

  return v_cert_id;
end;
$$;

grant execute on function public.try_issue_certificate(uuid, uuid) to authenticated;

-- Update submit_test to use try_issue_certificate
create or replace function public.submit_test(
  _course uuid,
  _kind text,
  _answers jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r record;
  v_score int := 0;
  v_total int := 0;
  v_pct numeric := 0;
  v_pass int := 80;
  v_passed boolean := false;
  cert_id uuid := null;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if _kind not in ('pre','post') then raise exception 'bad kind'; end if;
  if not exists(select 1 from public.enrollments where user_id=uid and course_id=_course) then raise exception 'not enrolled'; end if;
  if _kind = 'pre' and exists(select 1 from public.test_attempts where user_id=uid and course_id=_course and kind='pre') then
    raise exception 'pre-test already taken';
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
    cert_id := public.try_issue_certificate(_course, uid);
  end if;

  return jsonb_build_object('score', v_score, 'total', v_total, 'percent', v_pct, 'passed', v_passed, 'certificate_id', cert_id);
end;
$$;

-- Trigger on survey_responses
create or replace function public.handle_survey_response_cert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.try_issue_certificate(NEW.course_id, NEW.user_id);
  return NEW;
end;
$$;

drop trigger if exists trg_survey_response_cert on public.survey_responses;
create trigger trg_survey_response_cert
after insert on public.survey_responses
for each row execute function public.handle_survey_response_cert();

-- Trigger on lesson_progress
create or replace function public.handle_lesson_progress_cert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course uuid;
begin
  select course_id into v_course from public.lessons where id = NEW.lesson_id;
  if v_course is not null then
    perform public.try_issue_certificate(v_course, NEW.user_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_lesson_progress_cert on public.lesson_progress;
create trigger trg_lesson_progress_cert
after insert on public.lesson_progress
for each row execute function public.handle_lesson_progress_cert();

-- Clean up certificates for users who haven't completed survey if require_survey is true
delete from public.certificates c
using public.courses cr
where c.course_id = cr.id
  and cr.require_survey = true
  and not exists (
    select 1 from public.survey_responses sr
    where sr.course_id = c.course_id and sr.user_id = c.user_id
  );
