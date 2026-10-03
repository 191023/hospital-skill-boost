with c as (
  insert into public.courses(title, description, category, hours, pass_score, published, created_by)
  values ('การควบคุมการติดเชื้อในโรงพยาบาล', 'หลักสูตรตัวอย่าง: หลักการป้องกันและควบคุมการติดเชื้อ การล้างมือ และการใช้อุปกรณ์ป้องกันส่วนบุคคล', 'ความปลอดภัย', 4, 80, true, null)
  returning id
), l as (
  insert into public.lessons(course_id, position, title, kind, body, video_url)
  select id, 1, 'การล้างมือ 7 ขั้นตอน', 'video', 'ชมวิดีโอและฝึกล้างมือตามขั้นตอนให้ครบ 7 ขั้น ใช้เวลาอย่างน้อย 20 วินาที', 'https://www.youtube.com/watch?v=IisgnbMfKvI' from c
  union all
  select id, 2, 'อุปกรณ์ป้องกันส่วนบุคคล (PPE)', 'text', E'ลำดับการสวม: เสื้อกาวน์ → หน้ากาก → แว่นตา/face shield → ถุงมือ\nลำดับการถอด: ถุงมือ → แว่นตา → เสื้อกาวน์ → หน้ากาก แล้วล้างมือทันที', null from c
  returning course_id
)
insert into public.questions(course_id, position, question, options, correct_index)
select distinct course_id, x.pos, x.q, x.o::jsonb, x.a from l,
(values
  (1, 'การล้างมือที่ถูกต้องควรใช้เวลาอย่างน้อยกี่วินาที', '["5 วินาที","10 วินาที","20 วินาที","60 วินาที"]', 2),
  (2, 'อุปกรณ์ชิ้นใดควรถอดเป็นชิ้นแรก', '["หน้ากาก","ถุงมือ","เสื้อกาวน์","แว่นตา"]', 1),
  (3, 'ขั้นตอนการล้างมือมาตรฐานมีกี่ขั้นตอน', '["5","6","7","8"]', 2)
) as x(pos, q, o, a);