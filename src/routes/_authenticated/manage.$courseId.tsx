import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fileUrl } from "@/lib/auth";
import { kindLabel } from "@/lib/data";
import { divisions, orgChart } from "@/lib/org";
import { SurveyManager } from "@/components/Survey";

export const Route = createFileRoute("/_authenticated/manage/$courseId")({
  head: () => ({ meta: [{ title: "แก้ไขหลักสูตร — ระบบอบรมออนไลน์" }] }),
  component: Editor,
});

const inp = "w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const btn = "rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brand disabled:opacity-60";

async function upload(file: File, courseId: string) {
  const path = `${courseId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage.from("course-files").upload(path, file);
  if (error) throw error;
  return path;
}

function Editor() {
  const { courseId } = Route.useParams();
  const [tab, setTab] = useState<"info" | "access" | "lessons" | "questions" | "survey">("info");
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
        {(["info", "access", "lessons", "questions", "survey"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-4 py-2 ${tab === t ? "bg-primary font-semibold text-primary-foreground" : "text-foreground/70"}`}>
            {{ info: "ข้อมูลหลักสูตร", access: "ผู้มีสิทธิ์เรียน", lessons: "บทเรียน", questions: "ข้อสอบก่อน/หลังเรียน", survey: "แบบประเมินหลักสูตร" }[t]}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "info" && <Info course={course} />}
        {tab === "access" && <Access courseId={courseId} audience={(course as { audience?: string }).audience ?? "all"} />}
        {tab === "lessons" && <Lessons courseId={courseId} />}
        {tab === "questions" && <Questions courseId={courseId} />}
        {tab === "survey" && <SurveyManager courseId={courseId} />}
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
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => { fileUrl(f.cover_url).then(setCover); }, [f.cover_url]);

  async function save() {
    const { error } = await supabase.from("courses").update({
      title: f.title, description: f.description, category: f.category, hours: f.hours, pass_score: f.pass_score, published: f.published, cover_url: f.cover_url, training_year: f.training_year,
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
            try { setF({ ...f, cover_url: await upload(file, course.id) }); toast.success("อัปโหลดแล้ว กดบันทึก"); } catch (err) { toast.error((err as Error).message); }
          }} />
        </div>
      </L>
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

function Lessons({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["edit-lessons", courseId],
    queryFn: async () => (await supabase.from("lessons").select("*").eq("course_id", courseId).order("position")).data ?? [],
  });
  async function add() {
    const { error } = await supabase.from("lessons").insert({ course_id: courseId, title: `บทที่ ${data.length + 1}`, position: data.length + 1, kind: "text" });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["edit-lessons", courseId] });
  }
  return (
    <div className="space-y-4">
      {data.map((l) => <LessonRow key={l.id} lesson={l} courseId={courseId} />)}
      <button onClick={add} className="w-full rounded-2xl border-2 border-dashed border-primary/30 py-4 text-sm font-semibold text-primary">+ เพิ่มบทเรียน</button>
    </div>
  );
}

type Lesson = { id: string; title: string; kind: string; body: string | null; video_url: string | null; file_url: string | null; position: number; course_id: string; created_at: string };

function LessonRow({ lesson, courseId }: { lesson: Lesson; courseId: string }) {
  const qc = useQueryClient();
  const [f, setF] = useState(lesson);
  const refresh = () => qc.invalidateQueries({ queryKey: ["edit-lessons", courseId] });
  async function save() {
    const { error } = await supabase.from("lessons").update({ title: f.title, kind: f.kind, body: f.body, video_url: f.video_url, file_url: f.file_url, position: f.position }).eq("id", lesson.id);
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกบทเรียนแล้ว"); refresh();
  }
  async function del() {
    if (!confirm("ลบบทเรียนนี้?")) return;
    await supabase.from("lessons").delete().eq("id", lesson.id); refresh();
  }
  return (
    <div className="glass space-y-3 rounded-3xl p-5">
      <div className="grid gap-3 sm:grid-cols-[80px_1fr_160px]">
        <input type="number" className={inp} value={f.position} onChange={(e) => setF({ ...f, position: Number(e.target.value) })} title="ลำดับ" />
        <input className={inp} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <select className={inp} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          {Object.entries(kindLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {f.kind === "video" && <input className={inp} placeholder="ลิงก์ YouTube" value={f.video_url ?? ""} onChange={(e) => setF({ ...f, video_url: e.target.value })} />}
      {f.kind === "pdf" && (
        <div className="flex items-center gap-3 text-sm">
          <input type="file" accept="application/pdf" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            try { setF({ ...f, file_url: await upload(file, courseId) }); toast.success("อัปโหลดแล้ว กดบันทึก"); } catch (err) { toast.error((err as Error).message); }
          }} />
          {f.file_url && <span className="text-mint">✓ มีไฟล์แล้ว</span>}
        </div>
      )}
      <textarea rows={4} className={inp} placeholder="เนื้อหา / คำอธิบายประกอบ" value={f.body ?? ""} onChange={(e) => setF({ ...f, body: e.target.value })} />
      <div className="flex justify-between">
        <button onClick={del} className="text-sm text-destructive">ลบ</button>
        <button onClick={save} className={btn}>บันทึก</button>
      </div>
    </div>
  );
}

function Questions({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["edit-questions", courseId],
    queryFn: async () => (await supabase.from("questions").select("*").eq("course_id", courseId).order("position")).data ?? [],
  });
  const [q, setQ] = useState({ question: "", options: ["", "", "", ""], correct: 0 });
  async function add() {
    const opts = q.options.filter((o) => o.trim());
    if (!q.question.trim() || opts.length < 2) { toast.error("กรอกคำถามและตัวเลือกอย่างน้อย 2 ข้อ"); return; }
    const { error } = await supabase.from("questions").insert({ course_id: courseId, question: q.question, options: opts, correct_index: Math.min(q.correct, opts.length - 1), position: data.length + 1 });
    if (error) { toast.error(error.message); return; }
    setQ({ question: "", options: ["", "", "", ""], correct: 0 });
    qc.invalidateQueries({ queryKey: ["edit-questions", courseId] });
  }
  async function del(id: string) {
    await supabase.from("questions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["edit-questions", courseId] });
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">ข้อสอบชุดนี้ใช้ทั้งก่อนเรียนและหลังเรียน เพื่อเปรียบเทียบพัฒนาการ</p>
      {data.map((x, i) => (
        <div key={x.id} className="glass rounded-3xl p-5">
          <div className="flex justify-between gap-4">
            <div className="font-semibold">{i + 1}. {x.question}</div>
            <button onClick={() => del(x.id)} className="text-sm text-destructive">ลบ</button>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {(x.options as string[]).map((o, oi) => (
              <li key={oi} className={oi === x.correct_index ? "font-semibold text-mint" : "text-muted-foreground"}>{"กขคงจฉ"[oi]}. {o} {oi === x.correct_index && "✓"}</li>
            ))}
          </ul>
        </div>
      ))}
      <div className="glass space-y-3 rounded-3xl p-5">
        <div className="font-semibold">เพิ่มข้อสอบ</div>
        <input className={inp} placeholder="คำถาม" value={q.question} onChange={(e) => setQ({ ...q, question: e.target.value })} />
        {q.options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="correct" checked={q.correct === i} onChange={() => setQ({ ...q, correct: i })} title="คำตอบที่ถูก" />
            <input className={inp} placeholder={`ตัวเลือก ${"กขคง"[i]}`} value={o} onChange={(e) => { const opts = [...q.options]; opts[i] = e.target.value; setQ({ ...q, options: opts }); }} />
          </div>
        ))}
        <div className="text-[11px] text-muted-foreground">เลือกวงกลมหน้าคำตอบที่ถูกต้อง</div>
        <div className="flex justify-end"><button onClick={add} className={btn}>+ เพิ่มข้อสอบ</button></div>
      </div>
    </div>
  );
}

function Access({ courseId, audience: initial }: { courseId: string; audience: string }) {
  const qc = useQueryClient();
  const [audience, setAudience] = useState(initial);
  const [search, setSearch] = useState("");
  const { data: rules = [] } = useQuery({
    queryKey: ["access", courseId],
    queryFn: async () => ((await (supabase as any).from("course_access").select("*").eq("course_id", courseId)).data ?? []) as { id: string; kind: string; value: string }[],
  });
  const { data: people = [] } = useQuery({
    queryKey: ["access-people"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, department").eq("approved", true).order("full_name")).data ?? [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["access", courseId] }); qc.invalidateQueries({ queryKey: ["edit-course", courseId] }); };
  const has = (kind: string, value: string) => rules.find((r) => r.kind === kind && r.value === value);
  async function setMode(m: string) {
    setAudience(m);
    const { error } = await supabase.from("courses").update({ audience: m } as never).eq("id", courseId);
    if (error) toast.error(error.message); else { toast.success("บันทึกแล้ว"); refresh(); }
  }
  async function toggle(kind: string, value: string) {
    const r = has(kind, value);
    const { error } = r
      ? await (supabase as any).from("course_access").delete().eq("id", r.id)
      : await (supabase as any).from("course_access").insert({ course_id: courseId, kind, value });
    if (error) toast.error(error.message); else refresh();
  }
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground/70"}`;
  const nameOf = (id: string) => people.find((p) => p.id === id)?.full_name || id.slice(0, 8);
  const found = search.trim() ? people.filter((p) => `${p.full_name} ${p.email}`.toLowerCase().includes(search.toLowerCase())).slice(0, 8) : [];
  return (
    <div className="space-y-4">
      <div className="glass space-y-3 rounded-3xl p-6">
        <div className="font-semibold">ใครเรียนหลักสูตรนี้ได้บ้าง</div>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={audience === "all"} onChange={() => setMode("all")} /> บุคลากรทุกคน</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={audience === "restricted"} onChange={() => setMode("restricted")} /> เฉพาะฝ่าย / แผนก / บุคคลที่เลือก</label>
        {audience === "restricted" && <p className="text-xs text-muted-foreground">ผู้ที่ตรงกับเงื่อนไขข้อใดข้อหนึ่งด้านล่างจะเห็นและลงทะเบียนเรียนได้ ({rules.length} เงื่อนไข)</p>}
      </div>
      {audience === "restricted" && (
        <>
          <div className="glass space-y-4 rounded-3xl p-6">
            <div className="font-semibold">เลือกทั้งฝ่าย หรือเฉพาะแผนก</div>
            {divisions.map((d) => (
              <div key={d}>
                <button onClick={() => toggle("division", d)} className={chip(!!has("division", d))}>{has("division", d) ? "✓ " : ""}{d} (ทั้งฝ่าย)</button>
                {!has("division", d) && (
                  <div className="mt-2 flex flex-wrap gap-2 pl-4">
                    {orgChart[d]!.map((dep) => <button key={dep} onClick={() => toggle("department", dep)} className={chip(!!has("department", dep))}>{dep}</button>)}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="glass space-y-3 rounded-3xl p-6">
            <div className="font-semibold">รายบุคคล</div>
            <div className="flex flex-wrap gap-2">
              {rules.filter((r) => r.kind === "user").map((r) => <button key={r.id} onClick={() => toggle("user", r.value)} className={chip(true)}>{nameOf(r.value)} ✕</button>)}
            </div>
            <input className={inp} placeholder="ค้นหาชื่อหรืออีเมล เพื่อเพิ่ม" value={search} onChange={(e) => setSearch(e.target.value)} />
            {found.map((p) => (
              <button key={p.id} onClick={() => { toggle("user", p.id); setSearch(""); }} disabled={!!has("user", p.id)} className="flex w-full justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-mist disabled:opacity-50">
                <span>{p.full_name || p.email}</span><span className="text-xs text-muted-foreground">{p.department}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
