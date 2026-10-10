# การติดตั้งระบบที่ปลายทาง (Fresh Install)

คู่มือนี้อธิบายการนำโค้ดและโครงสร้างฐานข้อมูลไปติดตั้งบน Supabase โปรเจกต์ใหม่
พร้อมข้อมูลตัวอย่างสำหรับทดสอบระบบ

## 1. โครงสร้างฐานข้อมูล

ไฟล์ migration ทั้งหมดอยู่ที่ `supabase/migrations/` เรียงตามวันที่ในชื่อไฟล์
นำไปรันตามลำดับบนฐานข้อมูลปลายทาง ด้วยวิธีใดวิธีหนึ่ง:

**วิธี A — Supabase CLI (แนะนำ)**

```sh
supabase link --project-ref <project-ref-ปลายทาง>
supabase db push
```

**วิธี B — psql**

```sh
for f in supabase/migrations/*.sql; do
  psql "<connection-string>" -f "$f"
done
```

**วิธี C — SQL Editor** — เปิดแต่ละไฟล์แล้ววางรันทีละไฟล์ตามลำดับ

migration เหล่านี้สร้างตาราง ฟังก์ชัน (ตรวจคะแนน ออกใบประกาศ เช็คชื่อ รายงาน)
นโยบายสิทธิ์ (RLS) และ storage bucket ที่จำเป็นทั้งหมด

## 2. ข้อมูลตัวอย่าง

หลังรัน migration ครบแล้ว ให้รัน:

```sh
psql "<connection-string>" -f supabase/seed.sql
```

`supabase/seed.sql` สร้างข้อมูลสมมติ (ไม่มีข้อมูลส่วนบุคคลจริง):

- หลักสูตร 2 รายการ (ดับเพลิง / สารเคมี) พร้อมบทเรียน 7 บท
- ข้อสอบ 10 ข้อ และคำถามแบบประเมิน 6 ข้อ
- รอบอบรมตัวอย่าง 3 รอบ พร้อมรหัสเช็คชื่อ

สคริปต์รันซ้ำได้โดยไม่เกิดข้อมูลซ้ำ (idempotent)

## 3. สร้างผู้ดูแลระบบคนแรก

1. เปิดเว็บแล้วสมัครสมาชิกด้วยอีเมลของผู้ดูแล
2. รัน SQL นี้เพื่ออนุมัติและตั้งสิทธิ์ admin:

```sql
update public.profiles set approved = true where email = '<อีเมลผู้ดูแล>';
insert into public.user_roles (user_id, role)
select id, 'admin' from public.profiles where email = '<อีเมลผู้ดูแล>';
```

หลังจากนี้ผู้ดูแลสามารถเพิ่มสมาชิก อนุมัติผู้สมัคร และจัดการหลักสูตรผ่านหน้าเว็บได้ทั้งหมด

## 4. ตั้งค่าแอป

คัดลอก `.env.example` (หรือสร้าง `.env`) แล้วใส่ค่าของโปรเจกต์ปลายทาง:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=<project-ref>
```

## ข้อควรระวัง

- **ห้าม** นำโฟลเดอร์ `db-export/` (ข้อมูลจริง มีชื่อ-อีเมลบุคลากร) ขึ้น GitHub สาธารณะ
  — โฟลเดอร์นี้ถูกกันไว้ใน `.gitignore` แล้ว ใช้ repository แบบ private เท่านั้นหากจำเป็น
- รหัสผ่านสมาชิกไม่ได้อยู่ใน seed หรือ export ใด ๆ — สมาชิกต้องสมัคร/ตั้งรหัสผ่านใหม่ที่ปลายทาง
