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

export type CourseStatus = "not_started" | "in_progress" | "completed";

export type NextAction = {
  label: string;
  tone: "mint" | "primary" | "amber";
  icon?: string;
  href: string;
};

export type AssignedCourse = {
  id: string;
  course_id: string;
  title: string;
  course_title: string;
  category: string | null;
  hours: number | null;
  cover_url: string | null;
  description: string | null;
  pass_score: number;
  training_year: number;
  training_type: string; // 'classroom' | 'online'
  audience: string; // 'all' | 'restricted'
  isMandatoryForDepartment: boolean;
  enrolled: boolean;
  status: CourseStatus;
  pct: number;
  session_id: string | null;
  round_no: number | null;
  starts_at: string | null;
  has_sessions: boolean;
  require_pretest: boolean;
  pre_done: boolean;
  attended: boolean;
  total_lessons: number;
  lessons_done: number;
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
  action: NextAction;
};

export function getCourseAction(c: {
  id: string;
  has_cert: boolean;
  certId?: string | undefined;
  has_sessions: boolean;
  session_id: string | null;
  require_pretest: boolean;
  pre_done: boolean;
  attended: boolean;
  training_type?: string;
  total_lessons: number;
  lessons_done: number;
  require_posttest: boolean;
  post_done: boolean;
  require_survey: boolean;
  survey_done: boolean;
  enrolled: boolean;
}): NextAction {
  if (c.has_cert) {
    return {
      label: "ดูใบประกาศนียบัตร",
      tone: "mint",
      icon: "🎓",
      href: c.certId ? `/certificates/${c.certId}` : `/courses/${c.id}`,
    };
  }
  const isClassroom = (c.training_type || "classroom") === "classroom";
  if (!c.enrolled) {
    if (isClassroom && c.has_sessions) {
      return {
        label: "เลือกรอบการอบรม",
        tone: "amber",
        icon: "🗓️",
        href: `/courses/${c.id}`,
      };
    }
    return {
      label: "เริ่มเข้าอบรมทันที",
      tone: "primary",
      icon: "🚀",
      href: `/courses/${c.id}`,
    };
  }
  if (isClassroom && c.has_sessions && !c.session_id) {
    return {
      label: "เลือกรอบการอบรม",
      tone: "amber",
      icon: "🗓️",
      href: `/courses/${c.id}`,
    };
  }
  if (c.require_pretest && !c.pre_done) {
    return {
      label: "ทำแบบทดสอบก่อนเรียน (Pre-test)",
      tone: "amber",
      icon: "✍️",
      href: `/courses/${c.id}/test/pre`,
    };
  }
  if (isClassroom && c.has_sessions && !c.attended) {
    return {
      label: "รอสแกนเช็คชื่อเข้าห้องอบรม",
      tone: "primary",
      icon: "📍",
      href: `/courses/${c.id}`,
    };
  }
  if (c.total_lessons > 0 && c.lessons_done < c.total_lessons) {
    return {
      label: `เรียนต่อ (${c.lessons_done}/${c.total_lessons} บท)`,
      tone: "primary",
      icon: "📖",
      href: `/courses/${c.id}`,
    };
  }
  if (c.require_posttest && !c.post_done) {
    return {
      label: "ทำแบบทดสอบหลังเรียน (Post-test)",
      tone: "amber",
      icon: "✍️",
      href: `/courses/${c.id}/test/post`,
    };
  }
  if (c.require_survey && !c.survey_done) {
    return {
      label: "ทำแบบประเมินความพึงพอใจ",
      tone: "primary",
      icon: "📋",
      href: `/courses/${c.id}`,
    };
  }
  return {
    label: "เข้าสู่หลักสูตร",
    tone: "primary",
    icon: "👉",
    href: `/courses/${c.id}`,
  };
}

export function useAssignedCourses(userId?: string) {
  return useQuery({
    queryKey: ["assigned-courses", userId],
    enabled: !!userId,
    queryFn: async (): Promise<{
      courses: AssignedCourse[];
      stats: {
        total: number;
        notStarted: number;
        inProgress: number;
        completed: number;
        totalHoursCompleted: number;
        overallPct: number;
      };
    }> => {
      // 1. Fetch published courses accessible to user (RLS automatically scopes to all + user department)
      const { data: rawCourses, error: coursesError } = await supabase
        .from("courses")
        .select("*, lessons(id, deleted_at), questions(id, deleted_at), course_sessions(id, deleted_at)")
        .eq("published", true)
        .is("deleted_at", null)
        .order("training_year", { ascending: false })
        .order("created_at", { ascending: false });

      if (coursesError || !rawCourses) {
        return {
          courses: [],
          stats: { total: 0, notStarted: 0, inProgress: 0, completed: 0, totalHoursCompleted: 0, overallPct: 0 },
        };
      }

      // 2. Fetch user's enrollments and timeline progress
      const { data: enrollmentsData } = await supabase.rpc("get_my_enrollments");
      const enrMap = new Map<string, CourseProgress>();
      if (enrollmentsData) {
        for (const r of enrollmentsData) {
          const pct = r.has_cert
            ? 100
            : r.total_lessons
            ? Math.min(100, Math.round((r.lessons_done / r.total_lessons) * 100))
            : 0;
          enrMap.set(r.course_id, {
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
          });
        }
      }

      // 3. Merge courses with enrollments
      const courses: AssignedCourse[] = rawCourses.map((c) => {
        const enr = enrMap.get(c.id);
        const enrolled = !!enr;
        const isClassroom = (c.training_type || "classroom") === "classroom";
        const activeSessions = Array.isArray(c.course_sessions)
          ? (c.course_sessions as { id: string; deleted_at?: string | null }[]).filter((s) => !s.deleted_at)
          : [];
        const activeLessons = Array.isArray(c.lessons)
          ? (c.lessons as { id: string; deleted_at?: string | null }[]).filter((l) => !l.deleted_at)
          : [];
        const activeQuestions = Array.isArray(c.questions)
          ? (c.questions as { id: string; deleted_at?: string | null }[]).filter((q) => !q.deleted_at)
          : [];

        const hasSessions = isClassroom && (enr ? enr.has_sessions : activeSessions.length > 0);
        const totalLessons = enr ? enr.total_lessons : activeLessons.length;
        const hasQuestions = enr
          ? enr.require_pretest || enr.require_posttest
          : activeQuestions.length > 0 || (c.require_pretest ?? true) || (c.require_posttest ?? true);
        const requirePretest = enr ? enr.require_pretest : (c.require_pretest ?? true) && hasQuestions;
        const requirePosttest = enr ? enr.require_posttest : (c.require_posttest ?? true) && hasQuestions;

        const has_cert = enr?.has_cert ?? false;
        const pre_done = enr?.pre_done ?? false;
        const attended = !isClassroom || (enr?.attended ?? false);
        const lessons_done = enr?.lessons_done ?? 0;
        const post_done = enr?.post_done ?? false;
        const survey_done = enr?.survey_done ?? false;
        const session_id = enr?.session_id ?? null;
        const round_no = enr?.round_no ?? null;
        const starts_at = enr?.starts_at ?? null;

        // Determine status
        let status: CourseStatus = "not_started";
        if (has_cert) {
          status = "completed";
        } else if (enrolled) {
          const hasActivity = attended || pre_done || lessons_done > 0 || post_done || survey_done || !!session_id;
          status = hasActivity ? "in_progress" : "not_started";
        } else {
          status = "not_started";
        }

        const pct = enr ? enr.pct : 0;
        const isMandatoryForDepartment = c.audience === "restricted";

        const action = getCourseAction({
          id: c.id,
          has_cert,
          certId: enr?.certId,
          has_sessions: hasSessions,
          session_id,
          require_pretest: requirePretest,
          pre_done,
          attended,
          training_type: c.training_type || "classroom",
          total_lessons: totalLessons,
          lessons_done,
          require_posttest: requirePosttest,
          post_done,
          require_survey: c.require_survey ?? false,
          survey_done,
          enrolled,
        });

        return {
          id: c.id,
          course_id: c.id,
          title: c.title,
          course_title: c.title,
          category: c.category,
          hours: c.hours,
          cover_url: c.cover_url,
          description: c.description,
          pass_score: c.pass_score,
          training_year: c.training_year,
          training_type: c.training_type || "classroom",
          audience: c.audience || "all",
          isMandatoryForDepartment,
          enrolled,
          status,
          pct,
          session_id,
          round_no,
          starts_at,
          has_sessions: hasSessions,
          require_pretest: requirePretest,
          pre_done,
          attended,
          total_lessons: totalLessons,
          lessons_done,
          require_posttest: requirePosttest,
          post_done,
          require_survey: c.require_survey ?? false,
          survey_done,
          issue_certificate: c.issue_certificate ?? true,
          has_cert,
          pre: enr?.pre,
          post: enr?.post,
          passed: has_cert,
          certId: enr?.certId,
          action,
        };
      });

      const total = courses.length;
      const notStarted = courses.filter((c) => c.status === "not_started").length;
      const inProgress = courses.filter((c) => c.status === "in_progress").length;
      const completed = courses.filter((c) => c.status === "completed").length;
      const totalHoursCompleted = courses
        .filter((c) => c.status === "completed")
        .reduce((sum, c) => sum + Number(c.hours ?? 0), 0);
      const overallPct = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        courses,
        stats: {
          total,
          notStarted,
          inProgress,
          completed,
          totalHoursCompleted,
          overallPct,
        },
      };
    },
  });
}

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

export async function fileUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const { data } = await supabase.storage
    .from("course-files")
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function thaiDate(d: string) {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}
