import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { thaiDate } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/certificates/$certId")({
  head: () => ({ meta: [{ title: "ใบประกาศนียบัตร — ระบบอบรมออนไลน์" }] }),
  component: CertView,
});

function CertView() {
  const { certId } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["cert", certId],
    queryFn: async () => {
      const { data: c } = await supabase.from("certificates").select("*, courses(title,hours)").eq("id", certId).maybeSingle();
      if (!c) return null;
      const { data: p } = await supabase.from("profiles").select("full_name,division,department,position").eq("id", c.user_id).maybeSingle();
      return { c, p };
    },
  });
  if (!data) return <div className="text-muted-foreground">กำลังโหลด...</div>;
  const { c, p } = data;
  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex justify-between">
        <Link to="/certificates" className="text-sm text-primary">← ใบประกาศทั้งหมด</Link>
        <button onClick={() => window.print()} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brand">พิมพ์ / บันทึก PDF</button>
      </div>
      <div className="relative aspect-[1.414] overflow-hidden rounded-3xl border-[10px] border-primary/20 bg-card p-12 text-center shadow-brand">
        <div className="absolute inset-4 rounded-2xl border-2 border-mint/40" />
        <div className="relative flex h-full flex-col items-center justify-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-brand-gradient text-2xl font-bold text-primary-foreground">อ</div>
          <div className="mt-3 text-sm font-semibold text-primary-deep">โรงพยาบาลโอเวอร์บรุ๊ค · ศูนย์พัฒนาศักยภาพบุคลากร</div>
          <h1 className="mt-6 text-4xl font-bold text-primary">ประกาศนียบัตร</h1>
          <div className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">Certificate of Completion</div>
          <p className="mt-6 text-sm text-muted-foreground">ขอมอบให้ไว้เพื่อแสดงว่า</p>
          <div className="mt-2 text-3xl font-bold">{p?.full_name}</div>
          <div className="text-sm text-muted-foreground">{[p?.position, p?.department, p?.division].filter(Boolean).join(" · ")}</div>
          <p className="mt-6 text-sm text-muted-foreground">ได้ผ่านการอบรมหลักสูตร</p>
          <div className="mt-1 text-xl font-bold text-primary-deep">{c.courses?.title}</div>
          <div className="mt-2 text-sm text-muted-foreground">จำนวน {c.courses?.hours} ชั่วโมง · คะแนนหลังเรียน {c.score}%</div>
          <div className="mt-8 flex w-full justify-between px-8 text-xs text-muted-foreground">
            <span>เลขที่ {c.cert_no}</span>
            <span>ให้ไว้ ณ วันที่ {thaiDate(c.issued_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
