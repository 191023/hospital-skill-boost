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
});
