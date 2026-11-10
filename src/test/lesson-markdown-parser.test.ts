import { describe, it, expect } from "vitest";
import { parseMarkdownLessons, getSampleMarkdownTemplate } from "@/lib/lesson-markdown-parser";

describe("Lesson Markdown Parser", () => {
  it("returns empty array for empty string", () => {
    expect(parseMarkdownLessons("")).toEqual([]);
    expect(parseMarkdownLessons("   \n\n  ")).toEqual([]);
  });

  it("parses multiple lessons split by top-level markdown headings (#)", () => {
    const md = `
# บทที่ 1: ความรู้เบื้องต้น
เนื้อหาบทที่ 1 บรรทัดที่ 1
- ข้อความย่อย
- ประเด็นสำคัญ

# บทที่ 2: วิดีโอสาธิตการทำ CPR
ชมวิดีโอ: https://www.youtube.com/watch?v=dQw4w9WgXcQ
สรุปขั้นตอนการปฏิบัติ
`;
    const rows = parseMarkdownLessons(md, 0);
    expect(rows).toHaveLength(2);

    expect(rows[0].title).toBe("บทที่ 1: ความรู้เบื้องต้น");
    expect(rows[0].position).toBe(1);
    expect(rows[0].kind).toBe("text");
    expect(rows[0].body).toContain("เนื้อหาบทที่ 1");
    expect(rows[0].errors).toHaveLength(0);

    expect(rows[1].title).toBe("บทที่ 2: วิดีโอสาธิตการทำ CPR");
    expect(rows[1].position).toBe(2);
    expect(rows[1].video_url).toContain("youtube.com/watch?v=dQw4w9WgXcQ");
    expect(rows[1].errors).toHaveLength(0);
  });

  it("parses lessons split by horizontal rules (---)", () => {
    const md = `
บทนำการทำงาน
เนื้อหาเกริ่นนำ
---
ขั้นตอนการช่วยเหลือผู้ป่วย
1. ตรวจสอบชีพจร
2. เปิดทางเดินหายใจ
---
สรุปผล
ทบทวนความรู้
`;
    const rows = parseMarkdownLessons(md, 5);
    expect(rows).toHaveLength(3);
    expect(rows[0].position).toBe(6);
    expect(rows[0].title).toBe("บทนำการทำงาน");
    expect(rows[1].position).toBe(7);
    expect(rows[1].title).toBe("ขั้นตอนการช่วยเหลือผู้ป่วย");
    expect(rows[2].position).toBe(8);
    expect(rows[2].title).toBe("สรุปผล");
  });

  it("detects PDF file links within markdown", () => {
    const md = `
# คู่มือการใช้สารเคมี
ศึกษาเอกสารคู่มือได้ที่ https://hospital.example.com/msds-guide.pdf
กรุณาอ่านให้ละเอียดก่อนปฏิบัติงาน
`;
    const rows = parseMarkdownLessons(md, 0);
    expect(rows).toHaveLength(1);
    expect(rows[0].file_url).toBe("https://hospital.example.com/msds-guide.pdf");
  });

  it("parses frontmatter metadata if provided", () => {
    const md = `
# หัวข้อเบื้องต้น
---
title: หัวข้อพิเศษจาก Frontmatter
kind: video
youtube: https://youtu.be/dQw4w9WgXcQ
position: 10
---
คำอธิบายบทเรียนวิดีโอ
`;
    const rows = parseMarkdownLessons(md, 0);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("หัวข้อพิเศษจาก Frontmatter");
    expect(rows[0].kind).toBe("video");
    expect(rows[0].position).toBe(10);
    expect(rows[0].video_url).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(rows[0].body).toBe("คำอธิบายบทเรียนวิดีโอ");
  });

  it("handles single-lesson file without headings", () => {
    const md = `เนื้อหาบทเรียนเดี่ยวที่ไม่มีหัวข้อชัดเจน อธิบายขั้นตอนการทำงานตั้งแต่ต้นจนจบ`;
    const rows = parseMarkdownLessons(md, 2, "บทเรียนความปลอดภัย");
    expect(rows).toHaveLength(1);
    expect(rows[0].position).toBe(3);
    expect(rows[0].body).toBe(md);
  });

  it("provides valid sample template text", () => {
    const template = getSampleMarkdownTemplate();
    const rows = parseMarkdownLessons(template, 0);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});

