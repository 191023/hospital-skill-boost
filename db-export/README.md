# การส่งออกข้อมูล (Database Export)

ไฟล์ CSV ในโฟลเดอร์นี้คือข้อมูลทั้งหมดจากฐานข้อมูลของระบบอบรมออนไลน์
ส่งออกเมื่อ 7 ตุลาคม 2026 เพื่อใช้ย้ายไปยังฐานข้อมูลใหม่ (เช่น Supabase ส่วนตัวของโรงพยาบาล)

## รายการไฟล์

| ไฟล์ | เนื้อหา |
|---|---|
| profiles.csv | ข้อมูลสมาชิก (ชื่อ อีเมล ฝ่าย แผนก ตำแหน่ง สถานะอนุมัติ) |
| user_roles.csv | บทบาทของสมาชิก (admin / instructor / learner) |
| courses.csv | หลักสูตรทั้งหมด |
| lessons.csv | บทเรียนในแต่ละหลักสูตร |
| questions.csv | ข้อสอบ (รวมเฉลย correct_index) |
| enrollments.csv | การลงทะเบียนเรียน |
| lesson_progress.csv | ความคืบหน้าบทเรียน |
| test_attempts.csv | ผลสอบก่อน/หลังเรียน |
| certificates.csv | ใบประกาศนียบัตรที่ออกแล้ว |
| attendance.csv | การเช็คชื่อเข้าอบรมสด |
| course_access.csv | สิทธิ์เข้าเรียนตามฝ่าย/แผนก/บุคคล |
| survey_questions.csv | คำถามแบบประเมินหลักสูตร |
| survey_responses.csv | คำตอบแบบประเมิน |
| survey_summaries.csv | สรุปแบบประเมินโดย AI |

## วิธีนำเข้าฐานข้อมูลใหม่

1. สร้างโครงสร้างตารางก่อน โดยรันไฟล์ใน `supabase/migrations` ตามลำดับวันที่
2. นำเข้า CSV ตามลำดับนี้ (เพื่อไม่ให้ foreign key ขัดกัน):
   profiles → user_roles → courses → lessons → questions → course_access →
   enrollments → lesson_progress → test_attempts → certificates → attendance →
   survey_questions → survey_responses → survey_summaries
3. ใช้คำสั่ง `\COPY public.<ตาราง> FROM 'ไฟล์.csv' WITH CSV HEADER` ใน psql
   หรือนำเข้าผ่านหน้า Table Editor ของ Supabase

## ข้อควรระวัง

- ไฟล์เหล่านี้มีข้อมูลส่วนบุคคล (ชื่อ อีเมล) เก็บรักษาให้ปลอดภัย และอย่า commit
  ขึ้น GitHub สาธารณะ — ใช้ repository แบบ private เท่านั้น
- รหัสผ่านของสมาชิกไม่ได้อยู่ในไฟล์เหล่านี้ (เก็บในระบบ auth แยกต่างหาก)
  สมาชิกต้องตั้งรหัสผ่านใหม่หลังย้าย หรือย้ายบัญชี auth ผ่านเครื่องมือของ Supabase
- ไฟล์เป็น UTF-8 with BOM เปิดด้วย Excel ได้ทันทีโดยภาษาไทยไม่เพี้ยน
