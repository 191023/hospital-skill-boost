-- Auto-seed default survey questions when require_survey is enabled on a course

-- 1. Function to insert default survey questions
create or replace function public.seed_default_survey_questions(_course_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.survey_questions where course_id = _course_id) then
    insert into public.survey_questions (course_id, position, kind, prompt) values
      (_course_id, 1, 'rating', 'ความพึงพอใจโดยรวมต่อหลักสูตร'),
      (_course_id, 2, 'rating', 'เนื้อหานำไปใช้ในการทำงานได้จริง'),
      (_course_id, 3, 'rating', 'ความเหมาะสมของสื่อและระยะเวลา'),
      (_course_id, 4, 'text', 'สิ่งที่ชอบในหลักสูตรนี้'),
      (_course_id, 5, 'text', 'ข้อเสนอแนะเพื่อปรับปรุงหลักสูตร');
  end if;
end;
$$;

-- 2. Trigger function on courses table
create or replace function public.handle_course_survey_setting()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.require_survey = true then
    perform public.seed_default_survey_questions(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_course_survey_setting on public.courses;
create trigger trg_course_survey_setting
after insert or update of require_survey on public.courses
for each row execute function public.handle_course_survey_setting();

-- 3. Seed questions for all existing courses that require survey but have 0 questions
do $$
declare
  c record;
begin
  for c in select id from public.courses where require_survey = true loop
    perform public.seed_default_survey_questions(c.id);
  end loop;
end $$;
