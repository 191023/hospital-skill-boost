import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { thaiDate } from "@/lib/data";
import { origin } from "@/components/QR";
import { CertificateDesign } from "@/components/CertificateDesign";
import { fileUrl } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { HolographicSeal3D } from "@/components/HolographicSeal3D";
import { CelebrationConfetti, CelebrationHandle } from "@/components/CelebrationConfetti";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Printer, Copy, PartyPopper, ShieldCheck, Download, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/certificates/$certId")({
  head: () => ({
    meta: [
      { title: "ใบประกาศนียบัตร — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { name: "description", content: "ใบประกาศนียบัตรการฝึกอบรมสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:title", content: "ใบประกาศนียบัตร — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:description", content: "ใบประกาศนียบัตรการฝึกอบรมสำหรับบุคลากรโรงพยาบาล" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CertView,
});

function CertView() {
  const { certId } = Route.useParams();
  const confettiRef = useRef<CelebrationHandle>(null);
  const [generating, setGenerating] = useState(false);

  const { data } = useQuery({
    queryKey: ["cert", certId],
    queryFn: async () => {
      const { data: c } = await supabase
        .from("certificates")
        .select(
          "*, courses(title,hours,training_year,hospital_logo_url,course_logo_url,instructor_signature_url,instructor_name,instructor_title,certificate_background_url,organization_name,department_subtitle)"
        )
        .eq("id", certId)
        .maybeSingle();
      if (!c) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name,division,department,position")
        .eq("id", c.user_id)
        .maybeSingle();
      const [hospitalLogoUrl, courseLogoUrl, signatureUrl, backgroundUrl] = await Promise.all([
        fileUrl(c.courses?.hospital_logo_url),
        fileUrl(c.courses?.course_logo_url),
        fileUrl(c.courses?.instructor_signature_url),
        fileUrl(c.courses?.certificate_background_url),
      ]);
      return { c, p, hospitalLogoUrl, courseLogoUrl, signatureUrl, backgroundUrl };
    },
  });

  const handleCopyVerify = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("คัดลอกลิงก์ตรวจสอบใบประกาศแล้ว");
  };

  const downloadPDF = async () => {
    const certElement = document.querySelector(".certificate-sheet") as HTMLElement;
    if (!certElement || !data) {
      toast.error("ไม่พบคอมโพเนนต์ใบประกาศ");
      return;
    }

    setGenerating(true);
    const toastId = toast.loading("กำลังประมวลผลสร้างไฟล์ PDF ใบประกาศ...");

    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");

      // html-to-image uses native SVG foreignObject which natively supports modern CSS oklch() colors
      const imgData = await toPng(certElement, {
        pixelRatio: 2.5,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });

      // Create landscape A4 PDF: 297mm x 210mm
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      pdf.addImage(imgData, "PNG", 0, 0, 297, 210, undefined, "FAST");

      const safeCertNo = data.c.cert_no.replace(/[^\w.-]/g, "_");
      const fileName = `ใบประกาศนียบัตร-${safeCertNo}.pdf`;
      pdf.save(fileName);

      toast.success("ดาวน์โหลดไฟล์ใบประกาศนียบัตร (PDF) สำเร็จ", { id: toastId });
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      toast.error("สร้าง PDF ไม่สำเร็จ: " + (err.message || "เกิดข้อผิดพลาด"), { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    // Inject @page CSS dynamically so browser forces A4 landscape without margins
    const style = document.createElement("style");
    style.id = "cert-landscape-print-style";
    style.innerHTML = "@page { size: 297mm 210mm; margin: 0; }";
    document.head.appendChild(style);

    const cleanup = () => {
      style.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);

    window.print();
  };

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-3 animate-ping rounded-full bg-primary" />
          กำลังโหลดใบประกาศนียบัตร...
        </div>
      </div>
    );
  }

  const { c, p, hospitalLogoUrl, courseLogoUrl, signatureUrl, backgroundUrl } = data;
  const verifyUrl = `${origin()}/verify/${c.cert_no}`;

  return (
    <div className="mx-auto max-w-5xl pb-16">
      {/* Celebration Confetti & Ribbon Particle System */}
      <CelebrationConfetti ref={confettiRef} autoTrigger={true} />

      {/* Top Navigation & Action Controls */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/certificates"
          className="inline-flex items-center text-sm font-medium text-primary hover:underline"
        >
          ← ใบประกาศทั้งหมด
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => confettiRef.current?.burst()}
            className="border-amber/40 bg-amber/10 text-amber-900 hover:bg-amber/20 dark:text-amber-200"
          >
            <PartyPopper className="mr-1.5 size-4 text-amber" />
            ฉลองความสำเร็จ 🎉
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopyVerify(verifyUrl)}
          >
            <Copy className="mr-1.5 size-4" />
            คัดลอกลิงก์ตรวจสอบ
          </Button>
          <Button
            size="sm"
            disabled={generating}
            onClick={downloadPDF}
            className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 font-semibold"
          >
            {generating ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 size-4" />
            )}
            ดาวน์โหลด PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="border-border bg-card hover:bg-accent"
          >
            <Printer className="mr-1.5 size-4" />
            พิมพ์เอกสาร
          </Button>
        </div>
      </div>

      {/* Interactive Celebration Hero Showcase */}
      <div className="no-print relative mb-8 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card/90 to-primary/5 p-6 shadow-brand backdrop-blur-xl sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-mint/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-primary/15 blur-3xl" />

        <div className="relative z-10 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          {/* 3D Holographic Seal Interactive Display */}
          <div className="flex flex-col items-center justify-center lg:col-span-5">
            <HolographicSeal3D onInteract={() => confettiRef.current?.burst()} />
          </div>

          {/* Certificate Achievement Details */}
          <div className="space-y-4 lg:col-span-7">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-mint/40 bg-mint/10 px-3 py-1 text-xs font-semibold text-mint-deep">
              <Sparkles className="size-3.5 text-mint" />
              <span>สำเร็จการฝึกอบรมอย่างเป็นทางการ</span>
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {c.courses?.title ?? "หลักสูตรฝึกอบรม"}
              </h1>
              <p className="mt-1 text-base font-semibold text-primary">
                มอบให้แก่: {p?.full_name ?? "ผู้เข้ารับการอบรม"}
              </p>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {[p?.position, p?.department, p?.division].filter(Boolean).join(" · ")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/60 bg-background/50 p-3.5 text-xs sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground">เลขที่ใบประกาศ:</span>
                <div className="font-semibold text-foreground">{c.cert_no}</div>
              </div>
              <div>
                <span className="text-muted-foreground">วันที่ออกใบประกาศ:</span>
                <div className="font-semibold text-foreground">{thaiDate(c.issued_at)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">คะแนนที่ได้:</span>
                <div className="font-semibold text-foreground">
                  {c.score != null ? `${c.score}%` : "ผ่านเกณฑ์"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-mint" />
              <span>
                ตราประทับ 3D โฮโลแกรมดิจิทัล รับรองความถูกต้องโดยโรงพยาบาลโอเวอร์บรุ๊ค
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Official Certificate Document Sheet */}
      <div className="space-y-3">
        <div className="no-print flex items-center justify-between px-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            เอกสารใบประกาศนียบัตรฉบับสมบูรณ์ (Official Certificate Document)
          </div>
          <div className="text-xs text-muted-foreground">
            สแกน QR Code เพื่อตรวจสอบความถูกต้อง
          </div>
        </div>

        <div className="print-area certificate-print-area rounded-2xl transition-transform duration-300 hover:shadow-2xl">
          <CertificateDesign
            recipientName={p?.full_name ?? ""}
            recipientDetail={[p?.position, p?.department, p?.division].filter(Boolean).join(" · ")}
            courseTitle={c.courses?.title ?? ""}
            trainingYear={c.courses?.training_year}
            hours={c.courses?.hours}
            score={c.score}
            certificateNumber={c.cert_no}
            issuedDate={thaiDate(c.issued_at)}
            hospitalLogoUrl={hospitalLogoUrl}
            courseLogoUrl={courseLogoUrl}
            organizationName={c.courses?.organization_name}
            departmentSubtitle={c.courses?.department_subtitle}
            signatureUrl={signatureUrl}
            instructorName={c.courses?.instructor_name}
            instructorTitle={c.courses?.instructor_title}
            backgroundUrl={backgroundUrl}
            verifyUrl={verifyUrl}
          />
        </div>
      </div>
    </div>
  );
}
