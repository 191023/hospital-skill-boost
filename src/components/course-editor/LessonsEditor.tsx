import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { kindLabel } from "@/lib/data";
import { btn, inp, uploadCourseFile } from "./shared";

export function Lessons({ courseId }: { courseId: string }) {
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
            try { setF({ ...f, file_url: await uploadCourseFile(file, courseId) }); toast.success("อัปโหลดแล้ว กดบันทึก"); } catch (err) { toast.error((err as Error).message); }
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

export function Questions({ courseId }: { courseId: string }) {
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

