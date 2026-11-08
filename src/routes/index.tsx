import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  BarChart3,
  CheckCircle2,
  GraduationCap,
  QrCode,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import hero from "@/assets/hero.jpg";
import { Blobs, Brand } from "@/components/Brand";
import { Medical3DBackground } from "@/components/Medical3DBackground";
import { FontSizeControl } from "@/components/FontSizeControl";
import { ThemeControl } from "@/components/ThemeControl";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "โรงพยาบาลโอเวอร์บรุ๊ค — ระบบพัฒนาศักยภาพบุคลากรและอบรมออนไลน์" },
      {
        name: "description",
        content:
          "ระบบพัฒนาศักยภาพบุคลากรทางการแพทย์ เรียนบทเรียน ทดสอบก่อน-หลังเรียน (Pre/Post-test) สแกนเช็กชื่อ และรับใบประกาศนียบัตรออนไลน์มาตรฐาน HA",
      },
      { property: "og:title", content: "โรงพยาบาลโอเวอร์บรุ๊ค — ระบบพัฒนาศักยภาพบุคลากร" },
      {
        property: "og:description",
        content: "เรียนบทเรียน ทดสอบก่อน-หลังเรียน และรับใบประกาศนียบัตรออนไลน์",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-page text-foreground">
      {/* 3D Interactive Medical Background (Watermark moved away from text) */}
      <Medical3DBackground />
      <Blobs />

      {/* Floating Modern Glass Header */}
      <div className="sticky top-0 z-50 px-4 pt-4 sm:px-6">
        <header className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/60 bg-white/75 px-5 py-3 shadow-sm backdrop-blur-xl transition-all">
          <Brand />
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeControl compact />
            <FontSizeControl compact />
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-deep px-4 py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground shadow-brand transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>เข้าสู่ระบบ</span>
              <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </header>
      </div>

      {/* Hero Section */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Hero Text & Key Actions */}
          <div className="lg:col-span-7">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary backdrop-blur-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span>ระบบอบรมและประเมินสมรรถนะบุคลากร</span>
            </div>

            {/* Headline */}
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-[3.25rem] leading-[1.18]">
              พัฒนาศักยภาพบุคลากร
              <br />
              <span className="bg-gradient-to-r from-primary via-teal-600 to-emerald-600 bg-clip-text text-transparent">
                เรียนได้ทุกที่ ทุกเวลา
              </span>
            </h1>

            {/* Subheading / Description with crystal-clear readability */}
            <p className="mt-4 max-w-xl text-base sm:text-lg leading-relaxed text-slate-600">
              แพลตฟอร์มจัดการเรียนรู้ (Hospital LMS) สำหรับบุคลากรทางการแพทย์ ครอบคลุมบทเรียนวิดีโอ 
              การทดสอบก่อน-หลังเรียน (Pre/Post-test) ระบบเช็กชื่อหน้าห้องอบรม และการออกใบประกาศนียบัตรรับรองมาตรฐานอัตโนมัติ
            </p>

            {/* CTA Buttons */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-deep px-6 py-3.5 text-sm sm:text-base font-semibold text-white shadow-brand transition-all duration-200 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>เริ่มเข้าสู่บทเรียน</span>
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/80 px-5 py-3.5 text-sm sm:text-base font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow hover:-translate-y-0.5 active:translate-y-0"
              >
                <ShieldCheck className="size-4 text-primary" />
                <span>ตรวจสอบใบประกาศ</span>
              </Link>
            </div>

            {/* Quick Feature Cards */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="group rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-white hover:shadow-md hover:-translate-y-0.5">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <GraduationCap className="size-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">แบบทดสอบ</div>
                    <div className="text-xs text-slate-500">ก่อน-หลังเรียน (Pre/Post)</div>
                  </div>
                </div>
              </div>

              <div className="group rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-white hover:shadow-md hover:-translate-y-0.5">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                    <Award className="size-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">ใบประกาศนียบัตร</div>
                    <div className="text-xs text-slate-500">ออกอัตโนมัติพร้อม QR</div>
                  </div>
                </div>
              </div>

              <div className="group rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-white hover:shadow-md hover:-translate-y-0.5">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
                    <BarChart3 className="size-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">รายงานผล</div>
                    <div className="text-xs text-slate-500">สรุปคะแนนรายแผนก</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Showcase with Floating Badges */}
          <div className="relative lg:col-span-5">
            {/* Ambient Glow */}
            <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-tr from-teal-400/20 to-primary/20 blur-2xl" />

            <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/50 p-2.5 shadow-2xl backdrop-blur-xl">
              <img
                src={hero}
                alt="บุคลากรทางการแพทย์ร่วมเรียนรู้และพัฒนาศักยภาพ"
                width={1536}
                height={1024}
                className="h-auto w-full rounded-2xl object-cover shadow-sm transition-transform duration-500 hover:scale-[1.01]"
              />

              {/* Floating Badge 1: HA Standard */}
              <div className="absolute left-6 top-6 flex items-center gap-2 rounded-2xl border border-white/90 bg-white/90 px-3.5 py-2 shadow-lg backdrop-blur-md">
                <div className="grid size-7 place-items-center rounded-lg bg-emerald-500 text-white">
                  <CheckCircle2 className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">มาตรฐานคุณภาพ HA</div>
                  <div className="text-[10px] text-slate-500">ผ่านเกณฑ์รับรองโรงพยาบาล</div>
                </div>
              </div>

              {/* Floating Badge 2: Real-time QR Check-in */}
              <div className="absolute bottom-6 right-6 flex items-center gap-2 rounded-2xl border border-white/90 bg-white/90 px-3.5 py-2 shadow-lg backdrop-blur-md">
                <div className="grid size-7 place-items-center rounded-lg bg-primary text-white">
                  <QrCode className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">QR Check-in</div>
                  <div className="text-[10px] text-slate-500">เช็กชื่อเข้าห้องอบรมทันที</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights Section */}
        <section className="mt-20">
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="size-3.5" />
              <span>ความสามารถหลักของระบบ</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              ออกแบบเพื่อการพัฒนาบุคลากรทางการแพทย์อย่างแท้จริง
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
              เชื่อมโยงการเรียนรู้ การทดสอบ และการประเมินผลเข้าด้วยกันในแพลตฟอร์มเดียว
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="group rounded-3xl border border-white/80 bg-white/70 p-6 shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-white hover:shadow-xl hover:-translate-y-1">
              <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                <GraduationCap className="size-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">หลักสูตรและบทเรียน</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                รองรับบทเรียนวิดีโอ สื่อการสอน เอกสาร PDF และบันทึกประวัติการเรียนแบบรายบุคคล
              </p>
            </div>

            <div className="group rounded-3xl border border-white/80 bg-white/70 p-6 shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-white hover:shadow-xl hover:-translate-y-1">
              <div className="grid size-12 place-items-center rounded-2xl bg-teal-500/10 text-teal-600 transition-transform duration-200 group-hover:scale-110">
                <ShieldCheck className="size-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">คลังข้อสอบและประเมินผล</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                แบบทดสอบก่อน-หลังเรียน สุ่มข้อสอบ จับเวลา และรองรับการนำเข้าข้อสอบผ่านไฟล์ Excel
              </p>
            </div>

            <div className="group rounded-3xl border border-white/80 bg-white/70 p-6 shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-white hover:shadow-xl hover:-translate-y-1">
              <div className="grid size-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 transition-transform duration-200 group-hover:scale-110">
                <QrCode className="size-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">ห้องอบรมและ QR Check-in</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                ระบบจัดการรอบอบรม สแกน QR Code เพื่อเช็กชื่อ พร้อมผังห้องอบรมจำลองแบบ 3D
              </p>
            </div>

            <div className="group rounded-3xl border border-white/80 bg-white/70 p-6 shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-white hover:shadow-xl hover:-translate-y-1">
              <div className="grid size-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 transition-transform duration-200 group-hover:scale-110">
                <BarChart3 className="size-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">รายงานผลและใบรับรอง</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                ออกใบประกาศนียบัตรอัตโนมัติพร้อมระบบสแกนตรวจสอบความถูกต้อง และสรุปรายงานรายแผนก
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-20 border-t border-slate-200/60 pt-8 pb-6 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} โรงพยาบาลโอเวอร์บรุ๊ค — ระบบพัฒนาศักยภาพบุคลากร (Overbrook Hospital LMS)</p>
          <p className="mt-1 text-[11px] text-slate-400">Continuous Medical Education & Hospital Accreditation Standards</p>
        </footer>
      </main>
    </div>
  );
}


