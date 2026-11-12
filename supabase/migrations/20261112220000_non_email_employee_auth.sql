-- Migration: Support non-email staff authentication (Employee ID & Synthetic Email)
-- File: supabase/migrations/20261112220000_non_email_employee_auth.sql

-- 1. Add employee_id column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS employee_id text;

-- 2. Index for rapid lookup by employee_id
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id 
  ON public.profiles (lower(employee_id)) 
  WHERE (employee_id IS NOT NULL AND deleted_at IS NULL);

-- 3. Update handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  first_user boolean;
  v_raw_email text := lower(coalesce(new.email, ''));
  v_emp_id text := null;
BEGIN
  SELECT not exists(SELECT 1 FROM public.profiles) INTO first_user;

  -- Extract employee_id from synthetic email or raw_user_meta_data
  IF v_raw_email LIKE '%@staff.ovb' THEN
    v_emp_id := upper(replace(v_raw_email, '@staff.ovb', ''));
  ELSE
    v_emp_id := coalesce(new.raw_user_meta_data->>'employee_id', null);
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    employee_id,
    division,
    department,
    position,
    approved
  )
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    v_emp_id,
    coalesce(new.raw_user_meta_data->>'division', ''),
    coalesce(new.raw_user_meta_data->>'department', ''),
    coalesce(new.raw_user_meta_data->>'position', ''),
    first_user OR coalesce((new.raw_user_meta_data->>'approved')::boolean, false)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    employee_id = coalesce(EXCLUDED.employee_id, public.profiles.employee_id),
    full_name = coalesce(nullif(EXCLUDED.full_name, ''), public.profiles.full_name);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'learner')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF first_user THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

