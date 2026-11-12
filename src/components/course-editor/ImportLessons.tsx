import { useState } from "react";
import { toast } from "sonner";
import {
  Download,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Video,
  FileCheck,
  FileCode,
  CheckSquare,
  Sparkles,
  Presentation,
  Bot,
  Eye,
  EyeOff,
  Edit2,
  Wand2,
  BookOpen,
  Clock,
  Layers,
  FileUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { btn } from "./shared";
import {
  parseMarkdownLessons,
  getSampleMarkdownTemplate,
  type ParsedLessonRow,
} from "@/lib/lesson-markdown-parser";
import { useServerFn } from "@tanstack/react-start";
import { generateCourseLessons } from "@/lib/ai.functions";
import { parseTrainingDocument, type ParsedDocumentResult } from "@/lib/document-parser";
import { MarkdownView } from "@/components/MarkdownView";

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
  const [activeTab, setActiveTab] = useState<"ai" | "file">("ai");
  const [rows, setRows] = useState<ParsedLessonRow[]>([]);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [busy, setBusy] = useState(false);

  // AI Generator state
  const [aiContent, setAiContent] = useState("");
  const [aiDoc, setAiDoc] = useState<ParsedDocumentResult | null>(null);
  const [parsingDoc, setParsingDoc] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiCount, setAiCount] = useState<number>(0); // 0 = Auto natural chunking
  const [aiTopic, setAiTopic] = useState("");
  const [aiDirectInput, setAiDirectInput] = useState(false);
  const [expandedRowIdx, setExpandedRowIdx] = useState<number | null>(null);

  const generateLessonsFn = useServerFn(generateCourseLessons);

  // 1. Download Template as Excel (.xlsx)
  const downloadExcelTemplate = async () => {
    const XLSX = await import("xlsx");
    const wsData = [TEMPLATE_HEADERS, ...SAMPLE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
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
    toast.success("ดาวน์โหลดไฟล์แม่แบบ Markdown เรียบร้อย");
  };

  // 2. Handle Manual File Upload (.xlsx, .csv, .md, .txt)
  const handleFileUpload = async (file: File) => {
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "md" || ext === "markdown") {
        const text = await file.text();
        const parsed = parseMarkdownLessons(text, existingCount);
        if (!parsed.length) {
          toast.error("ไม่พบบทเรียนในไฟล์ Markdown กรุณาตรวจสอบว่ามีหัวข้อ '# บทที่...'");
          return;
        }

        setRows(parsed);
        const validCount = parsed.filter((r) => !r.errors.length).length;
        toast.success(`อ่านไฟล์ Markdown สำเร็จ ตรวจพบ ${parsed.length} บทเรียน (ถูกต้อง ${validCount} บท) 📄`);
        return;
      }

      // Handle Spreadsheet file (.xlsx, .xls, .csv)
      const buffer = await file.arrayBuffer();
      const XLSX = await import("xlsx");
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
          selected: errors.length === 0,
        };
      });

      setRows(parsed);
      const validCount = parsed.filter((r) => !r.errors.length).length;
      toast.success(`อ่านข้อมูลสำเร็จ ตรวจพบ ${parsed.length} แถว (ถูกต้อง ${validCount} แถว)`);
    } catch (err) {
      toast.error(`อ่านไฟล์ไม่สำเร็จ: ${(err as Error).message}`);
    }
  };

  // 3. Handle Document Upload for AI (.pdf, .pptx, .docx, .xlsx, .txt, .md)
  const handleAiDocumentUpload = async (file: File) => {
    setParsingDoc(true);
    try {
      const parsed = await parseTrainingDocument(file);
      setAiDoc(parsed);
      setAiContent(parsed.text);
      toast.success(
        `อ่านไฟล์ "${parsed.filename}" สำเร็จ (${parsed.itemCountDesc || ""}, ${parsed.charCount.toLocaleString()} ตัวอักษร) พร้อมให้ AI สกัดบทเรียน 📄`
      );
    } catch (err: any) {
      toast.error(`อ่านไฟล์ไม่สำเร็จ: ${err.message || String(err)}`);
    } finally {
      setParsingDoc(false);
    }
  };

  // 4. Trigger AI Lesson Generation
  const handleGenerateAi = async () => {
    if (!aiContent.trim() || aiContent.trim().length < 20) {
      toast.error("กรุณาอัปโหลดไฟล์เอกสาร หรือวางเนื้อหาอย่างน้อย 20 ตัวอักษร");
      return;
    }

    setGeneratingAi(true);
    try {
      const res = await generateLessonsFn({
        data: {
          courseId,
          content: aiContent,
          count: aiCount,
          topic: aiTopic.trim() || undefined,
        },
      });

      if (!res.lessons || !res.lessons.length) {
        throw new Error("AI ไม่ได้สร้างบทเรียน กรุณาลองใหม่อีกครั้ง");
      }

      const startingPos = mode === "append" ? existingCount : 0;
      const mappedRows: ParsedLessonRow[] = res.lessons.map((item, idx) => ({
        line: idx + 1,
        position: startingPos + idx + 1,
        title: item.title,
        kind: (item.kind || "text") as "text" | "video" | "pdf",
        body: item.body,
        video_url: null,
        file_url: null,
        errors: [],
        selected: true,
      }));

      setRows(mappedRows);
      toast.success(
        `AI สกัดและแบ่งบทเรียนสำเร็จ ${mappedRows.length} บทเรียนเรียบร้อย 🎉 เลื่อนลงตรวจสอบด้านล่างได้เลย`
      );
    } catch (err: any) {
      toast.error(`สร้างบทเรียนไม่สำเร็จ: ${err.message || String(err)}`);
    } finally {
      setGeneratingAi(false);
    }
  };

  // Selection & row mutation helpers
  const toggleRowSelect = (index: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r))
    );
  };

  const toggleSelectAll = () => {
    const areAllSelected = validRows.length > 0 && validRows.every((r) => r.selected);
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        selected: r.errors.length === 0 ? !areAllSelected : false,
      }))
    );
  };

  const selectAll = () => {
    setRows((prev) =>
      prev.map((r) => ({ ...r, selected: r.errors.length === 0 }))
    );
  };

  const deselectAll = () => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: false })));
  };

  const updateRowField = (idx: number, updates: Partial<ParsedLessonRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...updates } : r)));
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const validRows = rows.filter((r) => !r.errors.length);
  const invalidRows = rows.filter((r) => r.errors.length);
  const selectedValidRows = rows.filter((r) => r.selected && !r.errors.length);
  const allSelected = validRows.length > 0 && validRows.every((r) => r.selected);
  const isIndeterminate = rows.some((r) => r.selected) && !allSelected;

  // 5. Batch Save to Supabase (Only selected valid rows)
  const handleSave = async () => {
    if (!selectedValidRows.length) {
      toast.error("กรุณาเลือกบทเรียนอย่างน้อย 1 บทเรียนที่ต้องการนำเข้า");
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
      const insertPayload = selectedValidRows.map((r, i) => ({
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
          ? `แทนที่บทเรียนทั้งหมดด้วย ${selectedValidRows.length} บทเรียนเรียบร้อย 🎉`
          : `เพิ่มบทเรียนต่อท้ายสำเร็จ ${selectedValidRows.length} บทเรียน 🎉`
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

  return (
    <div className="glass overflow-hidden rounded-3xl border border-glass-border p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-5 text-amber-500 dark:text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-bold text-foreground">
              <span>นำเข้า & สกัดบทเรียน (AI / Markdown / Excel)</span>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                ✨ มี AI ช่วยร่าง
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              อัปโหลดไฟล์สไลด์ PowerPoint, PDF, Word หรือ Markdown เพื่อแปลงเป็นบทเรียน e-Learning พร้อมเรียน
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 rounded-xl border border-glass-border bg-card/80 px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-card transition cursor-pointer"
          >
            {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {isOpen ? "ซ่อนแผงนำเข้า" : "เปิดแผงนำเข้าบทเรียน"}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-5 space-y-5 border-t border-glass-border pt-5">
          {/* SUB-TAB SWITCHER */}
          <div className="flex flex-wrap gap-2 border-b border-glass-border pb-3">
            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
                activeTab === "ai"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "glass hover:bg-card text-foreground/70"
              }`}
            >
              <Sparkles className="size-4 text-amber-400" />
              <span>ออกแบบบทเรียนอัตโนมัติด้วย AI (AI Generator)</span>
              <span className="rounded-full bg-mint/20 px-2 py-0.5 text-[10px] font-bold text-mint">
                แนะนำ
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("file")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
                activeTab === "file"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "glass hover:bg-card text-foreground/70"
              }`}
            >
              <FileSpreadsheet className="size-4" />
              <span>นำเข้าจากไฟล์ Markdown / Excel / CSV</span>
            </button>
          </div>

          {/* TAB 1: AI GENERATOR */}
          {activeTab === "ai" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🤖</span>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        สกัดบทเรียนจากเอกสารด้วย AI (Instructional Designer)
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        รองรับสไลด์ PowerPoint (.pptx), PDF (.pdf), Word (.docx), Excel (.xlsx), Text หรือ Markdown
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAiDirectInput(!aiDirectInput)}
                    className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                  >
                    {aiDirectInput ? "← กลับไปเลือกไฟล์เอกสาร" : "✏️ วางข้อความเนื้อหาเอง"}
                  </button>
                </div>

                {/* Upload or Direct Input Area */}
                {!aiDirectInput ? (
                  <div className="space-y-3">
                    <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-background/50 p-6 text-center hover:bg-background/80 transition cursor-pointer">
                      <FileUp className="size-8 text-primary mb-2 opacity-80" />
                      <span className="text-xs font-bold text-foreground">
                        คลิกเพื่อเลือกไฟล์เอกสาร หรือลากไฟล์มาวางที่นี่
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-1">
                        รองรับไฟล์ <strong>.pptx</strong> (สไลด์ PowerPoint), <strong>.pdf</strong>, <strong>.docx</strong> (Word), <strong>.xlsx</strong>, <strong>.txt</strong>, <strong>.md</strong>
                      </span>
                      <input
                        type="file"
                        accept=".docx,.pptx,.pdf,.txt,.md,.markdown,.csv,.json,.xlsx,.xls"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleAiDocumentUpload(file);
                        }}
                      />
                    </label>

                    {parsingDoc && (
                      <div className="flex items-center justify-center gap-2 text-xs text-primary py-2 animate-pulse font-semibold">
                        <RefreshCw className="size-4 animate-spin" />
                        <span>กำลังอ่านและสกัดโครงสร้างเนื้อหาจากไฟล์เอกสาร...</span>
                      </div>
                    )}

                    {aiDoc && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mint/30 bg-mint/10 p-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="size-4 text-mint shrink-0" />
                          <div>
                            <div className="font-bold text-foreground flex items-center gap-2">
                              <span>{aiDoc.filename}</span>
                              <span className="rounded bg-mint/20 px-1.5 py-0.5 text-[10px] font-mono uppercase text-mint font-bold">
                                {aiDoc.fileType}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {aiDoc.itemCountDesc && <span className="mr-2">📄 {aiDoc.itemCountDesc}</span>}
                              <span>ความยาว: {aiDoc.charCount.toLocaleString()} ตัวอักษร</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setAiDoc(null);
                            setAiContent("");
                          }}
                          className="text-xs text-destructive hover:underline cursor-pointer"
                        >
                          ลบและเลือกไฟล์ใหม่
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground">
                      วางเนื้อหาเอกสารหรือข้อความอ้างอิง:
                    </label>
                    <textarea
                      rows={6}
                      value={aiContent}
                      onChange={(e) => setAiContent(e.target.value)}
                      placeholder="วางเนื้อหา สไลด์ หรือข้อความของหลักสูตรที่นี่ (อย่างน้อย 20 ตัวอักษร)..."
                      className="w-full rounded-xl border border-input bg-background/80 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>ความยาว: {aiContent.length.toLocaleString()} ตัวอักษร</span>
                      {aiContent.length >= 20 && <span className="text-mint font-semibold">✓ ความยาวเพียงพอ</span>}
                    </div>
                  </div>
                )}

                {/* AI Configuration Row */}
                <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-amber-500/10">
                  {/* Chunking control */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Layers className="size-3.5 text-primary" />
                      <span>การแบ่งจำนวนบทเรียน:</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "✨ แบ่งตามหัวข้อธรรมชาติ (แนะนำ)", val: 0 },
                        { label: "3 บท", val: 3 },
                        { label: "5 บท", val: 5 },
                        { label: "7 บท", val: 7 },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setAiCount(opt.val)}
                          className={`rounded-xl px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                            aiCount === opt.val
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "border border-border/80 bg-background/70 text-muted-foreground hover:bg-card hover:text-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Topic Focus */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <BookOpen className="size-3.5 text-primary" />
                      <span>หัวข้อหรือประเด็นเน้นย้ำพิเศษ (ไม่บังคับ):</span>
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น เน้นเฉพาะขั้นตอน Code Red และแผนกฉุกเฉิน"
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background/80 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Tone Notice */}
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
                  <span className="font-bold text-sky-600 dark:text-sky-400 shrink-0">🏥 ระดับภาษา:</span>
                  <span>โทนภาษามาตรฐานโรงพยาบาล สุภาพ ชัดเจน ครอบคลุมบุคลากรทุกสายงานตามมาตรฐานความปลอดภัย (HA / JCI)</span>
                </div>

                {/* Submit Action */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={generatingAi || !aiContent.trim() || aiContent.trim().length < 20}
                    onClick={handleGenerateAi}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-brand hover:opacity-95 transition cursor-pointer disabled:opacity-50"
                  >
                    {generatingAi ? (
                      <>
                        <RefreshCw className="size-4 animate-spin" />
                        <span>AI กำลังวิเคราะห์และเรียบเรียงบทเรียน...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="size-4" />
                        <span>✨ เริ่มวิเคราะห์และสร้างบทเรียนด้วย AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL FILE IMPORT (MARKDOWN / EXCEL / CSV) */}
          {activeTab === "file" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background/60 p-3.5 border border-glass-border">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground mr-1">ดาวน์โหลดแม่แบบ:</span>
                  <button
                    type="button"
                    onClick={downloadMarkdownTemplate}
                    className="flex items-center gap-1.5 rounded-xl bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-500/25 transition border border-sky-500/20 cursor-pointer"
                  >
                    <Download className="size-3.5" />
                    ไฟล์ Markdown (.md)
                  </button>
                  <button
                    type="button"
                    onClick={downloadExcelTemplate}
                    className="flex items-center gap-1.5 rounded-xl bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint hover:bg-mint/25 transition cursor-pointer"
                  >
                    <Download className="size-3.5" />
                    ไฟล์ Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={downloadCsvTemplate}
                    className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
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
            </div>
          )}

          {/* PREVIEW & CONFIRMATION SECTION */}
          {rows.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-glass-border pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 font-bold text-primary">
                    <CheckSquare className="size-3.5" /> เลือกนำเข้า {selectedValidRows.length} จาก {validRows.length} บท
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-coral/15 px-2.5 py-1 font-bold text-coral">
                      <AlertCircle className="size-3.5" /> มีข้อผิดพลาด {invalidRows.length} แถว
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={selectAll}
                    className="rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-card hover:text-foreground transition cursor-pointer"
                  >
                    เลือกทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-card hover:text-foreground transition cursor-pointer"
                  >
                    ยกเลิกเลือก
                  </button>
                </div>

                {/* MODE TOGGLE */}
                <div className="flex items-center gap-2 rounded-xl border bg-background/80 p-1">
                  <button
                    type="button"
                    onClick={() => setMode("append")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
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
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                      mode === "replace"
                        ? "bg-destructive text-destructive-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    แทนที่ทั้งหมด
                  </button>
                </div>
              </div>

              {/* LESSON CARDS LIST (ACCORDION WITH EDIT & MARKDOWN PREVIEW) */}
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {rows.map((r, i) => {
                  const isExpanded = expandedRowIdx === i;

                  return (
                    <div
                      key={i}
                      className={`rounded-2xl border transition-all ${
                        r.selected
                          ? "border-primary/40 bg-card shadow-xs"
                          : "border-border/60 bg-card/40 opacity-70"
                      }`}
                    >
                      {/* CARD HEADER */}
                      <div className="flex items-center gap-3 p-3 sm:p-4">
                        <input
                          type="checkbox"
                          checked={!!r.selected}
                          disabled={r.errors.length > 0}
                          onChange={() => toggleRowSelect(i)}
                          className="size-4 rounded border-input text-primary focus:ring-primary cursor-pointer disabled:opacity-30 shrink-0"
                        />

                        <div className="grid size-7 place-items-center rounded-xl bg-primary/10 font-mono text-xs font-bold text-primary shrink-0">
                          {r.position}
                        </div>

                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={r.title}
                            onChange={(e) => updateRowField(i, { title: e.target.value })}
                            className="w-full bg-transparent font-semibold text-sm text-foreground focus:bg-background/80 focus:ring-1 focus:ring-primary/40 rounded-lg px-2 py-1 outline-none transition"
                            placeholder="ชื่อบทเรียน..."
                          />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-background border">
                            {r.kind === "video" && <Video className="size-3 text-coral" />}
                            {r.kind === "pdf" && <FileCheck className="size-3 text-primary" />}
                            {r.kind === "text" && <FileText className="size-3 text-mint" />}
                            {r.kind === "video" ? "วิดีโอ" : r.kind === "pdf" ? "PDF" : "บทความ"}
                          </span>

                          <button
                            type="button"
                            onClick={() => setExpandedRowIdx(isExpanded ? null : i)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-card transition cursor-pointer"
                          >
                            {isExpanded ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            <span>{isExpanded ? "ซ่อนเนื้อหา" : "ดู/แก้เนื้อหา"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => removeRow(i)}
                            className="rounded-lg p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition cursor-pointer"
                            title="ลบแถวนี้"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* CARD EXPANDED BODY (EDIT TEXTAREA + MARKDOWN PREVIEW) */}
                      {isExpanded && (
                        <div className="border-t border-border/60 bg-background/40 p-4 space-y-3">
                          <div className="grid gap-4 lg:grid-cols-2">
                            {/* Editor Column */}
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-muted-foreground flex items-center justify-between">
                                <span>✏️ แก้ไขเนื้อหา (ฟอร์แมต Markdown)</span>
                                <span>{r.body?.length || 0} ตัวอักษร</span>
                              </label>
                              <textarea
                                rows={8}
                                value={r.body || ""}
                                onChange={(e) => updateRowField(i, { body: e.target.value })}
                                placeholder="เนื้อหาบทเรียน (รองรับ Markdown: # หัวข้อ, **ตัวหนา**, - รายการ)..."
                                className="w-full rounded-xl border border-input bg-background/90 p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                              />
                            </div>

                            {/* Markdown Preview Column */}
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-muted-foreground">
                                👁️ หน้าตาผลลัพธ์ที่จะแสดงในห้องเรียน:
                              </label>
                              <div className="max-h-56 overflow-y-auto rounded-xl border border-border/80 bg-background/80 p-3.5 text-xs">
                                {r.body ? (
                                  <MarkdownView content={r.body} />
                                ) : (
                                  <span className="text-muted-foreground italic">ไม่มีเนื้อหาข้อความ</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* SAVE & CANCEL BAR */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-glass-border">
                <button
                  type="button"
                  onClick={() => setRows([])}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Trash2 className="size-3.5" /> ล้างรายการพรีวิวทั้งหมด
                </button>

                <button
                  type="button"
                  disabled={busy || selectedValidRows.length === 0}
                  onClick={handleSave}
                  className={btn}
                >
                  {busy
                    ? "กำลังบันทึก..."
                    : `ยืนยันนำเข้า ${selectedValidRows.length} บทเรียนที่เลือก (${
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
