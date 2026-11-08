-- Migration: Default Hospital Logo from System Settings and Storage Policies for system/ assets

-- 1. Storage policies for system/ brand assets in course-files bucket
DROP POLICY IF EXISTS "course files read" ON storage.objects;
CREATE POLICY "course files read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-files' AND (
    (storage.foldername(name))[1] = 'system'
    OR is_staff(auth.uid())
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$' AND (
        (is_approved(auth.uid()) AND can_access_course(((storage.foldername(name))[1])::uuid, auth.uid()))
        OR EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = auth.uid() AND e.course_id = ((storage.foldername(objects.name))[1])::uuid)
        OR EXISTS (SELECT 1 FROM certificates c WHERE c.user_id = auth.uid() AND c.course_id = ((storage.foldername(objects.name))[1])::uuid)
      )
    )
  )
);

DROP POLICY IF EXISTS "system files admin insert" ON storage.objects;
CREATE POLICY "system files admin insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-files'
  AND (storage.foldername(name))[1] = 'system'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "system files admin update" ON storage.objects;
CREATE POLICY "system files admin update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'course-files'
  AND (storage.foldername(name))[1] = 'system'
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'course-files'
  AND (storage.foldername(name))[1] = 'system'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "system files admin delete" ON storage.objects;
CREATE POLICY "system files admin delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'course-files'
  AND (storage.foldername(name))[1] = 'system'
  AND public.has_role(auth.uid(), 'admin')
);

-- 2. Trigger function to auto-assign default hospital logo & details on new course creation
CREATE OR REPLACE FUNCTION public.set_default_course_hospital_info()
RETURNS TRIGGER AS $$
DECLARE
  v_hospital jsonb;
  v_cert jsonb;
BEGIN
  SELECT value INTO v_hospital FROM public.system_settings WHERE key = 'hospital_profile';
  SELECT value INTO v_cert FROM public.system_settings WHERE key = 'certificate_rules';

  IF NEW.hospital_logo_url IS NULL OR NEW.hospital_logo_url = '' THEN
    NEW.hospital_logo_url := COALESCE(v_hospital->>'logo_url', 'system/hospital-logo.png');
  END IF;

  IF NEW.organization_name IS NULL OR NEW.organization_name = '' THEN
    NEW.organization_name := COALESCE(v_hospital->>'name_th', 'โรงพยาบาลโอเวอร์บรุ๊ค');
  END IF;

  IF NEW.department_subtitle IS NULL OR NEW.department_subtitle = '' THEN
    NEW.department_subtitle := COALESCE(v_hospital->>'center_name', 'ศูนย์พัฒนาศักยภาพบุคลากร');
  END IF;

  IF (NEW.instructor_name IS NULL OR NEW.instructor_name = '') AND v_cert ? 'director_name' THEN
    NEW.instructor_name := COALESCE(v_cert->>'director_name', '');
  END IF;

  IF (NEW.instructor_title IS NULL OR NEW.instructor_title = '') AND v_cert ? 'director_title' THEN
    NEW.instructor_title := COALESCE(v_cert->>'director_title', '');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_default_course_hospital_info ON public.courses;
CREATE TRIGGER trigger_set_default_course_hospital_info
  BEFORE INSERT ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_course_hospital_info();

-- 3. Ensure system_settings hospital_profile has default logo_url
UPDATE public.system_settings
SET value = jsonb_set(value, '{logo_url}', '"system/hospital-logo.png"'::jsonb, true)
WHERE key = 'hospital_profile' AND (value->>'logo_url' IS NULL OR value->>'logo_url' = '');

-- 4. Backfill existing courses that do not have a hospital_logo_url
UPDATE public.courses
SET
  hospital_logo_url = COALESCE((SELECT value->>'logo_url' FROM public.system_settings WHERE key = 'hospital_profile'), 'system/hospital-logo.png'),
  organization_name = COALESCE(organization_name, (SELECT value->>'name_th' FROM public.system_settings WHERE key = 'hospital_profile'), 'โรงพยาบาลโอเวอร์บรุ๊ค'),
  department_subtitle = COALESCE(department_subtitle, (SELECT value->>'center_name' FROM public.system_settings WHERE key = 'hospital_profile'), 'ศูนย์พัฒนาศักยภาพบุคลากร')
WHERE hospital_logo_url IS NULL OR hospital_logo_url = '';
