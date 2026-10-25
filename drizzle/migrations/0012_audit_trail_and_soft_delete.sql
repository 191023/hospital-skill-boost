-- 0012_audit_trail_and_soft_delete.sql: Enterprise Audit Trail & Soft Delete Protection
-- Principles:
-- 1. Automatic tracking of created_at, created_by, updated_at, updated_by
-- 2. Master records are never physically destroyed; soft-delete via deleted_at and deleted_by

-- 1. Add audit columns and soft-delete columns to master tables
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

ALTER TABLE public.course_sessions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

ALTER TABLE public.survey_questions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

ALTER TABLE public.org_units
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

-- Initialize existing rows
UPDATE public.courses SET updated_at = coalesce(updated_at, created_at, now()) WHERE updated_at IS NULL;
UPDATE public.course_sessions SET updated_at = coalesce(updated_at, created_at, now()) WHERE updated_at IS NULL;
UPDATE public.lessons SET updated_at = coalesce(updated_at, created_at, now()) WHERE updated_at IS NULL;
UPDATE public.questions SET created_at = coalesce(created_at, now()), updated_at = coalesce(updated_at, now()) WHERE updated_at IS NULL;
UPDATE public.survey_questions SET updated_at = coalesce(updated_at, created_at, now()) WHERE updated_at IS NULL;
UPDATE public.org_units SET updated_at = coalesce(updated_at, created_at, now()) WHERE updated_at IS NULL;
UPDATE public.profiles SET updated_at = coalesce(updated_at, created_at, now()) WHERE updated_at IS NULL;

-- 2. Audit Triggers: Automatic created_by on INSERT, updated_at/updated_by on UPDATE
CREATE OR REPLACE FUNCTION public.handle_audit_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  IF NEW.updated_at IS NULL THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_audit_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Drop and recreate triggers
DROP TRIGGER IF EXISTS trg_courses_audit_insert ON public.courses;
CREATE TRIGGER trg_courses_audit_insert BEFORE INSERT ON public.courses FOR EACH ROW EXECUTE FUNCTION public.handle_audit_insert();

DROP TRIGGER IF EXISTS trg_courses_audit_update ON public.courses;
CREATE TRIGGER trg_courses_audit_update BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.handle_audit_update();

DROP TRIGGER IF EXISTS trg_course_sessions_audit_insert ON public.course_sessions;
CREATE TRIGGER trg_course_sessions_audit_insert BEFORE INSERT ON public.course_sessions FOR EACH ROW EXECUTE FUNCTION public.handle_audit_insert();

DROP TRIGGER IF EXISTS trg_course_sessions_audit_update ON public.course_sessions;
CREATE TRIGGER trg_course_sessions_audit_update BEFORE UPDATE ON public.course_sessions FOR EACH ROW EXECUTE FUNCTION public.handle_audit_update();

DROP TRIGGER IF EXISTS trg_lessons_audit_insert ON public.lessons;
CREATE TRIGGER trg_lessons_audit_insert BEFORE INSERT ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.handle_audit_insert();

DROP TRIGGER IF EXISTS trg_lessons_audit_update ON public.lessons;
CREATE TRIGGER trg_lessons_audit_update BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.handle_audit_update();

DROP TRIGGER IF EXISTS trg_questions_audit_insert ON public.questions;
CREATE TRIGGER trg_questions_audit_insert BEFORE INSERT ON public.questions FOR EACH ROW EXECUTE FUNCTION public.handle_audit_insert();

DROP TRIGGER IF EXISTS trg_questions_audit_update ON public.questions;
CREATE TRIGGER trg_questions_audit_update BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.handle_audit_update();

DROP TRIGGER IF EXISTS trg_survey_questions_audit_insert ON public.survey_questions;
CREATE TRIGGER trg_survey_questions_audit_insert BEFORE INSERT ON public.survey_questions FOR EACH ROW EXECUTE FUNCTION public.handle_audit_insert();

DROP TRIGGER IF EXISTS trg_survey_questions_audit_update ON public.survey_questions;
CREATE TRIGGER trg_survey_questions_audit_update BEFORE UPDATE ON public.survey_questions FOR EACH ROW EXECUTE FUNCTION public.handle_audit_update();

DROP TRIGGER IF EXISTS trg_org_units_audit_insert ON public.org_units;
CREATE TRIGGER trg_org_units_audit_insert BEFORE INSERT ON public.org_units FOR EACH ROW EXECUTE FUNCTION public.handle_audit_insert();

DROP TRIGGER IF EXISTS trg_org_units_audit_update ON public.org_units;
CREATE TRIGGER trg_org_units_audit_update BEFORE UPDATE ON public.org_units FOR EACH ROW EXECUTE FUNCTION public.handle_audit_update();

DROP TRIGGER IF EXISTS trg_profiles_audit_update ON public.profiles;
CREATE TRIGGER trg_profiles_audit_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_audit_update();

-- 3. Soft Delete Interceptor Trigger (Cancels physical DELETE, performs Soft Delete UPDATE)
CREATE OR REPLACE FUNCTION public.handle_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I.%I SET deleted_at = now(), deleted_by = $1 WHERE id = $2',
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME
  ) USING auth.uid(), OLD.id;
  RETURN NULL; -- Abort physical delete!
END;
$$;

DROP TRIGGER IF EXISTS trg_courses_soft_delete ON public.courses;
CREATE TRIGGER trg_courses_soft_delete BEFORE DELETE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.handle_soft_delete();

DROP TRIGGER IF EXISTS trg_course_sessions_soft_delete ON public.course_sessions;
CREATE TRIGGER trg_course_sessions_soft_delete BEFORE DELETE ON public.course_sessions FOR EACH ROW EXECUTE FUNCTION public.handle_soft_delete();

DROP TRIGGER IF EXISTS trg_lessons_soft_delete ON public.lessons;
CREATE TRIGGER trg_lessons_soft_delete BEFORE DELETE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.handle_soft_delete();

DROP TRIGGER IF EXISTS trg_questions_soft_delete ON public.questions;
CREATE TRIGGER trg_questions_soft_delete BEFORE DELETE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.handle_soft_delete();

DROP TRIGGER IF EXISTS trg_survey_questions_soft_delete ON public.survey_questions;
CREATE TRIGGER trg_survey_questions_soft_delete BEFORE DELETE ON public.survey_questions FOR EACH ROW EXECUTE FUNCTION public.handle_soft_delete();

DROP TRIGGER IF EXISTS trg_org_units_soft_delete ON public.org_units;
CREATE TRIGGER trg_org_units_soft_delete BEFORE DELETE ON public.org_units FOR EACH ROW EXECUTE FUNCTION public.handle_soft_delete();

-- 4. Update Row Level Security Policies to filter deleted_at IS NULL
DROP POLICY IF EXISTS "courses read" ON public.courses;
CREATE POLICY "courses read" ON public.courses FOR SELECT TO authenticated
USING (((published AND public.is_approved(auth.uid()) AND public.can_access_course(id, auth.uid())) OR public.is_staff(auth.uid())) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "sessions read" ON public.course_sessions;
CREATE POLICY "sessions read" ON public.course_sessions FOR SELECT TO authenticated
USING ((public.can_edit_course(course_id) OR public.is_staff(auth.uid()) OR (public.is_approved(auth.uid()) AND public.can_access_course(course_id, auth.uid()))) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "lessons read" ON public.lessons;
CREATE POLICY "lessons read" ON public.lessons FOR SELECT TO authenticated
USING ((EXISTS (SELECT 1 FROM public.courses c WHERE c.id = lessons.course_id AND c.deleted_at IS NULL)) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "org units read" ON public.org_units;
CREATE POLICY "org units read" ON public.org_units FOR SELECT TO authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "questions staff" ON public.questions;
CREATE POLICY "questions staff" ON public.questions FOR ALL TO authenticated
USING (public.can_edit_course(course_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "read survey q" ON public.survey_questions;
CREATE POLICY "read survey q" ON public.survey_questions FOR SELECT TO authenticated
USING ((public.can_edit_course(course_id) OR public.can_access_course(course_id, auth.uid())) AND deleted_at IS NULL);

-- 5. Update DB Functions to filter deleted_at IS NULL
CREATE OR REPLACE FUNCTION public.get_test_questions(_course uuid)
RETURNS TABLE(id uuid, question text, options jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.question, q.options FROM public.questions q
  JOIN public.courses c ON c.id = q.course_id
  WHERE q.course_id = _course 
    AND q.deleted_at IS NULL 
    AND c.deleted_at IS NULL
    AND ((c.published AND public.is_approved(auth.uid())) OR public.is_staff(auth.uid()))
  ORDER BY q.position, q.id;
$$;

CREATE OR REPLACE FUNCTION public.get_team_members()
RETURNS TABLE(user_id uuid, full_name text, "position" text, division text, department text, org_unit_id uuid, approved boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, coalesce(p."position", ''), coalesce(p.division, ''), coalesce(p.department, ''), p.org_unit_id, p.approved
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL 
    AND p.id <> auth.uid() 
    AND p.deleted_at IS NULL
    AND public.can_manage_user(auth.uid(), p.id)
  ORDER BY p.division, p.department, p.full_name;
$$;

CREATE OR REPLACE FUNCTION public.get_team_enrollments()
RETURNS TABLE(
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    e.user_id,
    e.course_id,
    c.title AS course_title,
    e.session_id,
    s.round_no,
    s.starts_at,
    EXISTS(SELECT 1 FROM public.course_sessions cs WHERE cs.course_id = c.id AND cs.deleted_at IS NULL) AS has_sessions,
    (c.require_pretest AND EXISTS(SELECT 1 FROM public.questions q WHERE q.course_id = c.id AND q.deleted_at IS NULL)) AS require_pretest,
    EXISTS(SELECT 1 FROM public.test_attempts t WHERE t.user_id = e.user_id AND t.course_id = e.course_id AND t.kind = 'pre') AS pre_done,
    EXISTS(SELECT 1 FROM public.attendance a WHERE a.user_id = e.user_id AND a.course_id = e.course_id) AS attended,
    (SELECT count(*)::int FROM public.lessons l WHERE l.course_id = c.id AND l.deleted_at IS NULL) AS total_lessons,
    (SELECT count(*)::int FROM public.lesson_progress lp JOIN public.lessons l ON l.id = lp.lesson_id WHERE lp.user_id = e.user_id AND l.course_id = c.id AND l.deleted_at IS NULL) AS lessons_done,
    (c.require_posttest AND EXISTS(SELECT 1 FROM public.questions q WHERE q.course_id = c.id AND q.deleted_at IS NULL)) AS require_posttest,
    EXISTS(SELECT 1 FROM public.test_attempts t WHERE t.user_id = e.user_id AND t.course_id = e.course_id AND t.kind = 'post' AND t.passed = true) AS post_done,
    (c.require_survey AND EXISTS(SELECT 1 FROM public.survey_questions sq WHERE sq.course_id = c.id AND sq.deleted_at IS NULL)) AS require_survey,
    EXISTS(SELECT 1 FROM public.survey_responses sr WHERE sr.user_id = e.user_id AND sr.course_id = e.course_id) AS survey_done,
    c.issue_certificate AS issue_certificate,
    EXISTS(SELECT 1 FROM public.certificates ce WHERE ce.user_id = e.user_id AND ce.course_id = e.course_id) AS has_cert
  FROM public.enrollments e
  JOIN public.courses c ON c.id = e.course_id
  LEFT JOIN public.course_sessions s ON s.id = e.session_id
  WHERE auth.uid() IS NOT NULL
    AND e.user_id <> auth.uid()
    AND c.deleted_at IS NULL
    AND public.can_manage_user(auth.uid(), e.user_id)
  ORDER BY c.title, s.round_no NULLS FIRST;
$$;

-- 6. Partial Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_courses_active ON public.courses (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_course_sessions_active ON public.course_sessions (course_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lessons_active ON public.lessons (course_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_active ON public.questions (course_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_survey_questions_active ON public.survey_questions (course_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_units_active ON public.org_units (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles (id) WHERE deleted_at IS NULL;
