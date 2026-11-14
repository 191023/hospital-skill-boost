-- Migration: Fix Online Course Flow & Timeline Lesson Count (Filter Soft-Deleted Rows)
-- 1. Updates get_my_enrollments() to filter deleted_at IS NULL on lessons, questions, survey_questions, course_sessions, enrollments, and courses,
--    and ensures has_sessions is false when courses.training_type = 'online'.
-- 2. Updates get_team_enrollments() so has_sessions is false when courses.training_type = 'online' and filters e.deleted_at IS NULL.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_enrollments()
RETURNS TABLE(
  course_id uuid,
  course_title text,
  category text,
  hours numeric,
  cover_url text,
  description text,
  pass_score integer,
  training_year integer,
  session_id uuid,
  round_no integer,
  starts_at timestamp with time zone,
  has_sessions boolean,
  require_pretest boolean,
  pre_done boolean,
  attended boolean,
  total_lessons integer,
  lessons_done integer,
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
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    e.course_id,
    c.title AS course_title,
    c.category,
    c.hours,
    c.cover_url,
    c.description,
    c.pass_score,
    c.training_year,
    e.session_id,
    s.round_no,
    s.starts_at,
    (
      coalesce(c.training_type, 'classroom') = 'classroom'
      AND EXISTS(SELECT 1 FROM public.course_sessions cs WHERE cs.course_id = c.id AND cs.deleted_at IS NULL)
    ) AS has_sessions,
    (
      c.require_pretest
      AND EXISTS(SELECT 1 FROM public.questions q WHERE q.course_id = c.id AND q.deleted_at IS NULL)
    ) AS require_pretest,
    EXISTS(
      SELECT 1 FROM public.test_attempts t
      WHERE t.user_id = auth.uid() AND t.course_id = e.course_id AND t.kind = 'pre'
    ) AS pre_done,
    (
      coalesce(c.training_type, 'classroom') = 'online'
      OR EXISTS(SELECT 1 FROM public.attendance a WHERE a.user_id = auth.uid() AND a.course_id = e.course_id)
    ) AS attended,
    (
      SELECT count(*)::int FROM public.lessons l
      WHERE l.course_id = c.id AND l.deleted_at IS NULL
    ) AS total_lessons,
    (
      SELECT count(*)::int FROM public.lesson_progress lp
      JOIN public.lessons l ON l.id = lp.lesson_id
      WHERE lp.user_id = auth.uid() AND l.course_id = c.id AND l.deleted_at IS NULL
    ) AS lessons_done,
    (
      c.require_posttest
      AND EXISTS(SELECT 1 FROM public.questions q WHERE q.course_id = c.id AND q.deleted_at IS NULL)
    ) AS require_posttest,
    EXISTS(
      SELECT 1 FROM public.test_attempts t
      WHERE t.user_id = auth.uid() AND t.course_id = e.course_id AND t.kind = 'post' AND t.passed = true
    ) AS post_done,
    (
      c.require_survey
      AND EXISTS(SELECT 1 FROM public.survey_questions sq WHERE sq.course_id = c.id AND sq.deleted_at IS NULL)
    ) AS require_survey,
    EXISTS(
      SELECT 1 FROM public.survey_responses sr
      WHERE sr.user_id = auth.uid() AND sr.course_id = e.course_id
    ) AS survey_done,
    c.issue_certificate AS issue_certificate,
    EXISTS(
      SELECT 1 FROM public.certificates ce
      WHERE ce.user_id = auth.uid() AND ce.course_id = e.course_id
    ) AS has_cert,
    (
      SELECT max(t.percent) FROM public.test_attempts t
      WHERE t.user_id = auth.uid() AND t.course_id = e.course_id AND t.kind = 'pre'
    ) AS pre_score,
    (
      SELECT max(t.percent) FROM public.test_attempts t
      WHERE t.user_id = auth.uid() AND t.course_id = e.course_id AND t.kind = 'post'
    ) AS post_score,
    (
      SELECT ce.id FROM public.certificates ce
      WHERE ce.user_id = auth.uid() AND ce.course_id = e.course_id
      LIMIT 1
    ) AS cert_id
  FROM public.enrollments e
  JOIN public.courses c ON c.id = e.course_id
  LEFT JOIN public.course_sessions s ON s.id = e.session_id AND s.deleted_at IS NULL
  WHERE auth.uid() IS NOT NULL
    AND e.user_id = auth.uid()
    AND e.deleted_at IS NULL
    AND c.deleted_at IS NULL
  ORDER BY e.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_team_enrollments()
RETURNS TABLE(
  user_id uuid,
  course_id uuid,
  course_title text,
  session_id uuid,
  round_no integer,
  starts_at timestamp with time zone,
  has_sessions boolean,
  require_pretest boolean,
  pre_done boolean,
  attended boolean,
  total_lessons integer,
  lessons_done integer,
  require_posttest boolean,
  post_done boolean,
  require_survey boolean,
  survey_done boolean,
  issue_certificate boolean,
  has_cert boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    e.user_id,
    e.course_id,
    c.title AS course_title,
    e.session_id,
    s.round_no,
    s.starts_at,
    (
      coalesce(c.training_type, 'classroom') = 'classroom'
      AND EXISTS(SELECT 1 FROM public.course_sessions cs WHERE cs.course_id = c.id AND cs.deleted_at IS NULL)
    ) AS has_sessions,
    (
      c.require_pretest
      AND EXISTS(SELECT 1 FROM public.questions q WHERE q.course_id = c.id AND q.deleted_at IS NULL)
    ) AS require_pretest,
    EXISTS(
      SELECT 1 FROM public.test_attempts t
      WHERE t.user_id = e.user_id AND t.course_id = e.course_id AND t.kind = 'pre'
    ) AS pre_done,
    (
      coalesce(c.training_type, 'classroom') = 'online'
      OR EXISTS(SELECT 1 FROM public.attendance a WHERE a.user_id = e.user_id AND a.course_id = e.course_id)
    ) AS attended,
    (
      SELECT count(*)::int FROM public.lessons l
      WHERE l.course_id = c.id AND l.deleted_at IS NULL
    ) AS total_lessons,
    (
      SELECT count(*)::int FROM public.lesson_progress lp
      JOIN public.lessons l ON l.id = lp.lesson_id
      WHERE lp.user_id = e.user_id AND l.course_id = c.id AND l.deleted_at IS NULL
    ) AS lessons_done,
    (
      c.require_posttest
      AND EXISTS(SELECT 1 FROM public.questions q WHERE q.course_id = c.id AND q.deleted_at IS NULL)
    ) AS require_posttest,
    EXISTS(
      SELECT 1 FROM public.test_attempts t
      WHERE t.user_id = e.user_id AND t.course_id = e.course_id AND t.kind = 'post' AND t.passed = true
    ) AS post_done,
    (
      c.require_survey
      AND EXISTS(SELECT 1 FROM public.survey_questions sq WHERE sq.course_id = c.id AND sq.deleted_at IS NULL)
    ) AS require_survey,
    EXISTS(
      SELECT 1 FROM public.survey_responses sr
      WHERE sr.user_id = e.user_id AND sr.course_id = e.course_id
    ) AS survey_done,
    c.issue_certificate AS issue_certificate,
    EXISTS(
      SELECT 1 FROM public.certificates ce
      WHERE ce.user_id = e.user_id AND ce.course_id = e.course_id
    ) AS has_cert
  FROM public.enrollments e
  JOIN public.courses c ON c.id = e.course_id
  LEFT JOIN public.course_sessions s ON s.id = e.session_id AND s.deleted_at IS NULL
  WHERE auth.uid() IS NOT NULL
    AND e.user_id <> auth.uid()
    AND e.deleted_at IS NULL
    AND c.deleted_at IS NULL
    AND public.can_manage_user(auth.uid(), e.user_id)
  ORDER BY c.title, s.round_no NULLS FIRST;
$function$;

COMMIT;
