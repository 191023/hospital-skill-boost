import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Trash2, ArrowUp, ArrowDown, ExternalLink, Loader2, Maximize2, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fileUrl } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inp } from "./shared";
import type { Database } from "@/integrations/supabase/types";

type ActivityPhoto = Database["public"]["Tables"]["course_activity_photos"]["Row"];
type Session = Database["public"]["Tables"]["course_sessions"]["Row"];

function safeName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() || "jpg";
  return `${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

export function PhotosEditor({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [activePhoto, setActivePhoto] = useState<{ url: string; caption: string } | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ["sessions", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("course_sessions").select("*").eq("course_id", courseId).order("round_no");
      return (data as Session[]) ?? [];
    },
  });

  const { data: photos = [], isLoading } = useQuery<ActivityPhoto[]>({
    queryKey: ["activity-photos", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_activity_photos")
        .select("*")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as ActivityPhoto[]) ?? [];
    },
  });

  useEffect(() => {
    let active = true;
    if (photos.length === 0) return;
    Promise.all(
      photos.map(async (p) => {
        const url = await fileUrl(p.photo_url);
        return [p.id, url ?? ""] as const;
      })
    ).then((entries) => {
      if (active) {
        setSignedUrls(Object.fromEntries(entries));
      }
    });
    return () => {
      active = false;
    };
  }, [photos]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["activity-photos", courseId] });
    qc.invalidateQueries({ queryKey: ["course-report", courseId] });
  };

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let successCount = 0;
    try {
      const currentMaxOrder = photos.length > 0 ? Math.max(...photos.map((p) => p.sort_order)) : -1;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
          toast.error(`ไฟล์ ${file.name} ไม่รองรับ (รองรับ PNG, JPG, WebP)`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`ไฟล์ ${file.name} มีขนาดเกิน 5 MB`);
          continue;
        }

        const path = `${courseId}/activity/${safeName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("course-files").upload(path, file, { contentType: file.type, upsert: true });
        if (uploadError) throw uploadError;

        const defaultCaption = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        const { error: insertError } = await supabase.from("course_activity_photos").insert({
          course_id: courseId,
          photo_url: path,
          caption: defaultCaption,
          sort_order: currentMaxOrder + 1 + i,
        });
        if (insertError) throw insertError;
        successCount++;
      }
      if (successCount > 0) {
        toast.success(`อัปโหลดรูปภาพกิจกรรมสำเร็จ ${successCount} รูป`);
        refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการอัปโหลด");
    } finally {
      setUploading(false);
    }
  }

  async function updateCaption(photoId: string, caption: string) {
    const { error } = await supabase.from("course_activity_photos").update({ caption }).eq("id", photoId);
    if (error) {
      toast.error(error.message);
    } else {
      qc.invalidateQueries({ queryKey: ["course-report", courseId] });
    }
  }

  async function updateSession(photoId: string, sessionId: string | null) {
    const { error } = await supabase
      .from("course_activity_photos")
      .update({ session_id: sessionId || null })
      .eq("id", photoId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("อัปเดตรอบกิจกรรมแล้ว");
      refresh();
    }
  }

  async function move(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= photos.length) return;
    const current = photos[index];
    const target = photos[targetIndex];
    if (!current || !target) return;
    await Promise.all([
      supabase.from("course_activity_photos").update({ sort_order: target.sort_order }).eq("id", current.id),
      supabase.from("course_activity_photos").update({ sort_order: current.sort_order }).eq("id", target.id),
    ]);
    refresh();
  }

  async function removePhoto(photo: ActivityPhoto) {
    if (!confirm("ต้องการลบรูปภาพกิจกรรมนี้หรือไม่?")) return;
    try {
      if (photo.photo_url && !photo.photo_url.startsWith("http")) {
        await supabase.storage.from("course-files").remove([photo.photo_url]);
      }
      const { error } = await supabase.from("course_activity_photos").delete().eq("id", photo.id);
      if (error) throw error;
      toast.success("ลบรูปภาพกิจกรรมแล้ว");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Header Box */}
      <div className="glass rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">รูปภาพกิจกรรมการอบรม</h2>
            <p className="text-xs text-muted-foreground">
              รูปภาพบรรยากาศการฝึกอบรม การปฏิบัติงานจริง และภาพหมู่ จะแสดงประกอบรายงานหลักสูตร (Report & PDF)
            </p>
          </div>
          <Button asChild size="sm" disabled={uploading}>
            <label className="cursor-pointer">
              {uploading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <ImagePlus className="mr-1.5 size-4" />}
              {uploading ? "กำลังอัปโหลด..." : "เพิ่มรูปภาพกิจกรรม"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  handleUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>
      </div>

      {/* Photos Grid */}
      {isLoading ? (
        <div className="glass flex min-h-40 items-center justify-center rounded-3xl p-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin text-primary" />
          กำลังโหลดรูปภาพกิจกรรม...
        </div>
      ) : photos.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <ImagePlus className="size-6" />
          </div>
          <p className="font-medium">ยังไม่มีรูปภาพกิจกรรม</p>
          <p className="mt-1 text-xs text-muted-foreground">
            กดปุ่ม "เพิ่มรูปภาพกิจกรรม" ด้านบนเพื่ออัปโหลดภาพกิจกรรมการอบรม สามารถเลือกหลายรูปพร้อมกันได้
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => {
            const url = signedUrls[photo.id];
            return (
              <div key={photo.id} className="glass group flex flex-col overflow-hidden rounded-2xl border bg-card transition hover:shadow-brand">
                {/* Image Container */}
                <div className="relative aspect-video w-full overflow-hidden bg-mist">
                  {url ? (
                    <img
                      src={url}
                      alt={photo.caption || "ภาพกิจกรรม"}
                      className="size-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                      <Loader2 className="mr-1 size-4 animate-spin" /> โหลดรูป...
                    </div>
                  )}

                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 gap-1.5 rounded-full text-xs"
                      onClick={() => url && setActivePhoto({ url, caption: photo.caption || "" })}
                    >
                      <Maximize2 className="size-3.5" />
                      ดูขนาดใหญ่
                    </Button>
                  </div>

                  {photo.session_id && (
                    <div className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-md">
                      รอบที่ {sessions.find((s) => s.id === photo.session_id)?.round_no ?? "?"}
                    </div>
                  )}
                </div>

                {/* Details & Controls */}
                <div className="flex flex-1 flex-col p-4">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">คำอธิบายภาพ</span>
                    <input
                      className={inp}
                      defaultValue={photo.caption || ""}
                      placeholder="เช่น ภาพการอบรมเชิงปฏิบัติการ"
                      onBlur={(e) => {
                        if (e.target.value !== (photo.caption || "")) {
                          updateCaption(photo.id, e.target.value);
                        }
                      }}
                    />
                  </label>

                  {sessions.length > 0 && (
                    <label className="mt-2 block">
                      <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">ผูกกับรอบอบรม</span>
                      <select
                        className={inp}
                        value={photo.session_id || ""}
                        onChange={(e) => updateSession(photo.id, e.target.value || null)}
                      >
                        <option value="">ทุกรอบ / ภาพรวม</option>
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            รอบที่ {s.round_no} ({s.location})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-glass-border pt-3">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        disabled={index === 0}
                        onClick={() => move(index, "up")}
                        title="ย้ายขึ้น"
                        aria-label="ย้ายขึ้น"
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        disabled={index === photos.length - 1}
                        onClick={() => move(index, "down")}
                        title="ย้ายลง"
                        aria-label="ย้ายลง"
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removePhoto(photo)}
                    >
                      <Trash2 className="mr-1 size-3.5" />
                      ลบรูป
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      <Dialog open={!!activePhoto} onOpenChange={() => setActivePhoto(null)}>
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-base font-semibold">
              {activePhoto?.caption || "ภาพกิจกรรมการอบรม"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <img
              src={activePhoto?.url}
              alt={activePhoto?.caption || ""}
              className="max-h-[75vh] w-full rounded-xl object-contain bg-black/5"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
