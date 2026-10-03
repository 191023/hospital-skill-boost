import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fileUrl, useMe } from "@/lib/auth";
import { kindLabel, youtubeEmbed } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/courses/$courseId/lesson/$lessonId")({
  head: () => ({ meta: [{ title: "บทเรียน — ระบบอบรมออนไลน์" }] }),
  component: LessonPage,
});

function LessonPage() {
  const { courseId, lessonId } = Route.useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data } = useQuery({
    queryKey: ["lesson", lessonId, me?.id],
    enabled: !!me,
    queryFn: async () => {
      const [{ data: lesson }, { data: all }, { data: prog }] = await Promise.all([
        supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle(),
        supabase.from("lessons").select("id,title,position").eq("course_id", courseId).order("position"),
        supabase.from("lesson_progress").select("lesson_id").eq("user_id", me!.id).eq("lesson_id", lessonId),
      ]);
      const pdf = lesson?.file_url ? await fileUrl(lesson.file_url) : null;
      return { lesson, all: all ?? [], done: (prog ?? []).length > 0, pdf };
    },
  });
  if (!data?.lesson) return <div className="text-muted-foreground">กำลังโหลด...</div>;
  const { lesson, all, done, pdf } = data;
  const idx = all.findIndex((l) => l.id === lessonId);
  const next = all[idx + 1];
  const embed = youtubeEmbed(lesson.video_url);

  async function complete() {
    if (!done) {
      const { error } = await supabase.from("lesson_progress").insert({ lesson_id: lessonId, user_id: me!.id });
      if (error) return toast.error(error.message);
      toast.success("บันทึกการเรียนแล้ว");
      qc.invalidateQueries();
    }
    if (next) nav({ to: "/courses/$courseId/lesson/$lessonId", params: { courseId, lessonId: next.id } });
    else nav({ to: "/courses/$courseId", params: { courseId } });
  }

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
          <button onClick={complete} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand">
            {done ? (next ? "บทถัดไป →" : "กลับหน้าหลักสูตร") : next ? "เรียนจบบทนี้ · ไปบทถัดไป →" : "เรียนจบบทนี้"}
          </button>
        </div>
      </div>
    </div>
  );
}
