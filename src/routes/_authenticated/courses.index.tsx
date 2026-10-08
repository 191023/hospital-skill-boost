import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { coverFor, toneFor } from "@/components/Brand";

export const Route = createFileRoute("/_authenticated/courses/")({
  head: () => ({ meta: [
    { title: "หลักสูตรทั้งหมด — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "หลักสูตรทั้งหมดสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:title", content: "หลักสูตรทั้งหมด — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "หลักสูตรทั้งหมดสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Catalog,
});

function Catalog() {
  const [q, setQ] = useState("");
  const [year, setYear] = useState<number | "all">("all");
  const { data = [], isLoading } = useQuery({
    queryKey: ["catalog"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*, lessons(count)").eq("published", true).order("training_year", { ascending: false }).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const years = [...new Set(data.map((c) => c.training_year))].sort((a, b) => b - a);
  const list = data.filter((c) =>
    (year === "all" || c.training_year === year) &&
    (c.title + (c.category ?? "")).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader
        eyebrow="คลังหลักสูตร"
        title="หลักสูตรทั้งหมด"
        right={
          <div className="flex gap-2">
            <select value={year} onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))} className="glass rounded-full px-4 py-2 text-sm outline-none">
              <option value="all">ทุกปี</option>
              {years.map((y) => <option key={y} value={y}>ปี {y}</option>)}
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 ค้นหาหลักสูตร..." className="glass rounded-full px-4 py-2 text-sm outline-none" />
          </div>
        }
      />
      {isLoading && <div className="text-muted-foreground">กำลังโหลด...</div>}
      {!isLoading && list.length === 0 && <div className="glass rounded-3xl p-10 text-center text-muted-foreground">ยังไม่มีหลักสูตรที่เผยแพร่</div>}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="glass overflow-hidden rounded-3xl transition hover:-translate-y-1">
            <img src={coverFor(c.id, c.cover_url)} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
            <div className="p-5">
              <div className={`text-[11px] font-semibold ${toneFor(c.id)}`}>ปี {c.training_year} · {c.category || "ทั่วไป"} · {c.hours} ชั่วโมง</div>
              <div className="mt-1 text-base font-bold">{c.title}</div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
              <div className="mt-3 text-xs text-muted-foreground">
                {(c.lessons as unknown as { count: number }[])[0]?.count ?? 0} บทเรียน · เกณฑ์ผ่าน {c.pass_score}%
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
