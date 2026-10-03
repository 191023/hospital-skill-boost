import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CourseProgress = {
  id: string;
  title: string;
  category: string | null;
  hours: number | null;
  cover_url: string | null;
  description: string | null;
  pass_score: number;
  training_year: number;
  lessonCount: number;
  done: number;
  pct: number;
  pre?: number | undefined;
  post?: number | undefined;
  passed: boolean;
  certId?: string | undefined;
};

export function useMyCourses(userId?: string) {
  return useQuery({
    queryKey: ["my-courses", userId],
    enabled: !!userId,
    queryFn: async (): Promise<CourseProgress[]> => {
      const { data: enr } = await supabase
        .from("enrollments")
        .select("course_id, courses(id,title,category,hours,cover_url,description,pass_score,training_year, lessons(id))")
        .eq("user_id", userId!);
      const [{ data: prog }, { data: att }, { data: certs }] = await Promise.all([
        supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId!),
        supabase.from("test_attempts").select("course_id,kind,percent,passed,created_at").eq("user_id", userId!).order("created_at"),
        supabase.from("certificates").select("id,course_id").eq("user_id", userId!),
      ]);
      const doneSet = new Set((prog ?? []).map((p) => p.lesson_id));
      return (enr ?? [])
        .filter((e) => e.courses)
        .map((e) => {
          const c = e.courses!;
          const lessons = (c.lessons ?? []) as { id: string }[];
          const done = lessons.filter((l) => doneSet.has(l.id)).length;
          const mine = (att ?? []).filter((a) => a.course_id === c.id);
          const pre = mine.find((a) => a.kind === "pre");
          const posts = mine.filter((a) => a.kind === "post");
          const bestPost = posts.length ? Math.max(...posts.map((p) => Number(p.percent))) : undefined;
          const cert = (certs ?? []).find((x) => x.course_id === c.id);
          return {
            id: c.id,
            title: c.title,
            category: c.category,
            hours: c.hours,
            cover_url: c.cover_url,
            description: c.description,
            pass_score: c.pass_score,
            training_year: c.training_year,
            lessonCount: lessons.length,
            done,
            pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0,
            pre: pre ? Number(pre.percent) : undefined,
            post: bestPost,
            passed: !!cert,
            certId: cert?.id,
          };
        });
    },
  });
}

export const kindLabel: Record<string, string> = { video: "วิดีโอ", text: "บทความ", pdf: "เอกสาร PDF" };

export function youtubeEmbed(url?: string | null) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export function thaiDate(d: string) {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}
