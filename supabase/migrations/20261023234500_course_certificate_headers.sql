-- Add customizable organization name and department subtitle to courses for certificates
alter table public.courses
  add column if not exists organization_name text default 'โรงพยาบาลโอเวอร์บรุ๊ค',
  add column if not exists department_subtitle text default 'ศูนย์พัฒนาศักยภาพบุคลากร';
