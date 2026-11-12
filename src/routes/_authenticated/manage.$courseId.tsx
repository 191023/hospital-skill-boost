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
import { PhotosEditor } from "@/components/course-editor/PhotosEditor";
import { AttendeesManager } from "@/components/course-editor/AttendeesManager";
import { DocumentsEditor } from "@/components/course-editor/DocumentsEditor";
import { ClassroomHubModal } from "@/components/course-editor/ClassroomHubModal";
import { InstructorAnalytics } from "@/components/course-editor/InstructorAnalytics";
import { Monitor, Armchair, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { notifyCoursePublished } from "@/lib/telegram.functions";

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

type Tab = "info" | "access" | "sessions" | "attendees" | "analytics" | "lessons" | "questions" | "survey" | "certificate" | "photos" | "documents";

function Editor() {
  const { courseId } = Route.useParams();


  const [classroomHubOpen, setClassroomHubOpen] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const notifyCourseFn = useServerFn(notifyCoursePublished);
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab") as Tab;
      if (q && ["info", "access", "sessions", "attendees", "analytics", "lessons", "questions", "survey", "certificate", "photos", "documents"].includes(q)) {
        return q;
      }
    }
    return "info";
  });
  const { data: course } = useQuery({
    queryKey: ["edit-course", courseId],
    queryFn: async () => (await supabase.from("courses").select("*").eq("id", courseId).maybeSingle()).data,
  });
  if (!course) return <div className="text-muted-foreground">กำลังโหลด...</div>;

  const isOnline = (course.training_type || "classroom") === "online";


  async function handleBroadcastTelegram() {
    if (!course.published) {
      toast.error("กรุณาเผยแพร่หลักสูตรก่อนส่งประกาศ Telegram");
      return;
    }
    if (!confirm(`ต้องการส่งข้อความแจ้งเตือนหลักสูตร "${course.title}" ไปยังกลุ่ม Telegram ที่ตั้งค่าไว้หรือไม่?`)) return;
    setBroadcasting(true);
    try {
      const res = await notifyCourseFn({ data: { courseId: course.id } });
      if (res.success) {
        toast.success("ส่งประกาศเปิดหลักสูตรลง Telegram เรียบร้อยแล้ว ✈️");
      } else {
        toast.error(res.error || "ไม่สามารถส่งประกาศได้");
      }
    } catch (err: any) {
      toast.error(`ส่งประกาศไม่สำเร็จ: ${err.message || String(err)}`);
    } finally {
      setBroadcasting(false);
    }
  }
  const allTabs = [
    "info",
    "access",
    ...(isOnline ? [] : ["sessions"]),
    "attendees",
    "analytics",
    "lessons",
    "questions",
    "survey",
    "certificate",
    "photos",
    "documents",
  ] as const;

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/manage" className="text-sm text-primary">← หลักสูตรทั้งหมด</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{course.title}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isOnline ? "bg-primary/15 text-primary" : "bg-amber/15 text-amber"}`}>
          {isOnline ? "🌐 อบรมออนไลน์ (Online)" : "🏢 อบรมในห้องประชุม (On-site)"}
        </span>
        <button
          type="button"
          onClick={handleBroadcastTelegram}
          disabled={broadcasting}
          className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 transition-all shadow-xs"
        >
          <Send className="size-3.5" />
          {broadcasting ? "กำลังส่ง..." : "📢 แจ้งลง Telegram"}
        </button>
        {!isOnline && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setClassroomHubOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-all shadow-xs"
            >
              <Monitor className="size-4" />
              ฉายจอ QR (Classroom Hub)
            </button>
            <Link
              to="/manage/$courseId/room"
              params={{ courseId }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-95 transition-all shadow-brand"
            >
              <Armchair className="size-4" />
              ห้องอบรม 3D
            </Link>
          </div>
        )}
      </div>
      <div className="glass mt-4 inline-flex flex-wrap rounded-2xl p-1 text-sm">
        {allTabs.map((t) => (
          <button key={t} onClick={() => setTab(t as Tab)} className={`rounded-xl px-4 py-2 ${tab === t ? "bg-primary font-semibold text-primary-foreground" : "text-foreground/70"}`}>
            {{ info: "ข้อมูลหลักสูตร", access: "ผู้มีสิทธิ์เรียน", sessions: "รอบอบรม", attendees: "ผู้ลงทะเบียน", analytics: "📊 วิเคราะห์ข้อสอบ & KPI", lessons: "บทเรียน", questions: "ข้อสอบก่อน/หลังเรียน", survey: "แบบประเมินหลักสูตร", certificate: "ใบประกาศนียบัตร", photos: "ภาพกิจกรรม", documents: "เอกสารแนบ" }[t]}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "info" && <Info course={course} />}
        {tab === "access" && <Access courseId={courseId} audience={course.audience} />}
        {tab === "sessions" && !isOnline && <SessionManager courseId={courseId} />}
        {tab === "attendees" && <AttendeesManager courseId={courseId} />}
        {tab === "analytics" && <InstructorAnalytics courseId={courseId} />}
        {tab === "lessons" && <Lessons courseId={courseId} />}
        {tab === "questions" && <Questions courseId={courseId} onOpenAnalytics={() => setTab("analytics")} />}
        {tab === "survey" && <SurveyManager courseId={courseId} />}
        {tab === "certificate" && <CertificateSettings course={course} />}
        {tab === "photos" && <PhotosEditor courseId={courseId} />}
        {tab === "documents" && <DocumentsEditor courseId={courseId} />}
      </div>
      <ClassroomHubModal
        courseId={courseId}
        courseTitle={course.title}
        open={classroomHubOpen}
        onClose={() => setClassroomHubOpen(false)}
        initialMode="projector"
      />
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
  const notifyCourseFn = useServerFn(notifyCoursePublished);
  const [broadcasting, setBroadcasting] = useState(false);

  async function handleBroadcast() {
    if (!f.published) {
      toast.error("กรุณาเผยแพร่หลักสูตรและกดบันทึกก่อนส่งประกาศ Telegram");
      return;
    }
    if (!confirm(`ส่งข้อความประกาศหลักสูตร "${f.title}" ไปยังกลุ่ม Telegram ทันที?`)) return;
    setBroadcasting(true);
    try {
      const res = await notifyCourseFn({ data: { courseId: course.id } });
      if (!res.success) {
        toast.error(`ส่งไม่สำเร็จ: ${res.error}`);
      } else {
        toast.success("ส่งประกาศหลักสูตรเข้ากลุ่ม Telegram เรียบร้อยแล้ว ✈️");
      }
    } catch (err: any) {
      toast.error(`ส่งไม่สำเร็จ: ${err.message || String(err)}`);
    } finally {
      setBroadcasting(false);
    }
  }

  async function save() {
    const { error } = await supabase.from("courses").update({
      title: f.title, description: f.description, category: f.category, hours: f.hours, pass_score: f.pass_score, published: f.published, cover_url: f.cover_url, training_year: f.training_year,
      training_type: f.training_type || "classroom",
      require_pretest: f.require_pretest, require_posttest: f.require_posttest, require_survey: f.require_survey, issue_certificate: f.issue_certificate,
    }).eq("id", course.id);
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกแล้ว");
    qc.invalidateQueries();
  }
  async function del() {
    if (!confirm("ลบหลักสูตรนี้? (ระบบจะเก็บประวัติการอบรมของผู้เรียนเดิมไว้)")) return;
    const { error } = await supabase.from("courses").delete().eq("id", course.id);
    if (error) { toast.error(error.message); return; }
    nav({ to: "/manage" });
  }
  return (
    <div className="glass space-y-4 rounded-3xl p-6">
      {/* Training Type Selector */}
      <L label="รูปแบบการอบรม (ประเภทหลักสูตร)">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all ${f.training_type === "online" ? "border-primary bg-primary/10 shadow-sm" : "border-glass-border bg-glass hover:bg-card"}`}>
            <input
              type="radio"
              name="training_type"
              value="online"
              checked={f.training_type === "online"}
              onChange={() => setF({ ...f, training_type: "online" })}
              className="mt-1"
            />
            <div>
              <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <span>🌐 อบรมออนไลน์ (Online E-Learning)</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                เรียนได้ทุกที่ ทุกเวลา ตลอด 24 ชม. ผู้เรียนลงทะเบียนแล้วทำ Pre-test ศึกษาบทเรียนวิดีโอ/เอกสาร และทำ Post-test ได้ทันทีโดยไม่ต้องเลือกรอบและไม่ต้องสแกนเช็กอิน
              </p>
            </div>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all ${(f.training_type === "classroom" || !f.training_type) ? "border-primary bg-primary/10 shadow-sm" : "border-glass-border bg-glass hover:bg-card"}`}>
            <input
              type="radio"
              name="training_type"
              value="classroom"
              checked={f.training_type === "classroom" || !f.training_type}
              onChange={() => setF({ ...f, training_type: "classroom" })}
              className="mt-1"
            />
            <div>
              <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <span>🏢 อบรมในห้องประชุม (On-site Training)</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                มีการจัดรอบอบรม ผู้เรียนต้องเลือกรอบ และต้องสแกน QR Code เช็กอินหน้าห้องอบรมก่อน จึงจะปลดล็อกเนื้อหาบทเรียนและแบบทดสอบหลังเรียน
              </p>
            </div>
          </label>
        </div>
      </L>

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
        <div className="flex items-center gap-2">
          {f.published && (
            <button
              type="button"
              onClick={handleBroadcast}
              disabled={broadcasting}
              className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{broadcasting ? "กำลังส่ง..." : "ประกาศลง Telegram"}</span>
            </button>
          )}
          <button onClick={save} className={btn}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>{children}</label>;
}
