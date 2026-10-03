import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { kindLabel } from "@/lib/data";
import { Bar } from "@/components/AppShell";
import { coverFor } from "@/components/Brand";

export const Route = createFileRoute("/_authenticated/courses/$courseId/")({
  head: () => ({ meta: [{ title: "รายละเอียดหลักสูตร — ระบบอบรมออนไลน์" }] }),
  component: CoursePage,
});

export function useCourseState(courseId: string, userId?: string) {
  return useQuery({
    queryKey: ["course", courseId, userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: course }, { data: lessons }, { data: enr }, { data: prog }, { data: att }, { data: cert }, { data: qs }] = await Promise.all([
        supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
        supabase.from("lessons").select("id,title,kind,position").eq("course_id", courseId).order("position"),
        supabase.from("enrollments").select("id").eq("course_id", courseId).eq("user_id", userId!).maybeSingle(),
        supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId!),
        supabase.from("test_attempts").select("*").eq("course_id", courseId).eq("user_id", userId!).order("created_at"),
        supabase.from("certificates").select("id").eq("course_id", courseId).eq("user_id", userId!).maybeSingle(),
        supabase.rpc("get_test_questions", { _course: courseId }),
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
        pre,
        posts,
        cert,
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

  if (isLoading || !data) return <div className="text-muted-foreground">กำลังโหลด...</div>;
  const { course, lessons, done, enrolled, pre, posts, cert, hasQuestions, allDone } = data;
  if (!course) return <div className="glass rounded-3xl p-10 text-center">ไม่พบหลักสูตร</div>;
  const needPre = hasQuestions && !pre;
  const bestPost = posts.length ? Math.max(...posts.map((p) => Number(p.percent))) : undefined;
  const pct = lessons.length ? Math.round((lessons.filter((l) => done.has(l.id)).length / lessons.length) * 100) : 0;

  async function enroll() {
    const { error } = await supabase.from("enrollments").insert({ course_id: courseId, user_id: me!.id });
    if (error) return toast.error(error.message);
    toast.success("ลงทะเบียนเรียบร้อย");
    qc.invalidateQueries();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <div className="glass overflow-hidden rounded-3xl">
          <img src={coverFor(course.id, course.cover_url)} alt="" className="aspect-[21/9] w-full object-cover" />
          <div className="p-6">
            <div className="text-[11px] font-semibold text-primary">{course.category || "ทั่วไป"} · {course.hours} ชั่วโมง · เกณฑ์ผ่าน {course.pass_score}%</div>
            <h1 className="mt-1 text-2xl font-bold">{course.title}</h1>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{course.description}</p>
            {enrolled && <div className="mt-4"><Bar value={pct} tone="gradient" /><div className="mt-1 text-xs text-muted-foreground">ความคืบหน้า {pct}%</div></div>}
          </div>
        </div>

        <div className="glass rounded-3xl p-6">
          <h2 className="text-lg font-bold">เนื้อหาหลักสูตร</h2>
          <div className="mt-4 space-y-3">
            {hasQuestions && (
              <Step n="ก" title="แบบทดสอบก่อนเรียน (Pre-test)" sub={pre ? `ทำแล้ว · ${pre.score}/${pre.total} (${pre.percent}%)` : "วัดความรู้ก่อนเริ่มเรียน"}
                badge={pre ? "เสร็จสิ้น" : "เริ่ม"} done={!!pre}
                to={enrolled && !pre ? { kind: "pre" } : undefined} courseId={courseId} />
            )}
            {lessons.map((l, i) => {
              const locked = !enrolled || needPre;
              return locked ? (
                <div key={l.id} className="flex items-center gap-3 rounded-2xl border border-glass-border bg-glass p-4 opacity-60">
                  <Num n={i + 1} />
                  <div className="flex-1"><div className="text-sm font-medium">{l.title}</div><div className="text-[11px] text-muted-foreground">{kindLabel[l.kind]}</div></div>
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
            {hasQuestions && (
              <Step n="ข" title="แบบทดสอบหลังเรียน (Post-test)"
                sub={!allDone ? "เรียนให้ครบทุกบทก่อน" : bestPost !== undefined ? `คะแนนสูงสุด ${bestPost}% · ทำแล้ว ${posts.length} ครั้ง` : `ต้องได้อย่างน้อย ${course.pass_score}%`}
                badge={cert ? "ผ่าน" : bestPost !== undefined ? "ทำใหม่" : "เริ่ม"} done={!!cert}
                to={enrolled && allDone && !needPre && !cert ? { kind: "post" } : undefined} courseId={courseId} />
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
              <button onClick={enroll} className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-brand">ลงทะเบียนเรียน</button>
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
                <p className="mt-4 text-xs text-muted-foreground">เรียนครบทุกบท และสอบหลังเรียนได้ ≥ {course.pass_score}% เพื่อรับใบประกาศ</p>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Num({ n, done }: { n: number; done?: boolean }) {
  return <div className={`grid size-8 place-items-center rounded-lg text-xs font-semibold ${done ? "bg-mint text-primary-foreground" : "bg-primary/15 text-primary"}`}>{done ? "✓" : n}</div>;
}

function Step({ n, title, sub, badge, done, to, courseId }: { n: string; title: string; sub: string; badge: string; done: boolean; to?: { kind: string }; courseId: string }) {
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
