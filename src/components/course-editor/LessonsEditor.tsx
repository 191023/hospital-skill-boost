import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { kindLabel, youtubeEmbed } from "@/lib/data";
import { btn, inp, uploadCourseFile } from "./shared";
import { ImportLessons } from "./ImportLessons";
import { ImportQuestions } from "./ImportQuestions";
import { MarkdownView } from "@/components/MarkdownView";
import {
  Trash2,
  Save,
  ImagePlus,
  Youtube,
  Table2,
  AlertTriangle,
  Lightbulb,
  FileText,
  Eye,
  Pencil,
  Loader2,
  X,
} from "lucide-react";

export function Lessons({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["edit-lessons", courseId],
    queryFn: async () =>
      (
        await supabase
          .from("lessons")
          .select("*")
          .eq("course_id", courseId)
          .is("deleted_at", null)
          .order("position")
      ).data ?? [],
  });
  async function add() {
    const { error } = await supabase.from("lessons").insert({
      course_id: courseId,
      title: `บทที่ ${data.length + 1}`,
      position: data.length + 1,
      kind: "text",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["edit-lessons", courseId] });
  }
  return (
    <div className="space-y-4">
      <ImportLessons
        courseId={courseId}
        existingCount={data.length}
        onDone={() => qc.invalidateQueries({ queryKey: ["edit-lessons", courseId] })}
      />
      {data.map((l) => (
        <LessonRow key={l.id} lesson={l} courseId={courseId} />
      ))}
      <button
        onClick={add}
        className="w-full rounded-2xl border-2 border-dashed border-primary/30 py-4 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
      >
        + เพิ่มบทเรียนใหม่
      </button>
    </div>
  );
}

type Lesson = {
  id: string;
  title: string;
  kind: string;
  body: string | null;
  video_url: string | null;
  file_url: string | null;
  position: number;
  course_id: string;
  created_at: string;
};

function LessonRow({ lesson, courseId }: { lesson: Lesson; courseId: string }) {
  const qc = useQueryClient();
  const [f, setF] = useState(lesson);
  const [previewMd, setPreviewMd] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [showYtBox, setShowYtBox] = useState(false);
  const [ytInputUrl, setYtInputUrl] = useState("");
  const [ytInputTitle, setYtInputTitle] = useState("");
  const [showMediaAttachments, setShowMediaAttachments] = useState(
    Boolean(lesson.video_url || lesson.file_url || lesson.kind === "video" || lesson.kind === "pdf")
  );

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["edit-lessons", courseId] });

  function insertAtCursor(snippet: string) {
    const current = f.body ?? "";
    const el = textareaRef.current;
    if (!el || previewMd) {
      const nextBody = current ? `${current.trimEnd()}\n\n${snippet.trim()}\n` : `${snippet.trim()}\n`;
      setF((prev) => ({ ...prev, body: nextBody }));
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const before = current.slice(0, start);
    const after = current.slice(end);
    const prefix = before.length > 0 && !before.endsWith("\n") ? "\n\n" : "";
    const suffix = after.length > 0 && !after.startsWith("\n") ? "\n\n" : "\n";
    const nextBody = `${before}${prefix}${snippet.trim()}${suffix}${after}`;
    setF((prev) => ({ ...prev, body: nextBody }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + prefix.length + snippet.trim().length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function handleUploadInlineImage(file: File) {
    setUploadingImg(true);
    try {
      const path = await uploadCourseFile(file, courseId);
      const defaultCaption = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      insertAtCursor(`![${defaultCaption || "ภาพประกอบบทเรียน"}](${path})`);
      toast.success("อัปโหลดและแทรกรูปภาพในเนื้อหาแล้ว (อย่าลืมกดบันทึกบทเรียน)");
    } catch (err) {
      toast.error(`อัปโหลดรูปไม่สำเร็จ: ${(err as Error).message}`);
    } finally {
      setUploadingImg(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  }

  function handleInsertYoutube() {
    const raw = ytInputUrl.trim();
    if (!raw) {
      toast.error("กรุณาวางลิงก์วิดีโอ YouTube");
      return;
    }
    if (!youtubeEmbed(raw)) {
      toast.error("รูปแบบลิงก์ YouTube ไม่ถูกต้อง (เช่น https://www.youtube.com/watch?v=...)");
      return;
    }
    const label = ytInputTitle.trim() ? `youtube:${ytInputTitle.trim()}` : "youtube";
    insertAtCursor(`![${label}](${raw})`);
    setYtInputUrl("");
    setYtInputTitle("");
    setShowYtBox(false);
    toast.success("แทรกวิดีโอ YouTube ลงในเนื้อหาบทเรียนแล้ว");
  }

  async function save() {
    const { error } = await supabase
      .from("lessons")
      .update({
        title: f.title,
        kind: f.kind,
        body: f.body,
        video_url: f.video_url || null,
        file_url: f.file_url || null,
        position: f.position,
      })
      .eq("id", lesson.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("บันทึกบทเรียนแล้ว");
    refresh();
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
    <div className="glass space-y-3.5 rounded-3xl p-5">
      {/* Row 1: Position, Title, Primary Kind */}
      <div className="grid gap-3 sm:grid-cols-[80px_1fr_170px]">
        <input
          type="number"
          className={inp}
          value={f.position}
          onChange={(e) => setF({ ...f, position: Number(e.target.value) })}
          title="ลำดับบทเรียน"
        />
        <input
          className={inp}
          placeholder="ชื่อบทเรียน"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
        />
        <select
          className={inp}
          value={f.kind}
          onChange={(e) => {
            const nextKind = e.target.value;
            setF({ ...f, kind: nextKind });
            if (nextKind === "video" || nextKind === "pdf") {
              setShowMediaAttachments(true);
            }
          }}
        >
          {Object.entries(kindLabel).map(([k, v]) => (
            <option key={k} value={k}>
              รูปแบบหลัก: {v}
            </option>
          ))}
        </select>
      </div>

      {/* Row 2: Rich Multimedia Toolbar */}
      <div className="rounded-2xl border border-border/70 bg-card/50 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1">
              แทรกสื่อในบทเรียน:
            </span>

            {/* Hidden file input for inline image upload */}
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadInlineImage(file);
              }}
            />

            <button
              type="button"
              disabled={uploadingImg}
              onClick={() => imgInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition cursor-pointer disabled:opacity-50"
              title="อัปโหลดรูปภาพแทรกลงในตำแหน่งเคอร์เซอร์"
            >
              {uploadingImg ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
              <span>{uploadingImg ? "กำลังอัปโหลดรูป..." : "แทรกรูปภาพ"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowYtBox((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                showYtBox
                  ? "border-rose-500 bg-rose-500 text-white"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
              }`}
              title="แทรกวิดีโอ YouTube ในเนื้อหาบทเรียน (ใส่ได้หลายคลิป)"
            >
              <Youtube className="size-3.5" />
              <span>แทรก YouTube</span>
            </button>

            <button
              type="button"
              onClick={() =>
                insertAtCursor(
                  `| หัวข้อ / ชนิด | รายละเอียดการปฏิบัติ | มาตรฐานอ้างอิง |\n| --- | --- | --- |\n| ตัวอย่างที่ 1 | ระบุขั้นตอนหรือเกณฑ์ปฏิบัติ | HA / JCI |\n| ตัวอย่างที่ 2 | ระบุขั้นตอนหรือเกณฑ์ปฏิบัติ | SOP โรงพยาบาล |`
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/80 px-2.5 py-1.5 text-xs font-medium text-foreground/85 hover:bg-card transition cursor-pointer"
              title="แทรกตารางเปรียบเทียบ"
            >
              <Table2 className="size-3.5 text-primary" />
              <span>ตาราง</span>
            </button>

            <button
              type="button"
              onClick={() =>
                insertAtCursor(
                  `> [!WARNING] ข้อควรระวังความปลอดภัย\n> ระบุข้อพึงระวังหรือความเสี่ยงสำคัญที่บุคลากรต้องตรวจสอบก่อนปฏิบัติงาน`
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
              title="แทรกกล่องแจ้งเตือนข้อควรระวัง"
            >
              <AlertTriangle className="size-3.5" />
              <span>กล่องข้อควรระวัง</span>
            </button>

            <button
              type="button"
              onClick={() =>
                insertAtCursor(
                  `> [!TIP] เทคนิคการปฏิบัติ (Best Practice)\n> ระบุคำแนะนำหรือแนวทางปฏิบัติที่ดีเพื่อให้เกิดความปลอดภัยสูงสุด`
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
              title="แทรกกล่องเทคนิคการปฏิบัติ"
            >
              <Lightbulb className="size-3.5" />
              <span>กล่องคำแนะนำ</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMediaAttachments((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                showMediaAttachments || f.video_url || f.file_url
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background/80 text-muted-foreground hover:text-foreground"
              }`}
              title="แนบวิดีโอหลักด้านบนสุดของบท หรือแนบไฟล์ PDF ประจำบทเรียน"
            >
              <FileText className="size-3.5" />
              <span>
                วิดีโอหลัก / PDF ประจำบท
                {(f.video_url || f.file_url) ? " ✓" : ""}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setPreviewMd((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition cursor-pointer"
          >
            {previewMd ? (
              <>
                <Pencil className="size-3.5" />
                <span>กลับไปแก้ไขเนื้อหา</span>
              </>
            ) : (
              <>
                <Eye className="size-3.5" />
                <span>พรีวิวบทเรียน (รูป/วิดีโอ/ตาราง)</span>
              </>
            )}
          </button>
        </div>

        {/* Inline YouTube Adder Popover */}
        {showYtBox && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-rose-600 dark:text-rose-400">
              <span>🎬 แทรกวิดีโอ YouTube ลงในเนื้อหาบทเรียน</span>
              <button type="button" onClick={() => setShowYtBox(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                className={inp}
                placeholder="วางลิงก์ YouTube (เช่น https://www.youtube.com/watch?v=...)"
                value={ytInputUrl}
                onChange={(e) => setYtInputUrl(e.target.value)}
              />
              <input
                className={inp}
                placeholder="ชื่อคลิป / คำอธิบายใต้วิดีโอ (ไม่บังคับ)"
                value={ytInputTitle}
                onChange={(e) => setYtInputTitle(e.target.value)}
              />
              <button
                type="button"
                onClick={handleInsertYoutube}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition cursor-pointer"
              >
                + แทรกลงในบทเรียน
              </button>
            </div>
          </div>
        )}

        {/* Primary Lesson Attachments (Top Hero Video & Lesson PDF) */}
        {showMediaAttachments && (
          <div className="grid gap-3 rounded-xl border border-border/60 bg-background/60 p-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-muted-foreground">
                🎬 วิดีโอหลักประจำบท (แสดงด้านบนสุดของหน้าเรียน)
              </label>
              <div className="flex items-center gap-2">
                <input
                  className={inp}
                  placeholder="ลิงก์ YouTube หลักของบทนี้ (ถ้ามี)"
                  value={f.video_url ?? ""}
                  onChange={(e) => setF({ ...f, video_url: e.target.value })}
                />
                {f.video_url && (
                  <button
                    type="button"
                    onClick={() => setF({ ...f, video_url: null })}
                    className="rounded-lg border border-border p-2 text-xs text-muted-foreground hover:text-destructive"
                    title="ล้างลิงก์วิดีโอหลัก"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-muted-foreground">
                📄 ไฟล์เอกสาร PDF ประจำบทเรียน (แสดงคู่กับเนื้อหาในหน้าเดียวกัน)
              </label>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="file"
                  accept="application/pdf"
                  disabled={uploadingPdf}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingPdf(true);
                    try {
                      const uploaded = await uploadCourseFile(file, courseId);
                      setF({ ...f, file_url: uploaded });
                      toast.success("อัปโหลด PDF ประจำบทแล้ว กดบันทึกบทเรียนเพื่อยืนยัน");
                    } catch (err) {
                      toast.error((err as Error).message);
                    } finally {
                      setUploadingPdf(false);
                    }
                  }}
                  className="text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-primary/10 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20"
                />
                {f.file_url && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-mint/15 px-2.5 py-0.5 text-[11px] font-semibold text-mint">
                    ✓ แนบ PDF แล้ว
                    <button
                      type="button"
                      onClick={() => setF({ ...f, file_url: null })}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                      title="นำไฟล์ PDF ออก"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Editor or Live Multimedia Preview */}
        {previewMd ? (
          <div className="rounded-2xl border border-border/80 bg-background/80 p-5 max-h-[520px] overflow-y-auto space-y-4">
            {youtubeEmbed(f.video_url) && (
              <div className="aspect-video overflow-hidden rounded-2xl border border-border/60 bg-black">
                <iframe
                  src={youtubeEmbed(f.video_url)!}
                  title={f.title}
                  className="h-full w-full"
                  allowFullScreen
                />
              </div>
            )}
            {f.body ? (
              <MarkdownView content={f.body} />
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                ยังไม่มีเนื้อหาข้อความในบทเรียนนี้
              </div>
            )}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            rows={7}
            className={inp + " font-sans leading-relaxed"}
            placeholder="พิมพ์เนื้อหาบทเรียน หรือกดปุ่มด้านบนเพื่อแทรกรูปภาพประกอบ, คลิป YouTube, ตาราง และกล่องข้อความสำคัญ..."
            value={f.body ?? ""}
            onChange={(e) => setF({ ...f, body: e.target.value })}
          />
        )}
      </div>

      {/* Row 3: Delete & Save Actions */}
      <div className="flex items-center justify-between pt-1">
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
          <span>บันทึกบทเรียน</span>
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
