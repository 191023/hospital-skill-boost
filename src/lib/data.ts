import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CourseProgress = {
  id: string;
  course_id: string;
  user_id: string;
  title: string;
  course_title: string;
  category: string | null;
  hours: number | null;
  cover_url: string | null;
  description: string | null;
  pass_score: number;
  training_year: number;
  session_id: string | null;
  round_no: number | null;
  starts_at: string | null;
  has_sessions: boolean;
  require_pretest: boolean;
  pre_done: boolean;
  attended: boolean;
  total_lessons: number;
  lessons_done: number;
  lessonCount: number;
  done: number;
  pct: number;
  require_posttest: boolean;
  post_done: boolean;
  require_survey: boolean;
  survey_done: boolean;
  issue_certificate: boolean;
  has_cert: boolean;
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
      const { data, error } = await supabase.rpc("get_my_enrollments");
      if (error || !data) return [];
      return data.map((r) => {
        const pct = r.total_lessons ? Math.round((r.lessons_done / r.total_lessons) * 100) : 0;
        return {
          id: r.course_id,
          course_id: r.course_id,
          user_id: userId!,
          title: r.course_title,
          course_title: r.course_title,
          category: r.category,
          hours: r.hours,
          cover_url: r.cover_url,
          description: r.description,
          pass_score: r.pass_score,
          training_year: r.training_year,
          session_id: r.session_id,
          round_no: r.round_no,
          starts_at: r.starts_at,
          has_sessions: r.has_sessions,
          require_pretest: r.require_pretest,
          pre_done: r.pre_done,
          attended: r.attended,
          total_lessons: r.total_lessons,
          lessons_done: r.lessons_done,
          lessonCount: r.total_lessons,
          done: r.lessons_done,
          pct,
          require_posttest: r.require_posttest,
          post_done: r.post_done,
          require_survey: r.require_survey,
          survey_done: r.survey_done,
          issue_certificate: r.issue_certificate,
          has_cert: r.has_cert,
          pre: r.pre_score != null ? Number(r.pre_score) : undefined,
          post: r.post_score != null ? Number(r.post_score) : undefined,
          passed: r.has_cert,
          certId: r.cert_id ?? undefined,
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
