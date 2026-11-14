-- Migration: Production Go-Live Data Reset
-- Preserves:
--   1. Organization structure (public.org_units)
--   2. System settings & branding (public.system_settings + storage system/hospital-logo.png)
--   3. 5 Main course templates (Fire Safety, Chemical Safety, CPR/AED, IC, Cybersecurity/PDPA)
--   4. 2 Admin accounts: aoaa.supinda@gmail.com and naturelife19@gmail.com (both granted admin, instructor, learner)
-- Wipes:
--   All test accounts, enrollments, attendance, test attempts, issued certificates, survey responses, test activity photos, and logs.

BEGIN;

-- 1. Temporarily disable soft-delete and audit triggers during physical cleanup
ALTER TABLE public.courses DISABLE TRIGGER trg_courses_soft_delete;
ALTER TABLE public.lessons DISABLE TRIGGER trg_lessons_soft_delete;
ALTER TABLE public.questions DISABLE TRIGGER trg_questions_soft_delete;
ALTER TABLE public.course_sessions DISABLE TRIGGER trg_course_sessions_soft_delete;
ALTER TABLE public.survey_questions DISABLE TRIGGER trg_survey_questions_soft_delete;
ALTER TABLE public.user_roles DISABLE TRIGGER log_role_change_trg;
ALTER TABLE public.profiles DISABLE TRIGGER log_profile_change_trg;
ALTER TABLE public.profiles DISABLE TRIGGER protect_profile_trg;

-- 2. Wipe all learner activity, test attempts, certificates, survey responses, and logs
TRUNCATE TABLE
  public.attendance,
  public.certificates,
  public.enrollments,
  public.lesson_progress,
  public.test_attempts,
  public.survey_responses,
  public.survey_summaries,
  public.course_activity_photos,
  public.notification_logs,
  public.member_audit_log
RESTART IDENTITY CASCADE;

-- 3. Remove draft/test courses (keep only the 5 main published hospital courses)
DELETE FROM public.courses
WHERE id NOT IN (
  'c319aeb6-c2da-4660-b5cd-35a9257ebab9', -- การดับเพลิงขั้นต้นและการใช้ถังดับเพลิง
  'e7b233f4-b927-4859-bc6e-e50ce9d81e5c', -- การใช้และการจัดเก็บสารเคมีอย่างปลอดภัย
  'b1000000-0000-4000-8000-000000000001', -- การช่วยฟื้นคืนชีพขั้นพื้นฐานและการใช้เครื่อง AED
  'b1000000-0000-4000-8000-000000000002', -- มาตรฐานการป้องกันและควบคุมการติดเชื้อในโรงพยาบาล (IC)
  'b1000000-0000-4000-8000-000000000003'  -- ความมั่นคงปลอดภัยไซเบอร์และคุ้มครองข้อมูลผู้ป่วย (Cybersecurity & PDPA)
);

-- Physically purge any soft-deleted items inside the 5 kept courses
DELETE FROM public.lessons WHERE deleted_at IS NOT NULL;
DELETE FROM public.questions WHERE deleted_at IS NOT NULL;
DELETE FROM public.course_sessions WHERE deleted_at IS NOT NULL;
DELETE FROM public.survey_questions WHERE deleted_at IS NOT NULL;

-- 4. Clear audit user references (created_by, updated_by, deleted_by) pointing to test accounts
DO $$
DECLARE
  keep_ids uuid[];
BEGIN
  SELECT ARRAY_AGG(id) INTO keep_ids
  FROM auth.users
  WHERE lower(email) IN ('aoaa.supinda@gmail.com', 'naturelife19@gmail.com');

  UPDATE public.org_units
  SET created_by = CASE WHEN created_by = ANY(keep_ids) THEN created_by ELSE NULL END,
      updated_by = CASE WHEN updated_by = ANY(keep_ids) THEN updated_by ELSE NULL END,
      deleted_by = NULL;

  UPDATE public.system_settings
  SET updated_by = CASE WHEN updated_by = ANY(keep_ids) THEN updated_by ELSE NULL END;

  UPDATE public.courses
  SET created_by = CASE WHEN created_by = ANY(keep_ids) THEN created_by ELSE NULL END,
      updated_by = CASE WHEN updated_by = ANY(keep_ids) THEN updated_by ELSE NULL END,
      deleted_by = NULL;

  UPDATE public.course_sessions
  SET created_by = CASE WHEN created_by = ANY(keep_ids) THEN created_by ELSE NULL END,
      updated_by = CASE WHEN updated_by = ANY(keep_ids) THEN updated_by ELSE NULL END,
      deleted_by = NULL;

  UPDATE public.lessons
  SET created_by = CASE WHEN created_by = ANY(keep_ids) THEN created_by ELSE NULL END,
      updated_by = CASE WHEN updated_by = ANY(keep_ids) THEN updated_by ELSE NULL END,
      deleted_by = NULL;

  UPDATE public.questions
  SET created_by = CASE WHEN created_by = ANY(keep_ids) THEN created_by ELSE NULL END,
      updated_by = CASE WHEN updated_by = ANY(keep_ids) THEN updated_by ELSE NULL END,
      deleted_by = NULL;

  UPDATE public.survey_questions
  SET created_by = CASE WHEN created_by = ANY(keep_ids) THEN created_by ELSE NULL END,
      updated_by = CASE WHEN updated_by = ANY(keep_ids) THEN updated_by ELSE NULL END,
      deleted_by = NULL;

  UPDATE public.course_documents
  SET created_by = CASE WHEN created_by = ANY(keep_ids) THEN created_by ELSE NULL END;

  UPDATE public.profiles
  SET updated_by = NULL,
      deleted_by = NULL
  WHERE id = ANY(keep_ids);

  -- 5. Delete all other accounts from public.profiles and auth.users
  DELETE FROM public.org_unit_managers
  WHERE NOT (user_id = ANY(keep_ids));

  DELETE FROM public.user_roles
  WHERE NOT (user_id = ANY(keep_ids));

  DELETE FROM public.profiles
  WHERE NOT (id = ANY(keep_ids));

  DELETE FROM auth.users
  WHERE NOT (id = ANY(keep_ids));

  -- 6. Ensure both preserved accounts are approved and have all 3 roles (admin, instructor, learner)
  UPDATE public.profiles
  SET approved = true,
      deleted_at = NULL,
      deleted_by = NULL
  WHERE id = ANY(keep_ids);

  INSERT INTO public.user_roles (user_id, role)
  SELECT u_id, r_role::public.app_role
  FROM UNNEST(keep_ids) AS u_id
  CROSS JOIN (VALUES ('admin'), ('instructor'), ('learner')) AS t(r_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;

-- 7. Remove test activity photos from storage.objects (keep system/hospital-logo.png, certificate assets, and course docs)
SET LOCAL storage.allow_delete_query = 'true';
DELETE FROM storage.objects
WHERE bucket_id = 'course-files'
  AND name LIKE '%/activity/%';

-- 8. Ensure member_audit_log is completely clean
TRUNCATE TABLE public.member_audit_log RESTART IDENTITY CASCADE;

-- 9. Re-enable all triggers
ALTER TABLE public.courses ENABLE TRIGGER trg_courses_soft_delete;
ALTER TABLE public.lessons ENABLE TRIGGER trg_lessons_soft_delete;
ALTER TABLE public.questions ENABLE TRIGGER trg_questions_soft_delete;
ALTER TABLE public.course_sessions ENABLE TRIGGER trg_course_sessions_soft_delete;
ALTER TABLE public.survey_questions ENABLE TRIGGER trg_survey_questions_soft_delete;
ALTER TABLE public.user_roles ENABLE TRIGGER log_role_change_trg;
ALTER TABLE public.profiles ENABLE TRIGGER log_profile_change_trg;
ALTER TABLE public.profiles ENABLE TRIGGER protect_profile_trg;

COMMIT;
