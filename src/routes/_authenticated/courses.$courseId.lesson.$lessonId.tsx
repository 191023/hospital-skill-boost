import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fileUrl, useMe } from "@/lib/auth";
import { kindLabel, youtubeEmbed } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/courses/$courseId/lesson/$lessonId")({
  head: () => ({ meta: [
    { title: "บทเรียน — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "บทเรียนสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:title", content: "บทเรียน — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "บทเรียนสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: LessonPage,
});

function LessonPage() {
  const { courseId, lessonId } = Route.useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const { data } = useQuery({
    queryKey: ["lesson", lessonId, me?.id],
    enabled: !!me,
    queryFn: async () => {
      const [{ data: lesson }, { data: all }, { data: prog }, { data: course }, { data: sess }, { data: att }, { data: preAtt }] = await Promise.all([
        supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle(),
        supabase.from("lessons").select("id,title,position").eq("course_id", courseId).order("position"),
        supabase.from("lesson_progress").select("lesson_id").eq("user_id", me!.id).eq("lesson_id", lessonId),
        supabase.from("courses").select("require_pretest,require_posttest").eq("id", courseId).maybeSingle(),
        supabase.from("course_sessions").select("id").eq("course_id", courseId).limit(1),
        supabase.from("attendance").select("id").eq("course_id", courseId).eq("user_id", me!.id).maybeSingle(),
        supabase.from("test_attempts").select("id").eq("course_id", courseId).eq("user_id", me!.id).eq("kind", "pre").maybeSingle(),
      ]);
      const pdf = lesson?.file_url ? await fileUrl(lesson.file_url) : null;
      const hasSessions = (sess ?? []).length > 0;
      const checkedIn = !hasSessions || !!att;
      const needPre = !!course?.require_pretest && !preAtt;
      const hasPostTest = !!course?.require_posttest;
      return { lesson, all: all ?? [], done: (prog ?? []).length > 0, pdf, checkedIn, needPre, hasPostTest };
    },
  });
  if (!data?.lesson) return <div className="text-muted-foreground">กำลังโหลด...</div>;

  if (!data.checkedIn) {
    return (
      <div className="mx-auto max-w-lg glass rounded-3xl p-8 text-center space-y-4">
        <div className="text-4xl">🔒</div>
        <h1 className="text-xl font-bold">รอเช็คชื่อเข้าห้องอบรม</h1>
        <p className="text-sm text-muted-foreground">
          หลักสูตรนี้ต้องสแกน QR Code เช็คชื่อเข้าห้องอบรมก่อน จึงจะสามารถเปิดดูเนื้อหาบทเรียนได้
        </p>
        <Link to="/courses/$courseId" params={{ courseId }} className="inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          กลับหน้าหลักสูตร
        </Link>
      </div>
    );
  }

  if (data.needPre) {
    return (
      <div className="mx-auto max-w-lg glass rounded-3xl p-8 text-center space-y-4">
        <div className="text-4xl">📝</div>
        <h1 className="text-xl font-bold">ต้องทำแบบทดสอบก่อนเรียน</h1>
        <p className="text-sm text-muted-foreground">
          กรุณาทำแบบทดสอบก่อนเรียน (Pre-test) ให้เรียบร้อยก่อนเริ่มเข้าดูเนื้อหาบทเรียน
        </p>
        <Link to="/courses/$courseId/test/$kind" params={{ courseId, kind: "pre" }} className="inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          ไปทำแบบทดสอบ Pre-test →
        </Link>
      </div>
    );
  }
  const { lesson, all, done, pdf, hasPostTest } = data;
  const idx = all.findIndex((l) => l.id === lessonId);
  const next = all[idx + 1];
  const embed = youtubeEmbed(lesson.video_url);

  async function complete() {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (!done) {
        const { error } = await supabase.from("lesson_progress").insert({ lesson_id: lessonId, user_id: me!.id });
        const isDuplicate = error && (
          error.code === "23505" ||
          error.message?.includes("duplicate key") ||
          error.message?.includes("lesson_progress_user_id_lesson_id_key")
        );
        if (error && !isDuplicate) {
          toast.error(error.message);
          return;
        }
        if (!isDuplicate) {
          toast.success("บันทึกการเรียนแล้ว");
        }
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["lesson", lessonId] }),
        qc.invalidateQueries({ queryKey: ["course", courseId] }),
      ]);
      if (next) {
        nav({ to: "/courses/$courseId/lesson/$lessonId", params: { courseId, lessonId: next.id } });
      } else if (hasPostTest) {
        toast.success("เรียนครบทุกบทแล้ว 🎉 พร้อมทำแบบทดสอบหลังเรียน");
        nav({ to: "/courses/$courseId/test/$kind", params: { courseId, kind: "post" } });
      } else {
        nav({ to: "/courses/$courseId", params: { courseId } });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const buttonLabel = submitting
    ? "กำลังบันทึก..."
    : done
    ? next
      ? "บทถัดไป →"
      : hasPostTest
      ? "ไปทำแบบทดสอบหลังเรียน (Post-test) →"
      : "กลับหน้าหลักสูตร"
    : next
    ? "เรียนจบบทนี้ · ไปบทถัดไป →"
    : hasPostTest
    ? "เรียนจบครบทุกบท · ทำ Post-test →"
    : "เรียนจบบทนี้";

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/courses/$courseId" params={{ courseId }} className="text-sm text-primary">← กลับไปหน้าหลักสูตร</Link>
      <div className="glass mt-4 rounded-3xl p-6">
        <div className="text-[11px] font-semibold text-primary">บทที่ {idx + 1} · {kindLabel[lesson.kind]}</div>
        <h1 className="mt-1 text-2xl font-bold">{lesson.title}</h1>
        {embed && (
          <div className="mt-5 aspect-video overflow-hidden rounded-2xl">
            <iframe src={embed} title={lesson.title} className="h-full w-full" allowFullScreen allow="accelerometer; autoplay; encrypted-media; picture-in-picture" />
          </div>
        )}
        {lesson.video_url && !embed && <a href={lesson.video_url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-primary underline">เปิดวิดีโอ</a>}
        {pdf && (
          <div className="mt-5">
            <iframe src={pdf} title="PDF" className="h-[70vh] w-full rounded-2xl border bg-card" />
            <a href={pdf} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary">ดาวน์โหลด / เปิดในแท็บใหม่</a>
          </div>
        )}
        {lesson.body && <div className="mt-5 whitespace-pre-line leading-relaxed">{lesson.body}</div>}
        <div className="mt-8 flex justify-end">
          <button
            onClick={complete}
            disabled={submitting}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand disabled:opacity-50"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
