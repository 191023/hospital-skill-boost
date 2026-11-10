import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Plus, RefreshCw, Trash2, Upload, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, FileText, Video, FileCheck, FileCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { btn } from "./shared";
import { parseMarkdownLessons, getSampleMarkdownTemplate, type ParsedLessonRow } from "@/lib/lesson-markdown-parser";

const TEMPLATE_HEADERS = [
  "ลำดับ (Position)",
  "ชื่อบทเรียน (Title) *จำเป็น",
  "ประเภท (Kind: text / video / pdf)",
  "ลิงก์วิดีโอ (Video URL)",
  "ลิงก์ไฟล์ (File URL)",
  "เนื้อหาบทเรียน (Content / Body)",
];

const SAMPLE_ROWS = [
  [
    1,
    "บทนำ: ความรู้เบื้องต้นและการเตรียมความพร้อม",
    "text",
    "",
    "",
    "การเรียนรู้เพื่อพัฒนาทักษะความเชี่ยวชาญทางคลินิกและการดูแลผู้ป่วยอย่างปลอดภัยตามมาตรฐานวิชาชีพ...",
  ],
  [
    2,
    "วิดีโอสาธิตขั้นตอนปฏิบัติการช่วยฟื้นคืนชีพขั้นสูง",
    "video",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "",
    "ชมวิดีโอสาธิตการกดหน้าอก การใช้เครื่องกระตุกหัวใจ AED และการประสานงานทีมฉุกเฉิน",
  ],
  [
    3,
    "คู่มือแนวทางเวชปฏิบัติมาตรฐานโรงพยาบาล",
    "pdf",
    "",
    "https://example.com/hospital-cpr-guideline.pdf",
    "เอกสารคู่มืออ้างอิงและเกณฑ์ประเมินทักษะตามมาตรฐานการรับรองกระบวนการคุณภาพ (HA)",
  ],
];

export function ImportLessons({
  courseId,
  existingCount,
  onDone,
}: {
  courseId: string;
  existingCount: number;
  onDone: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<ParsedLessonRow[]>([]);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [busy, setBusy] = useState(false);

  // 1. Download Template as Excel (.xlsx)
  const downloadExcelTemplate = () => {
    const wsData = [TEMPLATE_HEADERS, ...SAMPLE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    // Adjust column widths for readability
    ws["!cols"] = [
      { wch: 18 }, // ลำดับ
      { wch: 45 }, // ชื่อบทเรียน
      { wch: 28 }, // ประเภท
      { wch: 40 }, // ลิงก์วิดีโอ
      { wch: 40 }, // ลิงก์ไฟล์
      { wch: 60 }, // เนื้อหา
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "แม่แบบบทเรียน");
    XLSX.writeFile(wb, "lesson-template.xlsx");
    toast.success("ดาวน์โหลดไฟล์แม่แบบ Excel เรียบร้อย");
  };

  // Download Template as CSV (.csv)
  const downloadCsvTemplate = () => {
    const csvContent =
      "\uFEFF" +
      TEMPLATE_HEADERS.join(",") +
      "\n" +
      SAMPLE_ROWS.map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      ).join("\n") +
      "\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lesson-template.csv";
    a.click();
    toast.success("ดาวน์โหลดไฟล์แม่แบบ CSV เรียบร้อย");
  };

  // Download Template as Markdown (.md)
  const downloadMarkdownTemplate = () => {
    const mdContent = getSampleMarkdownTemplate();
    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lesson-template.md";
    a.click();
    toast.success("ดาวน์โหลดไฟล์แม่แบบ Markdown (.md) เรียบร้อย 📄");
  };

  // 2. Parse uploaded file (.xlsx, .xls, .csv, .md, .txt)
  const handleFileUpload = async (file: File) => {
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";

      // Handle Markdown or Plain Text file (.md, .markdown, .txt)
      if (ext === "md" || ext === "markdown" || ext === "txt" || file.type.includes("markdown") || file.type.includes("text/plain")) {
        const text = await file.text();
        const fallbackTitle = file.name.replace(/\.[^/.]+$/, "");
        const parsed = parseMarkdownLessons(text, existingCount, fallbackTitle);

        if (!parsed.length) {
          toast.error("ไฟล์ Markdown ไม่มีเนื้อหาบทเรียน");
          return;
        }

        setRows(parsed);
        const validCount = parsed.filter((r) => !r.errors.length).length;
        toast.success(`อ่านไฟล์ Markdown สำเร็จ ตรวจพบ ${parsed.length} บทเรียน (ถูกต้อง ${validCount} บท) 📄`);
        return;
      }

      // Handle Spreadsheet file (.xlsx, .xls, .csv)
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", codepage: 65001 });
      const firstSheetName = wb.SheetNames[0];
      if (!firstSheetName) {
        toast.error("ไม่พบข้อมูลแผ่นงาน (Worksheet) ในไฟล์");
        return;
      }
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        wb.Sheets[firstSheetName]!,
        { defval: "" }
      );

      if (!raw.length) {
        toast.error("ไฟล์ไม่มีแถวข้อมูลบทเรียน");
        return;
      }

      const parsed: ParsedLessonRow[] = raw.map((r, idx) => {
        // Flexible key getter (supports Thai or English headers)
        const getVal = (...keys: string[]) => {
          for (const k of keys) {
            for (const rk of Object.keys(r)) {
              if (rk.trim().toLowerCase().includes(k.toLowerCase())) {
                const val = r[rk];
                if (val !== undefined && val !== null) return String(val).trim();
              }
            }
          }
          return "";
        };

        const rawPos = getVal("ลำดับ", "position", "order", "no");
        const title = getVal("ชื่อบทเรียน", "ชื่อ", "title", "lesson");
        const rawKind = getVal("ประเภท", "kind", "type").toLowerCase();
        const videoUrl = getVal("ลิงก์วิดีโอ", "วิดีโอ", "video_url", "video", "youtube");
        const fileUrl = getVal("ลิงก์ไฟล์", "ไฟล์", "file_url", "file", "pdf_url");
        const body = getVal("เนื้อหา", "คำอธิบาย", "body", "content", "description");

        let kind: "text" | "video" | "pdf" = "text";
        if (rawKind.includes("video") || rawKind.includes("วิดีโอ") || rawKind.includes("youtube")) {
          kind = "video";
        } else if (rawKind.includes("pdf") || rawKind.includes("เอกสาร") || rawKind.includes("ไฟล์")) {
          kind = "pdf";
        }

        const errors: string[] = [];
        if (!title) {
          errors.push("ไม่มีชื่อบทเรียน");
        }

        const position = Number(rawPos) > 0 ? Number(rawPos) : existingCount + idx + 1;

        return {
          line: idx + 2,
          position,
          title: title || `บทเรียนแถวที่ ${idx + 2}`,
          kind,
          body: body || null,
          video_url: videoUrl || null,
          file_url: fileUrl || null,
          errors,
        };
      });

      setRows(parsed);
      const validCount = parsed.filter((r) => !r.errors.length).length;
      toast.success(`อ่านข้อมูลสำเร็จ ตรวจพบ ${parsed.length} แถว (ถูกต้อง ${validCount} แถว)`);
    } catch (err) {
      toast.error(`อ่านไฟล์ไม่สำเร็จ: ${(err as Error).message}`);
    }
  };

  // 3. Batch Save to Supabase
  const handleSave = async () => {
    const validRows = rows.filter((r) => !r.errors.length);
    if (!validRows.length) {
      toast.error("ไม่มีแถวบทเรียนที่ถูกต้องสำหรับบันทึก");
      return;
    }

    setBusy(true);
    try {
      if (mode === "replace") {
        const { error: delError } = await supabase
          .from("lessons")
          .delete()
          .eq("course_id", courseId);
        if (delError) throw delError;
      }

      // Re-normalize positions
      const startingPos = mode === "append" ? existingCount : 0;
      const insertPayload = validRows.map((r, i) => ({
        course_id: courseId,
        title: r.title,
        kind: r.kind,
        body: r.body,
        video_url: r.video_url,
        file_url: r.file_url,
        position: mode === "replace" ? i + 1 : (r.position > startingPos ? r.position : startingPos + i + 1),
      }));

      const { error: insError } = await supabase.from("lessons").insert(insertPayload);
      if (insError) throw insError;

      toast.success(
        mode === "replace"
          ? `แทนที่บทเรียนทั้งหมดด้วย ${validRows.length} บทเรียนเรียบร้อย`
          : `เพิ่มบทเรียนต่อท้ายสำเร็จ ${validRows.length} บทเรียน`
      );
      setRows([]);
      setIsOpen(false);
      onDone();
    } catch (err) {
      toast.error(`บันทึกไม่สำเร็จ: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const validRows = rows.filter((r) => !r.errors.length);
  const invalidRows = rows.filter((r) => r.errors.length);

  return (
    <div className="glass overflow-hidden rounded-3xl border border-glass-border p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileSpreadsheet className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">นำเข้าบทเรียนจากไฟล์ Markdown / Excel / CSV</h3>
            <p className="text-xs text-muted-foreground">สร้างบทเรียนจากไฟล์ Markdown (.md) หรือตาราง Excel / CSV ได้ในคลิกเดียว</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 rounded-xl border border-glass-border bg-card/80 px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-card transition"
          >
            {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {isOpen ? "ซ่อนแถบนำเข้า" : "เปิดแถบนำเข้า"}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 space-y-4 border-t pt-4">
          {/* ACTION BUTTONS & FILE INPUT */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background/60 p-3.5 border border-glass-border">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground mr-1">ดาวน์โหลดแม่แบบ:</span>
              <button
                type="button"
                onClick={downloadMarkdownTemplate}
                className="flex items-center gap-1.5 rounded-xl bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-500/25 transition border border-sky-500/20"
              >
                <Download className="size-3.5" />
                ไฟล์ Markdown (.md)
              </button>
              <button
                type="button"
                onClick={downloadExcelTemplate}
                className="flex items-center gap-1.5 rounded-xl bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint hover:bg-mint/25 transition"
              >
                <Download className="size-3.5" />
                ไฟล์ Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={downloadCsvTemplate}
                className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition"
              >
                <Download className="size-3.5" />
                ไฟล์ CSV (.csv)
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-brand hover:opacity-95 transition">
              <Upload className="size-3.5" />
              <span>เลือกไฟล์เพื่ออัปโหลด (.md / .xlsx / .csv)</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.md,.markdown,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />
            </label>
          </div>

          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3.5 py-2.5 text-xs text-muted-foreground leading-relaxed flex items-center gap-2">
            <span className="font-bold text-sky-600 dark:text-sky-400 shrink-0">💡 เคล็ดลับ Markdown:</span>
            <span>
              ใช้หัวข้อ <code># บทที่...</code> เพื่อแยกแต่ละบทเรียน หรือใช้เส้นแบ่ง <code>---</code> คั่นระหว่างบท ระบบจะสร้างบทเรียนย่อยพร้อมตรวจจับลิงก์วิดีโอ YouTube และ PDF ให้อัตโนมัติ
            </span>
          </div>

          {/* PREVIEW & CONFIRMATION */}
          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 rounded-full bg-mint/15 px-2.5 py-1 font-bold text-mint">
                    <CheckCircle2 className="size-3.5" /> พร้อมนำเข้า {validRows.length} บท
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-coral/15 px-2.5 py-1 font-bold text-coral">
                      <AlertCircle className="size-3.5" /> ผิดพลาด {invalidRows.length} แถว (จะถูกข้าม)
                    </span>
                  )}
                </div>

                {/* MODE TOGGLE */}
                <div className="flex items-center gap-2 rounded-xl border bg-background/80 p-1">
                  <button
                    type="button"
                    onClick={() => setMode("append")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      mode === "append"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    เพิ่มต่อท้าย (มีเดิม {existingCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("replace")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      mode === "replace"
                        ? "bg-destructive text-destructive-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    แทนที่ทั้งหมด
                  </button>
                </div>
              </div>

              {/* TABLE PREVIEW */}
              <div className="max-h-64 overflow-y-auto rounded-2xl border border-glass-border bg-card">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-mist/90 backdrop-blur-sm text-left border-b font-semibold text-muted-foreground">
                    <tr>
                      <th className="p-2.5 w-12 text-center">ลำดับ</th>
                      <th className="p-2.5">ชื่อบทเรียน</th>
                      <th className="p-2.5 w-24">ประเภท</th>
                      <th className="p-2.5">ลิงก์ / เนื้อหา</th>
                      <th className="p-2.5 w-24 text-right">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r, i) => (
                      <tr
                        key={i}
                        className={r.errors.length ? "bg-coral/5 text-coral" : "hover:bg-background/50"}
                      >
                        <td className="p-2.5 text-center font-mono font-bold text-muted-foreground">
                          {r.position}
                        </td>
                        <td className="p-2.5 font-semibold text-foreground">
                          <div className="truncate max-w-[280px]" title={r.title}>
                            {r.title}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-background border">
                            {r.kind === "video" && <Video className="size-3 text-coral" />}
                            {r.kind === "pdf" && <FileCheck className="size-3 text-primary" />}
                            {r.kind === "text" && <FileText className="size-3 text-mint" />}
                            {r.kind === "video" ? "วิดีโอ" : r.kind === "pdf" ? "PDF" : "บทความ"}
                          </span>
                        </td>
                        <td className="p-2.5 text-muted-foreground">
                          <div className="truncate max-w-[320px]">
                            {r.video_url || r.file_url || r.body || "—"}
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-medium">
                          {r.errors.length ? (
                            <span className="text-coral font-bold">{r.errors.join(", ")}</span>
                          ) : (
                            <span className="text-mint font-bold">✓ ผ่าน</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* SAVE & CANCEL BAR */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setRows([])}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="size-3.5" /> ล้างรายการพรีวิว
                </button>

                <button
                  type="button"
                  disabled={busy || !validRows.length}
                  onClick={handleSave}
                  className={btn}
                >
                  {busy
                    ? "กำลังบันทึก..."
                    : `ยืนยันนำเข้า ${validRows.length} บทเรียน (${
                        mode === "replace" ? "แทนที่ทั้งหมด" : "เพิ่มต่อท้าย"
                      })`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
