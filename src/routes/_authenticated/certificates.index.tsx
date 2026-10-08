import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { thaiDate } from "@/lib/data";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/certificates/")({
  head: () => ({ meta: [
    { title: "ใบประกาศของฉัน — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "ใบประกาศของฉันสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:title", content: "ใบประกาศของฉัน — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "ใบประกาศของฉันสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Certs,
});

function Certs() {
  const { data: me } = useMe();
  const { data = [] } = useQuery({
    queryKey: ["certs", me?.id],
    enabled: !!me,
    queryFn: async () => (await supabase.from("certificates").select("*, courses(title,hours)").eq("user_id", me!.id).order("issued_at", { ascending: false })).data ?? [],
  });
  return (
    <>
      <PageHeader eyebrow="ผลงานของฉัน" title="ใบประกาศนียบัตร" />
      {data.length === 0 && <div className="glass rounded-3xl p-10 text-center text-muted-foreground">ยังไม่มีใบประกาศ เรียนให้จบและสอบผ่านเพื่อรับใบประกาศ</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((c) => (
          <div key={c.id} className="glass flex items-center justify-between gap-4 rounded-3xl p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-mint/15 text-mint">✓</div>
              <div>
                <div className="text-sm font-semibold">{c.courses?.title}</div>
                <div className="text-[11px] text-muted-foreground">ออกเมื่อ {thaiDate(c.issued_at)} · เลขที่ {c.cert_no}</div>
              </div>
            </div>
            <Link to="/certificates/$certId" params={{ certId: c.id }} className="rounded-xl border border-primary/30 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10">เปิด / พิมพ์</Link>
          </div>
        ))}
      </div>
    </>
  );
}
