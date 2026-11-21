import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CertificateDesign } from "@/components/CertificateDesign";
import { Button } from "@/components/ui/button";
import obhLogoUrl from "@/assets/obh-logo.png?url";
import {
  CheckCircle2,
  Eraser,
  PenLine,
  ShieldCheck,
  Upload,
  Loader2,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/director-sign/$token")({
  head: () => ({
    meta: [
      { title: "ลงนามใบประกาศนียบัตร (สำหรับผู้บริหาร) — โรงพยาบาลโอเวอร์บรุ๊ค" },
      {
        name: "description",
        content: "ระบบลงนามอิเล็กทรอนิกส์ใบประกาศนียบัตรการฝึกอบรม สำหรับผู้อำนวยการโรงพยาบาลโอเวอร์บรุ๊ค",
      },
    ],
  }),
  component: DirectorSignPage,
});

type SignInfo = {
  valid: boolean;
  reason?: string;
  director_name?: string;
  director_title?: string;
  director_signature_url?: string | null;
  director_signed_at?: string | null;
  expires_at?: string | null;
  organization_name?: string;
  department_subtitle?: string;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์รูปได้"));
    reader.readAsDataURL(file);
  });
}

function DirectorSignPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<SignInfo | null>(null);
  const [directorName, setDirectorName] = useState("");
  const [directorTitle, setDirectorTitle] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    (supabase.rpc as any)("get_director_sign_info", { _token: token }).then(
      ({ data, error }: { data: SignInfo | null; error: any }) => {
        if (!active) return;
        setLoading(false);
        if (error || !data) {
          setInfo({ valid: false, reason: error?.message || "ไม่สามารถตรวจสอบลิงก์ได้" });
          return;
        }
        setInfo(data);
        if (data.valid) {
          setDirectorName(data.director_name || "นพ. กฤษณ์ วงศ์วิวัฒน์");
          setDirectorTitle(data.director_title || "ผู้อำนวยการโรงพยาบาลโอเวอร์บรุ๊ค");
          if (data.director_signature_url?.startsWith("data:") || data.director_signature_url?.startsWith("http")) {
            setSignatureDataUrl(data.director_signature_url);
          }
        }
      }
    );
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = 1200;
    c.height = 420;
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 6.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b2a5b";
  }, [loading, info?.valid]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 1200,
      y: ((e.clientY - r.top) / r.height) * 420,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function handlePointerUp() {
    if (!drawing.current) return;
    drawing.current = false;
    if (canvasRef.current) {
      setSignatureDataUrl(canvasRef.current.toDataURL("image/png"));
    }
  }

  function clearCanvas() {
    const c = canvasRef.current;
    if (c) {
      c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    }
    setSignatureDataUrl(null);
  }

  async function handleUploadFile(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("รองรับเฉพาะไฟล์ PNG, JPG หรือ WebP");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setSignatureDataUrl(dataUrl);
      toast.success("โหลดไฟล์ลายเซ็นแล้ว กรุณาตรวจสอบตัวอย่างด้านล่างแล้วกดยืนยัน");
    } catch (err: any) {
      toast.error(err.message || "อ่านไฟล์ไม่สำเร็จ");
    }
  }

  async function handleSubmit() {
    if (!signatureDataUrl) {
      toast.error("กรุณาเซ็นลายเซ็นในกรอบ หรืออัปโหลดไฟล์ลายเซ็นก่อนกดยืนยัน");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase.rpc as any)("submit_director_signature", {
        _token: token,
        _director_name: directorName.trim(),
        _director_title: directorTitle.trim(),
        _signature_data_url: signatureDataUrl,
      });
      if (error) throw error;
      setSavedSuccess(true);
      toast.success("บันทึกลายเซ็นผู้อำนวยการเรียบร้อยแล้ว");
    } catch (err: any) {
      toast.error(err.message || "บันทึกลายเซ็นไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-page p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>กำลังตรวจสอบลิงก์ลงนามสำหรับผู้บริหาร...</span>
        </div>
      </div>
    );
  }

  if (!info?.valid) {
    return (
      <div className="grid min-h-screen place-items-center bg-page p-4">
        <div className="glass w-full max-w-md rounded-3xl p-8 text-center space-y-4">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
            <AlertTriangle className="size-7" />
          </div>
          <h1 className="text-xl font-bold text-foreground">ไม่สามารถเปิดหน้าลงนามได้</h1>
          <p className="text-sm text-muted-foreground">
            {info?.reason || "ลิงก์ลงนามนี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อสร้างลิงก์ใหม่"}
          </p>
        </div>
      </div>
    );
  }

  if (savedSuccess) {
    return (
      <div className="grid min-h-screen place-items-center bg-page p-4">
        <div className="glass w-full max-w-xl rounded-3xl p-8 text-center space-y-5">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-mint/20 text-mint">
            <CheckCircle2 className="size-9" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">
              บันทึกลายเซ็นผู้อำนวยการเรียบร้อยแล้ว
            </h1>
            <p className="text-sm text-muted-foreground">
              ระบบได้นำลายเซ็นและข้อมูลของท่านไปใช้กับใบประกาศนียบัตรของหลักสูตรฝึกอบรมในระบบโดยอัตโนมัติแล้ว
            </p>
          </div>
          <div className="mx-auto max-w-xs rounded-2xl border bg-card p-4">
            <img
              src={signatureDataUrl!}
              alt="ลายเซ็นผู้อำนวยการ"
              className="mx-auto h-20 object-contain"
            />
            <div className="mt-2 text-sm font-bold text-foreground">({directorName})</div>
            <div className="text-xs text-muted-foreground">{directorTitle}</div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setSavedSuccess(false)}
            className="rounded-xl"
          >
            แก้ไขหรือเซ็นใหม่
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page py-6 px-4 sm:py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl p-6">
          <div className="flex items-center gap-3.5">
            <img
              src={obhLogoUrl}
              alt="โรงพยาบาลโอเวอร์บรุ๊ค"
              className="size-12 rounded-xl object-contain"
            />
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                <ShieldCheck className="size-3.5" />
                <span>ระบบลงนามอิเล็กทรอนิกส์สำหรับผู้บริหาร (Executive E-Signature)</span>
              </div>
              <h1 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
                ลงนามแม่แบบใบประกาศนียบัตรการฝึกอบรม
              </h1>
              <p className="text-xs text-muted-foreground">
                {info.organization_name || "โรงพยาบาลโอเวอร์บรุ๊ค"} ·{" "}
                {info.department_subtitle || "ศูนย์พัฒนาศักยภาพบุคลากร"}
              </p>
            </div>
          </div>
        </div>

        {/* Step 1: Signer Name & Title + Signature Canvas */}
        <div className="glass space-y-5 rounded-3xl p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                ชื่อ-นามสกุล ผู้อำนวยการ (แสดงใต้ลายเซ็น)
              </span>
              <input
                className="w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary"
                value={directorName}
                onChange={(e) => setDirectorName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                ตำแหน่งบริหาร
              </span>
              <input
                className="w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary"
                value={directorTitle}
                onChange={(e) => setDirectorTitle(e.target.value)}
              />
            </label>
          </div>

          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <PenLine className="size-4 text-primary" />
                <span>ลงลายมือชื่อในกรอบด้านล่าง (รองรับปากกา iPad / นิ้วสัมผัส / เมาส์)</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleUploadFile(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl text-xs"
                >
                  <Upload className="mr-1.5 size-3.5" />
                  อัปโหลดไฟล์ลายเซ็นแทน
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={clearCanvas}
                  className="rounded-xl text-xs text-muted-foreground hover:text-destructive"
                >
                  <Eraser className="mr-1.5 size-3.5" />
                  ล้างกระดานเซ็นใหม่
                </Button>
              </div>
            </div>

            <div className="relative">
              <canvas
                ref={canvasRef}
                aria-label="กระดานเซ็นลายเซ็นผู้อำนวยการ"
                className="aspect-[12/4.2] w-full touch-none rounded-2xl border-2 border-dashed border-primary/40 bg-white shadow-inner cursor-crosshair"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
              {!signatureDataUrl && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/50">
                  <PenLine className="size-7 mb-1" />
                  <span className="text-xs font-medium">ใช้นิ้ว ปากกา Stylus หรือเมาส์ลากเซ็นในกรอบสีขาวนี้</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              เมื่อกดยืนยัน ระบบจะนำลายเซ็นนี้ไปประทับบนใบประกาศนียบัตรของหลักสูตรอบรมในโรงพยาบาลโดยอัตโนมัติ
            </p>
            <Button
              type="button"
              disabled={saving || !signatureDataUrl}
              onClick={handleSubmit}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  กำลังบันทึกลายเซ็น...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 size-4" />
                  ยืนยันและบันทึกลายเซ็นผู้อำนวยการ
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Step 2: Live Certificate Preview */}
        <div className="glass space-y-3 rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-foreground">
              ตัวอย่างการแสดงผลลายเซ็นบนใบประกาศนียบัตรจริง
            </div>
            <span className="text-xs text-muted-foreground">พรีวิวสด (Live Preview)</span>
          </div>
          <div className="mx-auto max-w-3xl">
            <CertificateDesign
              recipientName="นางสาวสุพินดา อภิเดชกุล"
              recipientDetail="พยาบาลวิชาชีพ · แผนกผู้ป่วยนอก · ฝ่ายการพยาบาล"
              courseTitle="การดับเพลิงขั้นต้นและการใช้ถังดับเพลิง"
              trainingYear={2026}
              hours={3}
              score={95}
              certificateNumber="CERT-20261114-SAMPLE"
              issuedDate="14 พฤศจิกายน 2569"
              hospitalLogoUrl={obhLogoUrl}
              organizationName={info.organization_name || "โรงพยาบาลโอเวอร์บรุ๊ค"}
              departmentSubtitle={info.department_subtitle || "ศูนย์พัฒนาศักยภาพบุคลากร"}
              signatureUrl={signatureDataUrl}
              instructorName={directorName}
              instructorTitle={directorTitle}
              verifyUrl={typeof window !== "undefined" ? `${window.location.origin}/verify/CERT-20261114-SAMPLE` : undefined}
              preview
            />
          </div>
        </div>
      </div>
    </div>
  );
}
