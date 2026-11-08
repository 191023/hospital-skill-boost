import { describe, it, expect } from "vitest";

// Helper extracted from ImportQuestions logic to verify parsing rules
function parseCorrectIndex(raw: string, count: number): { index: number; error?: string } {
  const clean = raw
    .trim()
    .toLowerCase()
    .replace(/^(ข้อที่|ข้อ|ตัวเลือก|choice)\s*/gi, "")
    .replace(/[.\s()]/g, "");
  let idx = -1;

  if (clean === "ก" || clean === "1" || clean === "a") idx = 0;
  else if (clean === "ข" || clean === "2" || clean === "b") idx = 1;
  else if (clean === "ค" || clean === "3" || clean === "c") idx = 2;
  else if (clean === "ง" || clean === "4" || clean === "d") idx = 3;
  else if (clean === "จ" || clean === "5" || clean === "e") idx = 4;
  else if (!isNaN(Number(clean)) && Number(clean) >= 1 && Number(clean) <= 5) {
    idx = Number(clean) - 1;
  }

  if (idx === -1) {
    return { index: 0, error: `คำตอบระบุ '${raw}' ไม่ถูกต้อง (ระบุ ก, ข, ค, ง หรือ 1, 2, 3, 4)` };
  }

  if (idx >= count) {
    const letters = "กขคงจ";
    return {
      index: 0,
      error: `เฉลย '${letters[idx] || idx + 1}' เกินจำนวนตัวเลือกที่มี (${count} ข้อ)`,
    };
  }

  return { index: idx };
}

describe("ImportQuestions parser logic", () => {
  it("correctly parses Thai letter keys", () => {
    expect(parseCorrectIndex("ก", 4)).toEqual({ index: 0 });
    expect(parseCorrectIndex("ข้อ ข.", 4)).toEqual({ index: 1 });
    expect(parseCorrectIndex("ค", 4)).toEqual({ index: 2 });
    expect(parseCorrectIndex(" (ง) ", 4)).toEqual({ index: 3 });
    expect(parseCorrectIndex("จ", 5)).toEqual({ index: 4 });
  });

  it("correctly parses numbers (1-based to 0-based index)", () => {
    expect(parseCorrectIndex("1", 4)).toEqual({ index: 0 });
    expect(parseCorrectIndex("2", 4)).toEqual({ index: 1 });
    expect(parseCorrectIndex("3", 4)).toEqual({ index: 2 });
    expect(parseCorrectIndex("4", 4)).toEqual({ index: 3 });
  });

  it("correctly parses English letters (A-D)", () => {
    expect(parseCorrectIndex("A", 4)).toEqual({ index: 0 });
    expect(parseCorrectIndex("b", 4)).toEqual({ index: 1 });
    expect(parseCorrectIndex("C", 4)).toEqual({ index: 2 });
    expect(parseCorrectIndex("d", 4)).toEqual({ index: 3 });
  });

  it("validates boundary: rejects choice exceeding available options", () => {
    // True/False question with only 2 choices: ก, ข. Specifying "ค" or 3 should error
    const res = parseCorrectIndex("ค", 2);
    expect(res.error).toBeDefined();
    expect(res.error).toContain("เกินจำนวนตัวเลือกที่มี (2 ข้อ)");
  });

  it("rejects invalid input", () => {
    const res = parseCorrectIndex("xyz", 4);
    expect(res.error).toBeDefined();
    expect(res.error).toContain("ไม่ถูกต้อง");
  });

  it("formats and structures multi-lesson content for AI balanced question generation", () => {
    const mockLessons = [
      { id: "l1", title: "การป้องกันการติดเชื้อ", position: 1, kind: "text", body: "การล้างมือ 7 ขั้นตอน และการใช้แอลกอฮอล์เจล", file_url: null },
      { id: "l2", title: "การใช้อุปกรณ์ PPE", position: 2, kind: "pdf", body: null, file_url: "courses/c1/ppe-guide.pdf" },
    ];

    const formatLessonSections = (lessons: typeof mockLessons) => {
      return lessons.map((l) => {
        const bodyText = l.body?.trim() || "";
        const fileDesc = l.file_url ? `[ไฟล์แนบ: ${l.file_url.split("/").pop()}]` : "";
        const content = [bodyText, fileDesc].filter(Boolean).join("\n") || `(รูปแบบ: ${l.kind})`;
        return `=== บทที่ ${l.position}: ${l.title} ===\n${content}`;
      }).join("\n\n--------------------\n\n");
    };

    const combined = formatLessonSections(mockLessons);
    expect(combined).toContain("=== บทที่ 1: การป้องกันการติดเชื้อ ===");
    expect(combined).toContain("การล้างมือ 7 ขั้นตอน");
    expect(combined).toContain("=== บทที่ 2: การใช้อุปกรณ์ PPE ===");
    expect(combined).toContain("[ไฟล์แนบ: ppe-guide.pdf]");
    expect(combined).toContain("--------------------");
  });

  it("filters selected questions and re-indexes contiguous position numbers on save", () => {
    const rawRows = [
      { question: "ข้อ 1", options: ["A", "B"], correctIndex: 0, errors: [], selected: true },
      { question: "ข้อ 2", options: ["A", "B"], correctIndex: 1, errors: [], selected: false }, // unchecked
      { question: "ข้อ 3", options: ["A", "B"], correctIndex: 0, errors: [], selected: true },
      { question: "ข้อ 4", options: ["A", "B"], correctIndex: 1, errors: ["error in choice"], selected: false }, // error but unchecked
      { question: "ข้อ 5", options: ["A", "B"], correctIndex: 0, errors: [], selected: true },
    ];

    const selectedValidRows = rawRows.filter((r) => r.selected && r.errors.length === 0);
    expect(selectedValidRows).toHaveLength(3);

    const existingCount = 10;
    const payload = selectedValidRows.map((r, i) => ({
      question: r.question,
      position: existingCount + i + 1,
    }));

    expect(payload).toEqual([
      { question: "ข้อ 1", position: 11 },
      { question: "ข้อ 3", position: 12 },
      { question: "ข้อ 5", position: 13 },
    ]);
  });
});

