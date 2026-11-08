-- Migration: Add training_type to courses ('online' vs 'classroom')
alter table public.courses
add column if not exists training_type text not null default 'classroom';

-- Set existing courses without sessions to 'online'
update public.courses c
set training_type = 'online'
where not exists (
  select 1 from public.course_sessions s
  where s.course_id = c.id
);
