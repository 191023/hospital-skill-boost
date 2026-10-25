-- Update get_team_enrollments with rich timeline data
DROP FUNCTION IF EXISTS public.get_team_enrollments();

CREATE OR REPLACE FUNCTION public.get_team_enrollments()
RETURNS TABLE (
  user_id uuid,
  course_id uuid,
  course_title text,
  session_id uuid,
  round_no int,
  starts_at timestamptz,
  has_sessions boolean,
  require_pretest boolean,
  pre_done boolean,
  attended boolean,
  total_lessons int,
  lessons_done int,
  require_posttest boolean,
  post_done boolean,
  require_survey boolean,
  survey_done boolean,
  issue_certificate boolean,
  has_cert boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select
    e.user_id,
    e.course_id,
    c.title as course_title,
    e.session_id,
    s.round_no,
    s.starts_at,
    exists(select 1 from course_sessions cs where cs.course_id = c.id) as has_sessions,
    (c.require_pretest and exists(select 1 from questions q where q.course_id = c.id)) as require_pretest,
    exists(select 1 from test_attempts t where t.user_id = e.user_id and t.course_id = e.course_id and t.kind = 'pre') as pre_done,
    exists(select 1 from attendance a where a.user_id = e.user_id and a.course_id = e.course_id) as attended,
    (select count(*)::int from lessons l where l.course_id = c.id) as total_lessons,
    (select count(*)::int from lesson_progress lp join lessons l on l.id = lp.lesson_id where lp.user_id = e.user_id and l.course_id = c.id) as lessons_done,
    (c.require_posttest and exists(select 1 from questions q where q.course_id = c.id)) as require_posttest,
    exists(select 1 from test_attempts t where t.user_id = e.user_id and t.course_id = e.course_id and t.kind = 'post' and t.passed = true) as post_done,
    (c.require_survey and exists(select 1 from survey_questions sq where sq.course_id = c.id)) as require_survey,
    exists(select 1 from survey_responses sr where sr.user_id = e.user_id and sr.course_id = e.course_id) as survey_done,
    c.issue_certificate as issue_certificate,
    exists(select 1 from certificates ce where ce.user_id = e.user_id and ce.course_id = e.course_id) as has_cert
  from enrollments e
  join courses c on c.id = e.course_id
  left join course_sessions s on s.id = e.session_id
  where auth.uid() is not null
    and e.user_id <> auth.uid()
    and public.can_manage_user(auth.uid(), e.user_id)
  order by c.title, s.round_no nulls first
$$;

GRANT EXECUTE ON FUNCTION public.get_team_enrollments() TO authenticated;
