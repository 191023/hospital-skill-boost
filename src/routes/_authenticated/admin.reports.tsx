import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { thaiDate } from "@/lib/data";
import { toast } from "sonner";
import { PageHeader, Stat, Bar } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [
    { title: "สรุปผลการอบรม — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "สรุปผลการอบรมสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:title", content: "สรุปผลการอบรม — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "สรุปผลการอบรมสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Reports,
});

type Group = { name: string; enrolled: number; passed: number };
type Overview = {
  years: number[]; learners: number; enrollments: number; passed: number; certificates: number; course_count: number;
  pre_avg: number; post_avg: number; division: Group[]; department: Group[];
  courses: { id: string; title: string; training_year: number; enrolled: number; passed: number; pre: number; post: number }[];
};

function Reports() {
  const { data: me } = useMe();
  const [by, setBy] = useState<"division" | "department">("division");
  const [year, setYear] = useState<number | "all">("all");
  const yearArg = year === "all" ? undefined : year;
  const { data } = useQuery({
    queryKey: ["reports", year],
    enabled: !!me?.isStaff,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_overview", yearArg ? { _year: yearArg } : {});
      if (error) throw error;
      return data as unknown as Overview;
    },
  });
  if (!me?.isStaff) return <div className="glass rounded-3xl p-10 text-center">เฉพาะวิทยากรและผู้ดูแล</div>;
  if (!data) return <div className="text-muted-foreground">กำลังโหลด...</div>;
  const years = data.years;
  const perCourse = data.courses;
  const groups = data[by];
  const passRate = data.enrollments ? Math.round((data.passed / data.enrollments) * 1000) / 10 : 0;

  async function exportCsv() {
    const rows = [["ชื่อ", "ฝ่าย", "แผนก", "หลักสูตร", "ปีที่อบรม", "ก่อนเรียน(%)", "หลังเรียนสูงสุด(%)", "ผ่าน", "เลขใบประกาศ", "วันที่ออก"]];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await supabase.rpc("report_rows", yearArg ? { _year: yearArg } : {}).range(from, from + 999);
      if (error) { toast.error(error.message); return; }
      for (const r of page ?? []) {
        rows.push([r.full_name ?? "", r.division ?? "", r.department ?? "", r.course_title ?? "", String(r.training_year ?? ""), r.pre != null ? String(r.pre) : "", r.post != null ? String(r.post) : "", r.cert_no ? "ผ่าน" : "ยังไม่ผ่าน", r.cert_no ?? "", r.issued_at ? thaiDate(r.issued_at) : ""]);
      }
      if (!page || page.length < 1000) break;
    }
    const csv = "\uFEFF" + rows.map((r) => r.map((x) => `"${x.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "training-report.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader eyebrow="ระบบอบรมออนไลน์" title="แดชบอร์ดสรุปผลอบรม" right={
        <div className="flex gap-2">
          <select value={year} onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))} className="glass rounded-full px-4 py-2 text-sm outline-none">
            <option value="all">ทุกปี</option>
            {years.map((y) => <option key={y} value={y}>ปี {y}</option>)}
          </select>
          <button onClick={exportCsv} className="glass rounded-full px-4 py-2 text-sm font-semibold text-primary">⬇ ส่งออก Excel (CSV)</button>
        </div>
      } />
      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="บุคลากรที่อบรม" value={data.learners} note={`${data.enrollments} การลงทะเบียน`} tone="mint" />
        <Stat label="อัตราผ่านเกณฑ์" value={`${passRate}%`} note="ได้รับใบประกาศ / ลงทะเบียน" tone="mint" />
        <Stat label="คะแนนเฉลี่ยหลังเรียน" value={data.post_avg} note={`ก่อนเรียนเฉลี่ย ${data.pre_avg}`} tone="amber" />
        <Stat label="ใบประกาศออกแล้ว" value={data.certificates} note={`${data.course_count} หลักสูตร`} tone="primary" />
      </section>
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="glass overflow-x-auto rounded-3xl p-6 lg:col-span-2">
          <h2 className="text-lg font-bold">ผลรายหลักสูตร</h2>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">หลักสูตร</th><th>ผู้เรียน</th><th>ผ่าน</th><th>ก่อน</th><th>หลัง</th><th>พัฒนาการ</th></tr></thead>
            <tbody>
              {perCourse.map((c) => (
                <tr key={c.id} className="border-t border-glass-border">
                  <td className="py-3 font-medium"><Link to="/admin/reports/$courseId" params={{ courseId: c.id }} className="text-primary hover:underline">{c.title} ›</Link></td><td>{c.enrolled}</td><td>{c.passed}</td><td>{c.pre}%</td><td>{c.post}%</td>
                  <td className="font-bold text-primary">{c.post && c.pre ? `+${(c.post - c.pre).toFixed(1)}` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">ผลสำเร็จตาม{by === "division" ? "ฝ่าย" : "แผนก"}</h2>
            <div className="flex gap-1 text-xs">{(["division", "department"] as const).map((k) => <button key={k} onClick={() => setBy(k)} className={`rounded-full px-3 py-1 ${by === k ? "bg-primary text-primary-foreground" : "bg-mist"}`}>{k === "division" ? "ฝ่าย" : "แผนก"}</button>)}</div></div>
          <div className="mt-4 space-y-4">
            {groups.map(({ name: d, ...v }) => (
              <div key={d}>
                <div className="flex justify-between text-sm"><span>{d}</span><span className="text-muted-foreground">{v.passed}/{v.enrolled}</span></div>
                <div className="mt-1"><Bar value={v.enrolled ? (v.passed / v.enrolled) * 100 : 0} tone="gradient" /></div>
              </div>
            ))}
            {groups.length === 0 && <div className="text-sm text-muted-foreground">ยังไม่มีข้อมูล</div>}
          </div>
        </div>
      </section>
    </>
  );
}
