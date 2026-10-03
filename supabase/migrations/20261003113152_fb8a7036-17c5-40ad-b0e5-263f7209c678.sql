alter table public.profiles add column if not exists division text default '';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare first_user boolean;
begin
  select not exists(select 1 from public.profiles) into first_user;
  insert into public.profiles(id, full_name, email, division, department, position, approved)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'division',''),
    coalesce(new.raw_user_meta_data->>'department',''),
    coalesce(new.raw_user_meta_data->>'position',''),
    first_user);
  insert into public.user_roles(user_id, role) values (new.id, 'learner');
  if first_user then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

delete from public.courses where title = 'การควบคุมการติดเชื้อในโรงพยาบาล' and created_by is null;

with c as (
  insert into public.courses(title, description, category, hours, pass_score, published, created_by)
  values ('การดับเพลิงขั้นต้นและการใช้ถังดับเพลิง', 'หลักสูตรสำหรับบุคลากรทุกหน่วยงาน: ทฤษฎีการเกิดไฟ ประเภทของไฟและถังดับเพลิง วิธีใช้ถังดับเพลิงแบบ PASS และแนวปฏิบัติเมื่อเกิดเพลิงไหม้ในโรงพยาบาล (RACE)', 'ความปลอดภัย', 3, 80, true, null)
  returning id
), l as (
  insert into public.lessons(course_id, position, title, kind, body, video_url)
  select id, 1, 'ทฤษฎีการเกิดไฟและประเภทของไฟ', 'text', E'สามเหลี่ยมไฟ: เชื้อเพลิง + ความร้อน + ออกซิเจน หากตัดองค์ประกอบใดออก ไฟจะดับ\n\nประเภทของไฟ\n• ประเภท A: ของแข็งติดไฟได้ เช่น ไม้ กระดาษ ผ้า\n• ประเภท B: ของเหลวและก๊าซไวไฟ เช่น น้ำมัน แอลกอฮอล์\n• ประเภท C: อุปกรณ์ไฟฟ้าที่มีกระแสไฟ\n• ประเภท D: โลหะติดไฟ\n• ประเภท K: น้ำมันประกอบอาหาร', null from c
  union all
  select id, 2, 'วิธีใช้ถังดับเพลิง (PASS)', 'video', E'P – Pull ดึงสลักออก\nA – Aim เล็งหัวฉีดไปที่ฐานของไฟ\nS – Squeeze บีบคันบังคับ\nS – Sweep ส่ายหัวฉีดซ้าย-ขวา\nยืนเหนือลม ห่างจากไฟประมาณ 2-3 เมตร', 'https://www.youtube.com/watch?v=PQV71INDaqY' from c
  union all
  select id, 3, 'แนวปฏิบัติเมื่อเกิดเพลิงไหม้ในโรงพยาบาล (RACE)', 'text', E'R – Rescue ช่วยเหลือผู้ป่วยออกจากพื้นที่อันตราย\nA – Alarm แจ้งเหตุ กดสัญญาณเตือนภัย\nC – Confine ปิดประตูจำกัดพื้นที่เพลิง\nE – Extinguish/Evacuate ดับเพลิงขั้นต้น หรืออพยพตามแผน\nห้ามใช้ลิฟต์ระหว่างเกิดเพลิงไหม้', null from c
  returning course_id
)
insert into public.questions(course_id, position, question, options, correct_index)
select distinct course_id, x.pos, x.q, x.o::jsonb, x.a from l,
(values
  (1, 'องค์ประกอบของสามเหลี่ยมไฟคือข้อใด', '["น้ำ ลม ไฟ","เชื้อเพลิง ความร้อน ออกซิเจน","ไฟฟ้า ก๊าซ น้ำมัน","ควัน ความร้อน แสง"]', 1),
  (2, 'ไฟที่เกิดจากน้ำมันหรือแอลกอฮอล์เป็นไฟประเภทใด', '["A","B","C","D"]', 1),
  (3, 'ขั้นตอนแรกของการใช้ถังดับเพลิงตามหลัก PASS คือ', '["บีบคันบังคับ","เล็งที่ฐานไฟ","ดึงสลักออก","ส่ายหัวฉีด"]', 2),
  (4, 'ควรฉีดถังดับเพลิงไปที่ตำแหน่งใด', '["ยอดเปลวไฟ","ฐานของไฟ","ควันไฟ","ผนังรอบๆ"]', 1),
  (5, 'ตามหลัก RACE สิ่งแรกที่ต้องทำเมื่อพบเพลิงไหม้คือ', '["ดับไฟทันที","ช่วยเหลือผู้ป่วยออกจากพื้นที่อันตราย","ใช้ลิฟต์อพยพ","โทรหาญาติผู้ป่วย"]', 1)
) as x(pos, q, o, a);