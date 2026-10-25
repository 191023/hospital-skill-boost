-- Seed 3 new courses with sessions, lessons, questions, and mock trainees
DO $$
DECLARE
  demo_pw text := '$2b$10$0Hy2eBSHFIxT1gKWrH5uQeUQN8Z5srqy4b3hxDfUdDmt3mj96DKXq'; -- Demo1234!
  
  -- Course IDs
  c_cpr uuid := 'b1000000-0000-4000-8000-000000000001';
  c_ic uuid := 'b1000000-0000-4000-8000-000000000002';
  c_pdpa uuid := 'b1000000-0000-4000-8000-000000000003';

  -- Session IDs for CPR
  s_cpr_1 uuid := 'b1000000-0000-4000-8000-000000000101';
  s_cpr_2 uuid := 'b1000000-0000-4000-8000-000000000102';
  s_cpr_3 uuid := 'b1000000-0000-4000-8000-000000000103';

  -- Session IDs for IC
  s_ic_1 uuid := 'b1000000-0000-4000-8000-000000000201';
  s_ic_2 uuid := 'b1000000-0000-4000-8000-000000000202';

  -- Session IDs for PDPA
  s_pdpa_1 uuid := 'b1000000-0000-4000-8000-000000000301';
  s_pdpa_2 uuid := 'b1000000-0000-4000-8000-000000000302';

  -- New Mock Staff IDs
  u_nurse1 uuid := 'b2000000-0000-4000-8000-000000000001';
  u_nurse2 uuid := 'b2000000-0000-4000-8000-000000000002';
  u_it1 uuid := 'b2000000-0000-4000-8000-000000000003';
  u_it2 uuid := 'b2000000-0000-4000-8000-000000000004';

  -- Org Unit IDs
  id_nursing_div uuid := '674080f2-f46d-4089-8a74-b1c9172add36';
  id_icu_unit uuid := '9f688dd0-cd9a-4e06-a4da-288790f16c9b';
  id_it_div uuid := '618d8c2b-dc51-43b2-b080-c9972f1e4dbb';
  id_com_unit uuid := 'ced45300-51c2-4457-995f-63fc821270ba';
BEGIN
  -- =========================================================================
  -- 1. INSERT 3 COURSES
  -- =========================================================================
  
  -- Course 1: การช่วยฟื้นคืนชีพขั้นพื้นฐานและการใช้เครื่อง AED (CPR & AED)
  INSERT INTO public.courses (
    id, title, description, category, hours, pass_score, published, audience, training_year,
    require_pretest, require_posttest, require_survey, issue_certificate,
    instructor_name, instructor_title, cover_url
  ) VALUES (
    c_cpr,
    'การช่วยฟื้นคืนชีพขั้นพื้นฐานและการใช้เครื่อง AED',
    'หลักสูตรฝึกอบรมเชิงปฏิบัติการช่วยชีวิตขั้นพื้นฐาน (Basic Life Support: BLS) การกดหน้าอกคุณภาพสูง และการใช้งานเครื่องกระตุกหัวใจไฟฟ้าอัตโนมัติ (AED) สำหรับบุคลากรทางการแพทย์และเจ้าหน้าที่โรงพยาบาล',
    'วิชาชีพการแพทย์และพยาบาล',
    3, 80, true, 'all', 2026,
    true, true, true, true,
    'นพ. ธีรภัทร อัครเดชานันท์', 'แพทย์เวชศาสตร์ฉุกเฉิน',
    'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80'
  ) ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category,
    hours = EXCLUDED.hours, published = true, audience = 'all';

  -- Course 2: มาตรฐานการป้องกันและควบคุมการติดเชื้อในโรงพยาบาล (IC)
  INSERT INTO public.courses (
    id, title, description, category, hours, pass_score, published, audience, training_year,
    require_pretest, require_posttest, require_survey, issue_certificate,
    instructor_name, instructor_title, cover_url
  ) VALUES (
    c_ic,
    'มาตรฐานการป้องกันและควบคุมการติดเชื้อในโรงพยาบาล (IC)',
    'แนวทางปฏิบัติ Standard & Transmission-based Precautions การสุขอนามัยของมือ (Hand Hygiene) การสวมและถอดอุปกรณ์ป้องกัน PPE อย่างถูกต้อง และการจัดการขยะติดเชื้อตามมาตรฐาน HA และ JCI',
    'คุณภาพและความปลอดภัย',
    2, 80, true, 'all', 2026,
    true, true, true, true,
    'พว. นงลักษณ์ ชัยสิริกุล', 'พยาบาลควบคุมการติดเชื้อในโรงพยาบาล (ICN)',
    'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1200&q=80'
  ) ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category,
    hours = EXCLUDED.hours, published = true, audience = 'all';

  -- Course 3: ความมั่นคงปลอดภัยไซเบอร์และคุ้มครองข้อมูลส่วนบุคคลผู้ป่วย (Cybersecurity & PDPA)
  INSERT INTO public.courses (
    id, title, description, category, hours, pass_score, published, audience, training_year,
    require_pretest, require_posttest, require_survey, issue_certificate,
    instructor_name, instructor_title, cover_url
  ) VALUES (
    c_pdpa,
    'ความมั่นคงปลอดภัยไซเบอร์และคุ้มครองข้อมูลผู้ป่วย (Cybersecurity & PDPA)',
    'การตระหนักรู้ภัยคุกคามทางไซเบอร์ การป้องกันการโจมตี Phishing และ Ransomware การจัดการสิทธิ์เข้าถึงระบบเวชระเบียนอิเล็กทรอนิกส์ (EMR) และการปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)',
    'เทคโนโลยีและสารสนเทศ',
    2, 80, true, 'all', 2026,
    true, true, true, true,
    'นายกิตติศักดิ์ พัฒนไพศาล', 'หัวหน้าฝ่ายเทคโนโลยีสารสนเทศ',
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80'
  ) ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category,
    hours = EXCLUDED.hours, published = true, audience = 'all';

  -- =========================================================================
  -- 2. SESSIONS (รอบการอบรม)
  -- =========================================================================
  
  -- Sessions for CPR (3 rounds)
  INSERT INTO public.course_sessions (id, course_id, round_no, starts_at, ends_at, location, capacity, checkin_code)
  VALUES
    (s_cpr_1, c_cpr, 1, '2026-11-20 02:00:00+00', '2026-11-20 05:00:00+00', 'ห้องอบรมจำลองสถานการณ์ ชั้น 4', 25, 'CPR-RD1'),
    (s_cpr_2, c_cpr, 2, '2026-11-20 06:00:00+00', '2026-11-20 09:00:00+00', 'ห้องอบรมจำลองสถานการณ์ ชั้น 4', 25, 'CPR-RD2'),
    (s_cpr_3, c_cpr, 3, '2026-11-27 02:00:00+00', '2026-11-27 05:00:00+00', 'ห้องอบรมจำลองสถานการณ์ ชั้น 4', 25, 'CPR-RD3')
  ON CONFLICT (id) DO UPDATE SET location = EXCLUDED.location, capacity = EXCLUDED.capacity, starts_at = EXCLUDED.starts_at;

  -- Sessions for IC (2 rounds)
  INSERT INTO public.course_sessions (id, course_id, round_no, starts_at, ends_at, location, capacity, checkin_code)
  VALUES
    (s_ic_1, c_ic, 1, '2026-11-18 02:00:00+00', '2026-11-18 04:00:00+00', 'ห้องประชุมใหญ่ ชั้น 3', 30, 'IC-AM1'),
    (s_ic_2, c_ic, 2, '2026-11-18 06:30:00+00', '2026-11-18 08:30:00+00', 'ห้องประชุมใหญ่ ชั้น 3', 30, 'IC-PM1')
  ON CONFLICT (id) DO UPDATE SET location = EXCLUDED.location, capacity = EXCLUDED.capacity, starts_at = EXCLUDED.starts_at;

  -- Sessions for PDPA (2 rounds)
  INSERT INTO public.course_sessions (id, course_id, round_no, starts_at, ends_at, location, capacity, checkin_code)
  VALUES
    (s_pdpa_1, c_pdpa, 1, '2026-11-25 02:30:00+00', '2026-11-25 04:30:00+00', 'ห้องอบรมคอมพิวเตอร์ ชั้น 2', 20, 'CYBER-1'),
    (s_pdpa_2, c_pdpa, 2, '2026-11-25 07:00:00+00', '2026-11-25 09:00:00+00', 'ห้องอบรมคอมพิวเตอร์ ชั้น 2', 20, 'CYBER-2')
  ON CONFLICT (id) DO UPDATE SET location = EXCLUDED.location, capacity = EXCLUDED.capacity, starts_at = EXCLUDED.starts_at;

  -- =========================================================================
  -- 3. LESSONS FOR EACH COURSE
  -- =========================================================================
  
  -- CPR Lessons
  INSERT INTO public.lessons (course_id, title, position, kind, body, video_url)
  VALUES
    (c_cpr, 'หลักการประเมินผู้ป่วยหมดสติและห่วงโซ่การรอดชีวิต (Chain of Survival)', 1, 'text', 'เนื้อหาการประเมินความปลอดภัย การเรียกขอความช่วยเหลือ และการเปิดทางเดินหายใจ', null),
    (c_cpr, 'เทคนิคการกดหน้าอกคุณภาพสูง (High-Quality CPR)', 2, 'video', '', 'https://www.youtube.com/watch?v=M4ACYp75maU'),
    (c_cpr, 'ขั้นตอนการใช้งานเครื่องกระตุกหัวใจไฟฟ้าอัตโนมัติ (AED) อย่างปลอดภัย', 3, 'text', 'การติดแผ่น Electrode การเว้นระยะขณะวิเคราะห์คลื่นไฟฟ้าหัวใจ และการส่งผ่านประจุไฟฟ้า', null)
  ON CONFLICT DO NOTHING;

  -- IC Lessons
  INSERT INTO public.lessons (course_id, title, position, kind, body, video_url)
  VALUES
    (c_ic, 'หลักการ 5 Moments for Hand Hygiene และการล้างมือ 7 ขั้นตอน', 1, 'video', '', 'https://www.youtube.com/watch?v=3PmVJQUCm4E'),
    (c_ic, 'การสวมใส่และถอดชุดอุปกรณ์ป้องกันส่วนบุคคล (PPE) ตามมาตรฐาน', 2, 'text', 'ขั้นตอนการใส่ถุงมือ หน้ากาก N95 แว่นครอบตา และชุดกาวน์กันซึม', null),
    (c_ic, 'การคัดแยกและการทิ้งขยะติดเชื้อ/ขยะมีคมในสถานพยาบาล', 3, 'text', 'การจัดการถังขยะสีแดง กล่องทิ้งเข็ม และมาตรฐานสุขาภิบาลสิ่งแวดล้อม', null)
  ON CONFLICT DO NOTHING;

  -- PDPA Lessons
  INSERT INTO public.lessons (course_id, title, position, kind, body, video_url)
  VALUES
    (c_pdpa, 'ความสำคัญของ PDPA และข้อมูลสุขภาพผู้ป่วย (Sensitive Personal Data)', 1, 'text', 'บทบาทและหน้าที่ของผู้ปฏิบัติงานในการรักษาความลับของผู้รับบริการ', null),
    (c_pdpa, 'การระวังภัยฟิชชิ่ง (Phishing) และการตั้งรหัสผ่านความปลอดภัยสูง', 2, 'text', 'ตัวอย่างอีเมลหลอกลวง การตรวจสอบ URL และการยืนยันตัวตนแบบหลายชั้น (MFA)', null)
  ON CONFLICT DO NOTHING;

  -- =========================================================================
  -- 4. TEST QUESTIONS
  -- =========================================================================
  
  -- Questions for CPR
  INSERT INTO public.questions (course_id, question, options, correct_index, position)
  VALUES
    (c_cpr, 'อัตราความเร็วในการกดหน้าอก (Chest Compression) ที่ถูกต้องตามมาตรฐานคือข้อใด?',
     '["60-80 ครั้ง/นาที", "80-100 ครั้ง/นาที", "100-120 ครั้ง/นาที", "140-160 ครั้ง/นาที"]'::jsonb, 2, 1),
    (c_cpr, 'ความลึกในการกดหน้าอกสำหรับผู้ใหญ่ควรมีความลึกประมาณเท่าใด?',
     '["อย่างน้อย 2 นิ้ว (5 ซม.) แต่ไม่เกิน 2.4 นิ้ว (6 ซม.)", "ไม่เกิน 1 นิ้ว", "3-4 นิ้ว", "กดให้ลึกที่สุดเท่าที่ทำได้"]'::jsonb, 0, 2),
    (c_cpr, 'เมื่อเครื่อง AED กำลังทำการวิเคราะห์คลื่นไฟฟ้าหัวใจ (Analyzing) ควรปฏิบัติตามข้อใด?',
     '["ช่วยหายใจต่อไป", "กดหน้าอกต่อไปอย่างรวดเร็ว", "ทุกคนต้องถอยห่างและไม่สัมผัสตัวผู้ป่วย", "ปิดเครื่องทันที"]'::jsonb, 2, 3)
  ON CONFLICT DO NOTHING;

  -- Questions for IC
  INSERT INTO public.questions (course_id, question, options, correct_index, position)
  VALUES
    (c_ic, 'การล้างมือด้วยแอลกอฮอล์เจล (Alcohol-based hand rub) ควรใช้ระยะเวลาเท่าใด?',
     '["5-10 วินาที", "20-30 วินาที", "1 นาที", "2 นาที"]'::jsonb, 1, 1),
    (c_ic, 'ข้อใดคือลำดับที่ถูกต้องในการถอดอุปกรณ์ PPE?',
     '["ถอดถุงมือ -> เสื้อกาวน์ -> แว่นตา -> หน้ากากอนามัย", "ถอดหน้ากากก่อนเป็นลำดับแรก", "ถอดเสื้อกาวน์ก่อนถุงมือ", "ถอดพร้อมกันทั้งหมด"]'::jsonb, 0, 2)
  ON CONFLICT DO NOTHING;

  -- Questions for PDPA
  INSERT INTO public.questions (course_id, question, options, correct_index, position)
  VALUES
    (c_pdpa, 'หากได้รับอีเมลแจ้งให้รีบคลิกลิงก์เพื่อเปลี่ยนรหัสผ่านระบบโรงพยาบาลด่วน ควรทำอย่างไร?',
     '["คลิกลิงก์ทันทีเพื่อความรวดเร็ว", "ส่งต่อให้เพื่อนร่วมงานช่วยคลิก", "ตรวจสอบที่อยู่อีเมลผู้ส่งและแจ้งศูนย์ IT ทันที ห้ามคลิกลิงก์แปลกปลอม", "ตอบกลับอีเมลเพื่อสอบถามรหัสผ่าน"]'::jsonb, 2, 1),
    (c_pdpa, 'ข้อมูลสุขภาพและประวัติการรักษาของผู้ป่วย จัดเป็นข้อมูลประเภทใดตามกฎหมาย PDPA?',
     '["ข้อมูลทั่วไปเปิดเผยได้", "ข้อมูลส่วนบุคคลที่มีความอ่อนไหว (Sensitive Data)", "ข้อมูลสาธารณะ", "ข้อมูลที่ไม่ได้รับการคุ้มครอง"]'::jsonb, 1, 2)
  ON CONFLICT DO NOTHING;

  -- =========================================================================
  -- 5. NEW MOCK TRAINEES (บุคลากรจำลองเพิ่มเติม)
  -- =========================================================================
  
  -- Nurse 1: พว. ชลธิชา วรรณโชติ (พยาบาลวิชาชีพ ICU)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u_nurse1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'chonticha.w@overbrook.example.com', demo_pw, now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"พว. ชลธิชา วรรณโชติ"}'::jsonb, now(), now())
  ON CONFLICT (id) DO UPDATE SET raw_user_meta_data = EXCLUDED.raw_user_meta_data;
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (u_nurse1, u_nurse1, 'chonticha.w@overbrook.example.com', jsonb_build_object('sub', u_nurse1::text, 'email', 'chonticha.w@overbrook.example.com'), 'email', now(), now(), now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, full_name, email, division, department, position, approved, org_unit_id)
  VALUES (u_nurse1, 'พว. ชลธิชา วรรณโชติ', 'chonticha.w@overbrook.example.com', 'ฝ่ายการพยาบาล', 'ICU', 'พยาบาลวิชาชีพปฏิบัติการ', true, id_icu_unit)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, division = EXCLUDED.division, department = EXCLUDED.department, org_unit_id = id_icu_unit, approved = true;
  INSERT INTO public.user_roles (user_id, role) VALUES (u_nurse1, 'learner') ON CONFLICT DO NOTHING;

  -- Nurse 2: พว. ภัทรภร สุวรรณรัตน์ (พยาบาลวิชาชีพ แผนกการพยาบาล)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u_nurse2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'pattaraporn.s@overbrook.example.com', demo_pw, now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"พว. ภัทรภร สุวรรณรัตน์"}'::jsonb, now(), now())
  ON CONFLICT (id) DO UPDATE SET raw_user_meta_data = EXCLUDED.raw_user_meta_data;
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (u_nurse2, u_nurse2, 'pattaraporn.s@overbrook.example.com', jsonb_build_object('sub', u_nurse2::text, 'email', 'pattaraporn.s@overbrook.example.com'), 'email', now(), now(), now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, full_name, email, division, department, position, approved, org_unit_id)
  VALUES (u_nurse2, 'พว. ภัทรภร สุวรรณรัตน์', 'pattaraporn.s@overbrook.example.com', 'ฝ่ายการพยาบาล', 'บริการเคลื่อนย้ายผู้ป่วย', 'พยาบาลวิชาชีพชำนาญการ', true, id_nursing_div)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, division = EXCLUDED.division, department = EXCLUDED.department, org_unit_id = id_nursing_div, approved = true;
  INSERT INTO public.user_roles (user_id, role) VALUES (u_nurse2, 'learner') ON CONFLICT DO NOTHING;

  -- IT 1: นายวรฉัตร จิตเจริญ (วิศวกรคอมพิวเตอร์)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u_it1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'worachat.c@overbrook.example.com', demo_pw, now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"นายวรฉัตร จิตเจริญ"}'::jsonb, now(), now())
  ON CONFLICT (id) DO UPDATE SET raw_user_meta_data = EXCLUDED.raw_user_meta_data;
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (u_it1, u_it1, 'worachat.c@overbrook.example.com', jsonb_build_object('sub', u_it1::text, 'email', 'worachat.c@overbrook.example.com'), 'email', now(), now(), now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, full_name, email, division, department, position, approved, org_unit_id)
  VALUES (u_it1, 'นายวรฉัตร จิตเจริญ', 'worachat.c@overbrook.example.com', 'ฝ่ายเทคโนโลยีสารสนเทศ', 'วิศวกรรมคอมพิวเตอร์', 'วิศวกรคอมพิวเตอร์และระบบเครือข่าย', true, id_com_unit)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, division = EXCLUDED.division, department = EXCLUDED.department, org_unit_id = id_com_unit, approved = true;
  INSERT INTO public.user_roles (user_id, role) VALUES (u_it1, 'learner') ON CONFLICT DO NOTHING;

  -- IT 2: น.ส. ณิชากานต์ พงษ์ศิริ (นักวิชาการคอมพิวเตอร์ IT)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (u_it2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'nichakan.p@overbrook.example.com', demo_pw, now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"น.ส. ณิชากานต์ พงษ์ศิริ"}'::jsonb, now(), now())
  ON CONFLICT (id) DO UPDATE SET raw_user_meta_data = EXCLUDED.raw_user_meta_data;
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (u_it2, u_it2, 'nichakan.p@overbrook.example.com', jsonb_build_object('sub', u_it2::text, 'email', 'nichakan.p@overbrook.example.com'), 'email', now(), now(), now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, full_name, email, division, department, position, approved, org_unit_id)
  VALUES (u_it2, 'น.ส. ณิชากานต์ พงษ์ศิริ', 'nichakan.p@overbrook.example.com', 'ฝ่ายเทคโนโลยีสารสนเทศ', 'วิศวกรรมคอมพิวเตอร์', 'นักวิเคราะห์ระบบสารสนเทศ', true, id_com_unit)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, division = EXCLUDED.division, department = EXCLUDED.department, org_unit_id = id_com_unit, approved = true;
  INSERT INTO public.user_roles (user_id, role) VALUES (u_it2, 'learner') ON CONFLICT DO NOTHING;

  -- =========================================================================
  -- 6. SEED REALISTIC ENROLLMENTS FOR CPR, IC, AND PDPA
  -- =========================================================================
  
  -- CPR: Assign u_nurse1 to Round 1, u_nurse2 to Round 2
  -- Leave several members unassigned so managers can test allocation!
  INSERT INTO public.enrollments (user_id, course_id, session_id)
  VALUES
    (u_nurse1, c_cpr, s_cpr_1),
    (u_nurse2, c_cpr, s_cpr_2),
    ('75945ba6-66ef-49bc-820c-26bca8efbd2a', c_cpr, s_cpr_1), -- ธนพล ชนะชัย (ICU)
    ('faeff63e-5829-491b-b547-489e084cb5a1', c_cpr, s_cpr_1), -- วรากร ศรีสุข (ICU)
    ('352c0f88-fdc3-41eb-ac1c-1956379a5d98', c_cpr, s_cpr_2)  -- จันทร์เพ็ญ วงศ์ใหญ่ (ICU)
  ON CONFLICT (user_id, course_id) DO UPDATE SET session_id = EXCLUDED.session_id;

  -- IC (Infection Control): Assign diverse personnel across rounds
  INSERT INTO public.enrollments (user_id, course_id, session_id)
  VALUES
    (u_nurse1, c_ic, s_ic_1),
    ('75945ba6-66ef-49bc-820c-26bca8efbd2a', c_ic, s_ic_1),
    ('a24e9bee-f828-421c-8ce6-813cb3eedbec', c_ic, s_ic_2), -- ปิยะ อินทร์แปลน
    ('e189298d-aa4e-4994-86ba-7330df7b284e', c_ic, s_ic_2)  -- บุญญา ใจดี
  ON CONFLICT (user_id, course_id) DO UPDATE SET session_id = EXCLUDED.session_id;

  -- PDPA: Assign IT staff and general hospital staff
  INSERT INTO public.enrollments (user_id, course_id, session_id)
  VALUES
    (u_it1, c_pdpa, s_pdpa_1),
    (u_it2, c_pdpa, s_pdpa_1),
    ('2e87f994-9d4f-4acf-b323-d4c6154d373a', c_pdpa, s_pdpa_2), -- สายฟ้า ชนะชัย
    ('a85cc42c-0ffb-4a47-9aad-0ffa4923d6f4', c_pdpa, s_pdpa_2)  -- จิราภรณ์ ศรีสุข
  ON CONFLICT (user_id, course_id) DO UPDATE SET session_id = EXCLUDED.session_id;

  -- Pre-test attempt for u_nurse1 in CPR (scored 100%)
  INSERT INTO public.test_attempts (user_id, course_id, kind, score, total, percent, passed)
  VALUES
    (u_nurse1, c_cpr, 'pre', 3, 3, 100, true),
    (u_it1, c_pdpa, 'pre', 2, 2, 100, true)
  ON CONFLICT DO NOTHING;

END $$;
