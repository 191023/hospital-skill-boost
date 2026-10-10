import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fileUrl } from "@/lib/auth";
import { Access } from "@/components/course-editor/AccessEditor";
import { Lessons, Questions } from "@/components/course-editor/LessonsEditor";
import { btn, inp, uploadCourseFile } from "@/components/course-editor/shared";
import { SurveyManager } from "@/components/Survey";
import { CertificateSettings } from "@/components/CertificateSettings";
import { SessionManager } from "@/components/Sessions";

export const Route = createFileRoute("/_authenticated/manage/$courseId")({
  head: () => ({ meta: [
    { title: "แก้ไขหลักสูตร — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "จัดการข้อมูล บทเรียน แบบทดสอบ แบบประเมิน และใบประกาศของหลักสูตร" },
    { property: "og:title", content: "แก้ไขหลักสูตร — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "จัดการหลักสูตรและใบประกาศสำหรับบุคลากรโรงพยาบาล" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Editor,
});

function Editor() {
  const { courseId } = Route.useParams();
  const [tab, setTab] = useState<"info" | "access" | "sessions" | "lessons" | "questions" | "survey" | "certificate">("info");
  const { data: course } = useQuery({
    queryKey: ["edit-course", courseId],
    queryFn: async () => (await supabase.from("courses").select("*").eq("id", courseId).maybeSingle()).data,
  });
  if (!course) return <div className="text-muted-foreground">กำลังโหลด...</div>;
  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/manage" className="text-sm text-primary">← หลักสูตรทั้งหมด</Link>
      <h1 className="mt-2 text-3xl font-bold">{course.title}</h1>
      <div className="glass mt-4 inline-flex flex-wrap rounded-2xl p-1 text-sm">
        {(["info", "access", "sessions", "lessons", "questions", "survey", "certificate"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-4 py-2 ${tab === t ? "bg-primary font-semibold text-primary-foreground" : "text-foreground/70"}`}>
            {{ info: "ข้อมูลหลักสูตร", access: "ผู้มีสิทธิ์เรียน", sessions: "รอบอบรม", lessons: "บทเรียน", questions: "ข้อสอบก่อน/หลังเรียน", survey: "แบบประเมินหลักสูตร", certificate: "ใบประกาศนียบัตร" }[t]}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "info" && <Info course={course} />}
        {tab === "access" && <Access courseId={courseId} audience={course.audience} />}
        {tab === "sessions" && <SessionManager courseId={courseId} />}
        {tab === "lessons" && <Lessons courseId={courseId} />}
        {tab === "questions" && <Questions courseId={courseId} />}
        {tab === "survey" && <SurveyManager courseId={courseId} />}
        {tab === "certificate" && <CertificateSettings course={course} />}
      </div>
    </div>
  );
}

type Course = NonNullable<Awaited<ReturnType<typeof getCourse>>>;
async function getCourse(id: string) {
  return (await supabase.from("courses").select("*").eq("id", id).maybeSingle()).data;
}

function Info({ course }: { course: Course }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [f, setF] = useState(course);
  const { data: cover } = useQuery({ queryKey: ["cover-url", f.cover_url], queryFn: () => fileUrl(f.cover_url) });

  async function save() {
    const { error } = await supabase.from("courses").update({
      title: f.title, description: f.description, category: f.category, hours: f.hours, pass_score: f.pass_score, published: f.published, cover_url: f.cover_url, training_year: f.training_year,
      require_pretest: f.require_pretest, require_posttest: f.require_posttest, require_survey: f.require_survey, issue_certificate: f.issue_certificate,
    }).eq("id", course.id);
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกแล้ว");
    qc.invalidateQueries();
  }
  async function del() {
    if (!confirm("ลบหลักสูตรนี้? ข้อมูลผู้เรียนจะถูกลบด้วย")) return;
    const { error } = await supabase.from("courses").delete().eq("id", course.id);
    if (error) { toast.error(error.message); return; }
    nav({ to: "/manage" });
  }
  return (
    <div className="glass space-y-4 rounded-3xl p-6">
      <L label="ชื่อหลักสูตร"><input className={inp} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></L>
      <L label="รายละเอียด"><textarea rows={4} className={inp} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></L>
      <div className="grid gap-4 sm:grid-cols-4">
        <L label="ปีที่อบรม (ค.ศ.)"><input type="number" min={2020} max={2100} className={inp} value={f.training_year} onChange={(e) => setF({ ...f, training_year: Number(e.target.value) })} /></L>
        <L label="หมวดหมู่"><input className={inp} value={f.category ?? ""} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="เช่น ICU, ความปลอดภัย" /></L>
        <L label="จำนวนชั่วโมง"><input type="number" className={inp} value={f.hours ?? 0} onChange={(e) => setF({ ...f, hours: Number(e.target.value) })} /></L>
        <L label="เกณฑ์ผ่านหลังเรียน (%)"><input type="number" min={0} max={100} className={inp} value={f.pass_score} onChange={(e) => setF({ ...f, pass_score: Number(e.target.value) })} /></L>
      </div>
      <L label="ภาพปก">
        <div className="flex items-center gap-4">
          {cover && <img src={cover} alt="" className="h-20 w-32 rounded-xl object-cover" />}
          <input type="file" accept="image/*" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            try { setF({ ...f, cover_url: await uploadCourseFile(file, course.id) }); toast.success("อัปโหลดแล้ว กดบันทึก"); } catch (err) { toast.error((err as Error).message); }
          }} />
        </div>
      </L>
      <div className="rounded-2xl border border-glass-border bg-glass p-4">
        <div className="mb-2 text-sm font-semibold">ขั้นตอนของหลักสูตร</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ["require_pretest", "ทำแบบทดสอบก่อนเรียน (Pre-test)"],
            ["require_posttest", "ทำแบบทดสอบหลังเรียน (Post-test) และใช้เกณฑ์ผ่าน"],
            ["require_survey", "ต้องตอบแบบประเมินหลักสูตรก่อนรับใบประกาศ"],
            ["issue_certificate", "ออกใบประกาศนียบัตรเมื่อจบหลักสูตร"],
          ] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /> {label}</label>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">การปิดขั้นตอนจะซ่อนจากผู้เรียนเท่านั้น ผลสอบหรือแบบประเมินที่ทำไปแล้วยังอยู่ครบ</p>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /> เผยแพร่ให้ผู้เรียนเห็น</label>
      <div className="flex justify-between">
        <button onClick={del} className="text-sm font-semibold text-destructive">ลบหลักสูตร</button>
        <button onClick={save} className={btn}>บันทึก</button>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>{children}</label>;
}
