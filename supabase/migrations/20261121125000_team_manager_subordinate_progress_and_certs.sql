-- Upgrade Team Manager Capabilities:
-- 1. Enhance can_manage_user(_manager, _target) to match both org_unit_id and division/department names of managed units
-- 2. Allow division/department/unit managers to view subordinate certificates and profiles via RLS
-- 3. Expand get_team_enrollments() with pre_score, post_score, checked_at, cert_id, cert_no, cert_issued_at

BEGIN;

-- 1. Enhance can_manage_user to match org_unit_id OR division/department name of managed_units
CREATE OR REPLACE FUNCTION public.can_manage_user(_manager uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _manager IS NOT NULL AND (
    public.has_role(_manager, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = _target
        AND (
          p.org_unit_id IN (SELECT public.managed_units(_manager))
          OR EXISTS (
            SELECT 1
            FROM public.org_units u
            WHERE u.id IN (SELECT public.managed_units(_manager))
              AND (
                (u.kind = 'division' AND p.division = u.name)
                OR (u.kind = 'unit' AND p.department = u.name)
              )
          )
        )
    )
  );
$function$;

-- 2. Allow managers to read subordinate certificates and profiles so /certificates/$certId works for managers
DROP POLICY IF EXISTS "certs read" ON public.certificates;
CREATE POLICY "certs read" ON public.certificates
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_staff(auth.uid())
  OR public.can_manage_user(auth.uid(), user_id)
);

DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_staff(auth.uid())
  OR public.can_manage_user(auth.uid(), id)
);

-- 3. Upgrade get_team_enrollments() to return detailed scores, check-in timestamp, and certificate metadata
DROP FUNCTION IF EXISTS public.get_team_enrollments();

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
  has_cert boolean,
  pre_score numeric,
  post_score numeric,
  checked_at timestamp with time zone,
  cert_id uuid,
  cert_no text,
  cert_issued_at timestamp with time zone
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
    CASE
      WHEN EXISTS(SELECT 1 FROM public.certificates ce WHERE ce.user_id = e.user_id AND ce.course_id = e.course_id)
        OR EXISTS(SELECT 1 FROM public.test_attempts t WHERE t.user_id = e.user_id AND t.course_id = e.course_id AND t.kind = 'post' AND t.passed = true)
      THEN GREATEST(
        (SELECT count(*)::int FROM public.lesson_progress lp JOIN public.lessons l ON l.id = lp.lesson_id WHERE lp.user_id = e.user_id AND l.course_id = c.id AND l.deleted_at IS NULL),
        (SELECT count(*)::int FROM public.lessons l WHERE l.course_id = c.id AND l.deleted_at IS NULL)
      )
      ELSE (
        SELECT count(*)::int FROM public.lesson_progress lp
        JOIN public.lessons l ON l.id = lp.lesson_id
        WHERE lp.user_id = e.user_id AND l.course_id = c.id AND l.deleted_at IS NULL
      )
    END AS lessons_done,
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
    ) AS has_cert,
    (
      SELECT max(t.percent) FROM public.test_attempts t
      WHERE t.user_id = e.user_id AND t.course_id = e.course_id AND t.kind = 'pre'
    ) AS pre_score,
    (
      SELECT max(t.percent) FROM public.test_attempts t
      WHERE t.user_id = e.user_id AND t.course_id = e.course_id AND t.kind = 'post'
    ) AS post_score,
    (
      SELECT max(a.checked_at) FROM public.attendance a
      WHERE a.user_id = e.user_id AND a.course_id = e.course_id
    ) AS checked_at,
    (
      SELECT ce.id FROM public.certificates ce
      WHERE ce.user_id = e.user_id AND ce.course_id = e.course_id
      LIMIT 1
    ) AS cert_id,
    (
      SELECT ce.cert_no FROM public.certificates ce
      WHERE ce.user_id = e.user_id AND ce.course_id = e.course_id
      LIMIT 1
    ) AS cert_no,
    (
      SELECT ce.issued_at FROM public.certificates ce
      WHERE ce.user_id = e.user_id AND ce.course_id = e.course_id
      LIMIT 1
    ) AS cert_issued_at
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

REVOKE ALL ON FUNCTION public.get_team_enrollments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_enrollments() TO authenticated;

COMMIT;
