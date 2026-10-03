ALTER TABLE public.courses ADD COLUMN audience text NOT NULL DEFAULT 'all';

CREATE TABLE public.course_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('division','department','user')),
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, kind, value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_access TO authenticated;
GRANT ALL ON public.course_access TO service_role;
ALTER TABLE public.course_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "access staff" ON public.course_access FOR ALL TO authenticated
  USING (public.can_edit_course(course_id)) WITH CHECK (public.can_edit_course(course_id));

CREATE OR REPLACE FUNCTION public.can_access_course(_course uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM courses c WHERE c.id = _course AND (
      c.audience = 'all' OR EXISTS (
        SELECT 1 FROM course_access a JOIN profiles p ON p.id = _user
        WHERE a.course_id = c.id AND (
          (a.kind = 'division' AND a.value = p.division) OR
          (a.kind = 'department' AND a.value = p.department) OR
          (a.kind = 'user' AND a.value = _user::text))
      )
    )
  )
$$;

DROP POLICY "courses read" ON public.courses;
CREATE POLICY "courses read" ON public.courses FOR SELECT TO authenticated
  USING ((published AND is_approved(auth.uid()) AND can_access_course(id, auth.uid())) OR is_staff(auth.uid()));

DROP POLICY "enroll insert" ON public.enrollments;
CREATE POLICY "enroll insert" ON public.enrollments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_approved(auth.uid()) AND can_access_course(course_id, auth.uid()));