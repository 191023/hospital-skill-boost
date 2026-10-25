import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useMe, fileUrl } from "@/lib/auth";
import { thaiDate } from "@/lib/data";
import { PageHeader, Stat } from "@/components/AppShell";
import { Camera, ImagePlus, Maximize2, Loader2, Award, Users, BookOpen, Clock, Calendar, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import obhLogoUrl from "@/assets/obh-logo.png";
import type { Database } from "@/integrations/supabase/types";

const NONE = "00000000-0000-0000-0000-000000000000";

export const Route = createFileRoute("/_authenticated/admin/reports_/$courseId")({
  head: () => ({ meta: [
    { title: "รายงานสรุปผลการจัดฝึกอบรมหลักสูตร — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "รายงานสรุปผลการฝึกอบรมรายหลักสูตรอย่างเป็นทางการ โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:title", content: "รายงานสรุปผลการจัดฝึกอบรมหลักสูตร — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "รายงานสรุปผลการฝึกอบรมรายหลักสูตรอย่างเป็นทางการ โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CourseReport,
});

type Row = {
  name: string; email: string; division: string; department: string; position: string;
  enrolledAt: string; lessons: number; totalLessons: number;
  round: string; pre: number | null; post: number | null; passed: boolean; onsite: boolean; simulated: boolean; checkedAt: string; certNo: string; issuedAt: string;
};

type PhotoItem = Database["public"]["Tables"]["course_activity_photos"]["Row"] & {
  url: string | null;
};

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

function CourseReport() {
  const { courseId } = Route.useParams();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [division, setDivision] = useState("all");
  const [mode, setMode] = useState("all");
  const [round, setRound] = useState("all");
  const [quickUploading, setQuickUploading] = useState(false);
  const [activePhoto, setActivePhoto] = useState<{ url: string; caption: string } | null>(null);

  const { data } = useQuery({
    queryKey: ["course-report", courseId],
    enabled: !!me?.isStaff,
    queryFn: async () => {
      const [{ data: course }, { data: lessons }, { data: enr }, { data: att }, { data: certs }, { data: atd }, { data: sess }, { data: rawPhotos }] = await Promise.all([
        supabase
          .from("courses")
          .select("id,title,category,hours,pass_score,training_year,audience,organization_name,department_subtitle,instructor_name,instructor_title,instructor_signature_url,hospital_logo_url,course_logo_url")
          .eq("id", courseId)
          .single(),
        supabase.from("lessons").select("id").eq("course_id", courseId),
        supabase.from("enrollments").select("user_id,created_at,session_id").eq("course_id", courseId),
        supabase.from("test_attempts").select("user_id,kind,percent").eq("course_id", courseId),
        supabase.from("certificates").select("user_id,cert_no,issued_at").eq("course_id", courseId),
        supabase.from("attendance").select("user_id,session_id,checked_at,is_demo").eq("course_id", courseId),
        supabase.from("course_sessions").select("id,round_no,location,starts_at,ends_at").eq("course_id", courseId).order("round_no"),
        supabase.from("course_activity_photos").select("*").eq("course_id", courseId).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
      ]);

      const smap = new Map((sess ?? []).map((s) => [s.id, `รอบที่ ${s.round_no}`]));
      const amap = new Map((atd ?? []).map((a) => [`${a.user_id}:${a.session_id ?? ""}`, a]));
      const lessonIds = (lessons ?? []).map((l) => l.id);
      const userIds = (enr ?? []).map((e) => e.user_id);

      const [{ data: profiles }, { data: prog }, photoUrls, hospitalLogoUrl, courseLogoUrl, instructorSigUrl] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email,division,department,position").in("id", userIds.length ? userIds : [NONE]),
        supabase.from("lesson_progress").select("user_id,lesson_id").in("lesson_id", lessonIds.length && userIds.length ? lessonIds : [NONE]),
        Promise.all((rawPhotos ?? []).map((p) => fileUrl(p.photo_url))),
        fileUrl(course?.hospital_logo_url),
        fileUrl(course?.course_logo_url),
        fileUrl(course?.instructor_signature_url),
      ]);

      const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const rows: Row[] = (enr ?? []).map((e) => {
        const p = pmap.get(e.user_id);
        const a = (att ?? []).filter((x) => x.user_id === e.user_id);
        const pre = a.filter((x) => x.kind === "pre").map((x) => Number(x.percent));
        const post = a.filter((x) => x.kind === "post").map((x) => Number(x.percent));
        const cert = (certs ?? []).find((c) => c.user_id === e.user_id);
        const done = new Set((prog ?? []).filter((x) => x.user_id === e.user_id).map((x) => x.lesson_id)).size;
        const checkin = amap.get(`${e.user_id}:${e.session_id ?? ""}`);
        return {
          name: p?.full_name || "-",
          email: p?.email || "",
          division: p?.division || "ไม่ระบุฝ่าย",
          department: p?.department || "ไม่ระบุแผนก",
          position: p?.position || "-",
          enrolledAt: e.created_at,
          round: (e.session_id && smap.get(e.session_id)) || "ไม่ระบุรอบ",
          lessons: done,
          totalLessons: lessonIds.length,
          pre: pre.length ? pre[0]! : null,
          post: post.length ? Math.max(...post) : null,
          passed: !!cert,
          onsite: !!checkin,
          simulated: checkin?.is_demo ?? false,
          checkedAt: checkin?.checked_at ?? "",
          certNo: cert?.cert_no ?? "",
          issuedAt: cert?.issued_at ?? "",
        };
      }).sort((a, b) => a.division.localeCompare(b.division, "th") || a.department.localeCompare(b.department, "th") || a.name.localeCompare(b.name, "th"));

      const photos: PhotoItem[] = (rawPhotos ?? []).map((p, i) => ({
        ...p,
        url: photoUrls[i] ?? null,
      }));

      return {
        course,
        rows,
        hasRounds: (sess ?? []).length > 0,
        sessions: sess ?? [],
        photos,
        smap,
        hospitalLogoUrl: hospitalLogoUrl || obhLogoUrl,
        courseLogoUrl,
        instructorSigUrl,
      };
    },
  });

  if (!me?.isStaff) return <div className="glass rounded-3xl p-10 text-center">เฉพาะวิทยากรและผู้ดูแล</div>;
  if (!data) return <div className="text-muted-foreground p-8">กำลังโหลดข้อมูลรายงาน...</div>;
  if (!data.course) return <div className="glass rounded-3xl p-10 text-center">ไม่พบข้อมูลหลักสูตร</div>;

  const { course, sessions, smap, hospitalLogoUrl, courseLogoUrl, instructorSigUrl } = data;
  const divisions = [...new Set(data.rows.map((r) => r.division))];
  const rows = data.rows.filter(
    (r) =>
      (division === "all" || r.division === division) &&
      (mode === "all" || (mode === "onsite") === r.onsite) &&
      (round === "all" || r.round === round)
  );
  const rounds = [...new Set(data.rows.map((r) => r.round))].sort((a, b) => a.localeCompare(b, "th", { numeric: true }));
  const onsite = rows.filter((r) => r.onsite).length;
  const online = rows.length - onsite;
  const passed = rows.filter((r) => r.passed).length;
  const notPassed = rows.length - passed;
  const preAvg = avg(rows.flatMap((r) => (r.pre == null ? [] : [r.pre])));
  const postAvg = avg(rows.flatMap((r) => (r.post == null ? [] : [r.post])));
  const improvement = Math.round((postAvg - preAvg) * 10) / 10;
  const modeLabel = (r: Row) => (r.onsite ? (r.simulated ? "อบรมสด (จำลอง)" : "อบรมสด") : "ออนไลน์");

  // Departmental breakdown
  const deptList: { division: string; department: string; count: number; onsite: number; online: number; passed: number; notPassed: number; rate: number }[] = [];
  const groups = new Map<string, Map<string, Row[]>>();
  for (const r of rows) {
    const g = groups.get(r.division) ?? new Map<string, Row[]>();
    g.set(r.department, [...(g.get(r.department) ?? []), r]);
    groups.set(r.division, g);
  }
  for (const [d, deps] of groups) {
    for (const [dep, rs] of deps) {
      const pCount = rs.filter((r) => r.passed).length;
      const oCount = rs.filter((r) => r.onsite).length;
      deptList.push({
        division: d,
        department: dep,
        count: rs.length,
        onsite: oCount,
        online: rs.length - oCount,
        passed: pCount,
        notPassed: rs.length - pCount,
        rate: pct(pCount, rs.length),
      });
    }
  }

  const displayPhotos = (data.photos ?? []).filter(
    (p) => !p.session_id || round === "all" || smap.get(p.session_id) === round
  );

  async function handleQuickUpload(files: FileList | null) {
    if (!files || files.length === 0 || !data) return;
    setQuickUploading(true);
    let successCount = 0;
    try {
      const currentMax = (data.photos?.length ?? 0) > 0 ? Math.max(...data.photos.map((p) => p.sort_order)) : -1;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) continue;
        if (file.size > 5 * 1024 * 1024) continue;
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${courseId}/activity/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("course-files").upload(path, file, { contentType: file.type, upsert: true });
        if (upErr) throw upErr;
        const defaultCaption = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        const { error: insErr } = await supabase.from("course_activity_photos").insert({
          course_id: courseId,
          photo_url: path,
          caption: defaultCaption,
          sort_order: currentMax + 1 + i,
        });
        if (insErr) throw insErr;
        successCount++;
      }
      if (successCount > 0) {
        toast.success(`เพิ่มภาพกิจกรรม ${successCount} รูปแล้ว`);
        qc.invalidateQueries({ queryKey: ["course-report", courseId] });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setQuickUploading(false);
    }
  }

  function exportExcel() {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    const summary: (string | number)[][] = [
      ["แบบรายงานสรุปผลการจัดฝึกอบรมหลักสูตรอย่างเป็นทางการ"],
      [course.organization_name || "โรงพยาบาลโอเวอร์บรุ๊ค", course.department_subtitle || "ศูนย์พัฒนาศักยภาพบุคลากร"],
      ...(data.rows.some((r) => r.simulated) ? [["หมายเหตุ", "รวมข้อมูลเช็คชื่อจำลองสำหรับทดสอบ ไม่ใช่การเข้าอบรมจริง"]] : []),
      [],
      ["ข้อมูลหลักสูตร"],
      ["ชื่อหลักสูตร", course.title],
      ["ปีที่อบรม (ค.ศ.)", course.training_year],
      ["หมวดหมู่วิชา", course.category || "วิชาทั่วไป"],
      ["ระยะเวลาการอบรม", `${course.hours ?? 0} ชั่วโมง`],
      ["วิทยากรประจำหลักสูตร", `${course.instructor_name || "-"} (${course.instructor_title || "-"})`],
      ["เกณฑ์คะแนนผ่าน (%)", `${course.pass_score}%`],
      ["วันที่ออกรายงาน", thaiDate(new Date().toISOString())],
      ...(round !== "all" ? [["รอบอบรมที่กรอง", round]] : []),
      [],
      ["สรุปผลสัมฤทธิ์และตัวชี้วัดสำคัญ"],
      ["จำนวนผู้เข้าอบรมทั้งหมด", rows.length],
      ["เข้าอบรมสด (On-site)", onsite],
      ["เรียนออนไลน์ (Online)", online],
      ["ผ่านเกณฑ์การประเมิน", passed],
      ["ไม่ผ่านเกณฑ์การประเมิน", notPassed],
      ["อัตราการผ่านเกณฑ์ (%)", `${pct(passed, rows.length)}%`],
      ["คะแนนก่อนเรียนเฉลี่ย (%)", `${preAvg}%`],
      ["คะแนนหลังเรียนเฉลี่ย (%)", `${postAvg}%`],
      ["พัฒนาการเฉลี่ย (%)", `${improvement >= 0 ? `+${improvement}` : improvement}%`],
      ["ภาพกิจกรรมแนบรายงาน", `${displayPhotos.length} รูป`],
      [],
      ["สรุปผลแยกตามฝ่ายและแผนก"],
      ["ลำดับ", "ฝ่าย", "แผนก", "ผู้เข้าอบรม", "อบรมสด", "ออนไลน์", "ผ่านเกณฑ์", "ยังไม่ผ่าน", "อัตราผ่าน (%)"],
      ...deptList.map((d, i) => [i + 1, d.division, d.department, d.count, d.onsite, d.online, d.passed, d.notPassed, `${d.rate}%`]),
      ["", "รวมทั้งสิ้น", "", rows.length, onsite, online, passed, notPassed, `${pct(passed, rows.length)}%`],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summary);
    ws1["!cols"] = [{ wch: 28 }, { wch: 32 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws1, "สรุปผลการอบรม");

    const detail = [
      ["ลำดับ", "ชื่อ-นามสกุล", "อีเมล", "ตำแหน่ง", "ฝ่าย", "แผนก", "วันที่ลงทะเบียน", "รอบอบรม", "รูปแบบการอบรม", "เวลาเช็คชื่อ", "บทเรียนที่ผ่าน", "ก่อนเรียน (%)", "หลังเรียน (%)", "ผลการประเมิน", "เลขที่ใบประกาศ", "วันที่ออกใบประกาศ"],
      ...rows.map((r, i) => [
        i + 1,
        r.name,
        r.email,
        r.position,
        r.division,
        r.department,
        thaiDate(r.enrolledAt),
        r.round,
        modeLabel(r),
        r.checkedAt ? new Date(r.checkedAt).toLocaleString("th-TH") : "",
        `${r.lessons}/${r.totalLessons}`,
        r.pre ?? "",
        r.post ?? "",
        r.passed ? "ผ่าน" : "ไม่ผ่าน",
        r.certNo,
        r.issuedAt ? thaiDate(r.issuedAt) : "",
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(detail);
    ws2["!cols"] = [6, 26, 30, 16, 26, 28, 16, 12, 14, 20, 14, 12, 16, 12, 18, 18].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws2, "รายชื่อผู้เข้าอบรม");

    if (displayPhotos.length > 0) {
      const photoSheet = [
        ["ลำดับ", "คำอธิบายภาพกิจกรรม", "รอบอบรม", "วันที่บันทึก"],
        ...displayPhotos.map((p, i) => [
          i + 1,
          p.caption || "ภาพกิจกรรมการอบรม",
          p.session_id ? (smap.get(p.session_id) || "ไม่ระบุ") : "ทุกรอบ / ภาพรวม",
          thaiDate(p.created_at),
        ]),
      ];
      const wsPhotos = XLSX.utils.aoa_to_sheet(photoSheet);
      wsPhotos["!cols"] = [{ wch: 8 }, { wch: 45 }, { wch: 18 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsPhotos, "ภาพกิจกรรมการอบรม");
    }

    XLSX.writeFile(wb, `รายงานสรุปผลอบรม-${course.training_year}-${course.title}.xlsx`);
  }

  return (
    <div className="print-area mx-auto max-w-5xl space-y-8 pb-16">
      {/* Web Action Controls (Hidden on Print) */}
      <div className="no-print">
        <div className="mb-3">
          <Link to="/admin/reports" className="text-sm font-medium text-primary hover:underline">
            ← กลับหน้าสรุปผลหลักสูตรทั้งหมด
          </Link>
        </div>
        <PageHeader
          eyebrow={`รายงานรายหลักสูตร · ปี ${course.training_year}`}
          title={course.title}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="glass rounded-full px-4 py-2 text-sm outline-none"
              >
                <option value="all">ทุกฝ่าย</option>
                {divisions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {data.hasRounds && (
                <select
                  value={round}
                  onChange={(e) => setRound(e.target.value)}
                  className="glass rounded-full px-4 py-2 text-sm outline-none"
                >
                  <option value="all">ทุกรอบอบรม</option>
                  {rounds.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="glass rounded-full px-4 py-2 text-sm outline-none"
              >
                <option value="all">ทุกรูปแบบ</option>
                <option value="onsite">อบรมสด (On-site)</option>
                <option value="online">ออนไลน์</option>
              </select>
              <Button onClick={exportExcel} variant="outline" size="sm" className="rounded-full shadow-sm">
                ⬇ ดาวน์โหลด Excel
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-full shadow-sm">
                <a href={`/manage/${courseId}?tab=attendees`}>
                  👥 จัดการรายชื่อผู้เรียน
                </a>
              </Button>
              <Button
                onClick={() => window.print()}
                size="sm"
                className="rounded-full bg-primary font-semibold text-primary-foreground shadow-sm"
              >
                🖨 พิมพ์รายงานทางการ / PDF
              </Button>
            </div>
          }
        />
      </div>

      {/* =========================================================================
          OFFICIAL FORMAL HOSPITAL REPORT DOCUMENT SHEET
          ========================================================================= */}
      <div className="space-y-6 rounded-3xl border border-glass-border bg-card p-6 shadow-sm print:rounded-none print:border-none print:bg-white print:p-0 print:shadow-none">
        
        {/* 1. OFFICIAL LETTERHEAD & TITLE */}
        <header className="border-b-2 border-primary/30 pb-5 text-center print:border-b-2 print:border-black print:pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center sm:size-20">
              <img src={hospitalLogoUrl} alt="โลโก้โรงพยาบาล" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold tracking-tight text-primary-deep sm:text-xl print:text-black">
                {course.organization_name || "โรงพยาบาลโอเวอร์บรุ๊ค"}
              </h2>
              <p className="text-xs font-semibold text-muted-foreground print:text-gray-700">
                OVERBROOK HOSPITAL · {course.department_subtitle || "ศูนย์พัฒนาศักยภาพบุคลากร"}
              </p>
              <h1 className="mt-2 text-xl font-extrabold text-foreground sm:text-2xl print:text-black">
                แบบรายงานสรุปผลการจัดฝึกอบรมหลักสูตรและการประเมินผล
              </h1>
              <p className="text-xs font-medium text-muted-foreground print:text-gray-600">
                (Official Course Training & Assessment Report) · ประจำปี {course.training_year}
              </p>
            </div>
            <div className="flex size-16 shrink-0 items-center justify-center sm:size-20">
              {courseLogoUrl ? (
                <img src={courseLogoUrl} alt="โลโก้หลักสูตร" className="max-h-full max-w-full object-contain" />
              ) : (
                <div className="hidden sm:block" />
              )}
            </div>
          </div>

          {data.rows.some((r) => r.simulated) && (
            <div className="mt-3 rounded-lg border border-amber/40 bg-amber/10 px-3 py-1.5 text-xs text-amber-900 print:border print:border-amber print:bg-white print:text-amber-900">
              ⚠ หมายเหตุ: รายงานฉบับนี้รวมข้อมูลการเช็คชื่อจำลองสำหรับทดสอบระบบ ({data.rows.filter((r) => r.simulated).length} คน)
            </div>
          )}
        </header>

        {/* 2. FORMAL COURSE PROFILE TABLE */}
        <section className="print-avoid-break">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary print:text-black">
            ข้อมูลทั่วไปของหลักสูตร (Course Profile)
          </h3>
          <div className="overflow-hidden rounded-xl border border-glass-border print:border-gray-400">
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-glass-border bg-mist/50 print:border-gray-300 print:bg-gray-100">
                  <td className="w-1/4 px-3 py-2 font-semibold text-muted-foreground print:text-gray-700">ชื่อหลักสูตร</td>
                  <td className="w-1/4 px-3 py-2 font-bold text-foreground print:text-black">{course.title}</td>
                  <td className="w-1/4 px-3 py-2 font-semibold text-muted-foreground print:text-gray-700">ปีการอบรม / รหัส</td>
                  <td className="w-1/4 px-3 py-2 text-foreground print:text-black">ปี ค.ศ. {course.training_year}</td>
                </tr>
                <tr className="border-b border-glass-border print:border-gray-300">
                  <td className="px-3 py-2 font-semibold text-muted-foreground print:text-gray-700">หมวดหมู่หลักสูตร</td>
                  <td className="px-3 py-2 text-foreground print:text-black">{course.category || "วิชาพัฒนาทักษะวิชาชีพ"}</td>
                  <td className="px-3 py-2 font-semibold text-muted-foreground print:text-gray-700">ระยะเวลาหลักสูตร</td>
                  <td className="px-3 py-2 font-medium text-foreground print:text-black">{course.hours ?? 0} ชั่วโมง</td>
                </tr>
                <tr className="border-b border-glass-border bg-mist/50 print:border-gray-300 print:bg-gray-100">
                  <td className="px-3 py-2 font-semibold text-muted-foreground print:text-gray-700">วิทยากรผู้สอน</td>
                  <td className="px-3 py-2 font-semibold text-foreground print:text-black">
                    {course.instructor_name || "ไม่ระบุวิทยากร"} {course.instructor_title ? `(${course.instructor_title})` : ""}
                  </td>
                  <td className="px-3 py-2 font-semibold text-muted-foreground print:text-gray-700">เกณฑ์การผ่านประเมิน</td>
                  <td className="px-3 py-2 font-bold text-primary-deep print:text-black">{course.pass_score}% (แบบทดสอบหลังเรียน)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold text-muted-foreground print:text-gray-700">กลุ่มเป้าหมาย</td>
                  <td className="px-3 py-2 text-foreground print:text-black">
                    {course.audience === "all" ? "บุคลากรทุกฝ่ายและทุกแผนก" : "กลุ่มเป้าหมายเฉพาะที่กำหนด"}
                  </td>
                  <td className="px-3 py-2 font-semibold text-muted-foreground print:text-gray-700">วันที่จัดทำรายงาน</td>
                  <td className="px-3 py-2 text-foreground print:text-black">{thaiDate(new Date().toISOString())}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. EXECUTIVE SUMMARY & STATISTICAL KPI TABLE */}
        <section className="print-avoid-break">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary print:text-black">
            สรุปผลสัมฤทธิ์และตัวชี้วัดสำคัญ (Executive Summary & KPIs)
          </h3>
          
          {/* Web modern cards */}
          <div className="no-print mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="ผู้ลงทะเบียนทั้งหมด" value={rows.length} note={`อบรมสด ${onsite} · ออนไลน์ ${online}`} tone="primary" />
            <Stat label="ผ่านเกณฑ์ประเมิน" value={passed} note={`อัตราผ่าน ${pct(passed, rows.length)}%`} tone="mint" />
            <Stat label="คะแนนก่อนเรียนเฉลี่ย" value={`${preAvg}%`} tone="amber" />
            <Stat label="คะแนนหลังเรียนเฉลี่ย" value={`${postAvg}%`} note={`เกณฑ์ ${course.pass_score}% · พัฒนาการ ${improvement >= 0 ? `+${improvement}` : improvement}%`} tone="mint" />
          </div>

          {/* Official Formal KPI Table for Print & Formal Document */}
          <div className="overflow-hidden rounded-xl border border-glass-border print:border-gray-400">
            <table className="w-full text-xs">
              <thead className="bg-mist font-bold text-foreground print:bg-gray-200 print:text-black">
                <tr className="border-b border-glass-border text-center print:border-gray-400">
                  <th className="px-3 py-2 text-left">ตัวชี้วัดผลการดำเนินงาน</th>
                  <th className="px-3 py-2">จำนวน (คน)</th>
                  <th className="px-3 py-2">ร้อยละ (%)</th>
                  <th className="px-3 py-2 text-left">ข้อมูลเปรียบเทียบ / ผลสัมฤทธิ์</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border print:divide-gray-300">
                <tr>
                  <td className="px-3 py-2 font-medium">1. ผู้ลงทะเบียนเข้าร่วมโครงการทั้งหมด</td>
                  <td className="px-3 py-2 text-center font-bold">{rows.length}</td>
                  <td className="px-3 py-2 text-center">100.0%</td>
                  <td className="px-3 py-2 text-muted-foreground print:text-gray-700">แบ่งเป็น อบรมสด (On-site) {onsite} คน, ออนไลน์ {online} คน</td>
                </tr>
                <tr className="bg-mist/30 print:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-mint-deep print:text-black">2. ผู้ผ่านเกณฑ์การประเมินผล (ได้รับใบประกาศ)</td>
                  <td className="px-3 py-2 text-center font-bold text-mint-deep print:text-black">{passed}</td>
                  <td className="px-3 py-2 text-center font-bold text-mint-deep print:text-black">{pct(passed, rows.length)}%</td>
                  <td className="px-3 py-2 text-muted-foreground print:text-gray-700">ผ่านตามเกณฑ์คะแนนสอบหลังเรียนไม่น้อยกว่า {course.pass_score}%</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-coral print:text-black">3. ผู้ยังไม่ผ่านเกณฑ์การประเมินผล</td>
                  <td className="px-3 py-2 text-center font-semibold text-coral print:text-black">{notPassed}</td>
                  <td className="px-3 py-2 text-center text-coral print:text-black">{pct(notPassed, rows.length)}%</td>
                  <td className="px-3 py-2 text-muted-foreground print:text-gray-700">คะแนนยังไม่ถึงเกณฑ์ หรือยังไม่ได้ทำแบบทดสอบหลังเรียน</td>
                </tr>
                <tr className="bg-mist/30 print:bg-gray-50">
                  <td className="px-3 py-2 font-medium">4. คะแนนเฉลี่ยก่อนเรียน (Pre-test Average)</td>
                  <td className="px-3 py-2 text-center font-semibold">{preAvg}%</td>
                  <td className="px-3 py-2 text-center">-</td>
                  <td className="px-3 py-2 text-muted-foreground print:text-gray-700">ระดับความรู้พื้นฐานก่อนรับการอบรม</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">5. คะแนนเฉลี่ยหลังเรียน (Post-test Average)</td>
                  <td className="px-3 py-2 text-center font-bold text-primary-deep print:text-black">{postAvg}%</td>
                  <td className="px-3 py-2 text-center font-bold text-primary-deep print:text-black">{postAvg}%</td>
                  <td className="px-3 py-2 font-medium text-mint-deep print:text-black">
                    ผลการเรียนรู้เพิ่มขึ้นเฉลี่ย {improvement >= 0 ? `+${improvement}` : improvement}% (Learning Gain)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. SESSIONS & ROUNDS BREAKDOWN */}
        {data.hasRounds && (
          <section className="print-avoid-break">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary print:text-black">
              สรุปผลแยกตามรอบการจัดอบรม (Training Sessions & Rounds)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-glass-border print:border-gray-400">
              <table className="w-full text-xs">
                <thead className="bg-mist font-bold text-foreground print:bg-gray-200 print:text-black">
                  <tr className="border-b border-glass-border text-center print:border-gray-400">
                    <th className="px-3 py-2 text-left">รอบที่</th>
                    <th className="px-3 py-2 text-left">สถานที่ / วันที่อบรม</th>
                    <th className="px-3 py-2">ลงทะเบียน</th>
                    <th className="px-3 py-2">เข้าอบรมจริง</th>
                    <th className="px-3 py-2">เข้าแต่ไม่สอบ</th>
                    <th className="px-3 py-2 font-bold text-mint-deep print:text-black">สอบผ่าน</th>
                    <th className="px-3 py-2 text-coral print:text-black">ไม่ผ่าน</th>
                    <th className="px-3 py-2">อัตราผ่าน (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass-border text-center print:divide-gray-300">
                  {rounds.map((rnd) => {
                    const rs = data.rows.filter((r) => r.round === rnd);
                    const attCount = rs.filter((r) => r.onsite).length;
                    const noTestCount = rs.filter((r) => r.onsite && r.post == null).length;
                    const passCount = rs.filter((r) => r.passed).length;
                    const failCount = rs.filter((r) => r.post != null && !r.passed).length;
                    const sessObj = sessions.find((s) => `รอบที่ ${s.round_no}` === rnd);
                    return (
                      <tr key={rnd} className="hover:bg-mist/30">
                        <td className="px-3 py-2 text-left font-bold text-primary-deep print:text-black">{rnd}</td>
                        <td className="px-3 py-2 text-left text-muted-foreground print:text-gray-700">
                          {sessObj?.location || "ห้องฝึกอบรม"} {sessObj?.starts_at ? `(${thaiDate(sessObj.starts_at)})` : ""}
                        </td>
                        <td className="px-3 py-2 font-medium">{rs.length}</td>
                        <td className="px-3 py-2">{attCount}</td>
                        <td className="px-3 py-2 text-muted-foreground">{noTestCount}</td>
                        <td className="px-3 py-2 font-bold text-mint-deep print:text-black">{passCount}</td>
                        <td className="px-3 py-2 text-coral print:text-black">{failCount}</td>
                        <td className="px-3 py-2 font-bold">{rs.length ? Math.round((passCount / rs.length) * 100) : 0}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 5. DEPARTMENTAL ANALYSIS TABLE (CONSOLIDATED) */}
        <section className="print-avoid-break">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary print:text-black">
            สรุปผลการฝึกอบรมแยกตามโครงสร้างองค์กร (ฝ่ายและแผนก)
          </h3>
          <div className="overflow-x-auto rounded-xl border border-glass-border print:border-gray-400">
            <table className="w-full text-xs">
              <thead className="bg-mist font-bold text-foreground print:bg-gray-200 print:text-black">
                <tr className="border-b border-glass-border text-center print:border-gray-400">
                  <th className="w-12 px-2 py-2">ลำดับ</th>
                  <th className="px-3 py-2 text-left">ฝ่ายงาน (Division)</th>
                  <th className="px-3 py-2 text-left">แผนก (Department)</th>
                  <th className="px-2 py-2">ผู้เข้าอบรม</th>
                  <th className="px-2 py-2">อบรมสด</th>
                  <th className="px-2 py-2">ออนไลน์</th>
                  <th className="px-2 py-2 font-bold text-mint-deep print:text-black">ผ่านเกณฑ์</th>
                  <th className="px-2 py-2 text-coral print:text-black">ไม่ผ่าน</th>
                  <th className="px-2 py-2">อัตราผ่าน (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border print:divide-gray-300">
                {deptList.map((item, idx) => (
                  <tr key={`${item.division}-${item.department}`} className={idx % 2 === 1 ? "bg-mist/30 print:bg-gray-50" : ""}>
                    <td className="px-2 py-1.5 text-center text-muted-foreground print:text-gray-600">{idx + 1}</td>
                    <td className="px-3 py-1.5 font-medium">{item.division}</td>
                    <td className="px-3 py-1.5">{item.department}</td>
                    <td className="px-2 py-1.5 text-center font-medium">{item.count}</td>
                    <td className="px-2 py-1.5 text-center">{item.onsite}</td>
                    <td className="px-2 py-1.5 text-center">{item.online}</td>
                    <td className="px-2 py-1.5 text-center font-semibold text-mint-deep print:text-black">{item.passed}</td>
                    <td className="px-2 py-1.5 text-center text-coral print:text-black">{item.notPassed}</td>
                    <td className="px-2 py-1.5 text-center font-bold">{item.rate}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-glass-border bg-mist/60 font-bold text-foreground print:border-gray-500 print:bg-gray-200 print:text-black">
                <tr className="text-center">
                  <td colSpan={3} className="px-3 py-2 text-right">ยอดรวมทั้งสิ้น (Grand Total)</td>
                  <td className="px-2 py-2">{rows.length}</td>
                  <td className="px-2 py-2">{onsite}</td>
                  <td className="px-2 py-2">{online}</td>
                  <td className="px-2 py-2 font-bold text-mint-deep print:text-black">{passed}</td>
                  <td className="px-2 py-2 text-coral print:text-black">{notPassed}</td>
                  <td className="px-2 py-2 font-bold">{pct(passed, rows.length)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* 6. TRAINING ACTIVITY PHOTOS GALLERY */}
        <section className="print-avoid-break">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary print:text-black">
              ภาพบรรยากาศกิจกรรมการอบรม (Training Activity Gallery)
            </h3>
            <div className="no-print flex items-center gap-2">
              <Button asChild size="sm" variant="outline" className="h-7 text-xs" disabled={quickUploading}>
                <label className="cursor-pointer">
                  {quickUploading ? <Loader2 className="mr-1 size-3 animate-spin" /> : <ImagePlus className="mr-1 size-3" />}
                  {quickUploading ? "กำลังอัปโหลด..." : "เพิ่มภาพกิจกรรม"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="sr-only"
                    disabled={quickUploading}
                    onChange={(e) => {
                      handleQuickUpload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </Button>
              <Link to="/manage/$courseId" params={{ courseId }} className="text-xs text-primary hover:underline">
                จัดการภาพทั้งหมด →
              </Link>
            </div>
          </div>

          {displayPhotos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-glass-border p-6 text-center text-xs text-muted-foreground print:hidden">
              ยังไม่มีภาพกิจกรรมในหลักสูตรนี้ สามารถกดปุ่ม "เพิ่มภาพกิจกรรม" เพื่ออัปโหลดภาพประกอบรายงาน
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-2 print:gap-4">
              {displayPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-glass-border bg-card p-1.5 transition hover:shadow-brand print:border-gray-300 print:bg-white print:p-2"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-mist">
                    {photo.url ? (
                      <img
                        src={photo.url}
                        alt={photo.caption || "ภาพกิจกรรม"}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                        กำลังโหลดรูป...
                      </div>
                    )}

                    {photo.session_id && (
                      <div className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm print:border print:bg-white print:text-black">
                        {smap.get(photo.session_id)}
                      </div>
                    )}

                    <div className="no-print absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 gap-1 rounded-full text-xs"
                        onClick={() => photo.url && setActivePhoto({ url: photo.url, caption: photo.caption || "" })}
                      >
                        <Maximize2 className="size-3" />
                        ดูขนาดใหญ่
                      </Button>
                    </div>
                  </div>

                  {photo.caption && (
                    <p className="mt-1.5 line-clamp-2 px-1 text-[11px] font-medium text-foreground print:text-black">
                      {photo.caption}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 7. INDIVIDUAL PARTICIPANT ROSTER & ASSESSMENT RECORD */}
        <section className="print-avoid-break">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary print:text-black">
              บัญชีรายชื่อผู้เข้ารับการอบรมและผลการประเมินรายบุคคล (Individual Trainee Roster & Results)
            </h3>
            <div className="flex items-center gap-3">
              <a
                href={`/manage/${courseId}?tab=attendees`}
                className="no-print text-xs font-semibold text-primary hover:underline"
              >
                ⚙ จัดการรายชื่อผู้เรียน (เช็คอิน/ลบ/กู้คืน) →
              </a>
              <span className="text-xs text-muted-foreground print:text-gray-600">
                รวม {rows.length} รายชื่อ
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-glass-border print:border-gray-400">
            <table className="w-full text-xs">
              <thead className="bg-mist font-bold text-foreground print:bg-gray-200 print:text-black">
                <tr className="border-b border-glass-border text-center print:border-gray-400">
                  <th className="w-10 px-2 py-2">ลำดับ</th>
                  <th className="px-3 py-2 text-left">ชื่อ-นามสกุล</th>
                  <th className="px-2 py-2 text-left">ตำแหน่ง</th>
                  <th className="px-2 py-2 text-left">ฝ่าย / แผนก</th>
                  {data.hasRounds && <th className="px-2 py-2">รอบ</th>}
                  <th className="px-2 py-2">รูปแบบ</th>
                  <th className="px-2 py-2">บทเรียน</th>
                  <th className="px-2 py-2">ก่อนเรียน</th>
                  <th className="px-2 py-2">หลังเรียน</th>
                  <th className="px-2 py-2">ผลประเมิน</th>
                  <th className="px-2 py-2">เลขที่ใบประกาศ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border print:divide-gray-300">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-muted-foreground">
                      ไม่พบข้อมูลผู้ลงทะเบียนตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i} className={i % 2 === 1 ? "bg-mist/30 print:bg-gray-50" : ""}>
                      <td className="px-2 py-1.5 text-center text-muted-foreground print:text-gray-600">{i + 1}</td>
                      <td className="px-3 py-1.5 font-medium text-foreground print:text-black">{r.name}</td>
                      <td className="px-2 py-1.5 text-muted-foreground print:text-gray-700">{r.position || "-"}</td>
                      <td className="px-2 py-1.5 text-[11px] text-muted-foreground print:text-gray-700">
                        {r.division} · {r.department}
                      </td>
                      {data.hasRounds && (
                        <td className="px-2 py-1.5 text-center text-[11px]">{r.round}</td>
                      )}
                      <td className="px-2 py-1.5 text-center">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.onsite ? "bg-mint/20 text-primary-deep" : "bg-primary/10 text-primary"} print:bg-transparent print:text-black`}>
                          {modeLabel(r)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center text-muted-foreground">
                        {r.lessons}/{r.totalLessons}
                      </td>
                      <td className="px-2 py-1.5 text-center font-medium">
                        {r.pre != null ? `${r.pre}%` : "-"}
                      </td>
                      <td className="px-2 py-1.5 text-center font-bold text-primary-deep print:text-black">
                        {r.post != null ? `${r.post}%` : "-"}
                      </td>
                      <td className="px-2 py-1.5 text-center font-semibold">
                        {r.passed ? (
                          <span className="inline-flex items-center gap-0.5 text-mint-deep print:text-black">
                            ✓ ผ่าน
                          </span>
                        ) : (
                          <span className="text-muted-foreground print:text-gray-600">
                            ยังไม่ผ่าน
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center font-mono text-[10px] text-muted-foreground print:text-gray-800">
                        {r.certNo || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 8. OFFICIAL SIGNATURES & APPROVAL SECTION */}
        <section className="print-avoid-break mt-8 border-t-2 border-primary/30 pt-6 print:border-t-2 print:border-black print:pt-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 print:grid-cols-3">
            
            {/* Box 1: Instructor / Reporter */}
            <div className="flex flex-col items-center justify-between rounded-xl border border-glass-border bg-mist/20 p-4 text-center print:border-gray-400 print:bg-white">
              <div className="text-xs font-bold text-primary-deep print:text-black">ผู้รายงานผลการอบรม</div>
              <div className="my-3 flex h-14 items-center justify-center">
                {instructorSigUrl ? (
                  <img src={instructorSigUrl} alt="ลายเซ็นวิทยากร" className="max-h-full max-w-40 object-contain" />
                ) : (
                  <div className="w-36 border-b border-dashed border-gray-400" />
                )}
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground print:text-black">
                  ({course.instructor_name || "......................................................."})
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground print:text-gray-600">
                  {course.instructor_title || "วิทยากรประจำหลักสูตร"}
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground print:text-gray-600">
                  วันที่ .......... / .......... / ..........
                </div>
              </div>
            </div>

            {/* Box 2: Supervisor / Coordinator */}
            <div className="flex flex-col items-center justify-between rounded-xl border border-glass-border bg-mist/20 p-4 text-center print:border-gray-400 print:bg-white">
              <div className="text-xs font-bold text-primary-deep print:text-black">ผู้ตรวจรับรองรายงาน</div>
              <div className="my-3 flex h-14 items-center justify-center">
                <div className="w-36 border-b border-dashed border-gray-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground print:text-black">
                  (.......................................................)
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground print:text-gray-600">
                  หัวหน้า{course.department_subtitle || "ศูนย์พัฒนาศักยภาพบุคลากร"}
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground print:text-gray-600">
                  วันที่ .......... / .......... / ..........
                </div>
              </div>
            </div>

            {/* Box 3: Director / Approver */}
            <div className="flex flex-col items-center justify-between rounded-xl border border-glass-border bg-mist/20 p-4 text-center print:border-gray-400 print:bg-white">
              <div className="text-xs font-bold text-primary-deep print:text-black">ผู้อนุมัติผลการฝึกอบรม</div>
              <div className="my-3 flex h-14 items-center justify-center">
                <div className="w-36 border-b border-dashed border-gray-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground print:text-black">
                  (.......................................................)
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground print:text-gray-600">
                  ผู้อำนวยการโรงพยาบาลโอเวอร์บรุ๊ค
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground print:text-gray-600">
                  วันที่ .......... / .......... / ..........
                </div>
              </div>
            </div>

          </div>
          <div className="mt-4 text-center text-[10px] text-muted-foreground print:text-gray-500">
            เอกสารสรุปผลการประเมินโครงการฝึกอบรมและพัฒนาศักยภาพบุคลากร ออกโดยระบบอัตโนมัติ โรงพยาบาลโอเวอร์บรุ๊ค
          </div>
        </section>

      </div>

      {/* Lightbox Modal */}
      <Dialog open={!!activePhoto} onOpenChange={() => setActivePhoto(null)}>
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-base font-semibold">
              {activePhoto?.caption || "ภาพกิจกรรมการอบรม"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <img
              src={activePhoto?.url}
              alt={activePhoto?.caption || ""}
              className="max-h-[75vh] w-full rounded-xl object-contain bg-black/5"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
