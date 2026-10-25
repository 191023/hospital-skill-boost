-- Seed Demo Managers for testing
DO $$
DECLARE
  demo_pw text := '$2b$10$0Hy2eBSHFIxT1gKWrH5uQeUQN8Z5srqy4b3hxDfUdDmt3mj96DKXq'; -- Demo1234!
  uid_nursing_div uuid := 'a1000000-0000-4000-8000-000000000001';
  uid_icu_unit uuid := 'a1000000-0000-4000-8000-000000000002';
  uid_it_div uuid := 'a1000000-0000-4000-8000-000000000003';
  uid_com_unit uuid := 'a1000000-0000-4000-8000-000000000004';
  
  id_nursing_div uuid := '674080f2-f46d-4089-8a74-b1c9172add36';
  id_icu_unit uuid := '9f688dd0-cd9a-4e06-a4da-288790f16c9b';
  id_it_div uuid := '618d8c2b-dc51-43b2-b080-c9972f1e4dbb';
  id_com_unit uuid := 'ced45300-51c2-4457-995f-63fc821270ba';
BEGIN
  -- 1. หัวหน้าฝ่ายการพยาบาล
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (uid_nursing_div, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'head.nursing@overbrook.example.com', demo_pw, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"พว. วิภาวัลย์ เกียรติพงษ์"}'::jsonb, now(), now())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = demo_pw, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (uid_nursing_div, uid_nursing_div, 'head.nursing@overbrook.example.com',
    jsonb_build_object('sub', uid_nursing_div::text, 'email', 'head.nursing@overbrook.example.com'), 'email', now(), now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, full_name, email, division, department, position, approved, org_unit_id)
  VALUES (uid_nursing_div, 'พว. วิภาวัลย์ เกียรติพงษ์', 'head.nursing@overbrook.example.com', 'ฝ่ายการพยาบาล', '', 'หัวหน้าฝ่ายการพยาบาล', true, id_nursing_div)
  ON CONFLICT (id) DO UPDATE SET full_name = 'พว. วิภาวัลย์ เกียรติพงษ์', position = 'หัวหน้าฝ่ายการพยาบาล', org_unit_id = id_nursing_div, approved = true;

  INSERT INTO public.user_roles (user_id, role) VALUES (uid_nursing_div, 'learner') ON CONFLICT DO NOTHING;
  INSERT INTO public.org_unit_managers (user_id, org_unit_id) VALUES (uid_nursing_div, id_nursing_div) ON CONFLICT DO NOTHING;

  -- 2. หัวหน้าหน่วย ICU
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (uid_icu_unit, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'head.icu@overbrook.example.com', demo_pw, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"พว. กัลยา รักษาดี"}'::jsonb, now(), now())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = demo_pw, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (uid_icu_unit, uid_icu_unit, 'head.icu@overbrook.example.com',
    jsonb_build_object('sub', uid_icu_unit::text, 'email', 'head.icu@overbrook.example.com'), 'email', now(), now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, full_name, email, division, department, position, approved, org_unit_id)
  VALUES (uid_icu_unit, 'พว. กัลยา รักษาดี', 'head.icu@overbrook.example.com', 'ฝ่ายการพยาบาล', 'ICU', 'หัวหน้าหน่วย ICU', true, id_icu_unit)
  ON CONFLICT (id) DO UPDATE SET full_name = 'พว. กัลยา รักษาดี', position = 'หัวหน้าหน่วย ICU', org_unit_id = id_icu_unit, approved = true;

  INSERT INTO public.user_roles (user_id, role) VALUES (uid_icu_unit, 'learner') ON CONFLICT DO NOTHING;
  INSERT INTO public.org_unit_managers (user_id, org_unit_id) VALUES (uid_icu_unit, id_icu_unit) ON CONFLICT DO NOTHING;

  -- 3. หัวหน้าฝ่ายเทคโนโลยีสารสนเทศ
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (uid_it_div, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'head.it@overbrook.example.com', demo_pw, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"นายกิตติศักดิ์ พัฒนไพศาล"}'::jsonb, now(), now())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = demo_pw, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (uid_it_div, uid_it_div, 'head.it@overbrook.example.com',
    jsonb_build_object('sub', uid_it_div::text, 'email', 'head.it@overbrook.example.com'), 'email', now(), now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, full_name, email, division, department, position, approved, org_unit_id)
  VALUES (uid_it_div, 'นายกิตติศักดิ์ พัฒนไพศาล', 'head.it@overbrook.example.com', 'ฝ่ายเทคโนโลยีสารสนเทศ', '', 'หัวหน้าฝ่ายเทคโนโลยีสารสนเทศ', true, id_it_div)
  ON CONFLICT (id) DO UPDATE SET full_name = 'นายกิตติศักดิ์ พัฒนไพศาล', position = 'หัวหน้าฝ่ายเทคโนโลยีสารสนเทศ', org_unit_id = id_it_div, approved = true;

  INSERT INTO public.user_roles (user_id, role) VALUES (uid_it_div, 'learner') ON CONFLICT DO NOTHING;
  INSERT INTO public.org_unit_managers (user_id, org_unit_id) VALUES (uid_it_div, id_it_div) ON CONFLICT DO NOTHING;

  -- 4. หัวหน้าหน่วยวิศวกรรมคอมพิวเตอร์
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (uid_com_unit, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'head.com@overbrook.example.com', demo_pw, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"นายสิทธิชัย สุทธิโชติ"}'::jsonb, now(), now())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = demo_pw, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (uid_com_unit, uid_com_unit, 'head.com@overbrook.example.com',
    jsonb_build_object('sub', uid_com_unit::text, 'email', 'head.com@overbrook.example.com'), 'email', now(), now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, full_name, email, division, department, position, approved, org_unit_id)
  VALUES (uid_com_unit, 'นายสิทธิชัย สุทธิโชติ', 'head.com@overbrook.example.com', 'ฝ่ายเทคโนโลยีสารสนเทศ', 'วิศวกรรมคอมพิวเตอร์', 'หัวหน้าหน่วยวิศวกรรมคอมพิวเตอร์', true, id_com_unit)
  ON CONFLICT (id) DO UPDATE SET full_name = 'นายสิทธิชัย สุทธิโชติ', position = 'หัวหน้าหน่วยวิศวกรรมคอมพิวเตอร์', org_unit_id = id_com_unit, approved = true;

  INSERT INTO public.user_roles (user_id, role) VALUES (uid_com_unit, 'learner') ON CONFLICT DO NOTHING;
  INSERT INTO public.org_unit_managers (user_id, org_unit_id) VALUES (uid_com_unit, id_com_unit) ON CONFLICT DO NOTHING;
END $$;
