import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { thaiDate } from "@/lib/data";
import { PageHeader, Stat, Bar } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "สรุปผลการอบรม — ระบบอบรมออนไลน์" }] }),
  component: Reports,
});

function avg(xs: number[]) {
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0;
}

function Reports() {
  const { data: me } = useMe();
  const [by, setBy] = useState<"division" | "department">("division");
  const [year, setYear] = useState<number | "all">("all");
  const { data } = useQuery({
    queryKey: ["reports"],
    enabled: !!me?.isStaff,
    queryFn: async () => {
      const [{ data: courses }, { data: enr }, { data: att }, { data: certs }, { data: profiles }] = await Promise.all([
        supabase.from("courses").select("id,title,training_year"),
        supabase.from("enrollments").select("user_id,course_id"),
        supabase.from("test_attempts").select("user_id,course_id,kind,percent,passed"),
        supabase.from("certificates").select("user_id,course_id,issued_at,cert_no,score"),
        supabase.from("profiles").select("id,full_name,division,department"),
      ]);
      return { courses: courses ?? [], enr: enr ?? [], att: att ?? [], certs: certs ?? [], profiles: profiles ?? [] };
    },
  });
  if (!me?.isStaff) return <div className="glass rounded-3xl p-10 text-center">เฉพาะวิทยากรและผู้ดูแล</div>;
  if (!data) return <div className="text-muted-foreground">กำลังโหลด...</div>;
  const years = [...new Set(data.courses.map((c) => c.training_year))].sort((a, b) => b - a);
  const courses = data.courses.filter((c) => year === "all" || c.training_year === year);
  const courseIds = new Set(courses.map((c) => c.id));
  const enr = data.enr.filter((e) => courseIds.has(e.course_id));
  const att = data.att.filter((a) => courseIds.has(a.course_id));
  const certs = data.certs.filter((c) => courseIds.has(c.course_id));
  const { profiles } = data;
  const pmap = new Map(profiles.map((p) => [p.id, p]));
  const learners = new Set(enr.map((e) => e.user_id)).size;
  const passRate = enr.length ? Math.round((certs.length / enr.length) * 1000) / 10 : 0;
  const pre = att.filter((a) => a.kind === "pre").map((a) => Number(a.percent));
  const post = att.filter((a) => a.kind === "post").map((a) => Number(a.percent));

  const perCourse = courses.map((c) => {
    const e = enr.filter((x) => x.course_id === c.id).length;
    const ce = certs.filter((x) => x.course_id === c.id).length;
    const a = att.filter((x) => x.course_id === c.id);
    return {
      ...c, enrolled: e, passed: ce,
      pre: avg(a.filter((x) => x.kind === "pre").map((x) => Number(x.percent))),
      post: avg(a.filter((x) => x.kind === "post").map((x) => Number(x.percent))),
    };
  });

  const depts = new Map<string, { enrolled: number; passed: number }>();
  for (const e of enr) {
    const d = pmap.get(e.user_id)?.[by] || "ไม่ระบุ";
    const v = depts.get(d) ?? { enrolled: 0, passed: 0 };
    v.enrolled++;
    if (certs.some((c) => c.user_id === e.user_id && c.course_id === e.course_id)) v.passed++;
    depts.set(d, v);
  }

  function exportCsv() {
    const rows = [["ชื่อ", "ฝ่าย", "แผนก", "หลักสูตร", "ปีที่อบรม", "ก่อนเรียน(%)", "หลังเรียนสูงสุด(%)", "ผ่าน", "เลขใบประกาศ", "วันที่ออก"]];
    for (const e of enr) {
      const p = pmap.get(e.user_id);
      const c = courses.find((x) => x.id === e.course_id);
      const a = att.filter((x) => x.user_id === e.user_id && x.course_id === e.course_id);
      const preA = a.find((x) => x.kind === "pre");
      const posts = a.filter((x) => x.kind === "post").map((x) => Number(x.percent));
      const cert = certs.find((x) => x.user_id === e.user_id && x.course_id === e.course_id);
      rows.push([p?.full_name ?? "", p?.division ?? "", p?.department ?? "", c?.title ?? "", c ? String(c.training_year) : "", preA ? String(preA.percent) : "", posts.length ? String(Math.max(...posts)) : "", cert ? "ผ่าน" : "ยังไม่ผ่าน", cert?.cert_no ?? "", cert ? thaiDate(cert.issued_at) : ""]);
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
        <Stat label="บุคลากรที่อบรม" value={learners} note={`${enr.length} การลงทะเบียน`} tone="mint" />
        <Stat label="อัตราผ่านเกณฑ์" value={`${passRate}%`} note="ได้รับใบประกาศ / ลงทะเบียน" tone="mint" />
        <Stat label="คะแนนเฉลี่ยหลังเรียน" value={avg(post)} note={`ก่อนเรียนเฉลี่ย ${avg(pre)}`} tone="amber" />
        <Stat label="ใบประกาศออกแล้ว" value={certs.length} note={`${courses.length} หลักสูตร`} tone="primary" />
      </section>
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="glass overflow-x-auto rounded-3xl p-6 lg:col-span-2">
          <h2 className="text-lg font-bold">ผลรายหลักสูตร</h2>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">หลักสูตร</th><th>ผู้เรียน</th><th>ผ่าน</th><th>ก่อน</th><th>หลัง</th><th>พัฒนาการ</th></tr></thead>
            <tbody>
              {perCourse.map((c) => (
                <tr key={c.id} className="border-t border-glass-border">
                  <td className="py-3 font-medium">{c.title}</td><td>{c.enrolled}</td><td>{c.passed}</td><td>{c.pre}%</td><td>{c.post}%</td>
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
            {[...depts.entries()].map(([d, v]) => (
              <div key={d}>
                <div className="flex justify-between text-sm"><span>{d}</span><span className="text-muted-foreground">{v.passed}/{v.enrolled}</span></div>
                <div className="mt-1"><Bar value={(v.passed / v.enrolled) * 100} tone="gradient" /></div>
              </div>
            ))}
            {depts.size === 0 && <div className="text-sm text-muted-foreground">ยังไม่มีข้อมูล</div>}
          </div>
        </div>
      </section>
    </>
  );
}
