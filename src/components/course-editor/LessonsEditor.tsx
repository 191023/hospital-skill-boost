import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { kindLabel } from "@/lib/data";
import { btn, inp, uploadCourseFile } from "./shared";
import { ImportLessons } from "./ImportLessons";
import { ImportQuestions } from "./ImportQuestions";
import { MarkdownView } from "@/components/MarkdownView";
import { Trash2, Save } from "lucide-react";

export function Lessons({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["edit-lessons", courseId],
    queryFn: async () => (await supabase.from("lessons").select("*").eq("course_id", courseId).is("deleted_at", null).order("position")).data ?? [],
  });
  async function add() {
    const { error } = await supabase.from("lessons").insert({ course_id: courseId, title: `บทที่ ${data.length + 1}`, position: data.length + 1, kind: "text" });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["edit-lessons", courseId] });
  }
  return (
    <div className="space-y-4">
      <ImportLessons
        courseId={courseId}
        existingCount={data.length}
        onDone={() => qc.invalidateQueries({ queryKey: ["edit-lessons", courseId] })}
      />
      {data.map((l) => <LessonRow key={l.id} lesson={l} courseId={courseId} />)}
      <button onClick={add} className="w-full rounded-2xl border-2 border-dashed border-primary/30 py-4 text-sm font-semibold text-primary">+ เพิ่มบทเรียน</button>
    </div>
  );
}

type Lesson = { id: string; title: string; kind: string; body: string | null; video_url: string | null; file_url: string | null; position: number; course_id: string; created_at: string };

function LessonRow({ lesson, courseId }: { lesson: Lesson; courseId: string }) {
  const qc = useQueryClient();
  const [f, setF] = useState(lesson);
  const [previewMd, setPreviewMd] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["edit-lessons", courseId] });
  async function save() {
    const { error } = await supabase.from("lessons").update({ title: f.title, kind: f.kind, body: f.body, video_url: f.video_url, file_url: f.file_url, position: f.position }).eq("id", lesson.id);
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกบทเรียนแล้ว"); refresh();
  }
  async function del() {
    if (!confirm("ลบบทเรียนนี้?")) return;
    try {
      const { error } = await supabase.from("lessons").delete().eq("id", lesson.id);
      if (error) throw error;
      toast.success("ลบบทเรียนเรียบร้อยแล้ว");
      await qc.invalidateQueries({ queryKey: ["edit-lessons", courseId] });
    } catch (err: any) {
      toast.error(`ลบไม่สำเร็จ: ${err.message || String(err)}`);
    }
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
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">เนื้อหาบทเรียน (รองรับฟอร์แมต Markdown)</span>
          {f.body && (
            <button
              type="button"
              onClick={() => setPreviewMd(!previewMd)}
              className="text-xs text-primary font-semibold hover:underline"
            >
              {previewMd ? "✏️ แก้ไขข้อความ" : "👁️ พรีวิว Markdown"}
            </button>
          )}
        </div>
        {previewMd && f.body ? (
          <div className="rounded-2xl border border-border/80 bg-background/60 p-4 max-h-60 overflow-y-auto">
            <MarkdownView content={f.body} />
          </div>
        ) : (
          <textarea
            rows={4}
            className={inp}
            placeholder="เนื้อหา / คำอธิบายประกอบ (รองรับ Markdown: # หัวข้อ, **ตัวหนา**, - รายการ)"
            value={f.body ?? ""}
            onChange={(e) => setF({ ...f, body: e.target.value })}
          />
        )}
      </div>
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={del}
          className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-2 text-xs font-semibold text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground focus:outline-none focus:ring-2 focus:ring-destructive/30 cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          <span>ลบบทเรียน</span>
        </button>
        <button type="button" onClick={save} className={btn}>
          <Save className="mr-1.5 size-4" />
          <span>บันทึก</span>
        </button>
      </div>
    </div>
  );
}

export function Questions({ courseId, onOpenAnalytics }: { courseId: string; onOpenAnalytics?: () => void }) {
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
      {onOpenAnalytics && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📊</span>
            <div>
              <span className="font-bold text-foreground">ต้องการดูสถิติว่าข้อไหนคนตอบผิดมากที่สุด?</span>
              <p className="text-muted-foreground mt-0.5">ระบบมีระบบวิเคราะห์ข้อสอบ (Item Analysis) และสถิติพัฒนาการรายแผนก (HA/JCI) สำหรับวิทยากร</p>
            </div>
          </div>
          <button
            onClick={onOpenAnalytics}
            className="rounded-xl bg-primary px-3.5 py-1.5 font-semibold text-primary-foreground hover:opacity-90 transition-all shadow-sm"
          >
            เปิดหน้าวิเคราะห์ข้อสอบ & KPI →
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">ข้อสอบชุดนี้ใช้ทั้งก่อนเรียนและหลังเรียน เพื่อเปรียบเทียบพัฒนาการ</p>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          ทั้งหมด {data.length} ข้อ
        </span>
      </div>

      <ImportQuestions
        courseId={courseId}
        existingCount={data.length}
        onDone={() => qc.invalidateQueries({ queryKey: ["edit-questions", courseId] })}
      />

      {data.map((x, i) => (
        <div key={x.id} className="glass rounded-3xl p-5">
          <div className="flex justify-between gap-4">
            <div className="font-semibold">{i + 1}. {x.question}</div>
            <button
              type="button"
              onClick={() => del(x.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-1 text-xs font-medium text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground focus:outline-none focus:ring-2 focus:ring-destructive/30 cursor-pointer"
              title="ลบคำถามข้อนี้"
            >
              <Trash2 className="size-3.5" />
              <span>ลบ</span>
            </button>
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

