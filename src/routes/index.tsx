import { createFileRoute, Link } from "@tanstack/react-router";
import hero from "@/assets/hero.jpg";
import { Blobs, Brand } from "@/components/Brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "โรงพยาบาลโอเวอร์บรุ๊ค — ระบบอบรมออนไลน์บุคลากร" },
      { name: "description", content: "เรียนบทเรียน ทดสอบก่อน-หลังเรียน และรับใบประกาศนียบัตรออนไลน์สำหรับบุคลากรโรงพยาบาล" },
      { property: "og:title", content: "โรงพยาบาลโอเวอร์บรุ๊ค — ระบบอบรมออนไลน์บุคลากร" },
      { property: "og:description", content: "เรียนบทเรียน ทดสอบก่อน-หลังเรียน และรับใบประกาศนียบัตรออนไลน์" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-page">
      <Blobs />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Brand />
        <Link to="/auth" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brand">
          เข้าสู่ระบบ
        </Link>
      </header>
      <main className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-deep/70">ระบบอบรมออนไลน์</div>
          <h1 className="mt-3 text-4xl font-bold leading-tight lg:text-5xl">
            พัฒนาศักยภาพบุคลากร
            <br />
            <span className="text-primary">เรียนได้ทุกที่ ทุกเวลา</span>
          </h1>
          <p className="mt-5 max-w-lg text-muted-foreground">
            บทเรียนวิดีโอ เอกสาร และแบบทดสอบก่อน-หลังเรียน พร้อมออกใบประกาศนียบัตรอัตโนมัติเมื่อผ่านเกณฑ์
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/auth" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-brand">
              เริ่มเรียน
            </Link>
          </div>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
            {[
              ["ทดสอบ", "ก่อน/หลังเรียน"],
              ["ใบประกาศ", "ออกอัตโนมัติ"],
              ["รายงาน", "สรุปผลรายแผนก"],
            ].map(([a, b]) => (
              <div key={a} className="glass rounded-2xl p-3">
                <div className="text-sm font-bold">{a}</div>
                <div className="text-xs text-muted-foreground">{b}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass overflow-hidden rounded-3xl p-2">
          <img src={hero} alt="บุคลากรโรงพยาบาลเรียนออนไลน์" width={1536} height={1024} className="rounded-2xl" />
        </div>
      </main>
    </div>
  );
}

