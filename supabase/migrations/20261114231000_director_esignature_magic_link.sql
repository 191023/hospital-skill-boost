-- Director E-Signature System & Magic Sign Link for iPad/Mobile

-- 1. Backfill existing courses that have empty instructor_name / instructor_title with the default director info from system_settings
DO $$
DECLARE
  v_cert jsonb;
  v_dir_name text;
  v_dir_title text;
  v_dir_sig text;
BEGIN
  SELECT value INTO v_cert FROM public.system_settings WHERE key = 'certificate_rules';
  v_dir_name := COALESCE(NULLIF(btrim(v_cert->>'director_name'), ''), 'นพ. กฤษณ์ วงศ์วิวัฒน์');
  v_dir_title := COALESCE(NULLIF(btrim(v_cert->>'director_title'), ''), 'ผู้อำนวยการโรงพยาบาลโอเวอร์บรุ๊ค');
  v_dir_sig := NULLIF(btrim(v_cert->>'director_signature_url'), '');

  UPDATE public.courses
  SET
    instructor_name = CASE WHEN instructor_name IS NULL OR btrim(instructor_name) = '' THEN v_dir_name ELSE instructor_name END,
    instructor_title = CASE WHEN instructor_title IS NULL OR btrim(instructor_title) = '' THEN v_dir_title ELSE instructor_title END,
    instructor_signature_url = CASE WHEN (instructor_signature_url IS NULL OR btrim(instructor_signature_url) = '') AND v_dir_sig IS NOT NULL THEN v_dir_sig ELSE instructor_signature_url END;
END $$;

-- 2. Update trigger function set_default_course_hospital_info() so new courses also inherit director_signature_url
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

  IF (NEW.instructor_signature_url IS NULL OR btrim(NEW.instructor_signature_url) = '') AND v_cert ? 'director_signature_url' THEN
    NEW.instructor_signature_url := NULLIF(btrim(v_cert->>'director_signature_url'), '');
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. RPC: Generate a 7-day Magic Link token for the Hospital Director (Admin only)
CREATE OR REPLACE FUNCTION public.create_director_sign_token()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
  v_expires timestamptz;
  v_cert jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถสร้างลิงก์ลงนามได้';
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || substr(md5(random()::text), 1, 12);
  v_expires := now() + interval '7 days';

  SELECT coalesce(value, '{}'::jsonb) INTO v_cert
  FROM public.system_settings
  WHERE key = 'certificate_rules';

  v_cert := v_cert || jsonb_build_object(
    'sign_token', v_token,
    'sign_token_expires_at', v_expires
  );

  INSERT INTO public.system_settings(key, value, updated_at, updated_by)
  VALUES ('certificate_rules', v_cert, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;

  RETURN jsonb_build_object(
    'token', v_token,
    'expires_at', v_expires
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_director_sign_token() TO authenticated;

-- 4. RPC: Verify Magic Link token and return Director signing context (callable by anon/authenticated)
CREATE OR REPLACE FUNCTION public.get_director_sign_info(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cert jsonb;
  v_hospital jsonb;
  v_saved_token text;
  v_expires timestamptz;
BEGIN
  SELECT value INTO v_cert FROM public.system_settings WHERE key = 'certificate_rules';
  SELECT value INTO v_hospital FROM public.system_settings WHERE key = 'hospital_profile';

  v_saved_token := v_cert->>'sign_token';
  v_expires := (v_cert->>'sign_token_expires_at')::timestamptz;

  IF _token IS NULL OR btrim(_token) = '' OR v_saved_token IS NULL OR _token <> v_saved_token THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'ลิงก์ไม่ถูกต้องหรือถูกยกเลิกแล้ว');
  END IF;

  IF v_expires IS NOT NULL AND v_expires < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'ลิงก์หมดอายุแล้ว กรุณาขอรับลิงก์ใหม่จากผู้ดูแลระบบ');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'director_name', COALESCE(v_cert->>'director_name', 'นพ. กฤษณ์ วงศ์วิวัฒน์'),
    'director_title', COALESCE(v_cert->>'director_title', 'ผู้อำนวยการโรงพยาบาลโอเวอร์บรุ๊ค'),
    'director_signature_url', v_cert->>'director_signature_url',
    'director_signed_at', v_cert->>'director_signed_at',
    'expires_at', v_expires,
    'organization_name', COALESCE(v_hospital->>'name_th', 'โรงพยาบาลโอเวอร์บรุ๊ค'),
    'department_subtitle', COALESCE(v_hospital->>'center_name', 'ศูนย์พัฒนาศักยภาพบุคลากร')
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_director_sign_info(text) TO anon, authenticated, service_role;

-- 5. RPC: Save Director signature from Magic Link (or Admin settings) and propagate to courses
CREATE OR REPLACE FUNCTION public.submit_director_signature(
  _token text,
  _director_name text,
  _director_title text,
  _signature_data_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cert jsonb;
  v_saved_token text;
  v_expires timestamptz;
  v_old_dir_name text;
  v_signed_at timestamptz := now();
BEGIN
  SELECT coalesce(value, '{}'::jsonb) INTO v_cert FROM public.system_settings WHERE key = 'certificate_rules';
  v_saved_token := v_cert->>'sign_token';
  v_expires := (v_cert->>'sign_token_expires_at')::timestamptz;
  v_old_dir_name := v_cert->>'director_name';

  -- Allow either a valid Magic Link token OR an authenticated admin
  IF NOT (
    (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role))
    OR (_token IS NOT NULL AND btrim(_token) <> '' AND v_saved_token IS NOT NULL AND _token = v_saved_token AND (v_expires IS NULL OR v_expires >= now()))
  ) THEN
    RAISE EXCEPTION 'ลิงก์ลงนามไม่ถูกต้องหรือหมดอายุแล้ว';
  END IF;

  IF _signature_data_url IS NULL OR btrim(_signature_data_url) = '' THEN
    RAISE EXCEPTION 'กรุณาเซ็นลายเซ็นก่อนกดบันทึก';
  END IF;

  v_cert := v_cert || jsonb_build_object(
    'director_name', COALESCE(NULLIF(btrim(_director_name), ''), COALESCE(v_old_dir_name, 'นพ. กฤษณ์ วงศ์วิวัฒน์')),
    'director_title', COALESCE(NULLIF(btrim(_director_title), ''), COALESCE(v_cert->>'director_title', 'ผู้อำนวยการโรงพยาบาลโอเวอร์บรุ๊ค')),
    'director_signature_url', _signature_data_url,
    'director_signed_at', v_signed_at
  );

  INSERT INTO public.system_settings(key, value, updated_at, updated_by)
  VALUES ('certificate_rules', v_cert, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;

  -- Propagate director signature, name, and title to all courses that don't have a custom instructor or already use the director
  UPDATE public.courses
  SET
    instructor_name = v_cert->>'director_name',
    instructor_title = v_cert->>'director_title',
    instructor_signature_url = _signature_data_url
  WHERE deleted_at IS NULL
    AND (
      instructor_name IS NULL
      OR btrim(instructor_name) = ''
      OR instructor_name = v_old_dir_name
      OR instructor_name = (v_cert->>'director_name')
      OR instructor_signature_url IS NULL
      OR btrim(instructor_signature_url) = ''
      OR instructor_signature_url LIKE 'data:image/%'
      OR instructor_signature_url LIKE 'system/%'
    );

  RETURN jsonb_build_object(
    'success', true,
    'signed_at', v_signed_at,
    'director_name', v_cert->>'director_name',
    'director_title', v_cert->>'director_title'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_director_signature(text, text, text, text) TO anon, authenticated, service_role;
