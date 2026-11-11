-- Migration: Production Performance Optimization & Soft-Delete Hardening
-- File: supabase/migrations/20261111220000_production_perf_and_soft_delete_hardening.sql

-- ============================================================================
-- 1. PRODUCTION PERFORMANCE INDEXES
-- ============================================================================

-- 1.1 Course catalog & active courses lookup with ordering (eliminates Seq Scan & sort)
CREATE INDEX IF NOT EXISTS idx_courses_published_year 
  ON public.courses (published, training_year DESC, created_at DESC) 
  WHERE (deleted_at IS NULL);

-- 1.2 Enrollments by session (speeds up choose_session, session_seats, foreign key index)
CREATE INDEX IF NOT EXISTS idx_enrollments_session 
  ON public.enrollments (session_id) 
  WHERE (session_id IS NOT NULL AND deleted_at IS NULL);

-- 1.3 Enrollments course ordering (used by 3D room every 10s: eq course_id, order created_at, user_id)
CREATE INDEX IF NOT EXISTS idx_enrollments_course_ordering 
  ON public.enrollments (course_id, created_at ASC, user_id ASC) 
  WHERE (deleted_at IS NULL);

-- 1.4 Lesson progress reverse lookup by lesson_id (speeds up .in("lesson_id", ...) in reports and cert checks)
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson_lookup 
  ON public.lesson_progress (lesson_id, user_id);

-- 1.5 Lessons course & position ordering (speeds up course editor and learner lesson navigation)
CREATE INDEX IF NOT EXISTS idx_lessons_course_position 
  ON public.lessons (course_id, position ASC) 
  WHERE (deleted_at IS NULL);

-- 1.6 Questions course & position ordering (speeds up get_test_questions)
CREATE INDEX IF NOT EXISTS idx_questions_course_position 
  ON public.questions (course_id, position ASC, id) 
  WHERE (deleted_at IS NULL);

-- 1.7 Attendance by user_id (foreign key index, prevents table scan on user check)
CREATE INDEX IF NOT EXISTS idx_attendance_user 
  ON public.attendance (user_id);

-- 1.8 Profiles active lookup by approval and name
CREATE INDEX IF NOT EXISTS idx_profiles_approved_fullname 
  ON public.profiles (approved, full_name) 
  WHERE (deleted_at IS NULL);

-- 1.9 Profiles active lookup by division & department
CREATE INDEX IF NOT EXISTS idx_profiles_division_dept 
  ON public.profiles (division, department) 
  WHERE (deleted_at IS NULL);

-- 1.10 Org unit managers foreign key index
CREATE INDEX IF NOT EXISTS idx_org_unit_managers_unit_id 
  ON public.org_unit_managers (org_unit_id);

-- ============================================================================
-- 2. DATABASE FUNCTIONS HARDENING (Filter deleted_at IS NULL)
-- ============================================================================

-- 2.1 submit_test: ensure questions count and evaluation ignore soft-deleted questions
CREATE OR REPLACE FUNCTION public.submit_test(
  _course uuid,
  _kind text,
  _answers jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r record;
  v_score int := 0;
  v_total int := 0;
  v_pct numeric := 0;
  v_pass int := 80;
  v_passed boolean := false;
  cert_id uuid := null;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _kind NOT IN ('pre','post') THEN RAISE EXCEPTION 'bad kind'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.enrollments WHERE user_id = uid AND course_id = _course AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'not enrolled';
  END IF;
  
  IF _kind = 'pre' AND EXISTS(SELECT 1 FROM public.test_attempts WHERE user_id = uid AND course_id = _course AND kind = 'pre') THEN
    RAISE EXCEPTION 'pre-test already taken';
  END IF;

  SELECT pass_score INTO v_pass FROM public.courses WHERE id = _course AND deleted_at IS NULL;
  
  -- Must filter deleted_at IS NULL so deleted questions do not corrupt score calculation
  SELECT count(*) INTO v_total FROM public.questions WHERE course_id = _course AND deleted_at IS NULL;
  IF v_total = 0 THEN RAISE EXCEPTION 'no questions'; END IF;

  FOR r IN SELECT id, correct_index FROM public.questions WHERE course_id = _course AND deleted_at IS NULL LOOP
    IF (_answers->>(r.id::text))::int = r.correct_index THEN 
      v_score := v_score + 1; 
    END IF;
  END LOOP;

  v_pct := round(v_score::numeric * 100 / v_total, 1);
  v_passed := v_pct >= v_pass;

  INSERT INTO public.test_attempts(user_id, course_id, kind, score, total, percent, passed)
  VALUES (uid, _course, _kind, v_score, v_total, v_pct, v_passed);

  IF _kind = 'post' AND v_passed THEN
    cert_id := public.try_issue_certificate(_course, uid);
  END IF;

  RETURN jsonb_build_object('score', v_score, 'total', v_total, 'percent', v_pct, 'passed', v_passed, 'certificate_id', cert_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_test(uuid, text, jsonb) TO authenticated;

-- 2.2 try_issue_certificate: ensure lesson counts ignore soft-deleted lessons
CREATE OR REPLACE FUNCTION public.try_issue_certificate(
  _course uuid,
  _user uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course record;
  v_lessons int := 0;
  v_done int := 0;
  v_post_passed boolean := false;
  v_best_score numeric := null;
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

  -- 4. Check active lessons completion (filter deleted_at IS NULL)
  SELECT count(*) INTO v_lessons FROM public.lessons WHERE course_id = _course AND deleted_at IS NULL;
  IF v_lessons > 0 THEN
    SELECT count(*) INTO v_done
    FROM public.lesson_progress lp
    JOIN public.lessons l ON l.id = lp.lesson_id
    WHERE l.course_id = _course AND l.deleted_at IS NULL AND lp.user_id = _user;

    IF v_done < v_lessons THEN
      RETURN null;
    END IF;
  END IF;

  -- 5. Check post-test requirement
  IF coalesce(v_course.require_posttest, false) THEN
    SELECT EXISTS(
      SELECT 1 FROM public.test_attempts
      WHERE user_id = _user AND course_id = _course AND kind = 'post' AND passed = true
    ), coalesce(max(percent), null)
    INTO v_post_passed, v_best_score
    FROM public.test_attempts
    WHERE user_id = _user AND course_id = _course AND kind = 'post' AND passed = true;

    IF NOT coalesce(v_post_passed, false) THEN
      RETURN null;
    END IF;
  ELSE
    v_best_score := 100;
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
$$;

GRANT EXECUTE ON FUNCTION public.try_issue_certificate(uuid, uuid) TO authenticated;

-- Keep 1-parameter overload for backwards compatibility if needed
CREATE OR REPLACE FUNCTION public.try_issue_certificate(
  _course uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.try_issue_certificate(_course, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_issue_certificate(uuid) TO authenticated;
