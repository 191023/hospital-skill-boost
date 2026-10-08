import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/manage/")({
  head: () => ({ meta: [
    { title: "จัดการหลักสูตร — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "จัดการหลักสูตรสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:title", content: "จัดการหลักสูตร — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "จัดการหลักสูตรสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Manage,
});

function Manage() {
  const { data: me } = useMe();
  const nav = useNavigate();
  const { data = [] } = useQuery({
    queryKey: ["manage-courses", me?.id],
    enabled: !!me?.isStaff,
    queryFn: async () => {
      let q = supabase.from("courses").select("*, lessons(count), questions(count), enrollments(count)").order("created_at", { ascending: false });
      if (!me!.isAdmin) q = q.eq("created_by", me!.id);
      return (await q).data ?? [];
    },
  });
  if (!me?.isStaff) return <div className="glass rounded-3xl p-10 text-center">เฉพาะวิทยากรและผู้ดูแล</div>;

  async function create() {
    const { data: c, error } = await supabase.from("courses").insert({ title: "หลักสูตรใหม่" }).select("id").single();
    if (error) { toast.error(error.message); return; }
    nav({ to: "/manage/$courseId", params: { courseId: c.id } });
  }
  const cnt = (x: unknown) => (x as { count: number }[])[0]?.count ?? 0;

  return (
    <>
      <PageHeader eyebrow="สำหรับวิทยากร" title="จัดการหลักสูตร" right={<button onClick={create} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brand">+ สร้างหลักสูตร</button>} />
      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-sm">
          <thead className="bg-mist/60 text-left text-xs text-muted-foreground">
            <tr><th className="p-4">หลักสูตร</th><th>บทเรียน</th><th>ข้อสอบ</th><th>ผู้เรียน</th><th>สถานะ</th><th /></tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-t border-glass-border">
                <td className="p-4"><div className="font-semibold">{c.title}</div><div className="text-[11px] text-muted-foreground">ปี {c.training_year} · {c.category}</div></td>
                <td>{cnt(c.lessons)}</td><td>{cnt(c.questions)}</td><td>{cnt(c.enrollments)}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.published ? "bg-mint/15 text-mint" : "bg-amber/15 text-amber"}`}>{c.published ? "เผยแพร่" : "ฉบับร่าง"}</span></td>
                <td className="pr-4 text-right"><Link to="/manage/$courseId" params={{ courseId: c.id }} className="font-semibold text-primary">แก้ไข →</Link></td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">ยังไม่มีหลักสูตร</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
