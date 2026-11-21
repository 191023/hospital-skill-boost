-- Protect learners who already passed Post-test or earned a certificate when instructors add/edit lessons later

-- 1. Update try_issue_certificate(_course, _user) so lessons added after passing Post-test do not block certificate issuance
CREATE OR REPLACE FUNCTION public.try_issue_certificate(_course uuid, _user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_course record;
  v_lessons int := 0;
  v_done int := 0;
  v_post_passed boolean := false;
  v_best_score numeric := null;
  v_post_passed_at timestamptz := null;
  v_survey_done boolean := false;
  v_cert_id uuid := null;
BEGIN
  -- 1. Fetch course settings
  SELECT * INTO v_course FROM public.courses WHERE id = _course AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN null;
  END IF;

  -- 2. Check if course issues certificate
  IF NOT coalesce(v_course.issue_certificate, false) THEN
    RETURN null;
  END IF;

  -- 3. Check active enrollment
  IF NOT EXISTS(SELECT 1 FROM public.enrollments WHERE user_id = _user AND course_id = _course AND deleted_at IS NULL) THEN
    RETURN null;
  END IF;

  -- 4. Check post-test requirement first so we know if/when learner passed Post-test
  IF coalesce(v_course.require_posttest, false) THEN
    SELECT
      EXISTS(
        SELECT 1 FROM public.test_attempts
        WHERE user_id = _user AND course_id = _course AND kind = 'post' AND passed = true
      ),
      coalesce(max(percent), null),
      max(created_at)
    INTO v_post_passed, v_best_score, v_post_passed_at
    FROM public.test_attempts
    WHERE user_id = _user AND course_id = _course AND kind = 'post' AND passed = true;

    IF NOT coalesce(v_post_passed, false) THEN
      RETURN null;
    END IF;
  ELSE
    v_best_score := 100;
  END IF;

  -- 5. Check active lessons completion
  -- If learner already passed Post-test, only require lessons created on or before they passed Post-test
  SELECT count(*) INTO v_lessons
  FROM public.lessons l
  WHERE l.course_id = _course
    AND l.deleted_at IS NULL
    AND (v_post_passed_at IS NULL OR l.created_at <= v_post_passed_at);

  IF v_lessons > 0 THEN
    SELECT count(*) INTO v_done
    FROM public.lesson_progress lp
    JOIN public.lessons l ON l.id = lp.lesson_id
    WHERE l.course_id = _course
      AND l.deleted_at IS NULL
      AND lp.user_id = _user
      AND (v_post_passed_at IS NULL OR l.created_at <= v_post_passed_at);

    IF v_done < v_lessons THEN
      RETURN null;
    END IF;
  END IF;

  -- 6. Check survey requirement
  IF coalesce(v_course.require_survey, false) THEN
    SELECT EXISTS(
      SELECT 1 FROM public.survey_responses
      WHERE user_id = _user AND course_id = _course
    ) INTO v_survey_done;

    IF NOT v_survey_done THEN
      RETURN null;
    END IF;
  END IF;

  -- 7. All requirements met -> issue or update certificate
  INSERT INTO public.certificates(user_id, course_id, cert_no, score)
  VALUES (
    _user,
    _course,
    'CERT-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6)),
    coalesce(v_best_score, 100)
  )
  ON CONFLICT (user_id, course_id) DO UPDATE SET
    score = greatest(public.certificates.score, excluded.score)
  RETURNING id INTO v_cert_id;

  RETURN v_cert_id;
END;
$function$;

-- 2. Update get_my_enrollments() so learners who have a certificate or passed Post-test retain 100% lesson progress even if new lessons are added later
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
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    c.id AS course_id,
    c.title AS course_title,
    c.category,
    c.hours,
    c.cover_url,
    c.description,
    c.pass_score,
    c.training_year,
    e.session_id,
    cs.round_no,
    cs.starts_at,
    (coalesce(c.training_type, 'classroom') = 'classroom' AND EXISTS(
      SELECT 1 FROM public.course_sessions s
      WHERE s.course_id = c.id AND s.deleted_at IS NULL
    )) AS has_sessions,
    (coalesce(c.require_pretest, true) AND EXISTS(
      SELECT 1 FROM public.questions q
      WHERE q.course_id = c.id AND q.deleted_at IS NULL
    )) AS require_pretest,
    EXISTS(
      SELECT 1 FROM public.test_attempts ta
      WHERE ta.user_id = e.user_id AND ta.course_id = c.id AND ta.kind = 'pre'
    ) AS pre_done,
    (coalesce(c.training_type, 'classroom') <> 'classroom' OR EXISTS(
      SELECT 1 FROM public.attendance a
      WHERE a.user_id = e.user_id AND a.course_id = c.id
    )) AS attended,
    (
      SELECT count(*)::int FROM public.lessons l
      WHERE l.course_id = c.id AND l.deleted_at IS NULL
    ) AS total_lessons,
    CASE
      WHEN EXISTS(SELECT 1 FROM public.certificates cert WHERE cert.user_id = e.user_id AND cert.course_id = c.id)
        OR EXISTS(SELECT 1 FROM public.test_attempts ta WHERE ta.user_id = e.user_id AND ta.course_id = c.id AND ta.kind = 'post' AND ta.passed = true)
      THEN (
        SELECT count(*)::int FROM public.lessons l
        WHERE l.course_id = c.id AND l.deleted_at IS NULL
      )
      ELSE (
        SELECT count(*)::int FROM public.lesson_progress lp
        JOIN public.lessons l ON l.id = lp.lesson_id
        WHERE lp.user_id = e.user_id AND l.course_id = c.id AND l.deleted_at IS NULL
      )
    END AS lessons_done,
    (coalesce(c.require_posttest, true) AND EXISTS(
      SELECT 1 FROM public.questions q
      WHERE q.course_id = c.id AND q.deleted_at IS NULL
    )) AS require_posttest,
    EXISTS(
      SELECT 1 FROM public.test_attempts ta
      WHERE ta.user_id = e.user_id AND ta.course_id = c.id AND ta.kind = 'post' AND ta.passed = true
    ) AS post_done,
    coalesce(c.require_survey, false) AS require_survey,
    EXISTS(
      SELECT 1 FROM public.survey_responses sr
      WHERE sr.user_id = e.user_id AND sr.course_id = c.id
    ) AS survey_done,
    coalesce(c.issue_certificate, true) AS issue_certificate,
    EXISTS(
      SELECT 1 FROM public.certificates cert
      WHERE cert.user_id = e.user_id AND cert.course_id = c.id
    ) AS has_cert,
    (
      SELECT ta.percent FROM public.test_attempts ta
      WHERE ta.user_id = e.user_id AND ta.course_id = c.id AND ta.kind = 'pre'
      ORDER BY ta.created_at ASC LIMIT 1
    ) AS pre_score,
    (
      SELECT max(ta.percent) FROM public.test_attempts ta
      WHERE ta.user_id = e.user_id AND ta.course_id = c.id AND ta.kind = 'post'
    ) AS post_score,
    (
      SELECT cert.id FROM public.certificates cert
      WHERE cert.user_id = e.user_id AND cert.course_id = c.id
      LIMIT 1
    ) AS cert_id
  FROM public.enrollments e
  JOIN public.courses c ON c.id = e.course_id
  LEFT JOIN public.course_sessions cs ON cs.id = e.session_id AND cs.deleted_at IS NULL
  WHERE e.user_id = auth.uid()
    AND e.deleted_at IS NULL
    AND c.deleted_at IS NULL
  ORDER BY e.created_at DESC;
$function$;

-- 3. Update get_team_enrollments() with the same protection
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
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    e.user_id,
    c.id AS course_id,
    c.title AS course_title,
    e.session_id,
    cs.round_no,
    cs.starts_at,
    (coalesce(c.training_type, 'classroom') = 'classroom' AND EXISTS(
      SELECT 1 FROM public.course_sessions s
      WHERE s.course_id = c.id AND s.deleted_at IS NULL
    )) AS has_sessions,
    (coalesce(c.require_pretest, true) AND EXISTS(
      SELECT 1 FROM public.questions q
      WHERE q.course_id = c.id AND q.deleted_at IS NULL
    )) AS require_pretest,
    EXISTS(
      SELECT 1 FROM public.test_attempts ta
      WHERE ta.user_id = e.user_id AND ta.course_id = c.id AND ta.kind = 'pre'
    ) AS pre_done,
    (coalesce(c.training_type, 'classroom') <> 'classroom' OR EXISTS(
      SELECT 1 FROM public.attendance a
      WHERE a.user_id = e.user_id AND a.course_id = c.id
    )) AS attended,
    (
      SELECT count(*)::int FROM public.lessons l
      WHERE l.course_id = c.id AND l.deleted_at IS NULL
    ) AS total_lessons,
    CASE
      WHEN EXISTS(SELECT 1 FROM public.certificates cert WHERE cert.user_id = e.user_id AND cert.course_id = c.id)
        OR EXISTS(SELECT 1 FROM public.test_attempts ta WHERE ta.user_id = e.user_id AND ta.course_id = c.id AND ta.kind = 'post' AND ta.passed = true)
      THEN (
        SELECT count(*)::int FROM public.lessons l
        WHERE l.course_id = c.id AND l.deleted_at IS NULL
      )
      ELSE (
        SELECT count(*)::int FROM public.lesson_progress lp
        JOIN public.lessons l ON l.id = lp.lesson_id
        WHERE lp.user_id = e.user_id AND l.course_id = c.id AND l.deleted_at IS NULL
      )
    END AS lessons_done,
    (coalesce(c.require_posttest, true) AND EXISTS(
      SELECT 1 FROM public.questions q
      WHERE q.course_id = c.id AND q.deleted_at IS NULL
    )) AS require_posttest,
    EXISTS(
      SELECT 1 FROM public.test_attempts ta
      WHERE ta.user_id = e.user_id AND ta.course_id = c.id AND ta.kind = 'post' AND ta.passed = true
    ) AS post_done,
    coalesce(c.require_survey, false) AS require_survey,
    EXISTS(
      SELECT 1 FROM public.survey_responses sr
      WHERE sr.user_id = e.user_id AND sr.course_id = c.id
    ) AS survey_done,
    coalesce(c.issue_certificate, true) AS issue_certificate,
    EXISTS(
      SELECT 1 FROM public.certificates cert
      WHERE cert.user_id = e.user_id AND cert.course_id = c.id
    ) AS has_cert
  FROM public.enrollments e
  JOIN public.courses c ON c.id = e.course_id
  LEFT JOIN public.course_sessions cs ON cs.id = e.session_id AND cs.deleted_at IS NULL
  WHERE e.deleted_at IS NULL
    AND c.deleted_at IS NULL
    AND (
      public.is_staff(auth.uid())
      OR public.can_manage_user(auth.uid(), e.user_id)
      OR e.user_id = auth.uid()
    )
  ORDER BY e.created_at DESC;
$function$;
