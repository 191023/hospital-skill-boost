-- Add dual signer support (Instructor + Hospital Director) with selectable display options on courses

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS show_director_signature boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_instructor_signature boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS director_name text,
  ADD COLUMN IF NOT EXISTS director_title text,
  ADD COLUMN IF NOT EXISTS director_signature_url text;

-- Backfill existing courses with director info from system_settings (certificate_rules) while keeping existing instructor fields intact
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
    director_name = COALESCE(NULLIF(btrim(director_name), ''), v_dir_name),
    director_title = COALESCE(NULLIF(btrim(director_title), ''), v_dir_title),
    director_signature_url = COALESCE(NULLIF(btrim(director_signature_url), ''), v_dir_sig),
    show_director_signature = COALESCE(show_director_signature, true),
    show_instructor_signature = CASE
      WHEN instructor_name IS NOT NULL AND btrim(instructor_name) <> '' AND instructor_name <> v_dir_name THEN true
      ELSE false
    END;
END $$;

-- Update trigger function set_default_course_hospital_info() so newly created courses inherit director fields cleanly
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

  IF NEW.director_name IS NULL OR btrim(NEW.director_name) = '' THEN
    NEW.director_name := COALESCE(NULLIF(btrim(v_cert->>'director_name'), ''), 'นพ. กฤษณ์ วงศ์วิวัฒน์');
  END IF;

  IF NEW.director_title IS NULL OR btrim(NEW.director_title) = '' THEN
    NEW.director_title := COALESCE(NULLIF(btrim(v_cert->>'director_title'), ''), 'ผู้อำนวยการโรงพยาบาลโอเวอร์บรุ๊ค');
  END IF;

  IF (NEW.director_signature_url IS NULL OR btrim(NEW.director_signature_url) = '') AND v_cert ? 'director_signature_url' THEN
    NEW.director_signature_url := NULLIF(btrim(v_cert->>'director_signature_url'), '');
  END IF;

  RETURN NEW;
END;
$function$;

-- Update submit_director_signature RPC so signing via Magic Link or Settings updates director_* columns on courses without touching instructor_* columns
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

  -- Propagate director signature, name, and title to all courses' director_* columns
  UPDATE public.courses
  SET
    director_name = v_cert->>'director_name',
    director_title = v_cert->>'director_title',
    director_signature_url = _signature_data_url
  WHERE deleted_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'signed_at', v_signed_at,
    'director_name', v_cert->>'director_name',
    'director_title', v_cert->>'director_title'
  );
END;
$function$;
