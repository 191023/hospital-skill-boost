import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const summarizeSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: canEdit } = await sb.rpc("can_edit_course", { _course: data.courseId });
    if (!canEdit) throw new Error("Forbidden");
    const [{ data: course }, { data: qs }, { data: rs }] = await Promise.all([
      sb.from("courses").select("title,description").eq("id", data.courseId).maybeSingle(),
      sb.from("survey_questions").select("id,kind,prompt,position").eq("course_id", data.courseId).order("position"),
      sb.from("survey_responses").select("answers").eq("course_id", data.courseId),
    ]);
    const responses = rs ?? [];
    if (!responses.length) throw new Error("ยังไม่มีผู้ตอบแบบประเมิน");
    const lines: string[] = [];
    for (const q of qs ?? []) {
      const vals = responses.map((r) => (r.answers as Record<string, unknown>)[q.id]).filter((v) => v !== undefined && v !== "");
      if (q.kind === "rating") {
        const nums = vals.map(Number).filter((n) => !isNaN(n));
        const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : "-";
        lines.push(`[คะแนน 1-5] ${q.prompt}: เฉลี่ย ${avg} จาก ${nums.length} คน`);
      } else {
        lines.push(`[ปลายเปิด] ${q.prompt}:\n${vals.slice(0, 300).map((v) => `- ${String(v).slice(0, 800)}`).join("\n")}`);
      }
    }
    const { gatewayText } = await import("./ai.server");
    const summary = await gatewayText(
      "คุณเป็นผู้เชี่ยวชาญด้านการพัฒนาหลักสูตรอบรมบุคลากรโรงพยาบาล ตอบเป็นภาษาไทย กระชับ ใช้ Markdown หัวข้อ: ## ภาพรวม, ## ประเด็นสำคัญที่พบ, ## จุดแข็ง, ## สิ่งที่ควรปรับปรุง, ## ข้อเสนอแนะเพื่อปรับปรุงหลักสูตร (เป็นข้อปฏิบัติได้จริง) ห้ามเปิดเผยข้อมูลส่วนบุคคล ความยาวไม่เกิน 500 คำ",
      `หลักสูตร: ${course?.title}\n${course?.description ?? ""}\nจำนวนผู้ตอบ: ${responses.length}\n\n${lines.join("\n\n")}`,
    );
    const { error } = await sb.from("survey_summaries").upsert({
      course_id: data.courseId, summary, response_count: responses.length, created_by: context.userId, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { summary };
  });
