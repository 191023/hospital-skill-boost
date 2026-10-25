-- 0013_training_calendar.sql: RPC function for hospital training calendar with quota, team presence, and access checks
CREATE OR REPLACE FUNCTION public.get_calendar_sessions(
  _start timestamptz DEFAULT NULL,
  _end timestamptz DEFAULT NULL
)
RETURNS TABLE (
  session_id uuid,
  course_id uuid,
  course_title text,
  course_category text,
  course_hours numeric,
  instructor_name text,
  audience text,
  published boolean,
  round_no int,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  capacity int,
  checkin_code text,
  taken_seats int,
  is_my_session boolean,
  my_checked_in boolean,
  team_attendees_count int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH managed_orgs AS (
    SELECT org_unit_id AS id FROM org_unit_managers WHERE user_id = auth.uid()
    UNION
    SELECT u.id FROM org_units u
    JOIN org_unit_managers m ON u.parent_id = m.org_unit_id
    WHERE m.user_id = auth.uid()
  )
  SELECT
    s.id AS session_id,
    c.id AS course_id,
    c.title AS course_title,
    c.category AS course_category,
    c.hours AS course_hours,
    c.instructor_name,
    c.audience,
    c.published,
    s.round_no,
    s.starts_at,
    s.ends_at,
    s.location,
    s.capacity,
    s.checkin_code,
    (SELECT count(*)::int FROM enrollments e WHERE e.session_id = s.id) AS taken_seats,
    EXISTS(SELECT 1 FROM enrollments e WHERE e.session_id = s.id AND e.user_id = auth.uid()) AS is_my_session,
    EXISTS(SELECT 1 FROM attendance a WHERE a.session_id = s.id AND a.user_id = auth.uid()) AS my_checked_in,
    (
      SELECT count(*)::int
      FROM enrollments e
      JOIN profiles p ON p.id = e.user_id
      WHERE e.session_id = s.id
        AND p.org_unit_id IN (SELECT id FROM managed_orgs)
    ) AS team_attendees_count
  FROM course_sessions s
  JOIN courses c ON c.id = s.course_id
  WHERE s.deleted_at IS NULL
    AND c.deleted_at IS NULL
    AND (
      public.is_staff(auth.uid())
      OR (
        c.published = true
        AND public.is_approved(auth.uid())
        AND public.can_access_course(c.id, auth.uid())
      )
    )
    AND (_start IS NULL OR s.ends_at >= _start OR (s.ends_at IS NULL AND s.starts_at >= _start))
    AND (_end IS NULL OR s.starts_at <= _end)
  ORDER BY s.starts_at ASC NULLS LAST, s.round_no ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_calendar_sessions(timestamptz, timestamptz) TO authenticated;
