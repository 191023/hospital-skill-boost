import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText,
  UploadCloud,
  Trash2,
  ExternalLink,
  Loader2,
  DollarSign,
  Lock,
  Globe,
  FileCheck,
  Receipt,
  BookOpen,
  Paperclip,
  FolderOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fileUrl } from "@/lib/auth";
import { btn, inp } from "./shared";
import type { Database } from "@/integrations/supabase/types";

type CourseDocument = Database["public"]["Tables"]["course_documents"]["Row"];

export type DocCategory = "approval" | "expense" | "handout" | "general";

export const CATEGORIES: Record<
  DocCategory,
  { label: string; icon: typeof FileText; color: string }
> = {
  approval: {
    label: "เอกสารขออนุมัติโครงการ",
    icon: FileCheck,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  expense: {
    label: "ใบเสร็จ / ค่าใช้จ่าย",
    icon: Receipt,
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  handout: {
    label: "เอกสารประกอบการเรียน",
    icon: BookOpen,
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  general: {
    label: "เอกสารทั่วไป",
    icon: Paperclip,
    color: "bg-muted text-foreground border-border",
  },
};

const DEFAULT_CAT = CATEGORIES.general;

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return "-";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function DocumentsEditor({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");

  // Form states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("approval");
  const [amount, setAmount] = useState<string>("");
  const [visibility, setVisibility] = useState<string>("staff_only");

  const { data: docs = [], isLoading } = useQuery<CourseDocument[]>({
    queryKey: ["course-documents", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_documents")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as CourseDocument[]) ?? [];
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (!title.trim()) {
      // Auto-populate title with cleaned filename (strip extension)
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setTitle(nameWithoutExt);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("กรุณาเลือกไฟล์เอกสาร");
      return;
    }
    if (!title.trim()) {
      toast.error("กรุณาระบุชื่อเอกสาร");
      return;
    }

    setUploading(true);
    try {
      const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "bin";
      const cleanName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const storagePath = `${courseId}/docs/${cleanName}`;

      // 1. Upload to Supabase storage
      const uploadOpts = selectedFile.type
        ? { contentType: selectedFile.type, upsert: true }
        : { upsert: true };
      const { error: uploadError } = await supabase.storage
        .from("course-files")
        .upload(storagePath, selectedFile, uploadOpts);

      if (uploadError) throw uploadError;

      // 2. Insert record in course_documents
      const parsedAmount =
        category === "expense" && amount ? parseFloat(amount) : null;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: insertError } = await supabase
        .from("course_documents")
        .insert({
          course_id: courseId,
          category,
          title: title.trim(),
          file_url: storagePath,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          file_type: selectedFile.type || ext,
          amount: parsedAmount,
          visibility,
          created_by: user?.id ?? null,
        });

      if (insertError) throw insertError;

      toast.success("อัปโหลดเอกสารสำเร็จ");
      // Reset form
      setSelectedFile(null);
      setTitle("");
      setAmount("");
      setVisibility("staff_only");
      setCategory("approval");
      // Reset input element
      const fileInput = document.getElementById(
        "doc-file-input"
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      qc.invalidateQueries({ queryKey: ["course-documents", courseId] });
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการอัปโหลด");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: CourseDocument) => {
    if (!confirm(`ต้องการลบเอกสาร "${doc.title}" หรือไม่?`)) return;

    try {
      // 1. Delete from storage
      await supabase.storage.from("course-files").remove([doc.file_url]);

      // 2. Delete row
      const { error } = await supabase
        .from("course_documents")
        .delete()
        .eq("id", doc.id);

      if (error) throw error;

      toast.success("ลบเอกสารแล้ว");
      qc.invalidateQueries({ queryKey: ["course-documents", courseId] });
    } catch (err: any) {
      toast.error(err.message || "ลบเอกสารไม่สำเร็จ");
    }
  };

  const handleOpenDoc = async (doc: CourseDocument) => {
    try {
      const url = await fileUrl(doc.file_url);
      if (url) {
        window.open(url, "_blank");
      } else {
        toast.error("ไม่สามารถสร้างลิงก์ดาวน์โหลดได้");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเปิดไฟล์");
    }
  };

  // Calculations
  const filteredDocs =
    filterCat === "all"
      ? docs
      : docs.filter((d) => d.category === filterCat);

  const totalExpense = docs
    .filter((d) => d.category === "expense" && d.amount)
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Upload Box */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <UploadCloud className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">แนบไฟล์เอกสารใหม่</h2>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                เลือกไฟล์เอกสาร (PDF, Word, Excel, รูปภาพใบเสร็จ ฯลฯ) *
              </label>
              <input
                id="doc-file-input"
                type="file"
                className={inp}
                onChange={handleFileChange}
                required
              />
              {selectedFile && (
                <p className="mt-1 text-xs text-muted-foreground">
                  ขนาดไฟล์: {formatBytes(selectedFile.size)}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                ชื่อเอกสาร / รายละเอียดกำกับ *
              </label>
              <input
                type="text"
                placeholder="เช่น หนังสืออนุมัติจัดอบรม, ใบเสร็จค่าอาหารว่าง"
                className={inp}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                หมวดหมู่เอกสาร
              </label>
              <select
                className={inp}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {Object.entries(CATEGORIES).map(([catKey, info]) => (
                  <option key={catKey} value={catKey}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>

            {category === "expense" ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  จำนวนเงิน (บาท)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={`${inp} pl-8`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  สิทธิ์การเข้าถึง
                </label>
                <select
                  className={inp}
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                >
                  <option value="staff_only">
                    🔒 เฉพาะเจ้าหน้าที่ / ผู้ควบคุม
                  </option>
                  <option value="public">🌐 ผู้เรียนดาวน์โหลดได้</option>
                </select>
              </div>
            )}

            {category === "expense" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  สิทธิ์การเข้าถึง
                </label>
                <select
                  className={inp}
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                >
                  <option value="staff_only">
                    🔒 เฉพาะเจ้าหน้าที่ / ผู้ควบคุม
                  </option>
                  <option value="public">🌐 ผู้เรียนดาวน์โหลดได้</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className={`${btn} flex items-center gap-2`}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังอัปโหลด...
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  บันทึกและอัปโหลดเอกสาร
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Summary Stats & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Categories Filter Tabs */}
        <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-muted/60 p-1 text-xs">
          <button
            onClick={() => setFilterCat("all")}
            className={`rounded-xl px-3 py-1.5 font-medium transition-colors ${
              filterCat === "all"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ทั้งหมด ({docs.length})
          </button>
          {Object.entries(CATEGORIES).map(([catKey, info]) => {
            const count = docs.filter((d) => d.category === catKey).length;
            return (
              <button
                key={catKey}
                onClick={() => setFilterCat(catKey)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium transition-colors ${
                  filterCat === catKey
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{info.label}</span>
                <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Expense Summary badge if expenses exist */}
        {totalExpense > 0 && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
            <Receipt className="h-4 w-4" />
            <span>ยอดรวมค่าใช้จ่าย/ใบเสร็จ:</span>
            <span className="font-bold">
              {totalExpense.toLocaleString("th-TH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              บาท
            </span>
          </div>
        )}
      </div>

      {/* Document Items List */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
          กำลังโหลดรายการเอกสาร...
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="glass rounded-3xl py-12 text-center text-muted-foreground">
          <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="font-medium">ยังไม่มีเอกสารแนบในหมวดนี้</p>
          <p className="text-xs text-muted-foreground/80 mt-1">
            สามารถเลือกไฟล์และกดอัปโหลดจากฟอร์มด้านบน
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredDocs.map((doc) => {
            const catInfo = CATEGORIES[doc.category as DocCategory] ?? DEFAULT_CAT;
            const CatIcon = catInfo.icon;
            const isPublic = doc.visibility === "public";

            return (
              <div
                key={doc.id}
                className="glass group flex flex-col justify-between gap-4 rounded-2xl p-4 transition-all sm:flex-row sm:items-center hover:border-primary/40"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary mt-0.5">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground truncate">
                        {doc.title}
                      </span>
                      {/* Category Badge */}
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium ${catInfo.color}`}
                      >
                        <CatIcon className="h-3 w-3" />
                        {catInfo.label}
                      </span>
                      {/* Visibility Badge */}
                      {isPublic ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <Globe className="h-3 w-3" />
                          ผู้เรียนเข้าถึงได้
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          เฉพาะเจ้าหน้าที่
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="truncate max-w-[240px] text-foreground/70">
                        {doc.file_name}
                      </span>
                      <span>•</span>
                      <span>{formatBytes(doc.file_size)}</span>
                      <span>•</span>
                      <span>
                        {new Date(doc.created_at).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {doc.amount != null && (
                        <>
                          <span>•</span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            ยอดเงิน:{" "}
                            {Number(doc.amount).toLocaleString("th-TH", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            ฿
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleOpenDoc(doc)}
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                    title="เปิดดู / ดาวน์โหลดเอกสาร"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    เปิดดูไฟล์
                  </button>

                  <button
                    onClick={() => handleDelete(doc)}
                    className="flex items-center justify-center rounded-xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="ลบเอกสารนี้"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
