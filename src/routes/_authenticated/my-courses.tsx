import { createFileRoute, Link } from "@tanstack/react-router";
import { useMe } from "@/lib/auth";
import { useMyCourses } from "@/lib/data";
import { PageHeader, Bar } from "@/components/AppShell";
import { coverFor, toneFor } from "@/components/Brand";

export const Route = createFileRoute("/_authenticated/my-courses")({
  head: () => ({ meta: [
    { title: "หลักสูตรของฉัน — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "หลักสูตรของฉันสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:title", content: "หลักสูตรของฉัน — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "หลักสูตรของฉันสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MyCourses,
});

function MyCourses() {
  const { data: me } = useMe();
  const { data = [] } = useMyCourses(me?.id);
  return (
    <>
      <PageHeader eyebrow="การเรียนของฉัน" title="หลักสูตรของฉัน" />
      {data.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center text-muted-foreground">
          ยังไม่มีหลักสูตร <Link to="/courses" className="font-semibold text-primary">เลือกหลักสูตร</Link>
        </div>
      )}
      <div className="grid gap-4">
        {data.map((c) => (
          <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="glass flex gap-4 rounded-2xl p-3">
            <img src={coverFor(c.id, c.cover_url)} alt="" loading="lazy" className="h-24 w-40 shrink-0 rounded-xl object-cover" />
            <div className="flex-1">
              <div className={`text-[11px] font-semibold ${toneFor(c.id)}`}>{c.category || "ทั่วไป"} · {c.hours} ชั่วโมง</div>
              <div className="text-base font-bold">{c.title}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">ก่อนเรียน {c.pre ?? "-"}{c.pre !== undefined ? "%" : ""}</span>
                <span className="rounded-full bg-mint/15 px-2 py-0.5 text-mint">หลังเรียน {c.post ?? "-"}{c.post !== undefined ? "%" : ""}</span>
                {c.passed && <span className="rounded-full bg-mint px-2 py-0.5 text-primary-foreground">ผ่านแล้ว</span>}
              </div>
              <div className="mt-3"><Bar value={c.pct} tone={c.passed ? "mint" : "primary"} /></div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
