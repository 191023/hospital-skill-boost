-- Migration: Performance indexes for high-frequency queries
-- Speeds up test attempts lookup, 3D room attendance polling, reports, and course progress

-- 1. Test attempts: used in useCourseState, submit_test, report_overview, try_issue_certificate
CREATE INDEX IF NOT EXISTS idx_test_attempts_lookup 
  ON public.test_attempts (user_id, course_id, kind);

CREATE INDEX IF NOT EXISTS idx_test_attempts_course 
  ON public.test_attempts (course_id, kind);

-- 2. Attendance: used in 3D room roster polling (filtered by session_id)
CREATE INDEX IF NOT EXISTS idx_attendance_session 
  ON public.attendance (session_id) 
  WHERE session_id IS NOT NULL;

-- 3. Certificates: used in course reports, department summaries, and verification
CREATE INDEX IF NOT EXISTS idx_certificates_course 
  ON public.certificates (course_id);

-- 4. Lesson progress: used in useMyCourses and learner dashboard aggregation
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user 
  ON public.lesson_progress (user_id);

-- 5. Survey responses: used in course survey summary calculation
CREATE INDEX IF NOT EXISTS idx_survey_responses_course 
  ON public.survey_responses (course_id);
