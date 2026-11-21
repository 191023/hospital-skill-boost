-- Ensure any authenticated user can read course cover images, certificate backgrounds, and hospital logos
-- stored in the private course-files bucket when referenced by a course.

DROP POLICY IF EXISTS "course files read" ON storage.objects;
CREATE POLICY "course files read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-files' AND (
    (storage.foldername(name))[1] = 'system'
    OR is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.courses co
      WHERE co.cover_url = objects.name
         OR co.certificate_background_url = objects.name
         OR co.hospital_logo_url = objects.name
         OR co.instructor_signature_url = objects.name
    )
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$' AND (
        (is_approved(auth.uid()) AND can_access_course(((storage.foldername(name))[1])::uuid, auth.uid()))
        OR EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = auth.uid() AND e.course_id = ((storage.foldername(objects.name))[1])::uuid)
        OR EXISTS (SELECT 1 FROM certificates c WHERE c.user_id = auth.uid() AND c.course_id = ((storage.foldername(objects.name))[1])::uuid)
      )
    )
  )
);
