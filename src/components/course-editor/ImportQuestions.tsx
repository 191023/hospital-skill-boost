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
  HelpCircle,
  FileCheck,
  Sparkles,
  Bot,
  Wand2,
  FileText,
  BookOpen,
  Layers,
  CheckSquare,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateQuizQuestions } from "@/lib/ai.functions";
import { parseTrainingDocument } from "@/lib/document-parser";
import { supabase } from "@/integrations/supabase/client";
import { fileUrl } from "@/lib/auth";
import { btn } from "./shared";

type ParsedQuestionRow = {
  line: number;
  position: number;
  question: string;
  options: string[];
  correctIndex: number;
  correctRaw: string;
  errors: string[];
  selected: boolean;
};

const TEMPLATE_HEADERS = [
  "ลำดับ (No.)",
  "คำถาม (Question) *จำเป็น",
  "ตัวเลือก ก (Choice A) *จำเป็น",
  "ตัวเลือก ข (Choice B) *จำเป็น",
  "ตัวเลือก ค (Choice C)",
  "ตัวเลือก ง (Choice D)",
  "ตัวเลือก จ (Choice E)",
  "คำตอบที่ถูกต้อง (Correct: ก/ข/ค/ง/จ หรือ 1/2/3/4) *จำเป็น",
];

const SAMPLE_ROWS = [
  [
    1,
    "สิ่งแรกที่ต้องปฏิบัติเมื่อพบผู้หมดสติและไม่ตอบสนองคือข้อใด?",
    "ตรวจสอบความปลอดภัยของสถานที่เกิดเหตุ (Scene Safety)",
    "เริ่มกดหน้าอกทันที (Chest Compression)",
    "ร้องขอความช่วยเหลือและโทรแจ้งทีมฉุกเฉิน (Call for Help)",
    "นำเครื่องกระตุกหัวใจอัตโนมัติ (AED) มาใช้งานทันที",
    "",
    "ก",
  ],
  [
    2,
    "อัตราส่วนการกดหน้าอกต่อการช่วยหายใจในการทำ CPR ขั้นพื้นฐานสำหรับผู้ใหญ่คือเท่าใด?",
    "15 : 2",
    "30 : 2",
    "50 : 2",
    "100 : 2",
    "",
    "2",
  ],
  [
    3,
    "การล้างมือด้วยสบู่และน้ำตามมาตรฐาน 7 ขั้นตอนของ WHO ควรใช้เวลาอย่างน้อยกี่วินาที?",
    "10 - 15 วินาที",
    "20 - 30 วินาที",
    "40 - 60 วินาที",
    "2 นาทีขึ้นไป",
    "",
    "ค",
  ],
  [
    4,
    "บุคลากรทางการแพทย์ต้องล้างมือก่อนและหลังสัมผัสผู้ป่วยทุกราย แม้จะสวมถุงมือปฏิบัติงานหรือไม่ก็ตาม",
    "ถูกต้อง",
    "ไม่ถูกต้อง",
    "",
    "",
    "",
    "1",
  ],
];

export function ImportQuestions({
  courseId,
  existingCount,
  onDone,
}: {
  courseId: string;
  existingCount: number;
  onDone: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeImportTab, setActiveImportTab] = useState<"file" | "ai">("file");
  const [rows, setRows] = useState<ParsedQuestionRow[]>([]);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [busy, setBusy] = useState(false);

  // AI Quiz Generator State
  const [aiContent, setAiContent] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState<number>(5);
  const [aiDifficulty, setAiDifficulty] = useState<"basic" | "scenario" | "mixed">("mixed");
  const [generatingAi, setGeneratingAi] = useState(false);
  const generateQuizFn = useServerFn(generateQuizQuestions);

  async function handleGenerateWithAi() {
    if (!aiContent.trim() || aiContent.trim().length < 20) {
      toast.error("กรุณาระบุเนื้อหาหรือวางข้อความสรุปบทเรียนอย่างน้อย 20 ตัวอักษร");
      return;
    }
    setGeneratingAi(true);
    try {
      const res = await generateQuizFn({
        data: {
          courseId,
          content: aiContent.trim(),
          count: aiCount,
          difficulty: aiDifficulty,
          topic: aiTopic.trim() || undefined,
        },
      });

      const choiceChars = "กขคง";
      const newRows: ParsedQuestionRow[] = res.questions.map((q, idx) => ({
        line: idx + 1,
        position: (existingCount || 0) + idx + 1,
        question: q.question,
        options: q.options,
        correctIndex: q.correct_index,
        correctRaw: choiceChars[q.correct_index] || "ก",
        errors: [],
        selected: true,
      }));

      setRows(newRows);
      toast.success(`AI สร้างข้อสอบสำเร็จ ${newRows.length} ข้อ ตรวจทานและแก้ไขได้ที่ตารางด้านล่าง`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGeneratingAi(false);
    }
  }

  const [parsingDoc, setParsingDoc] = useState(false);
  const [docMeta, setDocMeta] = useState<{ filename: string; desc: string } | null>(null);

  // Lesson Extraction State
  const [showLessonSelector, setShowLessonSelector] = useState(false);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [extractingFromLessons, setExtractingFromLessons] = useState(false);

  type CourseLesson = {
    id: string;
    title: string;
    position: number;
    kind: string;
    body: string | null;
    file_url: string | null;
  };

  const { data: courseLessons = [] } = useQuery({
    queryKey: ["course-lessons-for-quiz", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, title, position, kind, body, file_url")
        .eq("course_id", courseId)
        .is("deleted_at", null)
        .order("position");
      if (error) throw error;
      return (data || []) as CourseLesson[];
    },
    enabled: isOpen,
  });

  const toggleLessonSelection = (id: string) => {
    setSelectedLessonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllLessons = () => {
    if (selectedLessonIds.length === courseLessons.length) {
      setSelectedLessonIds([]);
    } else {
      setSelectedLessonIds(courseLessons.map((l) => l.id));
    }
  };

  const handleExtractFromSelectedLessons = async () => {
    if (selectedLessonIds.length === 0) {
      toast.error("กรุณาเลือกบทเรียนอย่างน้อย 1 บทเรียน");
      return;
    }

    setExtractingFromLessons(true);
    try {
      const targetLessons = courseLessons.filter((l) => selectedLessonIds.includes(l.id));
      const extractedSections: string[] = [];

      for (const lesson of targetLessons) {
        let lessonText = "";

        if (lesson.body && lesson.body.trim()) {
          lessonText += lesson.body.trim();
        }

        if (lesson.file_url) {
          try {
            const signed = await fileUrl(lesson.file_url);
            if (signed) {
              const resp = await fetch(signed);
              if (resp.ok) {
                const blob = await resp.blob();
                const rawName = lesson.file_url.split("/").pop() || `lesson-${lesson.position}`;
                const fileObj = new File([blob], rawName, { type: blob.type });
                const parsed = await parseTrainingDocument(fileObj);
                if (parsed.text.trim()) {
                  if (lessonText) lessonText += "\n\n";
                  lessonText += `[เนื้อหาจากไฟล์แนบ: ${parsed.filename} (${parsed.itemCountDesc || ""})]:\n${parsed.text.trim()}`;
                }
              }
            }
          } catch (fileErr) {
            console.warn(`Failed to parse file for lesson ${lesson.title}:`, fileErr);
          }
        }

        if (lessonText.trim()) {
          extractedSections.push(`=== บทที่ ${lesson.position}: ${lesson.title} ===\n${lessonText.trim()}`);
        } else {
          extractedSections.push(
            `=== บทที่ ${lesson.position}: ${lesson.title} ===\n(บทนี้เน้นหัวข้อ "${lesson.title}" รูปแบบ: ${lesson.kind})`
          );
        }
      }

      const combinedText = extractedSections.join("\n\n--------------------\n\n");
      if (combinedText.trim().length < 20) {
        toast.error("บทเรียนที่เลือกไม่มีเนื้อหาเพียงพอสำหรับการออกข้อสอบ กรุณาพิมพ์หรือแนบไฟล์เพิ่มเติม");
        return;
      }

      const safeText =
        combinedText.length > 28000
          ? combinedText.slice(0, 28000) + "\n...[เนื้อหาถูกตัดให้พอดีกับขีดจำกัด AI]"
          : combinedText;

      setAiContent(safeText);
      setDocMeta({
        filename: `บทเรียนในหลักสูตร (${targetLessons.length} บท)`,
        desc: `${safeText.length.toLocaleString()} ตัวอักษร จาก ${targetLessons.map((l) => `บทที่ ${l.position}`).join(", ")}`,
      });
      setShowLessonSelector(false);
      toast.success(
        `ดึงเนื้อหาจาก ${targetLessons.length} บทเรียน เรียบร้อย! (${safeText.length.toLocaleString()} ตัวอักษร)`
      );
    } catch (err) {
      toast.error(`เกิดข้อผิดพลาดในการดึงเนื้อหา: ${(err as Error).message}`);
    } finally {
      setExtractingFromLessons(false);
    }
  };

  const handleAiFileUpload = async (file: File) => {
    // 25MB safety limit
    if (file.size > 25 * 1024 * 1024) {
      toast.error("ไฟล์มีขนาดเกิน 25 MB กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 25 MB");
      return;
    }

    setParsingDoc(true);
    try {
      const res = await parseTrainingDocument(file);
      setAiContent(res.text);
      setDocMeta({
        filename: res.filename,
        desc: `${res.itemCountDesc || ""} (${res.charCount.toLocaleString()} ตัวอักษร)`,
      });
      toast.success(
        `อ่านไฟล์ "${res.filename}" สำเร็จ! ${res.itemCountDesc ? `[${res.itemCountDesc}]` : ""} (${res.charCount.toLocaleString()} ตัวอักษร)`
      );
    } catch (err) {
      toast.error(`อ่านไฟล์ไม่สำเร็จ: ${(err as Error).message}`);
    } finally {
      setParsingDoc(false);
    }
  };

  // 1. Download Template as Excel (.xlsx)
  const downloadExcelTemplate = async () => {
    const XLSX = await import("xlsx");
    const wsData = [TEMPLATE_HEADERS, ...SAMPLE_ROWS];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 14 }, // ลำดับ
      { wch: 55 }, // คำถาม
      { wch: 35 }, // ตัวเลือก ก
      { wch: 35 }, // ตัวเลือก ข
      { wch: 35 }, // ตัวเลือก ค
      { wch: 35 }, // ตัวเลือก ง
      { wch: 25 }, // ตัวเลือก จ
      { wch: 26 }, // คำตอบที่ถูกต้อง
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ข้อสอบ");
    XLSX.writeFile(wb, "overbrook-questions-template.xlsx");
    toast.success("ดาวน์โหลดไฟล์แม่แบบ Excel เรียบร้อย");
  };

  // Download Template as CSV (.csv) with UTF-8 BOM
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
    a.download = "overbrook-questions-template.csv";
    a.click();
    toast.success("ดาวน์โหลดไฟล์แม่แบบ CSV เรียบร้อย");
  };

  // Parse correct choice string to 0-indexed number
  const parseCorrectIndex = (raw: string, count: number): { index: number; error?: string } => {
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
  };

  // 2. Parse uploaded file (.xlsx, .xls, .csv)
  const handleFileUpload = async (file: File) => {
    try {
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
        toast.error("ไฟล์ไม่มีแถวข้อมูลข้อสอบ");
        return;
      }

      const parsed: ParsedQuestionRow[] = raw.map((r, idx) => {
        // Flexible key getter
        const getVal = (...keys: string[]) => {
          for (const k of keys) {
            for (const rk of Object.keys(r)) {
              if (rk.trim().toLowerCase().includes(k.toLowerCase())) {
                const val = r[rk];
                return val != null ? String(val).trim() : "";
              }
            }
          }
          return "";
        };

        const posRaw = getVal("ลำดับ", "ข้อที่", "position", "no");
        const position = Number(posRaw) > 0 ? Number(posRaw) : idx + 1;
        const question = getVal("คำถาม", "โจทย์", "question", "ข้อสอบ");

        // Collect choices
        const optA = getVal("ตัวเลือก ก", "ก", "choice a", "choice 1", "opt 1");
        const optB = getVal("ตัวเลือก ข", "ข", "choice b", "choice 2", "opt 2");
        const optC = getVal("ตัวเลือก ค", "ค", "choice c", "choice 3", "opt 3");
        const optD = getVal("ตัวเลือก ง", "ง", "choice d", "choice 4", "opt 4");
        const optE = getVal("ตัวเลือก จ", "จ", "choice e", "choice 5", "opt 5");

        const options = [optA, optB, optC, optD, optE].filter((o) => o.trim() !== "");
        const correctRaw = getVal("คำตอบที่ถูก", "คำตอบ", "เฉลย", "correct", "answer", "key");

        const errors: string[] = [];
        if (!question) errors.push("ไม่มีโจทย์คำถาม");
        if (options.length < 2) errors.push("ตัวเลือกต้องมีอย่างน้อย 2 ข้อ");
        if (!correctRaw) {
          errors.push("ไม่ได้ระบุคำตอบที่ถูกต้อง");
        }

        let correctIndex = 0;
        if (correctRaw && options.length >= 2) {
          const parsedCorrect = parseCorrectIndex(correctRaw, options.length);
          if (parsedCorrect.error) {
            errors.push(parsedCorrect.error);
          } else {
            correctIndex = parsedCorrect.index;
          }
        }

        return {
          line: idx + 2,
          position,
          question,
          options,
          correctIndex,
          correctRaw,
          errors,
          selected: true,
        };
      });

      setRows(parsed);
      const errCount = parsed.filter((p) => p.errors.length > 0).length;
      if (errCount > 0) {
        toast.warning(`ตรวจพบข้อสอบ ${parsed.length} ข้อ (มี ${errCount} ข้อที่ต้องแก้ไข)`);
      } else {
        toast.success(`พร้อมนำเข้าข้อสอบ ${parsed.length} ข้อ`);
      }
    } catch (err: unknown) {
      toast.error(`อ่านไฟล์ไม่สำเร็จ: ${(err as Error).message || "รูปแบบไฟล์ไม่ถูกต้อง"}`);
    }
  };

  // Row selection & removal handlers
  const toggleSelectRow = (index: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r))
    );
  };

  const toggleSelectAll = () => {
    const areAllSelected = rows.length > 0 && rows.every((r) => r.selected);
    setRows((prev) => prev.map((r) => ({ ...r, selected: !areAllSelected })));
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const selectedRows = rows.filter((r) => r.selected);
  const selectedValidRows = selectedRows.filter((r) => r.errors.length === 0);
  const selectedErrorRows = selectedRows.filter((r) => r.errors.length > 0);
  const allSelected = rows.length > 0 && rows.every((r) => r.selected);
  const isIndeterminate = rows.some((r) => r.selected) && !allSelected;

  // 3. Save to database
  const handleSave = async () => {
    if (!selectedRows.length) {
      toast.error("กรุณาเลือกข้อสอบอย่างน้อย 1 ข้อที่ต้องการนำเข้า");
      return;
    }
    if (selectedErrorRows.length > 0) {
      toast.error("มีข้อสอบที่เลือกติดข้อผิดพลาด กรุณายกเลิกการเลือกข้อที่ติด error หรือแก้ไขก่อนบันทึก");
      return;
    }

    setBusy(true);
    try {
      if (mode === "replace") {
        const { error: delErr } = await supabase
          .from("questions")
          .delete()
          .eq("course_id", courseId);
        if (delErr) throw delErr;
      }

      const startPos = mode === "append" ? existingCount : 0;
      const payload = selectedValidRows.map((r, i) => ({
        course_id: courseId,
        question: r.question,
        options: r.options,
        correct_index: r.correctIndex,
        position: startPos + i + 1,
      }));

      const { error: insErr } = await supabase.from("questions").insert(payload);
      if (insErr) throw insErr;

      toast.success(
        mode === "replace"
          ? `แทนที่ข้อสอบทั้งหมดด้วยชุดใหม่ที่เลือก ${selectedValidRows.length} ข้อเรียบร้อย`
          : `นำเข้าข้อสอบที่เลือก ${selectedValidRows.length} ข้อต่อท้ายเรียบร้อย`
      );
      setRows([]);
      setIsOpen(false);
      onDone();
    } catch (err: unknown) {
      toast.error(`บันทึกไม่สำเร็จ: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);
  const choiceLetters = ["ก", "ข", "ค", "ง", "จ"];

  return (
    <div className="glass rounded-3xl p-5 border border-primary/20 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileSpreadsheet className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-bold text-foreground">
              <span>นำเข้าข้อสอบผ่านไฟล์แม่แบบ (Excel / CSV)</span>
              <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[11px] font-semibold text-mint">
                แนะนำสำหรับชุดข้อสอบ
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              กรอกคำถาม ตัวเลือก ก-จ และคำตอบที่ถูก แล้วอัปโหลดเข้าสู่ระบบพร้อมกันทั้งชุด
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-xl border border-glass-border bg-card/60 px-3.5 py-2 text-xs font-semibold text-foreground transition-all hover:bg-card"
          >
            {isOpen ? (
              <>
                <span>ซ่อนแผงนำเข้า</span>
                <ChevronUp className="size-4" />
              </>
            ) : (
              <>
                <span>เปิดแผงนำเข้าข้อสอบ</span>
                <ChevronDown className="size-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-5 space-y-5 border-t border-glass-border pt-5">
          {/* Sub-tab Switcher: File Import vs AI Generator */}
          <div className="flex flex-wrap gap-2 border-b border-glass-border pb-3">
            <button
              type="button"
              onClick={() => setActiveImportTab("file")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeImportTab === "file"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "glass hover:bg-card text-foreground/70"
              }`}
            >
              <FileSpreadsheet className="size-4" />
              <span>นำเข้าจากไฟล์ Excel / CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveImportTab("ai")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeImportTab === "ai"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "glass hover:bg-card text-foreground/70"
              }`}
            >
              <Sparkles className="size-4 text-amber-400" />
              <span>ออกข้อสอบอัตโนมัติด้วย AI (AI Generator)</span>
              <span className="rounded-full bg-mint/20 px-2 py-0.5 text-[10px] font-bold text-mint">
                แนะนำ
              </span>
            </button>
          </div>

          {/* Tab 1: File Upload */}
          {activeImportTab === "file" && (
            <div className="space-y-4">
              {/* Section: Download templates */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/40 p-4">
                <div>
                  <div className="text-xs font-bold text-foreground">ดาวน์โหลดไฟล์แม่แบบมาตรฐาน</div>
                  <div className="text-[11px] text-muted-foreground">
                    มีหัวตารางพร้อมตัวอย่างข้อสอบ 4 ข้อ (ทั้งแบบ 4 ตัวเลือก และถูก/ผิด 2 ตัวเลือก)
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={downloadExcelTemplate}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                  >
                    <Download className="size-3.5" />
                    <span>แม่แบบ Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadCsvTemplate}
                    className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                  >
                    <Download className="size-3.5" />
                    <span>แม่แบบ CSV (.csv UTF-8)</span>
                  </button>
                </div>
              </div>

              {/* Section: Upload area */}
              <div className="relative rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center transition hover:border-primary/50">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                    e.target.value = "";
                  }}
                  className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
                  title="เลือกหรือลากไฟล์แม่แบบมาวางที่นี่"
                />
                <div className="pointer-events-none flex flex-col items-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                    <Upload className="size-6" />
                  </div>
                  <div className="mt-2 text-sm font-bold text-foreground">
                    คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    รองรับไฟล์นามสกุล <strong>.xlsx</strong>, <strong>.xls</strong> และ <strong>.csv</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: AI Quiz Generator */}
          {activeImportTab === "ai" && (
            <div className="glass space-y-4 rounded-3xl p-5 border border-primary/20 bg-primary/5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                    <Wand2 className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm">
                      สร้างข้อสอบมาตรฐานโรงพยาบาลด้วย AI จากเอกสารหรือสไลด์
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      วางเนื้อหาบทเรียน ข้อบังคับ หรือสไลด์บรรยาย AI จะสกัดเป็นข้อสอบปรนัย 4 ตัวเลือก พร้อมเฉลยอัตโนมัติ
                    </p>
                  </div>
                </div>
              </div>

              {/* Input Options Grid */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">หัวข้อเฉพาะ (ถ้ามี)</label>
                  <input
                    type="text"
                    placeholder="เช่น การใช้ถังดับเพลิง CO2 หรือ ขั้นตอน CPR"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    className="w-full rounded-xl border border-glass-border bg-card px-3 py-2 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">จำนวนข้อสอบที่ต้องการ</label>
                  <select
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="w-full rounded-xl border border-glass-border bg-card px-3 py-2 text-xs outline-none"
                  >
                    <option value={3}>3 ข้อ (สั้นกระชับ)</option>
                    <option value={5}>5 ข้อ (แนะนำ: เหมาะสำหรับ 1 บทเรียน)</option>
                    <option value={10}>10 ข้อ (ชุดทดสอบเต็มรูปแบบ)</option>
                    <option value={15}>15 ข้อ</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">รูปแบบและระดับความยาก</label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value as any)}
                    className="w-full rounded-xl border border-glass-border bg-card px-3 py-2 text-xs outline-none"
                  >
                    <option value="mixed">⚖️ ผสมผสาน (ทฤษฎี + จำลองสถานการณ์)</option>
                    <option value="scenario">🏥 สถานการณ์หน้างานจริง (Scenario-based)</option>
                    <option value="basic">📋 กฎระเบียบและมาตรฐาน (SOP / Standards)</option>
                  </select>
                </div>
              </div>

              {/* Textarea and Upload Option for training material */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span>เนื้อหาบทเรียน / สไลด์อบรม / คู่มือ SOP</span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      ({aiContent.length.toLocaleString()} ตัวอักษร)
                    </span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !showLessonSelector;
                        setShowLessonSelector(next);
                        if (next && selectedLessonIds.length === 0 && courseLessons.length > 0) {
                          setSelectedLessonIds(courseLessons.map((l) => l.id));
                        }
                      }}
                      className={`flex items-center gap-1.5 rounded-xl border border-primary/30 px-3 py-1.5 text-[11px] font-semibold transition cursor-pointer ${
                        showLessonSelector
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-primary/10 text-primary hover:bg-primary/20"
                      }`}
                      title="ดึงเนื้อหาจากบทเรียนที่มีอยู่ในหลักสูตรนี้"
                    >
                      <BookOpen className="size-3.5" />
                      <span>
                        ดึงจากบทเรียน {courseLessons.length > 0 ? `(${courseLessons.length} บท)` : ""}
                      </span>
                    </button>
                    <label
                      className={`flex items-center gap-1.5 cursor-pointer rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary transition hover:bg-primary/20 ${
                        parsingDoc ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      {parsingDoc ? (
                        <>
                          <RefreshCw className="size-3.5 animate-spin text-primary" />
                          <span>กำลังอ่านไฟล์...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="size-3.5" />
                          <span>แนบไฟล์ (.pdf, .pptx, .docx, .xlsx, .txt)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".docx,.pptx,.pdf,.txt,.md,.csv,.json,.xlsx,.xls"
                        disabled={parsingDoc}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleAiFileUpload(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {aiContent && (
                      <button
                        type="button"
                        onClick={() => {
                          setAiContent("");
                          setDocMeta(null);
                        }}
                        className="text-[11px] text-muted-foreground hover:text-destructive transition underline cursor-pointer"
                      >
                        ล้างข้อความ
                      </button>
                    )}
                  </div>
                </div>

                {/* Lesson Selector Panel */}
                {showLessonSelector && (
                  <div className="rounded-2xl border border-primary/30 bg-card/90 backdrop-blur p-3.5 space-y-3 shadow-md animate-in fade-in duration-200">
                    <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="size-4 text-primary" />
                        <span className="text-xs font-bold text-foreground">
                          เลือกบทเรียนที่ต้องการนำเนื้อหามาออกข้อสอบ
                        </span>
                        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          เลือก {selectedLessonIds.length}/{courseLessons.length} บท
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={selectAllLessons}
                          className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                        >
                          {selectedLessonIds.length === courseLessons.length ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLessonSelector(false)}
                          className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          ปิด
                        </button>
                      </div>
                    </div>

                    {courseLessons.length === 0 ? (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        ยังไม่มีบทเรียนในหลักสูตรนี้ กรุณาเพิ่มบทเรียนที่แท็บ "เนื้อหาบทเรียน" ก่อน หรือแนบไฟล์เอกสารด้านบน
                      </div>
                    ) : (
                      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                        {courseLessons.map((l) => {
                          const isSelected = selectedLessonIds.includes(l.id);
                          const hasContent = Boolean(l.body?.trim() || l.file_url);
                          return (
                            <label
                              key={l.id}
                              className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-xs transition cursor-pointer select-none ${
                                isSelected
                                  ? "border-primary/50 bg-primary/10"
                                  : "border-border/60 bg-card hover:bg-muted/40"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleLessonSelection(l.id)}
                                className="mt-0.5 size-4 rounded accent-primary cursor-pointer"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground truncate">
                                    บทที่ {l.position}: {l.title}
                                  </span>
                                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0 uppercase">
                                    {l.kind}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                                  {l.body?.trim() ? (
                                    <span className="text-mint flex items-center gap-1 font-medium">
                                      ✓ มีเนื้อหา ({l.body.trim().length.toLocaleString()} ตัวอักษร)
                                    </span>
                                  ) : (
                                    <span>ไม่มีข้อความสรุป</span>
                                  )}
                                  {l.file_url && (
                                    <span className="text-primary flex items-center gap-1 font-medium">
                                      📎 มีไฟล์แนบ ({l.file_url.split("/").pop()})
                                    </span>
                                  )}
                                  {!hasContent && (
                                    <span className="text-amber-500">
                                      ⚠️ ยังไม่มีเนื้อหาหรือไฟล์แนบ
                                    </span>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
                      <div className="text-[11px] text-muted-foreground">
                        AI จะเกลี่ยข้อสอบให้กระจายครอบคลุมทุกบทเรียนที่เลือกอย่างสมดุล
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowLessonSelector(false)}
                          className="rounded-xl border border-glass-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="button"
                          disabled={selectedLessonIds.length === 0 || extractingFromLessons}
                          onClick={handleExtractFromSelectedLessons}
                          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow hover:opacity-90 disabled:opacity-50 transition cursor-pointer"
                        >
                          {extractingFromLessons ? (
                            <>
                              <RefreshCw className="size-3.5 animate-spin" />
                              <span>กำลังอ่านเนื้อหา...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="size-3.5" />
                              <span>ดึงเนื้อหาเข้าสู่ AI ({selectedLessonIds.length} บท)</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {docMeta && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-mint/30 bg-mint/10 px-3 py-1.5 text-xs text-foreground">
                    <div className="flex items-center gap-2 truncate">
                      <FileCheck className="size-4 text-mint shrink-0" />
                      <span className="font-semibold truncate">{docMeta.filename}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {docMeta.desc}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAiContent("");
                        setDocMeta(null);
                      }}
                      className="text-[11px] text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                      title="ยกเลิกไฟล์นี้"
                    >
                      ลบออก
                    </button>
                  </div>
                )}

                <textarea
                  rows={6}
                  placeholder="พิมพ์ หรือวางข้อความ (Ctrl+V) หรือคลิกปุ่ม 'แนบไฟล์' ด้านบน (รองรับ PowerPoint .pptx, Word .docx, PDF .pdf, Excel, Text) เพื่อให้ AI สกัดเป็นข้อสอบ..."
                  value={aiContent}
                  onChange={(e) => setAiContent(e.target.value)}
                  className="w-full rounded-2xl border border-glass-border bg-card p-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary font-sans leading-relaxed"
                />

                <div className="rounded-xl border border-border/50 bg-card/40 p-2.5 text-[11px] text-muted-foreground leading-normal flex items-start gap-2">
                  <FileText className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">คำแนะนำ:</strong> รองรับการอัปโหลดไฟล์ตรงทั้ง <strong>PowerPoint (.pptx)</strong>, <strong>Word (.docx)</strong>, <strong>PDF (.pdf)</strong>, <strong>Excel (.xlsx)</strong> หรือ <strong>Text (.txt)</strong> ระบบจะสกัดเนื้อหาและระบุหมายเลขสไลด์/หน้าให้อัตโนมัติ เพื่อให้ AI วิเคราะห์ออกข้อสอบได้อย่างแม่นยำ
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  disabled={generatingAi || aiContent.trim().length < 20}
                  onClick={handleGenerateWithAi}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {generatingAi ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      <span>AI กำลังวิเคราะห์และสกัดข้อสอบ...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      <span>⚡ สกัดและสร้างข้อสอบด้วย AI ({aiCount} ข้อ)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Preview Table */}
          {rows.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-bold text-foreground">
                    ข้อมูลตัวอย่าง ({rows.length} ข้อ)
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <CheckSquare className="size-3.5" />
                    <span>เลือกนำเข้า: <strong>{selectedValidRows.length}</strong> / {rows.length} ข้อ</span>
                  </span>
                  {selectedErrorRows.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                      <AlertCircle className="size-3" />
                      ข้อที่เลือกติดข้อผิดพลาด {selectedErrorRows.length} ข้อ
                    </span>
                  )}
                </div>

                {/* Import Mode Switcher */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">โหมดนำเข้า:</span>
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1">
                    <input
                      type="radio"
                      name="q-import-mode"
                      checked={mode === "append"}
                      onChange={() => setMode("append")}
                      className="accent-primary"
                    />
                    <span>นำเข้าต่อท้าย (+{existingCount} เดิม)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1">
                    <input
                      type="radio"
                      name="q-import-mode"
                      checked={mode === "replace"}
                      onChange={() => setMode("replace")}
                      className="accent-destructive"
                    />
                    <span className="text-destructive font-medium">แทนที่ข้อสอบทั้งหมด</span>
                  </label>
                </div>
              </div>

              <div className="glass max-h-96 overflow-y-auto rounded-2xl border border-glass-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-mist/95 text-muted-foreground backdrop-blur-sm z-10 border-b border-glass-border">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = isIndeterminate;
                          }}
                          onChange={toggleSelectAll}
                          className="size-4 rounded accent-primary cursor-pointer"
                          title={allSelected ? "ยกเลิกการเลือกทั้งหมด" : "เลือกทั้งหมด"}
                        />
                      </th>
                      <th className="p-3 w-12 text-center">ข้อ</th>
                      <th className="p-3">คำถาม</th>
                      <th className="p-3">ตัวเลือกและเฉลย</th>
                      <th className="p-3 w-28 text-center">สถานะ</th>
                      <th className="p-3 w-14 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-glass-border">
                    {rows.map((r, i) => {
                      const isRowSelected = r.selected;
                      return (
                        <tr
                          key={i}
                          className={`transition-all ${
                            !isRowSelected
                              ? "opacity-50 bg-muted/15 hover:opacity-80"
                              : r.errors.length > 0
                              ? "bg-destructive/5 hover:bg-destructive/10"
                              : "hover:bg-primary/5"
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isRowSelected}
                              onChange={() => toggleSelectRow(i)}
                              className="size-4 rounded accent-primary cursor-pointer"
                              title={isRowSelected ? "คลิกเพื่อยกเลิกการนำเข้าข้อนี้" : "คลิกเพื่อเลือกนำเข้าข้อนี้"}
                            />
                          </td>
                          <td className="p-3 text-center font-bold text-muted-foreground">
                            {i + 1}
                          </td>
                          <td className="p-3 font-semibold text-foreground max-w-sm">
                            <div className={!isRowSelected ? "line-through text-muted-foreground" : ""}>
                              {r.question || <span className="text-destructive italic">(ไม่มีคำถาม)</span>}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              {r.options.map((opt, oi) => {
                                const isCorrect = oi === r.correctIndex;
                                return (
                                  <div
                                    key={oi}
                                    className={`flex items-center gap-1.5 text-[11px] ${
                                      !isRowSelected
                                        ? "text-muted-foreground"
                                        : isCorrect
                                        ? "font-bold text-mint"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    <span className="font-mono">{choiceLetters[oi]}.</span>
                                    <span>{opt}</span>
                                    {isCorrect && (
                                      <span className="rounded bg-mint/20 px-1 py-0.2 text-[9px] font-bold text-mint">
                                        ✓ เฉลย
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              {r.options.length === 0 && (
                                <span className="text-[11px] text-destructive italic">ไม่มีตัวเลือก</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {!isRowSelected ? (
                              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                ไม่เลือก
                              </span>
                            ) : r.errors.length === 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-mint/15 px-2 py-0.5 text-[11px] font-semibold text-mint">
                                <CheckCircle2 className="size-3" />
                                พร้อม
                              </span>
                            ) : (
                              <div className="space-y-0.5 text-[10px] text-destructive font-semibold">
                                {r.errors.map((err, ei) => (
                                  <div key={ei}>• {err}</div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeRow(i)}
                              className="size-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition cursor-pointer"
                              title="ลบข้อนี้ออกจากตารางตัวอย่าง"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRows([])}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-card cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  <span>ล้างตารางตัวอย่าง</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={busy || selectedValidRows.length === 0 || selectedErrorRows.length > 0}
                    className={btn}
                  >
                    <FileCheck className="mr-1.5 size-4" />
                    <span>
                      {busy
                        ? "กำลังบันทึก..."
                        : selectedValidRows.length === 0
                        ? "กรุณาเลือกข้อสอบอย่างน้อย 1 ข้อ"
                        : mode === "replace"
                        ? `แทนที่ด้วยข้อสอบที่เลือก (${selectedValidRows.length} ข้อ)`
                        : `บันทึกข้อสอบที่เลือก ${selectedValidRows.length} ข้อต่อท้าย`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
