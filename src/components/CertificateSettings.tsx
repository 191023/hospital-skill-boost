import { useEffect, useState } from "react";
import { ImagePlus, PenLine, RefreshCw, Save, Trash2, Users } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CertificateDesign } from "@/components/CertificateDesign";
import { supabase } from "@/integrations/supabase/client";
import { fileUrl } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

type Course = Database["public"]["Tables"]["courses"]["Row"];
type AssetField =
  | "hospital_logo_url"
  | "course_logo_url"
  | "instructor_signature_url"
  | "director_signature_url"
  | "certificate_background_url";
type PreviewUrls = Record<AssetField, string | null>;

const inputClass =
  "w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const assetConfig: Record<
  AssetField,
  { title: string; hint: string; folder: string; maxBytes: number; imageClass: string }
> = {
  hospital_logo_url: {
    title: "โลโก้โรงพยาบาล",
    hint: "แนะนำ PNG พื้นหลังโปร่งใส อย่างน้อย 400 × 400 px",
    folder: "hospital-logo",
    maxBytes: 2 * 1024 * 1024,
    imageClass: "object-contain",
  },
  course_logo_url: {
    title: "โลโก้หลักสูตร",
    hint: "แนะนำ PNG พื้นหลังโปร่งใส อย่างน้อย 400 × 400 px",
    folder: "course-logo",
    maxBytes: 2 * 1024 * 1024,
    imageClass: "object-contain",
  },
  certificate_background_url: {
    title: "ภาพพื้นหลังใบประกาศ",
    hint: "แนะนำ A4 แนวนอน 3508 × 2480 px และเว้นพื้นที่กลางสำหรับข้อความ",
    folder: "background",
    maxBytes: 5 * 1024 * 1024,
    imageClass: "object-cover",
  },
  instructor_signature_url: {
    title: "ลายเซ็นวิทยากร",
    hint: "แนะนำ PNG พื้นหลังโปร่งใส อย่างน้อย 800 × 300 px",
    folder: "signature",
    maxBytes: 2 * 1024 * 1024,
    imageClass: "object-contain",
  },
  director_signature_url: {
    title: "ลายเซ็นผู้อำนวยการ",
    hint: "ดึงจากตั้งค่าระบบอัตโนมัติ หรืออัปโหลด/เซ็นเฉพาะหลักสูตร",
    folder: "director-signature",
    maxBytes: 2 * 1024 * 1024,
    imageClass: "object-contain",
  },
};

function safeName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() || "png";
  return `${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

export function CertificateSettings({ course }: { course: Course }) {
  const [form, setForm] = useState({
    hospital_logo_url: course.hospital_logo_url || "system/hospital-logo.png",
    course_logo_url: course.course_logo_url,
    certificate_background_url:
      course.certificate_background_url || "system/certificate-background.png",
    organization_name: course.organization_name ?? "โรงพยาบาลโอเวอร์บรุ๊ค",
    department_subtitle: course.department_subtitle ?? "ศูนย์พัฒนาศักยภาพบุคลากร",
    show_instructor_signature: course.show_instructor_signature ?? Boolean(course.instructor_name),
    show_director_signature: course.show_director_signature ?? true,
    instructor_name: course.instructor_name ?? "",
    instructor_title: course.instructor_title ?? "",
    instructor_signature_url: course.instructor_signature_url,
    director_name: course.director_name ?? "นพ. กฤษณ์ วงศ์วิวัฒน์",
    director_title: course.director_title ?? "ผู้อำนวยการโรงพยาบาลโอเวอร์บรุ๊ค",
    director_signature_url: course.director_signature_url,
  });

  const [previews, setPreviews] = useState<PreviewUrls>({
    hospital_logo_url: null,
    course_logo_url: null,
    instructor_signature_url: null,
    director_signature_url: null,
    certificate_background_url: null,
  });
  const [uploading, setUploading] = useState<AssetField | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingField, setSigningField] = useState<
    "instructor_signature_url" | "director_signature_url" | null
  >(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fileUrl(form.hospital_logo_url),
      fileUrl(form.course_logo_url),
      fileUrl(form.instructor_signature_url),
      fileUrl(form.director_signature_url),
      fileUrl(form.certificate_background_url),
    ]).then(([hospital, courseLogo, signature, directorSig, background]) => {
      if (active) {
        setPreviews({
          hospital_logo_url: hospital,
          course_logo_url: courseLogo,
          instructor_signature_url: signature,
          director_signature_url: directorSig,
          certificate_background_url: background,
        });
      }
    });
    return () => {
      active = false;
    };
  }, [
    form.hospital_logo_url,
    form.course_logo_url,
    form.instructor_signature_url,
    form.director_signature_url,
    form.certificate_background_url,
  ]);

  async function uploadAsset(field: AssetField, file: File) {
    if (!allowedTypes.has(file.type)) {
      toast.error("รองรับเฉพาะไฟล์ PNG, JPG และ WebP");
      return;
    }
    const config = assetConfig[field];
    if (file.size > config.maxBytes) {
      toast.error(`ไฟล์ต้องมีขนาดไม่เกิน ${config.maxBytes / 1024 / 1024} MB`);
      return;
    }
    setUploading(field);
    try {
      const path = `${course.id}/certificate/${config.folder}/${safeName(file.name)}`;
      const { error } = await supabase.storage
        .from("course-files")
        .upload(path, file, { contentType: file.type, upsert: true });
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
    if (path && !path.startsWith("http") && !path.startsWith("system/") && !path.startsWith("data:")) {
      const { error } = await supabase.storage.from("course-files").remove([path]);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    setForm((current) => ({ ...current, [field]: null }));
    toast.success(`นำ${assetConfig[field].title}ออกแล้ว กดบันทึกเพื่อยืนยัน`);
  }

  async function resetToDefaultHospitalLogo() {
    let defaultLogo = "system/hospital-logo.png";
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "hospital_profile")
        .maybeSingle();
      if (data?.value && typeof data.value === "object" && (data.value as any).logo_url) {
        defaultLogo = (data.value as any).logo_url;
      }
    } catch {
      // fallback
    }
    setForm((current) => ({ ...current, hospital_logo_url: defaultLogo }));
    toast.success("ใช้โลโก้เริ่มต้นของโรงพยาบาลแล้ว กดบันทึกเพื่อยืนยัน");
  }

  async function resetToDefaultBackground() {
    let defaultBg = "system/certificate-background.png";
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "certificate_rules")
        .maybeSingle();
      if (data?.value && typeof data.value === "object" && (data.value as any).default_background_url) {
        defaultBg = (data.value as any).default_background_url;
      }
    } catch {
      // fallback
    }
    setForm((current) => ({ ...current, certificate_background_url: defaultBg }));
    toast.success("ใช้ภาพพื้นหลังเริ่มต้นของระบบแล้ว กดบันทึกเพื่อยืนยัน");
  }

  async function syncFromSystemDirector() {
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "certificate_rules")
        .maybeSingle();
      const cr = (data?.value ?? {}) as {
        director_name?: string;
        director_title?: string;
        director_signature_url?: string | null;
      };
      setForm((current) => ({
        ...current,
        director_name: cr.director_name || "นพ. กฤษณ์ วงศ์วิวัฒน์",
        director_title: cr.director_title || "ผู้อำนวยการโรงพยาบาลโอเวอร์บรุ๊ค",
        director_signature_url: cr.director_signature_url ?? null,
      }));
      toast.success("ซิงค์ชื่อ ตำแหน่ง และลายเซ็นผู้อำนวยการจากตั้งค่าระบบแล้ว กดบันทึกเพื่อยืนยัน");
    } catch {
      toast.error("ไม่สามารถดึงข้อมูลผู้อำนวยการได้");
    }
  }

  async function save() {
    if (!form.show_director_signature && !form.show_instructor_signature) {
      toast.error("กรุณาเลือกแสดงผู้ลงนามอย่างน้อย 1 ท่าน (วิทยากร หรือ ผู้อำนวยการ)");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("courses").update(form).eq("id", course.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("บันทึกการตั้งค่าใบประกาศแล้ว");
  }

  const brandFields: AssetField[] = [
    "hospital_logo_url",
    "course_logo_url",
    "certificate_background_url",
  ];

  const signerMode =
    form.show_instructor_signature && form.show_director_signature
      ? "both"
      : form.show_instructor_signature
      ? "instructor"
      : "director";

  function setSignerMode(mode: "director" | "both" | "instructor") {
    if (mode === "director") {
      setForm((prev) => ({
        ...prev,
        show_director_signature: true,
        show_instructor_signature: false,
      }));
    } else if (mode === "both") {
      setForm((prev) => ({
        ...prev,
        show_director_signature: true,
        show_instructor_signature: true,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        show_director_signature: false,
        show_instructor_signature: true,
      }));
    }
  }

  return (
    <div className="space-y-5">
      {/* Section 1: Logos, Background, and Organization Header */}
      <section className="glass rounded-3xl p-6 space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          {brandFields.map((field) => {
            const config = assetConfig[field];
            return (
              <div key={field} className="rounded-2xl border bg-card p-4">
                <div className="font-semibold">{config.title}</div>
                <div className="mt-3 flex h-28 items-center justify-center rounded-xl bg-mist p-3">
                  {previews[field] ? (
                    <img
                      src={previews[field] ?? ""}
                      alt={config.title}
                      className={`size-full ${config.imageClass}`}
                    />
                  ) : (
                    <ImagePlus className="size-8 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>
                <p className="mt-2 min-h-9 text-[11px] text-muted-foreground">
                  {config.hint}
                  <br />
                  PNG, JPG หรือ WebP ไม่เกิน {config.maxBytes / 1024 / 1024} MB
                </p>
                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <label>
                      <ImagePlus aria-hidden="true" />
                      {uploading === field
                        ? "กำลังอัปโหลด..."
                        : previews[field]
                        ? "เปลี่ยนไฟล์"
                        : "เลือกไฟล์"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        disabled={uploading !== null}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) uploadAsset(field, file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </Button>
                  {form[field] && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title={`ลบ${config.title}`}
                      aria-label={`ลบ${config.title}`}
                      onClick={() => removeAsset(field)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </div>
                {field === "hospital_logo_url" &&
                  form.hospital_logo_url !== "system/hospital-logo.png" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="mt-2 w-full text-xs text-primary"
                      onClick={resetToDefaultHospitalLogo}
                    >
                      ใช้โลโก้เริ่มต้นของโรงพยาบาล
                    </Button>
                  )}
                {field === "certificate_background_url" &&
                  form.certificate_background_url !== "system/certificate-background.png" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="mt-2 w-full text-xs text-primary"
                      onClick={resetToDefaultBackground}
                    >
                      ใช้ภาพพื้นหลังเริ่มต้นของระบบ
                    </Button>
                  )}
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              ชื่อโรงพยาบาล/องค์กร
            </span>
            <input
              className={inputClass}
              value={form.organization_name}
              onChange={(event) =>
                setForm({ ...form, organization_name: event.target.value })
              }
              placeholder="เช่น โรงพยาบาลโอเวอร์บรุ๊ค"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              ชื่อหน่วยงาน/ศูนย์ฝึกอบรม (ใต้ชื่อโรงพยาบาล)
            </span>
            <input
              className={inputClass}
              value={form.department_subtitle}
              onChange={(event) =>
                setForm({ ...form, department_subtitle: event.target.value })
              }
              placeholder="เช่น ศูนย์พัฒนาศักยภาพบุคลากร"
            />
          </label>
        </div>
      </section>

      {/* Section 2: Signer Option Mode + Dual Signer Cards */}
      <section className="glass rounded-3xl p-6 space-y-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-bold text-base text-foreground">
            <Users className="size-4 text-primary" />
            <span>ตัวเลือกรูปแบบผู้ลงนามบนใบประกาศนียบัตร</span>
          </div>
          <p className="text-xs text-muted-foreground">
            เลือกได้ว่าจะแสดงเฉพาะผู้อำนวยการโรงพยาบาล, แสดงคู่ทั้งวิทยากรและผู้อำนวยการ หรือแสดงเฉพาะวิทยากรประจำหลักสูตร
          </p>

          <div className="grid gap-3 pt-1 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setSignerMode("both")}
              className={`rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                signerMode === "both"
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-border bg-card hover:bg-card/80"
              }`}
            >
              <div className="text-xs font-bold text-foreground">
                👥 แสดงคู่ 2 ท่าน (วิทยากร + ผู้อำนวยการ)
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                ฝั่งซ้าย: วิทยากรประจำหลักสูตร · ฝั่งขวา: ผู้อำนวยการโรงพยาบาล
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSignerMode("director")}
              className={`rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                signerMode === "director"
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-border bg-card hover:bg-card/80"
              }`}
            >
              <div className="text-xs font-bold text-foreground">
                🏥 เฉพาะผู้อำนวยการโรงพยาบาล (1 ท่าน)
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                แสดงชื่อ ตำแหน่ง และลายเซ็นผู้อำนวยการกึ่งกลางใบประกาศ
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSignerMode("instructor")}
              className={`rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                signerMode === "instructor"
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-border bg-card hover:bg-card/80"
              }`}
            >
              <div className="text-xs font-bold text-foreground">
                🎓 เฉพาะวิทยากรประจำหลักสูตร (1 ท่าน)
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                แสดงเฉพาะชื่อ ตำแหน่ง และลายเซ็นวิทยากรกึ่งกลางใบประกาศ
              </div>
            </button>
          </div>
        </div>

        {/* Signer Cards Grid */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Card 1: Instructor Signer */}
          <div
            className={`rounded-2xl border p-4 space-y-3.5 transition ${
              form.show_instructor_signature
                ? "border-primary/30 bg-card"
                : "border-border/60 bg-card/40 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-foreground">
                  1. วิทยากรประจำหลักสูตร {signerMode === "both" ? "(แสดงฝั่งซ้าย)" : ""}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  สามารถใส่เฉพาะชื่อ-ตำแหน่ง หรือแนบลายเซ็นด้วยก็ได้
                </div>
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.show_instructor_signature}
                  onChange={(e) =>
                    setForm({ ...form, show_instructor_signature: e.target.checked })
                  }
                  className="size-4 accent-primary"
                />
                <span>แสดงบนใบประกาศ</span>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  ชื่อ-นามสกุล วิทยากร
                </span>
                <input
                  className={inputClass}
                  value={form.instructor_name}
                  onChange={(e) => setForm({ ...form, instructor_name: e.target.value })}
                  placeholder="เช่น นพ. สมชาย ใจดี"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  ตำแหน่งวิทยากร
                </span>
                <input
                  className={inputClass}
                  value={form.instructor_title}
                  onChange={(e) => setForm({ ...form, instructor_title: e.target.value })}
                  placeholder="เช่น วิทยากรประจำหลักสูตร"
                />
              </label>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                ลายเซ็นวิทยากร (ตัวเลือกเสริม — ไม่บังคับ)
              </div>
              <div className="flex h-24 items-center justify-center rounded-xl bg-mist p-3">
                {previews.instructor_signature_url ? (
                  <img
                    src={previews.instructor_signature_url}
                    alt="ลายเซ็นวิทยากร"
                    className="size-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    ยังไม่ได้แนบรูปลายเซ็น (แสดงเฉพาะชื่อ-ตำแหน่ง)
                  </span>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <label>
                    <ImagePlus aria-hidden="true" />
                    {uploading === "instructor_signature_url"
                      ? "กำลังอัปโหลด..."
                      : previews.instructor_signature_url
                      ? "เปลี่ยนไฟล์ลายเซ็น"
                      : "อัปโหลดลายเซ็น"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      disabled={uploading !== null}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadAsset("instructor_signature_url", file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={uploading !== null}
                  onClick={() =>
                    setSigningField(
                      signingField === "instructor_signature_url"
                        ? null
                        : "instructor_signature_url"
                    )
                  }
                >
                  <PenLine aria-hidden="true" />
                  เซ็นบนหน้าจอ
                </Button>
                {form.instructor_signature_url && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="ลบลายเซ็นวิทยากร"
                    onClick={() => removeAsset("instructor_signature_url")}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </div>
              {signingField === "instructor_signature_url" && (
                <SignaturePad
                  onCancel={() => setSigningField(null)}
                  onSave={async (file) => {
                    setSigningField(null);
                    await uploadAsset("instructor_signature_url", file);
                  }}
                />
              )}
            </div>
          </div>

          {/* Card 2: Hospital Director Signer */}
          <div
            className={`rounded-2xl border p-4 space-y-3.5 transition ${
              form.show_director_signature
                ? "border-primary/30 bg-card"
                : "border-border/60 bg-card/40 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-foreground">
                  2. ผู้อำนวยการโรงพยาบาล {signerMode === "both" ? "(แสดงฝั่งขวา)" : ""}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  ดึงค่าเริ่มต้นจากศูนย์ตั้งค่าระบบ หรือปรับเฉพาะหลักสูตรได้
                </div>
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.show_director_signature}
                  onChange={(e) =>
                    setForm({ ...form, show_director_signature: e.target.checked })
                  }
                  className="size-4 accent-primary"
                />
                <span>แสดงบนใบประกาศ</span>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  ชื่อ-นามสกุล ผู้อำนวยการ
                </span>
                <input
                  className={inputClass}
                  value={form.director_name}
                  onChange={(e) => setForm({ ...form, director_name: e.target.value })}
                  placeholder="เช่น นพ. กฤษณ์ วงศ์วิวัฒน์"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  ตำแหน่งผู้อำนวยการ
                </span>
                <input
                  className={inputClass}
                  value={form.director_title}
                  onChange={(e) => setForm({ ...form, director_title: e.target.value })}
                  placeholder="เช่น ผู้อำนวยการโรงพยาบาลโอเวอร์บรุ๊ค"
                />
              </label>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  ลายเซ็นผู้อำนวยการ (ตัวเลือกเสริม — ไม่บังคับ)
                </span>
                <button
                  type="button"
                  onClick={syncFromSystemDirector}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  <RefreshCw className="size-3" />
                  <span>ดึงข้อมูลและลายเซ็นจากตั้งค่าระบบ</span>
                </button>
              </div>
              <div className="flex h-24 items-center justify-center rounded-xl bg-mist p-3">
                {previews.director_signature_url ? (
                  <img
                    src={previews.director_signature_url}
                    alt="ลายเซ็นผู้อำนวยการ"
                    className="size-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    ยังไม่ได้แนบรูปลายเซ็น (แสดงเฉพาะชื่อ-ตำแหน่งผู้อำนวยการ)
                  </span>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <label>
                    <ImagePlus aria-hidden="true" />
                    {uploading === "director_signature_url"
                      ? "กำลังอัปโหลด..."
                      : previews.director_signature_url
                      ? "เปลี่ยนไฟล์ลายเซ็น"
                      : "อัปโหลดลายเซ็น"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      disabled={uploading !== null}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadAsset("director_signature_url", file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={uploading !== null}
                  onClick={() =>
                    setSigningField(
                      signingField === "director_signature_url"
                        ? null
                        : "director_signature_url"
                    )
                  }
                >
                  <PenLine aria-hidden="true" />
                  เซ็นบนหน้าจอ
                </Button>
                {form.director_signature_url && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="ลบลายเซ็นผู้อำนวยการ"
                    onClick={() => removeAsset("director_signature_url")}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </div>
              {signingField === "director_signature_url" && (
                <SignaturePad
                  onCancel={() => setSigningField(null)}
                  onSave={async (file) => {
                    setSigningField(null);
                    await uploadAsset("director_signature_url", file);
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={save} disabled={saving || uploading !== null}>
            <Save aria-hidden="true" />
            {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่าใบประกาศ"}
          </Button>
        </div>
      </section>

      {/* Section 3: Live Certificate Preview */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">ตัวอย่างใบประกาศ</h2>
          <span className="text-xs text-muted-foreground">ตัวอย่างย่อก่อนออกใบจริง</span>
        </div>
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
          organizationName={form.organization_name}
          departmentSubtitle={form.department_subtitle}
          signatureUrl={previews.instructor_signature_url}
          instructorName={form.instructor_name}
          instructorTitle={form.instructor_title}
          directorSignatureUrl={previews.director_signature_url}
          directorName={form.director_name}
          directorTitle={form.director_title}
          showInstructorSignature={form.show_instructor_signature}
          showDirectorSignature={form.show_director_signature}
          backgroundUrl={previews.certificate_background_url}
        />
      </section>
    </div>
  );
}
