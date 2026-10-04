import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { summarizeSurvey } from "@/lib/survey.functions";

const inp = "w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const DEFAULTS: { kind: "rating" | "text"; prompt: string }[] = [
  { kind: "rating", prompt: "ความพึงพอใจโดยรวมต่อหลักสูตร" },
  { kind: "rating", prompt: "เนื้อหานำไปใช้ในการทำงานได้จริง" },
  { kind: "rating", prompt: "ความเหมาะสมของสื่อและระยะเวลา" },
  { kind: "text", prompt: "สิ่งที่ชอบในหลักสูตรนี้" },
  { kind: "text", prompt: "ข้อเสนอแนะเพื่อปรับปรุงหลักสูตร" },
];

function useSurveyQs(courseId: string) {
  return useQuery({
    queryKey: ["survey-q", courseId],
    queryFn: async () => (await supabase.from("survey_questions").select("*").eq("course_id", courseId).order("position")).data ?? [],
  });
}

/** Staff: edit questions, view results, AI summary */
export function SurveyManager({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const summarize = useServerFn(summarizeSurvey);
  const { data: qs = [] } = useSurveyQs(courseId);
  const [nq, setNq] = useState({ kind: "rating" as "rating" | "text", prompt: "" });
  const [busy, setBusy] = useState(false);
  const { data: extra } = useQuery({
    queryKey: ["survey-results", courseId],
    queryFn: async () => {
      const [{ data: rs }, { data: sum }] = await Promise.all([
        supabase.from("survey_responses").select("answers").eq("course_id", courseId),
        supabase.from("survey_summaries").select("*").eq("course_id", courseId).maybeSingle(),
      ]);
      return { rs: rs ?? [], sum };
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["survey-q", courseId] }); qc.invalidateQueries({ queryKey: ["survey-results", courseId] }); };

  async function add(items: { kind: "rating" | "text"; prompt: string }[]) {
    const { error } = await supabase.from("survey_questions").insert(items.map((x, i) => ({ ...x, course_id: courseId, position: qs.length + i })));
    if (error) return toast.error(error.message);
    setNq({ kind: nq.kind, prompt: "" }); refresh();
  }
  async function del(id: string) {
    const { error } = await supabase.from("survey_questions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }
  async function runAi() {
    setBusy(true);
    try { await summarize({ data: { courseId } }); toast.success("สรุปผลแล้ว"); refresh(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const rs = extra?.rs ?? [];
  return (
    <div className="space-y-5">
      <div className="glass rounded-3xl p-5">
        <h3 className="font-bold">ข้อคำถามแบบประเมินหลักสูตร</h3>
        <p className="text-xs text-muted-foreground">ผู้เข้าอบรมที่ลงทะเบียนแล้วจะเห็นแบบประเมินในหน้าหลักสูตร (ตอบได้ 1 ครั้ง)</p>
        {!qs.length && <button onClick={() => add(DEFAULTS)} className="mt-3 rounded-xl bg-mist px-3 py-2 text-sm font-semibold text-primary">+ ใช้ชุดคำถามมาตรฐาน</button>}
        <ol className="mt-3 space-y-2">
          {qs.map((q, i) => (
            <li key={q.id} className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-sm">
              <span className="text-muted-foreground">{i + 1}.</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${q.kind === "rating" ? "bg-amber/20 text-amber" : "bg-primary/10 text-primary"}`}>{q.kind === "rating" ? "คะแนน 1-5" : "ปลายเปิด"}</span>
              <span className="flex-1">{q.prompt}</span>
              <button onClick={() => del(q.id)} className="text-xs text-coral">ลบ</button>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex gap-2">
          <select className={`${inp} w-36`} value={nq.kind} onChange={(e) => setNq({ ...nq, kind: e.target.value as "rating" | "text" })}><option value="rating">คะแนน 1-5</option><option value="text">ปลายเปิด</option></select>
          <input className={inp} placeholder="ข้อคำถามใหม่" value={nq.prompt} onChange={(e) => setNq({ ...nq, prompt: e.target.value })} />
          <button disabled={!nq.prompt.trim()} onClick={() => add([nq])} className="rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">เพิ่ม</button>
        </div>
      </div>

      <div className="glass rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">ผลการประเมิน ({rs.length} คน)</h3>
          <button disabled={busy || !rs.length} onClick={runAi} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brand disabled:opacity-50">{busy ? "AI กำลังวิเคราะห์..." : "✦ สรุปด้วย AI"}</button>
        </div>
        <div className="mt-3 space-y-3 text-sm">
          {qs.map((q) => {
            const vals = rs.map((r) => (r.answers as Record<string, unknown>)[q.id]).filter((v) => v !== undefined && v !== "");
            if (q.kind === "rating") {
              const n = vals.map(Number);
              const avg = n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0;
              return <div key={q.id}><div className="flex justify-between"><span>{q.prompt}</span><b>{n.length ? avg.toFixed(2) : "-"} / 5</b></div><div className="mt-1 h-2 rounded-full bg-mist"><div className="h-2 rounded-full bg-mint" style={{ width: `${(avg / 5) * 100}%` }} /></div></div>;
            }
            return <details key={q.id}><summary className="cursor-pointer">{q.prompt} <span className="text-muted-foreground">({vals.length} ความคิดเห็น)</span></summary><ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{vals.map((v, i) => <li key={i}>{String(v)}</li>)}</ul></details>;
          })}
        </div>
        {extra?.sum && (
          <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="mb-2 text-xs text-muted-foreground">สรุปโดย AI จาก {extra.sum.response_count} คน · {new Date(extra.sum.updated_at).toLocaleString("th-TH")}</div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{extra.sum.summary.replace(/\*\*/g, "")}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Learner: fill the survey once */
export function SurveyForm({ courseId, userId }: { courseId: string; userId: string }) {
  const qc = useQueryClient();
  const { data: qs = [] } = useSurveyQs(courseId);
  const { data: mine, isLoading } = useQuery({
    queryKey: ["survey-mine", courseId, userId],
    queryFn: async () => (await supabase.from("survey_responses").select("id").eq("course_id", courseId).eq("user_id", userId).maybeSingle()).data,
  });
  const [ans, setAns] = useState<Record<string, string | number>>({});
  if (isLoading || !qs.length) return null;
  if (mine) return <div className="glass rounded-3xl p-5 text-sm text-mint">✓ ขอบคุณที่ตอบแบบประเมินหลักสูตร</div>;
  async function submit() {
    if (qs.some((q) => q.kind === "rating" && !ans[q.id])) return toast.error("กรุณาให้คะแนนให้ครบทุกข้อ");
    const { error } = await supabase.from("survey_responses").insert({ course_id: courseId, user_id: userId, answers: ans });
    if (error) return toast.error(error.message);
    toast.success("ส่งแบบประเมินแล้ว");
    qc.invalidateQueries({ queryKey: ["survey-mine", courseId, userId] });
  }
  return (
    <div className="glass rounded-3xl p-5">
      <h3 className="font-bold">แบบประเมินหลักสูตร</h3>
      <div className="mt-3 space-y-4 text-sm">
        {qs.map((q) => (
          <div key={q.id}>
            <div className="mb-1">{q.prompt}</div>
            {q.kind === "rating" ? (
              <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setAns({ ...ans, [q.id]: n })} className={`size-8 rounded-lg text-xs font-semibold ${ans[q.id] === n ? "bg-primary text-primary-foreground" : "bg-mist"}`}>{n}</button>
              ))}</div>
            ) : (
              <textarea rows={2} maxLength={2000} className={inp} value={String(ans[q.id] ?? "")} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })} />
            )}
          </div>
        ))}
        <button onClick={submit} className="w-full rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground">ส่งแบบประเมิน</button>
      </div>
    </div>
  );
}
