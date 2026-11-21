-- Set default certificate background to system/certificate-background.png (copied from Chemical Safety course)

-- 1. Set column default on public.courses.certificate_background_url
ALTER TABLE public.courses
  ALTER COLUMN certificate_background_url SET DEFAULT 'system/certificate-background.png';

-- 2. Backfill all existing courses that do not have a certificate background set
UPDATE public.courses
SET certificate_background_url = 'system/certificate-background.png'
WHERE certificate_background_url IS NULL OR btrim(certificate_background_url) = '';

-- 3. Store default_background_url in system_settings (certificate_rules)
UPDATE public.system_settings
SET value = coalesce(value, '{}'::jsonb) || jsonb_build_object('default_background_url', 'system/certificate-background.png')
WHERE key = 'certificate_rules';

-- 4. Update trigger function set_default_course_hospital_info() to also set default certificate_background_url
CREATE OR REPLACE FUNCTION public.set_default_course_hospital_info()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hospital jsonb;
  v_cert jsonb;
BEGIN
  SELECT value INTO v_hospital FROM public.system_settings WHERE key = 'hospital_profile';
  SELECT value INTO v_cert FROM public.system_settings WHERE key = 'certificate_rules';

  IF NEW.hospital_logo_url IS NULL OR btrim(NEW.hospital_logo_url) = '' THEN
    NEW.hospital_logo_url := COALESCE(v_hospital->>'logo_url', 'system/hospital-logo.png');
  END IF;

  IF NEW.certificate_background_url IS NULL OR btrim(NEW.certificate_background_url) = '' THEN
    NEW.certificate_background_url := COALESCE(v_cert->>'default_background_url', 'system/certificate-background.png');
  END IF;

  IF NEW.organization_name IS NULL OR btrim(NEW.organization_name) = '' THEN
    NEW.organization_name := COALESCE(v_hospital->>'name_th', 'โรงพยาบาลโอเวอร์บรุ๊ค');
  END IF;

  IF NEW.department_subtitle IS NULL OR btrim(NEW.department_subtitle) = '' THEN
    NEW.department_subtitle := COALESCE(v_hospital->>'center_name', 'ศูนย์พัฒนาศักยภาพบุคลากร');
  END IF;

  IF (NEW.instructor_name IS NULL OR btrim(NEW.instructor_name) = '') AND v_cert ? 'director_name' THEN
    NEW.instructor_name := COALESCE(v_cert->>'director_name', '');
  END IF;

  IF (NEW.instructor_title IS NULL OR btrim(NEW.instructor_title) = '') AND v_cert ? 'director_title' THEN
    NEW.instructor_title := COALESCE(v_cert->>'director_title', '');
  END IF;

  RETURN NEW;
END;
$function$;
