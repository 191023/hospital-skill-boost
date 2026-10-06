import { useEffect, useState } from "react";
import { ImagePlus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CertificateDesign } from "@/components/CertificateDesign";
import { supabase } from "@/integrations/supabase/client";
import { fileUrl } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

type Course = Database["public"]["Tables"]["courses"]["Row"];
type AssetField = "hospital_logo_url" | "course_logo_url" | "instructor_signature_url" | "certificate_background_url";
type PreviewUrls = Record<AssetField, string | null>;

const inputClass = "w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const assetConfig: Record<AssetField, { title: string; hint: string; folder: string; maxBytes: number; imageClass: string }> = {
  hospital_logo_url: { title: "โลโก้โรงพยาบาล", hint: "แนะนำ PNG พื้นหลังโปร่งใส อย่างน้อย 400 × 400 px", folder: "hospital-logo", maxBytes: 2 * 1024 * 1024, imageClass: "object-contain" },
  course_logo_url: { title: "โลโก้หลักสูตร", hint: "แนะนำ PNG พื้นหลังโปร่งใส อย่างน้อย 400 × 400 px", folder: "course-logo", maxBytes: 2 * 1024 * 1024, imageClass: "object-contain" },
  instructor_signature_url: { title: "ลายเซ็นวิทยากร", hint: "แนะนำ PNG พื้นหลังโปร่งใส อย่างน้อย 800 × 300 px", folder: "signature", maxBytes: 2 * 1024 * 1024, imageClass: "object-contain" },
  certificate_background_url: { title: "ภาพพื้นหลังใบประกาศ", hint: "แนะนำ A4 แนวนอน 3508 × 2480 px และเว้นพื้นที่กลางสำหรับข้อความ", folder: "background", maxBytes: 5 * 1024 * 1024, imageClass: "object-cover" },
};

function safeName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() || "png";
  return `${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

export function CertificateSettings({ course }: { course: Course }) {
  const [form, setForm] = useState({
    hospital_logo_url: course.hospital_logo_url,
    course_logo_url: course.course_logo_url,
    instructor_signature_url: course.instructor_signature_url,
    certificate_background_url: course.certificate_background_url,
    instructor_name: course.instructor_name ?? "",
    instructor_title: course.instructor_title ?? "",
  });
  const [previews, setPreviews] = useState<PreviewUrls>({ hospital_logo_url: null, course_logo_url: null, instructor_signature_url: null, certificate_background_url: null });
  const [uploading, setUploading] = useState<AssetField | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fileUrl(form.hospital_logo_url),
      fileUrl(form.course_logo_url),
      fileUrl(form.instructor_signature_url),
      fileUrl(form.certificate_background_url),
    ]).then(([hospital, courseLogo, signature, background]) => {
      if (active) setPreviews({ hospital_logo_url: hospital, course_logo_url: courseLogo, instructor_signature_url: signature, certificate_background_url: background });
    });
    return () => { active = false; };
  }, [form.hospital_logo_url, form.course_logo_url, form.instructor_signature_url, form.certificate_background_url]);

  async function uploadAsset(field: AssetField, file: File) {
    if (!allowedTypes.has(file.type)) { toast.error("รองรับเฉพาะไฟล์ PNG, JPG และ WebP"); return; }
    const config = assetConfig[field];
    if (file.size > config.maxBytes) { toast.error(`ไฟล์ต้องมีขนาดไม่เกิน ${config.maxBytes / 1024 / 1024} MB`); return; }
    setUploading(field);
    try {
      const path = `${course.id}/certificate/${config.folder}/${safeName(file.name)}`;
      const { error } = await supabase.storage.from("course-files").upload(path, file, { contentType: file.type });
      if (error) throw error;
      setForm((current) => ({ ...current, [field]: path }));
      toast.success(`อัปโหลด${config.title}แล้ว กดบันทึกเพื่อยืนยัน`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(null);
    }
  }

  async function removeAsset(field: AssetField) {
    const path = form[field];
    if (path && !path.startsWith("http")) {
      const { error } = await supabase.storage.from("course-files").remove([path]);
      if (error) { toast.error(error.message); return; }
    }
    setForm((current) => ({ ...current, [field]: null }));
    toast.success(`นำ${assetConfig[field].title}ออกแล้ว กดบันทึกเพื่อยืนยัน`);
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("courses").update(form).eq("id", course.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกการตั้งค่าใบประกาศแล้ว");
  }

  return (
    <div className="space-y-5">
      <section className="glass rounded-3xl p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(assetConfig) as AssetField[]).map((field) => {
            const config = assetConfig[field];
            return (
              <div key={field} className="rounded-2xl border bg-card p-4">
                <div className="font-semibold">{config.title}</div>
                <div className="mt-3 flex h-28 items-center justify-center rounded-xl bg-mist p-3">
                  {previews[field] ? <img src={previews[field] ?? ""} alt={config.title} className={`size-full ${config.imageClass}`} /> : <ImagePlus className="size-8 text-muted-foreground" aria-hidden="true" />}
                </div>
                <p className="mt-2 min-h-9 text-[11px] text-muted-foreground">{config.hint}<br />PNG, JPG หรือ WebP ไม่เกิน {config.maxBytes / 1024 / 1024} MB</p>
                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <label>
                      <ImagePlus aria-hidden="true" />{uploading === field ? "กำลังอัปโหลด..." : previews[field] ? "เปลี่ยนไฟล์" : "เลือกไฟล์"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading !== null} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadAsset(field, file); event.target.value = ""; }} />
                    </label>
                  </Button>
                  {form[field] && <Button type="button" size="icon" variant="ghost" title={`ลบ${config.title}`} aria-label={`ลบ${config.title}`} onClick={() => removeAsset(field)}><Trash2 aria-hidden="true" /></Button>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">ชื่อวิทยากร/ผู้ลงนาม</span><input className={inputClass} value={form.instructor_name} onChange={(event) => setForm({ ...form, instructor_name: event.target.value })} placeholder="เช่น นพ. สมชาย ใจดี" /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">ตำแหน่ง/บทบาท</span><input className={inputClass} value={form.instructor_title} onChange={(event) => setForm({ ...form, instructor_title: event.target.value })} placeholder="เช่น วิทยากรประจำหลักสูตร" /></label>
        </div>
        <div className="mt-5 flex justify-end"><Button type="button" onClick={save} disabled={saving || uploading !== null}><Save aria-hidden="true" />{saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}</Button></div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">ตัวอย่างใบประกาศ</h2><span className="text-xs text-muted-foreground">ตัวอย่างย่อก่อนออกใบจริง</span></div>
        <CertificateDesign
          preview
          recipientName="ชื่อผู้ผ่านการอบรม"
          recipientDetail="ตำแหน่ง · แผนก · ฝ่าย"
          courseTitle={course.title}
          trainingYear={course.training_year}
          hours={course.hours}
          score={course.pass_score}
          certificateNumber="CERT-ตัวอย่าง"
          issuedDate="วันที่ออกใบประกาศ"
          hospitalLogoUrl={previews.hospital_logo_url}
          courseLogoUrl={previews.course_logo_url}
          signatureUrl={previews.instructor_signature_url}
          instructorName={form.instructor_name}
          instructorTitle={form.instructor_title}
          backgroundUrl={previews.certificate_background_url}
        />
      </section>
    </div>
  );
}