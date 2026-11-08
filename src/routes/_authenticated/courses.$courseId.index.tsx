import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { kindLabel } from "@/lib/data";
import { Bar } from "@/components/AppShell";
import { coverFor } from "@/components/Brand";
import { SurveyForm } from "@/components/Survey";
import { useSessions } from "@/components/Sessions";
import { CourseSessionSelection } from "@/components/CourseSessionSelection";
import { Lock, CheckCircle2, ArrowRight, Sparkles, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileUrl } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/courses/$courseId/")({
  head: () => ({ meta: [
    { title: "รายละเอียดหลักสูตร — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "รายละเอียดหลักสูตรสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:title", content: "รายละเอียดหลักสูตร — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "รายละเอียดหลักสูตรสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CoursePage,
});

function useCourseState(courseId: string, userId?: string) {
  return useQuery({
    queryKey: ["course", courseId, userId],
    enabled: !!userId,
    staleTime: 0,
    queryFn: async () => {
      const [{ data: course }, { data: lessons }, { data: enr }, { data: prog }, { data: att }, { data: cert }, { data: qs }, { data: atd }, { data: surveyRes }] = await Promise.all([
        supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
        supabase.from("lessons").select("id,title,kind,position").eq("course_id", courseId).order("position"),
        supabase.from("enrollments").select("id,session_id").eq("course_id", courseId).eq("user_id", userId!).maybeSingle(),
        supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId!),
        supabase.from("test_attempts").select("*").eq("course_id", courseId).eq("user_id", userId!).order("created_at"),
        supabase.from("certificates").select("id").eq("course_id", courseId).eq("user_id", userId!).maybeSingle(),
        supabase.rpc("get_test_questions", { _course: courseId }),
        supabase.from("attendance").select("id").eq("course_id", courseId).eq("user_id", userId!).maybeSingle(),
        supabase.from("survey_responses").select("id").eq("course_id", courseId).eq("user_id", userId!).maybeSingle(),
      ]);
      const done = new Set((prog ?? []).map((p) => p.lesson_id));
      const ls = lessons ?? [];
      const pre = (att ?? []).find((a) => a.kind === "pre");
      const posts = (att ?? []).filter((a) => a.kind === "post");
      return {
        course,
        lessons: ls,
        done,
        enrolled: !!enr,
        sessionId: enr?.session_id ?? null,
        attended: !!atd,
        pre,
        posts,
        cert,
        surveyDone: !!surveyRes,
        hasQuestions: (qs ?? []).length > 0,
        allDone: ls.length > 0 && ls.every((l) => done.has(l.id)),
      };
    },
  });
}

function CoursePage() {
  const { courseId } = Route.useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data, isLoading } = useCourseState(courseId, me?.id);
  const { data: sessions = [] } = useSessions(courseId);

  const { data: publicDocs = [] } = useQuery({
    queryKey: ["course-public-docs", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_documents")
        .select("*")
        .eq("course_id", courseId)
        .eq("visibility", "public")
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const joined = useRef(false);
  useEffect(() => {
    if (!data?.course || !me || data.enrolled || joined.current) return;
    if (new URLSearchParams(window.location.search).get("join") !== "1") return;
    joined.current = true;
    sessionStorage.removeItem("after-auth");
    // Check if course has sessions before enrolling
    supabase.from("course_sessions").select("id").eq("course_id", courseId).limit(1).then(({ data: sess }) => {
      if (sess && sess.length > 0) {
        toast.info("กรุณาเลือกรอบการอบรมที่ต้องการเพื่อลงทะเบียน", { duration: 6000 });
        const el = document.getElementById("course-sessions-section");
        if (el) el.scrollIntoView({ behavior: "smooth" });
        return;
      }
      // No sessions: direct enrollment
      supabase.from("enrollments").insert({ course_id: courseId, user_id: me.id }).then(({ error }) => {
        if (error) { toast.error("ลงทะเบียนไม่สำเร็จ: " + error.message); return; }
        toast.success("ลงทะเบียนหลักสูตรเรียบร้อย");
        qc.invalidateQueries();
      });
    });
  }, [data, me, courseId, qc]);

  // Server re-checks every requirement; this only asks it to issue when the learner may be done.
  const tried = useRef("");
  useEffect(() => {
    if (!data?.course || !data.enrolled || data.cert || !data.course.issue_certificate) return;
    if (sessions.length > 0 && !data.attended) return;
    if (data.lessons.length && !data.allDone) return;
    const key = `${data.done.size}-${data.posts.length}`;
    if (tried.current === key) return;
    tried.current = key;
    supabase.rpc("try_issue_certificate", { _course: courseId }).then(({ data: id }) => {
      if (id) { toast.success("ได้รับใบประกาศนียบัตรแล้ว 🎉"); qc.invalidateQueries({ queryKey: ["course", courseId] }); }
    });
  }, [data, sessions, courseId, qc]);

  if (isLoading || !data) return <div className="text-muted-foreground">กำลังโหลด...</div>;
  const { course, lessons, done, enrolled, pre, posts, cert, hasQuestions, allDone } = data;
  if (!course) return <div className="glass rounded-3xl p-10 text-center">ไม่พบหลักสูตร</div>;

  const isClassroomCourse = (course.training_type || "classroom") === "classroom";
  const hasSelectedSession = !isClassroomCourse || (sessions.length > 0 ? !!data.sessionId : true);
  const isCheckedIn = !isClassroomCourse || data.attended;

  const usePre = hasQuestions && course.require_pretest;
  const usePost = hasQuestions && course.require_posttest;
  const needPre = usePre && !pre;
  const bestPost = posts.length ? Math.max(...posts.map((p) => Number(p.percent))) : undefined;
  const pct = lessons.length ? Math.round((lessons.filter((l) => done.has(l.id)).length / lessons.length) * 100) : 0;

  async function enroll() {
    if (!me) return;
    if (isClassroomCourse && sessions.length > 0) {
      toast.info("กรุณาเลือกรอบการอบรมที่คุณต้องการเข้าร่วม", { duration: 4000 });
      document.getElementById("course-sessions-section")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const { error } = await supabase.from("enrollments").insert({ course_id: courseId, user_id: me.id });
    if (error) { toast.error(error.message); return; }
    toast.success("ลงทะเบียนเรียบร้อย");
    qc.invalidateQueries();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div className="glass overflow-hidden rounded-3xl">
          <img src={coverFor(course.id, course.cover_url)} alt="" className="aspect-[21/9] w-full object-cover" />
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isClassroomCourse ? "bg-amber/15 text-amber" : "bg-primary/15 text-primary"}`}>
                {isClassroomCourse ? "🏢 อบรมในห้องประชุม (On-site)" : "🌐 อบรมออนไลน์ (Online)"}
              </span>
              <span className="text-[11px] font-semibold text-primary">{course.category || "ทั่วไป"} · {course.hours} ชั่วโมง · เกณฑ์ผ่าน {course.pass_score}%</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold">{course.title}</h1>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{course.description}</p>
            {enrolled && <div className="mt-4"><Bar value={pct} tone="gradient" /><div className="mt-1 text-xs text-muted-foreground">ความคืบหน้า {pct}%</div></div>}
          </div>
        </div>

        {/* 3D Simulation Banner for CPR/Emergency Simulation Courses */}
        {(course.title.includes("CPR") || course.title.includes("AED") || course.title.includes("ช่วยฟื้นคืนชีพ") || course.id === "b1000000-0000-4000-8000-000000000001") && (
          <div className="glass overflow-hidden rounded-3xl p-6 border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-transparent shadow-brand">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm">
                    3D
                  </span>
                  <div className="font-bold text-base text-foreground flex items-center gap-1.5">
                    แบบจำลอง 3 มิติ: ลำดับขั้นตอนการช่วยชีวิต CPR & AED
                    <Sparkles className="h-4 w-4 text-emerald-500 inline" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  สัมผัสประสบการณ์เรียนรู้เสมือนจริง หมุนกล้อง 360° ควบคุมไทม์ไลน์ และฝึกจังหวะกดหน้าอก 110 ครั้ง/นาที
                </p>
              </div>
              <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm shrink-0">
                <Link to="/simulation-cpr">
                  เข้าสู่แบบจำลอง 3D →
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Training Rounds & Overview (Classroom courses only) */}
        {isClassroomCourse && sessions.length > 0 && (
          <div id="course-sessions-section">
            <CourseSessionSelection
              courseId={courseId}
              currentSessionId={data.sessionId}
              isEnrolled={enrolled}
              isLocked={data.attended}
            />
          </div>
        )}

        {/* Requirement 1: Prominent Pre-test section after selecting training round */}
        {enrolled && hasSelectedSession && usePre && !pre && (
          <div className="glass rounded-3xl p-6 border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-brand space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm">
                    ก
                  </span>
                  <span className="rounded-full bg-amber/20 px-2.5 py-0.5 text-xs font-semibold text-amber">
                    จำเป็นต้องทำก่อน{isClassroomCourse ? "เข้าอบรม" : "เข้าเรียนบทเรียน"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground">แบบทดสอบก่อนการอบรม (Pre-test)</h3>
                <p className="text-xs text-muted-foreground">
                  {isClassroomCourse
                    ? "คุณเลือกรอบการอบรมเรียบร้อยแล้ว กรุณาทำแบบทดสอบก่อนเรียนเพื่อวัดระดับความรู้พื้นฐานก่อนเข้าร่วมกิจกรรมในห้องอบรม"
                    : "กรุณาทำแบบทดสอบก่อนเรียนเพื่อวัดระดับความรู้พื้นฐาน ระบบจะปลดล็อกบทเรียนทันทีหลังจากทำแบบทดสอบเสร็จสิ้น"}
                </p>
              </div>
              <Link
                to="/courses/$courseId/test/$kind"
                params={{ courseId, kind: "pre" }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand hover:opacity-95 transition-all"
              >
                <span>เริ่มทำ Pre-test ตอนนี้</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        )}

        {enrolled && hasSelectedSession && usePre && pre && !isCheckedIn && isClassroomCourse && (
          <div className="glass rounded-3xl p-5 border border-mint/40 bg-mint/5 flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-mint/20 text-mint font-bold">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-foreground">ทำแบบทดสอบก่อนเรียน (Pre-test) เรียบร้อยแล้ว</div>
              <div className="text-xs text-muted-foreground">
                คะแนนที่ได้ {pre.score}/{pre.total} ข้อ ({pre.percent}%) · รอสแกน QR Code หน้าห้องอบรมเพื่อเช็คชื่อเข้าเรียนและปลดล็อกเนื้อหา
              </div>
            </div>
          </div>
        )}

        {enrolled && usePre && pre && !isClassroomCourse && (
          <div className="glass rounded-3xl p-5 border border-mint/40 bg-mint/5 flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-mint/20 text-mint font-bold">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-foreground">ทำแบบทดสอบก่อนเรียน (Pre-test) เรียบร้อยแล้ว</div>
              <div className="text-xs text-muted-foreground">
                คะแนนที่ได้ {pre.score}/{pre.total} ข้อ ({pre.percent}%) · บทเรียนด้านล่างปลดล็อกพร้อมให้เข้าศึกษาได้ทันที
              </div>
            </div>
          </div>
        )}

        {/* Prominent Post-test callout when lessons are done and post-test is ready */}
        {enrolled && isCheckedIn && allDone && usePost && !cert && (bestPost === undefined || bestPost < course.pass_score) && (
          <div className="glass rounded-3xl p-6 border-2 border-mint/40 bg-gradient-to-br from-mint/15 via-mint/5 to-transparent shadow-brand space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-xl bg-mint text-primary-foreground text-xs font-bold shadow-sm">
                    ข
                  </span>
                  <span className="rounded-full bg-mint/20 px-2.5 py-0.5 text-xs font-semibold text-mint">
                    เรียนครบทุกบทแล้ว · พร้อมทำแบบทดสอบ
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground">แบบทดสอบหลังการอบรม (Post-test)</h3>
                <p className="text-xs text-muted-foreground">
                  {bestPost !== undefined
                    ? `คะแนนครั้งก่อนหน้า ${bestPost}% (เกณฑ์ผ่าน ${course.pass_score}%) ท่านสามารถทำแบบทดสอบใหม่เพื่อปรับปรุงคะแนนและรับใบประกาศนียบัตร`
                    : `ท่านศึกษาบทเรียนครบถ้วนแล้ว กรุณาทำแบบทดสอบวัดผลหลังเรียน (เกณฑ์ผ่าน ${course.pass_score}%) เพื่อประเมินผลและรับใบประกาศนียบัตร`}
                </p>
              </div>
              <Link
                to="/courses/$courseId/test/$kind"
                params={{ courseId, kind: "post" }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-mint px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand hover:opacity-95 transition-all"
              >
                <span>{bestPost !== undefined ? "ทำแบบทดสอบอีกครั้ง" : "เริ่มทำ Post-test ตอนนี้"}</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Course Contents Section (Gated for classroom courses until checked in) */}
        <div className="glass rounded-3xl p-6">
          <h2 className="text-lg font-bold">เนื้อหาหลักสูตร</h2>

          {/* Classroom gating notice */}
          {isClassroomCourse && enrolled && !isCheckedIn && (
            <div className="mt-3 rounded-2xl border border-amber/30 bg-amber/10 p-4 text-xs">
              <div className="flex items-center gap-2 font-bold text-sm text-amber">
                <Lock className="size-4" />
                <span>รอสแกน QR Code เช็คชื่อเพื่อปลดล็อกเนื้อหา</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                เนื้อหาบทเรียน, แบบทดสอบหลังเรียน (Post-test) และแบบประเมินหลักสูตร จะปลดล็อกให้เข้าถึงได้หลังจากท่านสแกน QR Code เช็คชื่อที่จุดลงทะเบียนหน้าห้องอบรม
              </p>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {usePre && (
              <Step
                n="ก"
                title="แบบทดสอบก่อนเรียน (Pre-test)"
                sub={
                  pre
                    ? `ทำแล้ว · ${pre.score}/${pre.total} (${pre.percent}%)`
                    : isClassroomCourse
                    ? "วัดความรู้ก่อนเริ่มเรียน (ทำได้ทันทีหลังเลือกรอบ)"
                    : "วัดความรู้ก่อนเริ่มเรียน (ทำได้ทันทีหลังลงทะเบียน)"
                }
                badge={pre ? "เสร็จสิ้น" : "เริ่ม"}
                done={!!pre}
                to={enrolled && !pre ? { kind: "pre" } : undefined}
                courseId={courseId}
              />
            )}
            {lessons.map((l, i) => {
              const locked = !enrolled || !isCheckedIn || needPre;
              let lockText = "";
              if (!enrolled) lockText = "ต้องลงทะเบียนก่อน";
              else if (!isCheckedIn && isClassroomCourse) lockText = "รอเช็คชื่อเข้าห้องอบรม";
              else if (needPre) lockText = "ต้องทำ Pre-test ก่อน";

              return locked ? (
                <div key={l.id} className="flex items-center gap-3 rounded-2xl border border-glass-border bg-glass p-4 opacity-60">
                  <Num n={i + 1} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{l.title}</div>
                    <div className="text-[11px] text-muted-foreground">{kindLabel[l.kind]} · {lockText}</div>
                  </div>
                  <span className="text-xs">🔒</span>
                </div>
              ) : (
                <Link key={l.id} to="/courses/$courseId/lesson/$lessonId" params={{ courseId, lessonId: l.id }} className="flex items-center gap-3 rounded-2xl border border-glass-border bg-glass p-4 hover:bg-card">
                  <Num n={i + 1} done={done.has(l.id)} />
                  <div className="flex-1"><div className="text-sm font-medium">{l.title}</div><div className="text-[11px] text-muted-foreground">{kindLabel[l.kind]}</div></div>
                  <span className={`text-[11px] font-semibold ${done.has(l.id) ? "text-mint" : "text-primary"}`}>{done.has(l.id) ? "เรียนแล้ว ✓" : "เรียน →"}</span>
                </Link>
              );
            })}
            {lessons.length === 0 && <div className="text-sm text-muted-foreground">ยังไม่มีบทเรียน</div>}
            {usePost && (
              <Step
                n="ข"
                title="แบบทดสอบหลังเรียน (Post-test)"
                sub={
                  !isCheckedIn && isClassroomCourse
                    ? "ปลดล็อกหลังสแกน QR เช็คชื่อเข้าห้องอบรมและเรียนครบทุกบท"
                    : !allDone
                    ? "เรียนให้ครบทุกบทก่อน"
                    : bestPost !== undefined
                    ? `คะแนนสูงสุด ${bestPost}% · ทำแล้ว ${posts.length} ครั้ง`
                    : `ต้องได้อย่างน้อย ${course.pass_score}%`
                }
                badge={
                  (bestPost !== undefined && bestPost >= course.pass_score) || !!cert
                    ? "ผ่าน"
                    : !isCheckedIn && isClassroomCourse
                    ? "รอเช็คชื่อ"
                    : bestPost !== undefined
                    ? "ทำใหม่"
                    : "เริ่ม"
                }
                done={!!cert || (bestPost !== undefined && bestPost >= course.pass_score)}
                to={enrolled && isCheckedIn && allDone && !needPre && !cert ? { kind: "post" } : undefined}
                courseId={courseId}
              />
            )}
            {course.require_survey && (
              <div
                onClick={() => {
                  if (enrolled && isCheckedIn) {
                    document.getElementById("course-survey-form")?.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className={`flex items-center gap-3 rounded-2xl border p-4 transition-colors ${
                  data.surveyDone
                    ? "border-mint/30 bg-mint/5"
                    : enrolled && isCheckedIn
                    ? "border-primary/40 bg-primary/5 cursor-pointer hover:bg-card"
                    : "border-glass-border bg-glass opacity-60"
                }`}
              >
                <div className={`grid size-8 place-items-center rounded-lg text-xs font-semibold ${data.surveyDone ? "bg-mint text-primary-foreground" : "bg-primary/20 text-primary"}`}>
                  {data.surveyDone ? "✓" : "ค"}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">แบบประเมินหลักสูตร (Survey)</div>
                  <div className="text-[11px] text-muted-foreground">
                    {data.surveyDone
                      ? "ตอบแบบประเมินเรียบร้อยแล้ว"
                      : !isCheckedIn
                      ? "รอเช็คชื่อเข้าห้องอบรม"
                      : "ทำแบบประเมิน (แถบขวามือ) ก่อนรับใบประกาศนียบัตร"}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  data.surveyDone
                    ? "bg-mint/15 text-mint"
                    : enrolled && isCheckedIn
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {data.surveyDone ? "เสร็จสิ้น" : enrolled && isCheckedIn ? "ทำประเมิน →" : "รอก่อน"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="glass rounded-3xl p-6">
          {!enrolled ? (
            <>
              <h3 className="font-bold">เริ่มเรียนหลักสูตรนี้</h3>
              <p className="mt-1 text-sm text-muted-foreground">{lessons.length} บทเรียน · {course.hours} ชั่วโมง</p>
              <button
                onClick={enroll}
                className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-brand"
              >
                {sessions.length > 0 ? "เลือกรอบอบรมเพื่อลงทะเบียน" : "ลงทะเบียนเรียน"}
              </button>
            </>
          ) : (
            <>
              <h3 className="font-bold">ผลการเรียน</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="glass rounded-2xl p-3 shadow-none"><div className="text-[11px] text-muted-foreground">ก่อนเรียน</div><div className="text-xl font-bold">{pre ? `${pre.percent}%` : "-"}</div></div>
                <div className="glass rounded-2xl p-3 shadow-none"><div className="text-[11px] text-muted-foreground">หลังเรียน</div><div className="text-xl font-bold text-mint">{bestPost !== undefined ? `${bestPost}%` : "-"}</div></div>
              </div>
              {cert ? (
                <Link to="/certificates/$certId" params={{ certId: cert.id }} className="mt-4 block w-full rounded-xl bg-mint py-2.5 text-center text-sm font-semibold text-primary-foreground">ดูใบประกาศนียบัตร</Link>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">{course.issue_certificate
                  ? ["เรียนครบทุกบท", usePost && `สอบหลังเรียนได้ ≥ ${course.pass_score}%`, course.require_survey && "ตอบแบบประเมินหลักสูตร"].filter(Boolean).join(" · ") + " เพื่อรับใบประกาศ"
                  : "หลักสูตรนี้ไม่มีการออกใบประกาศนียบัตร"}</p>
              )}
            </>
          )}
        </div>

        {enrolled && sessions.length > 0 && (
          <div className="glass rounded-3xl p-6">
            <h3 className="font-bold">รอบอบรมของคุณ</h3>
            {data.sessionId ? (
              <div className="mt-3 space-y-2">
                {(() => {
                  const mySession = sessions.find((s) => s.id === data.sessionId);
                  return mySession ? (
                    <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3.5">
                      <div className="font-bold text-primary">รอบที่ {mySession.round_no}</div>
                      <div className="mt-1 text-xs text-foreground/90">
                        {mySession.starts_at ? new Date(mySession.starts_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "ยังไม่กำหนดวัน"}
                        {mySession.location ? ` · ${mySession.location}` : ""}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {data.attended ? "✓ เช็คชื่อแล้ว" : "ยังไม่เช็คชื่อ"}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">รอบที่เลือก (ID: {data.sessionId.slice(0, 8)}...)</div>
                  );
                })()}
                {!data.attended && (
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById("course-sessions-section")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="w-full text-center text-xs font-semibold text-primary hover:underline pt-1"
                  >
                    เปลี่ยนรอบ / ดูรายชื่อเพื่อนร่วมรุ่น →
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-amber/40 bg-amber/10 p-3.5 text-xs">
                <div className="font-bold text-amber">ยังไม่ได้เลือกรอบอบรม</div>
                <p className="mt-1 text-muted-foreground">กรุณาเลือกรอบอบรมเพื่อระบุวันเวลาและที่นั่ง</p>
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("course-sessions-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="mt-2 inline-block font-semibold text-primary hover:underline"
                >
                  เลือกรอบอบรมเลย →
                </button>
              </div>
            )}
          </div>
        )}

        {enrolled && isCheckedIn && me && (!usePost || !course.require_survey || allDone) && (
          <div id="course-survey-form">
            <SurveyForm courseId={courseId} userId={me.id} />
          </div>
        )}

        {publicDocs.length > 0 && (
          <div className="glass rounded-3xl p-6">
            <h3 className="font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              เอกสารประกอบการเรียน ({publicDocs.length})
            </h3>
            <div className="mt-3 space-y-2">
              {publicDocs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={async () => {
                    const url = await fileUrl(doc.file_url);
                    if (url) window.open(url, "_blank");
                  }}
                  className="w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-card/60 p-2.5 text-left text-xs hover:bg-card hover:border-primary/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground truncate">{doc.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{doc.file_name}</div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-primary shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Num({ n, done }: { n: number; done?: boolean }) {
  return <div className={`grid size-8 place-items-center rounded-lg text-xs font-semibold ${done ? "bg-mint text-primary-foreground" : "bg-primary/15 text-primary"}`}>{done ? "✓" : n}</div>;
}

function Step({ n, title, sub, badge, done, to, courseId }: { n: string; title: string; sub: string; badge: string; done: boolean; to?: { kind: string } | undefined; courseId: string }) {
  const body = (
    <>
      <div className={`grid size-8 place-items-center rounded-lg text-xs font-semibold ${done ? "bg-mint text-primary-foreground" : "bg-amber/20 text-amber"}`}>{n}</div>
      <div className="flex-1"><div className="text-sm font-semibold">{title}</div><div className="text-[11px] text-muted-foreground">{sub}</div></div>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${done ? "bg-mint/15 text-mint" : "bg-primary text-primary-foreground"}`}>{badge}</span>
    </>
  );
  const cls = "flex items-center gap-3 rounded-2xl border border-amber/30 bg-glass p-4";
  return to ? (
    <Link to="/courses/$courseId/test/$kind" params={{ courseId, kind: to.kind }} className={cls + " hover:bg-card"}>{body}</Link>
  ) : (
    <div className={cls + (done ? "" : " opacity-70")}>{body}</div>
  );
}
