import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { thaiDate } from "@/lib/data";
import { QRImg, origin } from "@/components/QR";
import { CertificateDesign } from "@/components/CertificateDesign";
import { fileUrl } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/certificates/$certId")({
  head: () => ({ meta: [
    { title: "ใบประกาศนียบัตร — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "ใบประกาศนียบัตรการฝึกอบรมสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:title", content: "ใบประกาศนียบัตร — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "ใบประกาศนียบัตรการฝึกอบรมสำหรับบุคลากรโรงพยาบาล" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CertView,
});

function CertView() {
  const { certId } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["cert", certId],
    queryFn: async () => {
      const { data: c } = await supabase.from("certificates").select("*, courses(title,hours,training_year,hospital_logo_url,course_logo_url,instructor_signature_url,instructor_name,instructor_title)").eq("id", certId).maybeSingle();
      if (!c) return null;
      const { data: p } = await supabase.from("profiles").select("full_name,division,department,position").eq("id", c.user_id).maybeSingle();
      const [hospitalLogoUrl, courseLogoUrl, signatureUrl] = await Promise.all([
        fileUrl(c.courses?.hospital_logo_url),
        fileUrl(c.courses?.course_logo_url),
        fileUrl(c.courses?.instructor_signature_url),
      ]);
      return { c, p, hospitalLogoUrl, courseLogoUrl, signatureUrl };
    },
  });
  if (!data) return <div className="text-muted-foreground">กำลังโหลด...</div>;
  const { c, p, hospitalLogoUrl, courseLogoUrl, signatureUrl } = data;
  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex justify-between">
        <Link to="/certificates" className="text-sm text-primary">← ใบประกาศทั้งหมด</Link>
        <Button onClick={() => window.print()}>พิมพ์ / บันทึก PDF</Button>
      </div>
      <div className="print-area certificate-print-area">
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
          signatureUrl={signatureUrl}
          instructorName={c.courses?.instructor_name}
          instructorTitle={c.courses?.instructor_title}
          verifyUrl={`${origin()}/verify/${c.cert_no}`}
        />
      </div>
    </div>
  );
}
