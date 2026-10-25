-- 0010_my_enrollments_timeline.sql: Fast complete query for learner's enrolled courses with timeline state
CREATE OR REPLACE FUNCTION public.get_my_enrollments()
RETURNS TABLE (
  course_id uuid,
  course_title text,
  category text,
  hours numeric,
  cover_url text,
  description text,
  pass_score int,
  training_year int,
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
  has_cert boolean,
  pre_score numeric,
  post_score numeric,
  cert_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select
    e.course_id,
    c.title as course_title,
    c.category,
    c.hours,
    c.cover_url,
    c.description,
    c.pass_score,
    c.training_year,
    e.session_id,
    s.round_no,
    s.starts_at,
    exists(select 1 from course_sessions cs where cs.course_id = c.id) as has_sessions,
    (c.require_pretest and exists(select 1 from questions q where q.course_id = c.id)) as require_pretest,
    exists(select 1 from test_attempts t where t.user_id = auth.uid() and t.course_id = e.course_id and t.kind = 'pre') as pre_done,
    exists(select 1 from attendance a where a.user_id = auth.uid() and a.course_id = e.course_id) as attended,
    (select count(*)::int from lessons l where l.course_id = c.id) as total_lessons,
    (select count(*)::int from lesson_progress lp join lessons l on l.id = lp.lesson_id where lp.user_id = auth.uid() and l.course_id = c.id) as lessons_done,
    (c.require_posttest and exists(select 1 from questions q where q.course_id = c.id)) as require_posttest,
    exists(select 1 from test_attempts t where t.user_id = auth.uid() and t.course_id = e.course_id and t.kind = 'post' and t.passed = true) as post_done,
    (c.require_survey and exists(select 1 from survey_questions sq where sq.course_id = c.id)) as require_survey,
    exists(select 1 from survey_responses sr where sr.user_id = auth.uid() and sr.course_id = e.course_id) as survey_done,
    c.issue_certificate as issue_certificate,
    exists(select 1 from certificates ce where ce.user_id = auth.uid() and ce.course_id = e.course_id) as has_cert,
    (select max(t.percent) from test_attempts t where t.user_id = auth.uid() and t.course_id = e.course_id and t.kind = 'pre') as pre_score,
    (select max(t.percent) from test_attempts t where t.user_id = auth.uid() and t.course_id = e.course_id and t.kind = 'post') as post_score,
    (select ce.id from certificates ce where ce.user_id = auth.uid() and ce.course_id = e.course_id limit 1) as cert_id
  from enrollments e
  join courses c on c.id = e.course_id
  left join course_sessions s on s.id = e.session_id
  where auth.uid() is not null
    and e.user_id = auth.uid()
  order by e.created_at desc
$$;

GRANT EXECUTE ON FUNCTION public.get_my_enrollments() TO authenticated;
