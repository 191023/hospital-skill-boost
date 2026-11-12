import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayText, type AiProvider } from "./ai.server";

/**
 * 1. Test AI Connection Server Function
 */
export const testAiConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        provider: z.enum(["gemini", "openai", "lovable"]),
        apiKey: z.string().min(1, "กรุณาระบุ API Key"),
        model: z.string().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: isStaff } = await sb.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("เฉพาะวิทยากรและผู้ดูแลระบบเท่านั้น");

    const start = Date.now();
    const reply = await gatewayText(
      "คุณคือระบบ AI ผู้ช่วยทดสอบการเชื่อมต่อ ตอบสั้นๆ ภาษาไทย ไม่เกิน 1 ประโยค",
      "ยืนยันสถานะการเชื่อมต่อ AI พร้อมใช้งานสำหรับโรงพยาบาลโอเวอร์บรุ๊ค",
      {
        provider: data.provider as AiProvider,
        apiKey: data.apiKey,
        ...(data.model ? { model: data.model } : {}),
      },
      sb
    );
    const latency = Date.now() - start;

    return {
      success: true,
      reply: reply.trim(),
      latencyMs: latency,
      provider: data.provider,
    };
  });

/**
 * 2. AI Misconception Explainer Server Function
 */
export const explainCourseMisconceptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: canEdit } = await sb.rpc("can_edit_course", { _course: data.courseId });
    if (!canEdit) throw new Error("ไม่มีสิทธิ์จัดการหลักสูตรนี้");

    const [{ data: course }, { data: rawItems }] = await Promise.all([
      sb.from("courses").select("title,description,category").eq("id", data.courseId).maybeSingle(),
      sb.rpc("get_course_item_analytics", { _course: data.courseId }),
    ]);

    const items = (rawItems as any[]) || [];
    if (!items.length) {
      throw new Error("หลักสูตรนี้ยังไม่มีข้อสอบหรือไม่มีข้อมูลสถิติการสอบ");
    }

    // Filter tricky questions (error rate >= 30% in Pre-test)
    const tricky = items
      .filter((q) => (q.pre_total ?? 0) > 0 && (q.pre_error_rate ?? 0) >= 30)
      .sort((a, b) => (b.pre_error_rate ?? 0) - (a.pre_error_rate ?? 0));

    const choiceChars = "กขคงจฉชซ";
    const questionSummaries = (tricky.length ? tricky : items.slice(0, 5)).map((q) => {
      const opts = (q.options as string[]) || [];
      const optDist = opts.map((opt, i) => {
        const count = q.pre_options?.[String(i)] ?? 0;
        const isCor = i === q.correct_index;
        return `   - ${choiceChars[i]}. ${opt} (${count} คนเลือก) ${isCor ? "[คำตอบที่ถูกต้อง ✓]" : ""}`;
      }).join("\n");

      return `ข้อที่ ${q.position}: ${q.question}
- อัตราตอบผิดก่อนเรียน: ${q.pre_error_rate}% (ตอบผิด ${q.pre_wrong} จาก ${q.pre_total} คน)
- อัตราตอบถูกหลังเรียน: ${q.post_accuracy}%
- การกระจายตัวเลือก:
${optDist}`;
    }).join("\n\n");

    const systemPrompt = `คุณเป็นแพทย์และผู้เชี่ยวชาญด้านการพัฒนาหลักสูตรฝึกอบรมบุคลากรทางการแพทย์ในโรงพยาบาล (เช่น มาตรฐาน HA, JCI, Patient Safety Goals)
หน้าที่ของคุณคือ:
1. วิเคราะห์เจาะลึกว่า "ทำไมบุคลากรถึงตอบผิด" และ "สับสนหรือเข้าใจผิดในจุดใด" (Root Cause of Misconception)
2. สรุปเป็น "สคริปต์จุดเน้นย้ำในห้องเรียนสำหรับวิทยากร" (Instructor Teaching Script & Talking Points) ที่กระชับ ตรงประเด็น และปฏิบัติได้จริงในบริบทโรงพยาบาล
3. ใช้ภาษาไทยทางการแพทย์ที่เข้าใจง่าย กระชับ ใช้ Markdown จัดรูปแบบหัวข้อชัดเจน ไม่เวิ่นเว้อ ห้ามเปิดเผยข้อมูลส่วนบุคคล`;

    const userPrompt = `หลักสูตร: ${course?.title}
หมวดหมู่วิชา: ${course?.category || "วิชาพัฒนาทักษะวิชาชีพ"}
รายละเอียด: ${course?.description || "-"}

ข้อมูลสถิติข้อสอบที่บุคลากรตอบผิดมากที่สุด:
${questionSummaries}

กรุณาวิเคราะห์และจัดทำรายงานสรุปสำหรับวิทยากรตามโครงสร้างนี้:
## 1. 🎯 ภาพรวมจุดบอดความรู้ของบุคลากร (Knowledge Gaps Summary)
## 2. ⚠️ วิเคราะห์ข้อที่คนสับสนมากที่สุด & สาเหตุความเข้าใจผิด (Misconception Breakdown)
(ระบุเป็นรายข้อ พร้อมอธิบายว่าทำไมถึงเลือกตัวลวงนั้นๆ)
## 3. 💡 สคริปต์และประเด็นที่วิทยากรต้องเน้นย้ำในห้องเรียน (Instructor Talking Points)
(ระบุเป็น bullet points ชัดเจนที่วิทยากรสามารถหยิบไปพูดเปิดประเด็นในคลาสได้ทันที)`;

    const report = await gatewayText(systemPrompt, userPrompt, undefined, sb);
    return { report, analyzedCount: tricky.length || items.length };
  });

/**
 * 3. AI Quiz Generator Server Function
 */
export const generateQuizQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        courseId: z.string().uuid(),
        content: z.string().min(20, "กรุณากรอกเนื้อหาบทเรียนอย่างน้อย 20 ตัวอักษร"),
        count: z.number().min(1).max(20).default(5),
        difficulty: z.enum(["basic", "scenario", "mixed"]).default("mixed"),
        topic: z.string().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: canEdit } = await sb.rpc("can_edit_course", { _course: data.courseId });
    if (!canEdit) throw new Error("ไม่มีสิทธิ์จัดการหลักสูตรนี้");

    const { data: course } = await sb
      .from("courses")
      .select("title,category")
      .eq("id", data.courseId)
      .maybeSingle();

    const difficultyText = {
      basic: "เน้นความรู้ความจำ กฎระเบียบ ข้อห้าม และมาตรฐานขั้นตอนการปฏิบัติ (SOP)",
      scenario: "เน้นการจำลองสถานการณ์หน้างานจริงในโรงพยาบาล (Clinical/Hospital Vignette) ให้คิดวิเคราะห์และตัดสินใจแก้ไขปัญหา",
      mixed: "ผสมผสานทั้งข้อสอบมาตรฐานแนวคิด (Concept) และสถานการณ์จำลองหน้างาน (Scenario-based)",
    }[data.difficulty];

    const systemPrompt = `คุณเป็นผู้เชี่ยวชาญด้านการออกข้อสอบมาตรฐานสำหรับบุคลากรทางการแพทย์ในโรงพยาบาล (ตามมาตรฐาน HA / JCI)
จงสกัดเนื้อหาที่ได้รับให้เป็นข้อสอบปรนัย 4 ตัวเลือก (ก, ข, ค, ง) ที่มีคุณภาพสูง จำนวน ${data.count} ข้อ
หลักเกณฑ์การออกข้อสอบ:
1. ตัวลวง (Distractors) ต้องสมจริง น่าเชื่อถือ และสะท้อนความเข้าใจผิดที่พบบ่อยในโรงพยาบาล
2. มีคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว ระบุ correct_index (0 คือตัวเลือกแรก, 1, 2, 3)
3. ให้คำอธิบายสั้นๆ (explanation) ว่าเหตุใดตัวเลือกนี้จึงถูกต้อง อ้างอิงเนื้อหา
4. หากเนื้อหาอ้างอิงมีหลายบทเรียน (เช่น มีหัวข้อ '=== บทที่ 1:... ===', '=== บทที่ 2:... ===') ให้เฉลี่ยสัดส่วนข้อสอบให้ครอบคลุมทุกบทเรียนอย่างสมดุล
5. ตอบกลับเป็น JSON Array ตามรูปแบบนี้เท่านั้น ห้ามใส่ข้อความเกริ่นนำหรือปิดท้าย:
[
  {
    "question": "ข้อความคำถาม...",
    "options": ["ตัวเลือก 1", "ตัวเลือก 2", "ตัวเลือก 3", "ตัวเลือก 4"],
    "correct_index": 0,
    "explanation": "คำอธิบายเฉลย..."
  }
]`;

    const userPrompt = `หลักสูตร: ${course?.title || "-"}
หัวข้อเฉพาะ: ${data.topic || course?.title || "-"}
ระดับความยาก/รูปแบบ: ${difficultyText}
จำนวนข้อที่ต้องการ: ${data.count} ข้อ

เนื้อหาอ้างอิงสำหรับออกข้อสอบ:
${data.content.slice(0, 30000)}

สร้างข้อสอบตามรูปแบบ JSON ที่กำหนดเท่านั้น:`;

    const rawResponse = await gatewayText(systemPrompt, userPrompt, undefined, sb);

    // Extract JSON block from response
    let jsonStr = rawResponse.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```/, "").replace(/```$/, "").trim();
    }

    // Find array brackets if wrapped
    const startIdx = jsonStr.indexOf("[");
    const endIdx = jsonStr.lastIndexOf("]");
    if (startIdx !== -1 && endIdx !== -1) {
      jsonStr = jsonStr.substring(startIdx, endIdx + 1);
    }

    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) throw new Error("Invalid output format: not an array");

      const validated = parsed.map((item, idx) => ({
        question: String(item.question || `คำถามข้อที่ ${idx + 1}`),
        options: Array.isArray(item.options) ? item.options.slice(0, 4).map(String) : ["ก", "ข", "ค", "ง"],
        correct_index: Math.min(Math.max(Number(item.correct_index) || 0, 0), 3),
        explanation: String(item.explanation || ""),
      }));

      return { questions: validated };
    } catch (err) {
      console.error("Failed to parse AI quiz response:", rawResponse, err);
      throw new Error("AI ส่งข้อมูลรูปแบบไม่ถูกต้อง กรุณากดลองสร้างใหม่อีกครั้ง");
    }
  });

export const generateCourseLessons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        courseId: z.string().uuid(),
        content: z.string().min(20, "กรุณากรอกเนื้อหาอย่างน้อย 20 ตัวอักษร"),
        count: z.number().min(0).max(20).default(0), // 0 = Auto natural chunking
        topic: z.string().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: canEdit } = await sb.rpc("can_edit_course", { _course: data.courseId });
    if (!canEdit) throw new Error("ไม่มีสิทธิ์จัดการหลักสูตรนี้");

    const { data: course } = await sb
      .from("courses")
      .select("title,category")
      .eq("id", data.courseId)
      .maybeSingle();

    const chunkingInstruction =
      data.count > 0
        ? `แบ่งเนื้อหาออกเป็นประมาณ ${data.count} บทเรียนที่มีลำดับการเรียนรู้ต่อเนื่องและเข้าใจง่าย`
        : `วิเคราะห์โครงสร้างเนื้อหา หัวข้อย่อย หรือสไลด์ในเอกสาร แล้วแบ่งออกเป็นบทเรียนตามธรรมชาติของเนื้อหา (โดยทั่วไปประมาณ 3–8 บทเรียนต่อหลักสูตร แต่ละบทมีเนื้อหาพอเหมาะ ใช้เวลาเรียน 3–8 นาที ไม่สั้นหรือยาวจนเกินไป)`;

    const systemPrompt = `คุณเป็นผู้เชี่ยวชาญด้านการออกแบบหลักสูตรและการเรียนรู้ทางการแพทย์ (Hospital Instructional Designer) สำหรับโรงพยาบาลมาตรฐานระดับสากล (HA / JCI)
หน้าที่ของคุณคือแปลงเนื้อหาหรือเอกสารอ้างอิงที่ได้รับ ให้กลายเป็น "ชุดบทเรียน e-Learning (Lessons)" คุณภาพสูง

หลักเกณฑ์การออกแบบบทเรียน:
1. การแบ่งบท (Chunking): ${chunkingInstruction}
2. ระดับภาษา (Standard Hospital Tone): ใช้โทนภาษามาตรฐานโรงพยาบาลที่สุภาพ ชัดเจน เข้าใจง่าย ครอบคลุมบุคลากรทุกสายงาน (ทั้งสายวิชาชีพแพทย์ พยาบาล เภสัชกร และสายสนับสนุน เช่น บริการทั่วไป ช่าง รปภ.) ถ่ายทอดขั้นตอนการปฏิบัติ กฎระเบียบความปลอดภัย และข้อควรระวังตามมาตรฐานโรงพยาบาลให้ทุกคนสามารถนำไปปฏิบัติจริงได้อย่างถูกต้อง
3. โครงสร้างของแต่ละบทเรียน:
   - ชื่อบทเรียน (title): ระบุ 'บทที่ X: [ชื่อหัวข้อที่น่าสนใจและตรงประเด็น]'
   - ประเภท (kind): กำหนดเป็น 'text'
   - เวลาโดยประมาณ (estimated_minutes): ตัวเลขจำนวนนาทีที่ใช้อ่าน (เช่น 3, 5, 7)
   - สรุปสั้น (summary): สรุปใจความสั้น 1 ประโยคของบทนี้
   - เนื้อหาบทเรียน (body): เขียนด้วยฟอร์แมต Markdown ที่จัดระเบียบอย่างสวยงาม ประกอบด้วย:
     * ### วัตถุประสงค์การเรียนรู้ (Learning Objectives) แบบ bullet point
     * ### เนื้อหาหลัก (Core Content) มีหัวข้อย่อย, ตัวหนาเน้นคำสำคัญ, รายการลำดับขั้นตอน หรือตารางสรุป
     * กล่องแจ้งเตือนเน้นย้ำตามรูปแบบ GitHub Alerts เช่น > [!IMPORTANT] หรือ > [!WARNING] สำหรับข้อควรระวังวิกฤติตามมาตรฐานความปลอดภัย รพ.
     * ### สรุปใจความสำคัญ (Key Takeaways) 2-4 ข้อท้ายบท
4. ตอบกลับเป็น JSON Array ตามรูปแบบนี้เท่านั้น ห้ามใส่ข้อความเกริ่นนำหรือปิดท้าย:
[
  {
    "title": "บทที่ 1: ...",
    "kind": "text",
    "estimated_minutes": 5,
    "summary": "สรุปสั้น 1 ประโยคของบทนี้",
    "body": "เนื้อหาบทเรียนในรูปแบบ Markdown..."
  }
]`;

    const userPrompt = `หลักสูตร: ${course?.title || "-"}
หัวข้อเฉพาะ: ${data.topic || course?.title || "-"}
แนวทางการแบ่งบท: ${data.count > 0 ? `กำหนดตายตัว ${data.count} บท` : "วิเคราะห์แบ่งตามหัวข้อธรรมชาติของเอกสาร"}
ระดับภาษา: โทนภาษามาตรฐานโรงพยาบาล เหมาะกับบุคลากรทุกสายงาน (HA/JCI)

เนื้อหาเอกสารอ้างอิง:
${data.content.slice(0, 35000)}

สร้างชุดบทเรียนตามรูปแบบ JSON ที่กำหนดเท่านั้น:`;

    const rawResponse = await gatewayText(systemPrompt, userPrompt, undefined, sb);

    // Extract JSON block from response
    let jsonStr = rawResponse.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const startIdx = jsonStr.indexOf("[");
    const endIdx = jsonStr.lastIndexOf("]");
    if (startIdx !== -1 && endIdx !== -1) {
      jsonStr = jsonStr.substring(startIdx, endIdx + 1);
    }

    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) throw new Error("Invalid output format: not an array");

      const validated = parsed.map((item, idx) => ({
        title: String(item.title || `บทที่ ${idx + 1}`),
        kind: (item.kind === "video" || item.kind === "pdf" ? item.kind : "text") as "text" | "video" | "pdf",
        estimated_minutes: Number(item.estimated_minutes) || 5,
        summary: String(item.summary || ""),
        body: String(item.body || ""),
      }));

      return { lessons: validated };
    } catch (err) {
      console.error("Failed to parse AI lessons response:", rawResponse, err);
      throw new Error("AI ส่งข้อมูลรูปแบบไม่ถูกต้อง กรุณากดลองสร้างใหม่อีกครั้ง");
    }
  });
