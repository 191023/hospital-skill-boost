import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/courses/$courseId/test/$kind")({
  head: () => ({ meta: [
    { title: "แบบทดสอบ — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "แบบทดสอบสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:title", content: "แบบทดสอบ — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "แบบทดสอบสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: TestPage,
});

type Result = { score: number; total: number; percent: number; passed: boolean; certificate_id: string | null };

function TestPage() {
  const { courseId, kind } = Route.useParams();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: qs = [] } = useQuery({
    queryKey: ["test", courseId],
    queryFn: async () => (await supabase.rpc("get_test_questions", { _course: courseId })).data ?? [],
  });
  const title = kind === "pre" ? "แบบทดสอบก่อนเรียน" : "แบบทดสอบหลังเรียน";

  async function submit() {
    if (Object.keys(answers).length < qs.length) { toast.error("กรุณาตอบให้ครบทุกข้อ"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("submit_test", { _course: courseId, _kind: kind, _answers: answers });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setResult(data as unknown as Result);
    qc.invalidateQueries();
  }

  if (result) {
    return (
      <div className="glass mx-auto max-w-lg rounded-3xl p-8 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</div>
        <div className={`mt-4 text-6xl font-bold ${result.passed ? "text-mint" : "text-coral"}`}>{result.percent}%</div>
        <div className="mt-2 text-sm text-muted-foreground">ถูก {result.score} จาก {result.total} ข้อ</div>
        {kind === "post" && (
          <div className="mt-4 font-semibold">{result.passed ? "🎉 ผ่านเกณฑ์!" : "ยังไม่ผ่านเกณฑ์ ลองทบทวนบทเรียนแล้วสอบใหม่"}</div>
        )}
        <div className="mt-6 flex justify-center gap-2">
          {result.certificate_id && (
            <Link to="/certificates/$certId" params={{ certId: result.certificate_id }} className="rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-primary-foreground">ดูใบประกาศ</Link>
          )}
          <Link to="/courses/$courseId" params={{ courseId }} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">กลับหน้าหลักสูตร</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/courses/$courseId" params={{ courseId }} className="text-sm text-primary">← กลับ</Link>
      <h1 className="mt-3 text-3xl font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">{qs.length} ข้อ · ตอบแล้ว {Object.keys(answers).length}</p>
      <div className="mt-6 space-y-4">
        {qs.map((q, i) => (
          <div key={q.id} className="glass rounded-3xl p-5">
            <div className="font-semibold">{i + 1}. {q.question}</div>
            <div className="mt-3 grid gap-2">
              {(q.options as string[]).map((o, oi) => (
                <button key={oi} onClick={() => setAnswers({ ...answers, [q.id]: oi })}
                  className={`rounded-xl border px-4 py-2.5 text-left text-sm transition ${answers[q.id] === oi ? "border-primary bg-primary text-primary-foreground" : "border-glass-border bg-glass hover:bg-card"}`}>
                  {"กขคงจฉชซ"[oi]}. {o}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button disabled={busy} onClick={submit} className="mt-6 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground shadow-brand disabled:opacity-60">
        {busy ? "กำลังตรวจ..." : "ส่งคำตอบ"}
      </button>
    </div>
  );
}
