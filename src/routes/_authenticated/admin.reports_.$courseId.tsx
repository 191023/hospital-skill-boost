import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { thaiDate } from "@/lib/data";
import { PageHeader, Stat, Bar } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/admin/reports_/$courseId")({
  head: () => ({ meta: [{ title: "รายงานรายหลักสูตร — ระบบอบรมออนไลน์" }] }),
  component: CourseReport,
});

type Row = {
  name: string; email: string; division: string; department: string; position: string;
  enrolledAt: string; lessons: number; totalLessons: number;
  round: string; pre: number | null; post: number | null; passed: boolean; onsite: boolean; checkedAt: string; certNo: string; issuedAt: string;
};

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);

function CourseReport() {
  const { courseId } = Route.useParams();
  const { data: me } = useMe();
  const [division, setDivision] = useState("all");
  const [mode, setMode] = useState("all");
  const [round, setRound] = useState("all");
  const { data } = useQuery({
    queryKey: ["course-report", courseId],
    enabled: !!me?.isStaff,
    queryFn: async () => {
      const [{ data: course }, { data: lessons }, { data: enr }, { data: att }, { data: certs }, { data: atd }, { data: sess }] = await Promise.all([
        supabase.from("courses").select("id,title,category,hours,pass_score,training_year").eq("id", courseId).single(),
        supabase.from("lessons").select("id").eq("course_id", courseId),
        supabase.from("enrollments").select("user_id,created_at,session_id").eq("course_id", courseId),
        supabase.from("test_attempts").select("user_id,kind,percent").eq("course_id", courseId),
        supabase.from("certificates").select("user_id,cert_no,issued_at").eq("course_id", courseId),
        supabase.from("attendance").select("user_id,checked_at").eq("course_id", courseId),
        supabase.from("course_sessions").select("id,round_no").eq("course_id", courseId),
      ]);
      const smap = new Map((sess ?? []).map((s) => [s.id, `รอบที่ ${s.round_no}`]));
      const amap = new Map((atd ?? []).map((a) => [a.user_id, a.checked_at]));
      const lessonIds = (lessons ?? []).map((l) => l.id);
      const userIds = (enr ?? []).map((e) => e.user_id);
      const [{ data: profiles }, { data: prog }] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("id,full_name,email,division,department,position").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
        lessonIds.length && userIds.length ? supabase.from("lesson_progress").select("user_id,lesson_id").in("lesson_id", lessonIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const rows: Row[] = (enr ?? []).map((e) => {
        const p: any = pmap.get(e.user_id) ?? {};
        const a = (att ?? []).filter((x) => x.user_id === e.user_id);
        const pre = a.filter((x) => x.kind === "pre").map((x) => Number(x.percent));
        const post = a.filter((x) => x.kind === "post").map((x) => Number(x.percent));
        const cert = (certs ?? []).find((c) => c.user_id === e.user_id);
        const done = new Set((prog ?? []).filter((x: any) => x.user_id === e.user_id).map((x: any) => x.lesson_id)).size;
        return {
          name: p.full_name || "-", email: p.email || "", division: p.division || "ไม่ระบุ", department: p.department || "ไม่ระบุ", position: p.position || "",
          enrolledAt: e.created_at, round: (e.session_id && smap.get(e.session_id)) || "ไม่ระบุรอบ", lessons: done, totalLessons: lessonIds.length,
          pre: pre.length ? pre[0]! : null, post: post.length ? Math.max(...post) : null,
          passed: !!cert, onsite: amap.has(e.user_id), checkedAt: amap.get(e.user_id) ?? "", certNo: cert?.cert_no ?? "", issuedAt: cert?.issued_at ?? "",
        };
      }).sort((a, b) => a.division.localeCompare(b.division, "th") || a.department.localeCompare(b.department, "th") || a.name.localeCompare(b.name, "th"));
      return { course, rows, hasRounds: (sess ?? []).length > 0 };
    },
  });

  if (!me?.isStaff) return <div className="glass rounded-3xl p-10 text-center">เฉพาะวิทยากรและผู้ดูแล</div>;
  if (!data) return <div className="text-muted-foreground">กำลังโหลด...</div>;
  if (!data.course) return <div className="glass rounded-3xl p-10 text-center">ไม่พบหลักสูตร</div>;
  const { course } = data;
  const divisions = [...new Set(data.rows.map((r) => r.division))];
  const rows = data.rows.filter((r) => (division === "all" || r.division === division) && (mode === "all" || (mode === "onsite") === r.onsite) && (round === "all" || r.round === round));
  const rounds = [...new Set(data.rows.map((r) => r.round))].sort((a, b) => a.localeCompare(b, "th", { numeric: true }));
  const onsite = rows.filter((r) => r.onsite).length;
  const modeLabel = (r: Row) => (r.onsite ? "อบรมสด" : "ออนไลน์");

  const groups = new Map<string, Map<string, Row[]>>();
  for (const r of rows) {
    const g = groups.get(r.division) ?? new Map<string, Row[]>();
    g.set(r.department, [...(g.get(r.department) ?? []), r]);
    groups.set(r.division, g);
  }
  const passed = rows.filter((r) => r.passed).length;
  const preAvg = avg(rows.flatMap((r) => (r.pre == null ? [] : [r.pre])));
  const postAvg = avg(rows.flatMap((r) => (r.post == null ? [] : [r.post])));
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const summary: (string | number)[][] = [
      ["รายงานสรุปผลการอบรม โรงพยาบาลโอเวอร์บรุ๊ค"],
      ["หลักสูตร", course!.title], ["ปีที่อบรม (ค.ศ.)", course!.training_year], ["เกณฑ์ผ่าน (%)", course!.pass_score],
      ...(round !== "all" ? [["รอบอบรม", round]] : []), ["ผู้เข้าอบรม", rows.length], ["อบรมสด (on-site)", onsite], ["ออนไลน์", rows.length - onsite], ["ผ่านเกณฑ์", passed], ["อัตราผ่าน (%)", pct(passed, rows.length)],
      ["คะแนนก่อนเรียนเฉลี่ย", preAvg], ["คะแนนหลังเรียนเฉลี่ย", postAvg], [],
      ["ฝ่าย", "แผนก", "ผู้เข้าอบรม", "อบรมสด", "ออนไลน์", "ผ่าน", "ยังไม่ผ่าน", "อัตราผ่าน (%)"],
    ];
    for (const [d, deps] of groups) for (const [dep, rs] of deps) {
      const p = rs.filter((r) => r.passed).length;
      const o = rs.filter((r) => r.onsite).length;
      summary.push([d, dep, rs.length, o, rs.length - o, p, rs.length - p, pct(p, rs.length)]);
    }
    const ws1 = XLSX.utils.aoa_to_sheet(summary);
    ws1["!cols"] = [{ wch: 28 }, { wch: 32 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws1, "สรุปตามฝ่าย-แผนก");
    const detail = [["ลำดับ", "ชื่อ-นามสกุล", "อีเมล", "ตำแหน่ง", "ฝ่าย", "แผนก", "วันที่ลงทะเบียน", "รอบอบรม", "รูปแบบการอบรม", "เวลาเช็คชื่อ", "บทเรียนที่เรียน", "ก่อนเรียน (%)", "หลังเรียนสูงสุด (%)", "ผลการอบรม", "เลขใบประกาศ", "วันที่ออกใบประกาศ"],
      ...rows.map((r, i) => [i + 1, r.name, r.email, r.position, r.division, r.department, thaiDate(r.enrolledAt), r.round, modeLabel(r), r.checkedAt ? new Date(r.checkedAt).toLocaleString("th-TH") : "", `${r.lessons}/${r.totalLessons}`, r.pre ?? "", r.post ?? "", r.passed ? "ผ่าน" : "ยังไม่ผ่าน", r.certNo, r.issuedAt ? thaiDate(r.issuedAt) : ""])];
    const ws2 = XLSX.utils.aoa_to_sheet(detail);
    ws2["!cols"] = [6, 26, 30, 16, 28, 32, 16, 12, 14, 20, 14, 12, 16, 12, 18, 18].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws2, "รายชื่อผู้เข้าอบรม");
    XLSX.writeFile(wb, `report-${course!.training_year}-${course!.title}.xlsx`);
  }

  return (
    <div className="print-area">
      <div className="no-print mb-3"><Link to="/admin/reports" className="text-sm text-primary">← กลับหน้าสรุปผล</Link></div>
      <PageHeader eyebrow={`รายงานรายหลักสูตร · ปี ${course.training_year}`} title={course.title} right={
        <div className="no-print flex flex-wrap gap-2">
          <select value={division} onChange={(e) => setDivision(e.target.value)} className="glass rounded-full px-4 py-2 text-sm outline-none">
            <option value="all">ทุกฝ่าย</option>
            {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {data.hasRounds && <select value={round} onChange={(e) => setRound(e.target.value)} className="glass rounded-full px-4 py-2 text-sm outline-none">
            <option value="all">ทุกรอบ</option>
            {rounds.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>}
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="glass rounded-full px-4 py-2 text-sm outline-none">
            <option value="all">ทุกรูปแบบ</option>
            <option value="onsite">อบรมสด</option>
            <option value="online">ออนไลน์</option>
          </select>
          <button onClick={exportExcel} className="glass rounded-full px-4 py-2 text-sm font-semibold text-primary">⬇ Excel</button>
          <button onClick={() => window.print()} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">⬇ PDF / พิมพ์</button>
        </div>
      } />
      <p className="mb-4 hidden text-sm print:block">โรงพยาบาลโอเวอร์บรุ๊ค · ศูนย์พัฒนาศักยภาพบุคลากร · เกณฑ์ผ่าน {course.pass_score}%{division !== "all" ? ` · ${division}` : ""}</p>
      <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="ผู้เข้าอบรม" value={rows.length} note={`อบรมสด ${onsite} · ออนไลน์ ${rows.length - onsite}`} tone="primary" />
        <Stat label="ผ่านเกณฑ์" value={passed} note={`อัตราผ่าน ${pct(passed, rows.length)}%`} tone="mint" />
        <Stat label="ก่อนเรียนเฉลี่ย" value={`${preAvg}%`} tone="amber" />
        <Stat label="หลังเรียนเฉลี่ย" value={`${postAvg}%`} note={`เกณฑ์ ${course.pass_score}%`} tone="mint" />
      </section>
      {rows.length === 0 && <div className="glass rounded-3xl p-10 text-center text-muted-foreground">ยังไม่มีผู้ลงทะเบียน</div>}
      {data.hasRounds && <RoundReport rows={data.rows} />}
      <div className="space-y-6">
        {[...groups.entries()].map(([d, deps]) => {
          const all = [...deps.values()].flat();
          const p = all.filter((r) => r.passed).length;
          return (
            <section key={d} className="glass break-inside-avoid rounded-3xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{d}</h2>
                <span className="text-sm text-muted-foreground">ผ่าน {p}/{all.length} คน ({pct(p, all.length)}%)</span>
              </div>
              <div className="mt-2"><Bar value={pct(p, all.length)} tone="gradient" /></div>
              {[...deps.entries()].map(([dep, rs]) => (
                <div key={dep} className="mt-5 overflow-x-auto">
                  <h3 className="text-sm font-semibold text-primary">{dep} · {rs.filter((r) => r.passed).length}/{rs.length} คน</h3>
                  <table className="mt-2 w-full min-w-[640px] text-sm">
                    <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">ชื่อ-นามสกุล</th><th>ตำแหน่ง</th>{data.hasRounds && <th>รอบ</th>}<th>รูปแบบ</th><th>บทเรียน</th><th>ก่อน</th><th>หลัง</th><th>ผล</th><th>เลขใบประกาศ</th></tr></thead>
                    <tbody>
                      {rs.map((r, i) => (
                        <tr key={i} className="border-t border-glass-border">
                          <td className="py-2 font-medium">{r.name}</td><td>{r.position || "-"}</td>{data.hasRounds && <td className="text-xs">{r.round}</td>}<td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.onsite ? "bg-mint/25 text-primary-deep" : "bg-primary/10 text-primary"}`}>{modeLabel(r)}</span></td><td>{r.lessons}/{r.totalLessons}</td>
                          <td>{r.pre ?? "-"}{r.pre != null && "%"}</td><td>{r.post ?? "-"}{r.post != null && "%"}</td>
                          <td className={r.passed ? "font-semibold text-primary" : "text-muted-foreground"}>{r.passed ? "ผ่าน" : "ยังไม่ผ่าน"}</td>
                          <td className="text-xs">{r.certNo || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
