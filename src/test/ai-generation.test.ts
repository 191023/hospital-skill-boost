import { describe, it, expect } from "vitest";

// Logic mirror of cleanAndParseAiJson in ai.functions.ts
function cleanAndParseAiJson(rawText: string) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return JSON.parse(cleaned);
}

describe("AI Response Parser logic", () => {
  it("parses raw clean JSON array", () => {
    const raw = `[{"question":"ไฟไหม้ทำอย่างไร","options":["วิ่ง","ดึงสัญญาณเตือน","เซลฟี่","นอน"],"correct_answer":1,"explanation":"ดึงสัญญาณเตือนก่อน"}]`;
    const parsed = cleanAndParseAiJson(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].correct_answer).toBe(1);
    expect(parsed[0].options).toHaveLength(4);
  });

  it("handles markdown code block wrapped JSON (```json ... ```)", () => {
    const raw = `\`\`\`json
[
  {
    "question": "มาตรการล้างมือ 7 ขั้นตอนใช้เวลาเท่าใด",
    "options": ["5 วินาที", "10 วินาที", "20-30 วินาที", "5 นาที"],
    "correct_answer": 2,
    "explanation": "ตามมาตรฐาน WHO กำหนด 20-30 วินาที"
  }
]
\`\`\``;
    const parsed = cleanAndParseAiJson(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].question).toContain("7 ขั้นตอน");
    expect(parsed[0].correct_answer).toBe(2);
    expect(parsed[0].options[2]).toBe("20-30 วินาที");
  });

  it("handles leading and trailing text or whitespaces correctly", () => {
    const raw = `\`\`\`
[
  {
    "question": "ข้อใดเป็นข้อห้าม",
    "options": ["ก", "ข", "ค", "ง"],
    "correct_answer": 0
  }
]
\`\`\``;
    const parsed = cleanAndParseAiJson(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].correct_answer).toBe(0);
  });

  it("parses and normalizes AI generated lessons array", () => {
    const rawLessons = `\`\`\`json
[
  {
    "title": "บทที่ 1: การจำแนกประเภทสารเคมีอันตราย",
    "kind": "text",
    "estimated_minutes": 5,
    "summary": "ทำความเข้าใจระบบ GHS และป้ายเตือนความปลอดภัย",
    "body": "### วัตถุประสงค์\\n- อ่านสัญลักษณ์ความปลอดภัยได้\\n\\n### เนื้อหา\\nสารเคมีในโรงพยาบาลแบ่งออกเป็น...\\n\\n> [!IMPORTANT]\\n> ห้ามผสมสารทำความสะอาดโดยเด็ดขาด"
  },
  {
    "title": "บทที่ 2: ขั้นตอนเมื่อเกิดสารเคมีหกรั่วไหล",
    "summary": "คู่มือปฏิบัติการ Spill Kit",
    "body": "### ขั้นตอนปฏิบัติ\\n1. กั้นพื้นที่\\n2. สวมอุปกรณ์ PPE"
  }
]
\`\`\``;

    const parsed = cleanAndParseAiJson(rawLessons);
    expect(parsed).toHaveLength(2);

    const normalized = parsed.map((item: any, idx: number) => ({
      title: String(item.title || `บทที่ ${idx + 1}`),
      kind: (item.kind === "video" || item.kind === "pdf" ? item.kind : "text") as "text" | "video" | "pdf",
      estimated_minutes: Number(item.estimated_minutes) || 5,
      summary: String(item.summary || ""),
      body: String(item.body || ""),
    }));

    expect(normalized[0].title).toBe("บทที่ 1: การจำแนกประเภทสารเคมีอันตราย");
    expect(normalized[0].kind).toBe("text");
    expect(normalized[0].estimated_minutes).toBe(5);
    expect(normalized[0].body).toContain("> [!IMPORTANT]");

    // Fallback defaults test for item 2
    expect(normalized[1].title).toBe("บทที่ 2: ขั้นตอนเมื่อเกิดสารเคมีหกรั่วไหล");
    expect(normalized[1].kind).toBe("text");
    expect(normalized[1].estimated_minutes).toBe(5);
  });
});
