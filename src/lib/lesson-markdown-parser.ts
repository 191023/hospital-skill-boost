export type ParsedLessonRow = {
  line: number;
  position: number;
  title: string;
  kind: "text" | "video" | "pdf";
  body: string | null;
  video_url: string | null;
  file_url: string | null;
  errors: string[];
  selected?: boolean;
};

/**
 * Regex to detect YouTube URLs (standard watch?v=, embed/, youtu.be/)
 */
const YOUTUBE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s)]*)/i;

/**
 * Regex to detect PDF file links
 */
const PDF_URL_REGEX = /https?:\/\/[^\s)<>"]+\.pdf(?:\?[^\s)<>"]*)?/i;

/**
 * Parses frontmatter YAML-style metadata between `---` at the beginning of a section
 */
export function parseFrontmatter(rawText: string): {
  metadata: Record<string, string>;
  content: string;
} {
  const match = rawText.match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { metadata: {}, content: rawText };
  }

  const metaLines = match[1].split(/\r?\n/);
  const metadata: Record<string, string> = {};

  for (const line of metaLines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
      metadata[key] = val;
    }
  }

  return { metadata, content: match[2] };
}

/**
 * Parses Markdown (.md) or Text file content into structured lesson rows.
 *
 * Supports:
 * 1. Headings (# บทที่ 1, ## บทที่ 2)
 * 2. Frontmatter blocks (--- title: ... ---)
 * 3. Horizontal rules (--- or ===) between lessons
 * 4. Single-lesson document fallback
 */
export function parseMarkdownLessons(
  markdownText: string,
  startingPosition: number = 0,
  defaultTitle: string = "บทเรียนใหม่"
): ParsedLessonRow[] {
  const cleanText = markdownText.trim();
  if (!cleanText) {
    return [];
  }

  const rawSections: { heading: string; body: string; lineNo: number }[] = [];

  // Check if headings (# or ##) exist
  const headingMatches = [...cleanText.matchAll(/(?:^|\n)(#{1,2})\s+([^\n]+)/g)];

  if (headingMatches.length > 0) {
    // 1. Document has headings -> split by headings
    for (let i = 0; i < headingMatches.length; i++) {
      const current = headingMatches[i];
      const heading = current[2].trim();
      const startIndex = current.index! + current[0].length;
      const endIndex = i + 1 < headingMatches.length ? headingMatches[i + 1].index! : cleanText.length;
      let body = cleanText.slice(startIndex, endIndex).trim();

      // Only remove trailing horizontal rule between lessons if present
      body = body.replace(/\r?\n---\s*$/, "").trim();

      const lineNo = cleanText.slice(0, current.index!).split("\n").length;
      rawSections.push({ heading, body, lineNo });
    }
  } else {
    // 2. No headings: check if divided by horizontal rules `\n---\n`
    const isSingleFrontmatter = /^\s*---\r?\n[\s\S]*?\r?\n---\r?\n?[^-]*$/.test(cleanText);

    if (!isSingleFrontmatter && (cleanText.includes("\n---\n") || cleanText.includes("\n===\n"))) {
      const dividerRegex = /\r?\n(?:---|===)\r?\n/;
      const parts = cleanText.split(dividerRegex);

      let lineCounter = 1;
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const lines = trimmed.split(/\r?\n/);
        let heading = lines[0].replace(/^#+\s*/, "").trim();
        let body = lines.slice(1).join("\n").trim();

        rawSections.push({ heading, body, lineNo: lineCounter });
        lineCounter += lines.length + 2;
      }
    } else {
      // 3. Single-lesson file
      const { metadata, content } = parseFrontmatter(cleanText);
      const lines = content.trim().split(/\r?\n/);
      const firstLine = lines[0]?.trim() || "";
      const heading = metadata["title"] || (firstLine.length > 0 && firstLine.length < 80 ? firstLine : defaultTitle);
      const body = firstLine === heading && !metadata["title"] ? lines.slice(1).join("\n").trim() : content;
      rawSections.push({ heading, body: body || content, lineNo: 1 });
    }
  }

  // Process each section into a ParsedLessonRow
  return rawSections.map((sec, idx) => {
    const { metadata, content } = parseFrontmatter(sec.body);

    // 1. Title
    const title = metadata["title"] || sec.heading || `บทเรียนที่ ${idx + 1}`;

    // 2. Extract media URLs
    const ytMatch = content.match(YOUTUBE_REGEX);
    const videoUrl = metadata["video"] || metadata["video_url"] || metadata["youtube"] || (ytMatch ? ytMatch[0] : null);

    const pdfMatch = content.match(PDF_URL_REGEX);
    const fileUrl = metadata["file"] || metadata["file_url"] || metadata["pdf"] || (pdfMatch ? pdfMatch[0] : null);

    // 3. Determine Kind
    const rawKind = (metadata["kind"] || metadata["type"] || "").toLowerCase();
    let kind: "text" | "video" | "pdf" = "text";

    if (rawKind.includes("video") || rawKind.includes("วิดีโอ")) {
      kind = "video";
    } else if (rawKind.includes("pdf") || rawKind.includes("ไฟล์")) {
      kind = "pdf";
    } else if (videoUrl && content.length < 150) {
      kind = "video";
    } else if (fileUrl && content.length < 150) {
      kind = "pdf";
    }

    // 4. Position
    const rawPos = Number(metadata["position"] || metadata["pos"]);
    const position = rawPos > 0 ? rawPos : startingPosition + idx + 1;

    // 5. Clean up body
    const finalBody = content.trim() || null;

    const errors: string[] = [];
    if (!title) {
      errors.push("ไม่มีชื่อบทเรียน");
    }

    return {
      line: sec.lineNo,
      position,
      title,
      kind,
      body: finalBody,
      video_url: videoUrl,
      file_url: fileUrl,
      errors,
      selected: errors.length === 0,
    };
  });
}

/**
 * Returns a well-formatted markdown template ready for download.
 */
export function getSampleMarkdownTemplate(): string {
  return `# บทที่ 1: ความรู้เบื้องต้นและการเตรียมความพร้อม
การเรียนรู้เพื่อพัฒนาทักษะความเชี่ยวชาญทางคลินิกและการดูแลผู้ป่วยอย่างปลอดภัยตามมาตรฐานวิชาชีพ

### ประเด็นสำคัญที่ต้องปฏิบัติตาม
- **การประเมินเบื้องต้น:** สังเกตอาการและบันทึกสัญญาณชีพอย่างสม่ำเสมอ
- **การประสานงาน:** สื่อสารกับทีมสหสาขาวิชาชีพด้วยหลัก SBAR
- **ความปลอดภัย:** ปฏิบัติตามมาตรฐานการควบคุมการติดเชื้อ (Infection Control)

---

# บทที่ 2: วิดีโอสาธิตขั้นตอนปฏิบัติการช่วยฟื้นคืนชีพ (CPR)
ชมวิดีโอสาธิตการกดหน้าอก การใช้เครื่องกระตุกหัวใจ AED และการประสานงานทีมฉุกเฉิน:
https://www.youtube.com/watch?v=dQw4w9WgXcQ

> **คำแนะนำ:** บุคลากรควรกดหน้าอกด้วยความลึกอย่างน้อย 2 นิ้ว (5 ซม.) และความเร็ว 100 - 120 ครั้งต่อนาที

---

# บทที่ 3: คู่มือแนวทางเวชปฏิบัติมาตรฐานโรงพยาบาลโอเวอร์บรุ๊ค
เอกสารคู่มืออ้างอิงและเกณฑ์ประเมินทักษะตามมาตรฐานการรับรองกระบวนการคุณภาพสถานพยาบาล (HA)
ลิงก์เอกสารประกอบ: https://example.com/hospital-clinical-guideline.pdf

1. นโยบายความปลอดภัยด้านสิ่งแวดล้อม (FMS)
2. แนวทางปฏิบัติการอพยพผู้ป่วยภาวะวิกฤต
3. การจัดการความเสี่ยงและรายงานอุบัติการณ์
`;
}
