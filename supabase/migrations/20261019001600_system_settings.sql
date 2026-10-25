-- Migration: Create system_settings table and add license_no to profiles
alter table public.profiles add column if not exists license_no text;

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

alter table public.system_settings enable row level security;

-- Authenticated users can view settings
create policy "system_settings_read"
  on public.system_settings
  for select
  to authenticated
  using (true);

-- Only admin can insert/update settings
create policy "system_settings_admin_insert"
  on public.system_settings
  for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "system_settings_admin_update"
  on public.system_settings
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Default Settings Seed
insert into public.system_settings (key, value) values
  ('hospital_profile', '{
    "name_th": "โรงพยาบาลโอเวอร์บรุ๊ค",
    "name_en": "Overbrook Hospital",
    "center_name": "ศูนย์พัฒนาศักยภาพบุคลากร",
    "contact_email": "hrd@overbrook.example.com",
    "contact_tel": "053-910100 ต่อ 1234",
    "address": "17 ถนนสิงหไคล ตำบลเวียง อำเภอเมือง จังหวัดเชียงราย 57000"
  }'::jsonb),
  ('training_policy', '{
    "annual_hours_target": 20,
    "doctor_hours_target": 30,
    "nurse_hours_target": 25,
    "staff_hours_target": 15,
    "default_pass_score": 80,
    "require_attendance_percent": 80,
    "year_type": "calendar"
  }'::jsonb),
  ('certificate_rules', '{
    "number_pattern": "OVB-{YEAR}-{RUNNING}",
    "director_name": "นพ. กฤษณ์ วงศ์วิวัฒน์",
    "director_title": "ผู้อำนวยการโรงพยาบาลโอเวอร์บรุ๊ค",
    "verify_public_enabled": true
  }'::jsonb),
  ('notification_settings', '{
    "email_reminders_enabled": true,
    "line_notify_enabled": false,
    "line_token": "",
    "remind_hours_before": 24
  }'::jsonb)
on conflict (key) do nothing;
