import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMe } from "@/lib/auth";
import { useAssignedCourses, type CourseStatus, type CourseProgress } from "@/lib/data";
import { PageHeader } from "@/components/AppShell";
import { coverFor, toneFor } from "@/components/Brand";
import { CourseTimeline } from "@/components/CourseTimeline";
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  BookOpen,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-courses")({
  head: () => ({
    meta: [
      { title: "หลักสูตรของฉัน — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { name: "description", content: "หลักสูตรของฉันสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:title", content: "หลักสูตรของฉัน — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:description", content: "หลักสูตรของฉันสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyCourses,
});

function MyCourses() {
  const { data: me } = useMe();
  const { data, isLoading } = useAssignedCourses(me?.id);
  const courses = data?.courses ?? [];
  const stats = data?.stats ?? {
    total: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    totalHoursCompleted: 0,
    overallPct: 0,
  };

  const [filter, setFilter] = useState<"all" | CourseStatus>("all");
  const [search, setSearch] = useState("");

  const filteredCourses = courses.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = c.title.toLowerCase().includes(q);
      const matchCat = (c.category ?? "").toLowerCase().includes(q);
      return matchTitle || matchCat;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="การเรียนของฉัน"
        title="หลักสูตรประจำหน่วยงานของฉัน"
        right={
          <div className="flex items-center gap-2">
            <Link
              to="/courses"
              className="glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold hover:border-primary/40 transition-colors"
            >
              <BookOpen className="size-3.5 text-primary" /> คลังหลักสูตรทั้งหมด
            </Link>
          </div>
        }
      />

      {/* Department & Progress Summary Bar */}
      <div className="glass flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl p-5 border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-mint/5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
            <Building2 className="size-3.5" />
            <span>ฝ่าย{me?.division || "ทั่วไป"} · แผนก{me?.department || "ทั่วไป"}</span>
          </div>
          <div className="text-sm font-semibold text-foreground">
            หลักสูตรที่ต้องเข้าอบรมทั้งหมด {stats.total} หลักสูตร
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filter === "all"
                ? "bg-primary text-primary-foreground shadow-brand"
                : "glass text-foreground/70 hover:bg-card"
            }`}
          >
            ทั้งหมด ({stats.total})
          </button>
          <button
            onClick={() => setFilter("not_started")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition flex items-center gap-1 ${
              filter === "not_started"
                ? "bg-rose-600 text-white shadow-sm"
                : "glass text-rose-700 dark:text-rose-400 hover:bg-rose-500/10"
            }`}
          >
            <span className="size-1.5 rounded-full bg-rose-500" />
            ต้องเริ่ม ({stats.notStarted})
          </button>
          <button
            onClick={() => setFilter("in_progress")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition flex items-center gap-1 ${
              filter === "in_progress"
                ? "bg-amber-500 text-white shadow-sm"
                : "glass text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            }`}
          >
            <span className="size-1.5 rounded-full bg-amber-500" />
            กำลังเรียน ({stats.inProgress})
          </button>
          <button
            onClick={() => setFilter("completed")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition flex items-center gap-1 ${
              filter === "completed"
                ? "bg-emerald-600 text-white shadow-sm"
                : "glass text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            <span className="size-1.5 rounded-full bg-emerald-500" />
            ผ่านแล้ว ({stats.completed})
          </button>
        </div>
      </div>

      {isLoading && <div className="text-muted-foreground p-6 text-center">กำลังโหลดข้อมูลหลักสูตร...</div>}

      {!isLoading && filteredCourses.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center space-y-3">
          <div className="text-3xl">📭</div>
          <div className="text-sm font-semibold">ไม่พบหลักสูตรในหมวดนี้</div>
          <p className="text-xs text-muted-foreground">
            {filter !== "all"
              ? "ลองสลับแท็บสถานะ หรือเลือกดูทั้งหมด"
              : "ยังไม่มีหลักสูตรที่เปิดให้หน่วยงานของคุณในขณะนี้"}
          </p>
          {filter !== "all" && (
            <button
              onClick={() => setFilter("all")}
              className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
            >
              ดูทั้งหมด ({stats.total})
            </button>
          )}
        </div>
      )}

      <div className="grid gap-5">
        {filteredCourses.map((c) => {
          const action = c.action;
          const isClassroom = c.training_type === "classroom";

          // Adapt to CourseProgress shape if enrolled to reuse CourseTimeline
          const timelineProgress: CourseProgress = {
            id: c.id,
            course_id: c.id,
            user_id: me?.id || "",
            title: c.title,
            course_title: c.title,
            category: c.category,
            hours: c.hours,
            cover_url: c.cover_url,
            description: c.description,
            pass_score: c.pass_score,
            training_year: c.training_year,
            session_id: c.session_id,
            round_no: c.round_no,
            starts_at: c.starts_at,
            has_sessions: c.has_sessions,
            require_pretest: c.require_pretest,
            pre_done: c.pre_done,
            attended: c.attended,
            total_lessons: c.total_lessons,
            lessons_done: c.lessons_done,
            lessonCount: c.total_lessons,
            done: c.lessons_done,
            pct: c.pct,
            require_posttest: c.require_posttest,
            post_done: c.post_done,
            require_survey: c.require_survey,
            survey_done: c.survey_done,
            issue_certificate: c.issue_certificate,
            has_cert: c.has_cert,
            pre: c.pre,
            post: c.post,
            passed: c.has_cert,
            certId: c.certId,
          };

          return (
            <div
              key={c.id}
              className="glass overflow-hidden rounded-3xl p-4 md:p-5 transition hover:shadow-lg border hover:border-primary/40 space-y-4"
            >
              <div className="flex flex-col lg:flex-row gap-5">
                {/* Cover & Course meta */}
                <div className="flex flex-col sm:flex-row lg:flex-col sm:w-auto lg:w-56 shrink-0 gap-3">
                  <Link
                    to="/courses/$courseId"
                    params={{ courseId: c.id }}
                    className="group relative block overflow-hidden rounded-2xl"
                  >
                    <img
                      src={coverFor(c.id, c.cover_url)}
                      alt={c.title}
                      loading="lazy"
                      className="h-36 sm:h-32 lg:h-36 w-full sm:w-48 lg:w-full rounded-2xl object-cover transition duration-300 group-hover:scale-105"
                    />
                    {c.has_cert ? (
                      <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-emerald-600/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                        <CheckCircle2 className="h-3 w-3" /> ผ่านเกณฑ์แล้ว
                      </span>
                    ) : c.status === "not_started" ? (
                      <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-rose-600/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                        🔴 ยังไม่เริ่ม
                      </span>
                    ) : (
                      <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-amber-500/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                        🟡 กำลังเรียน
                      </span>
                    )}
                  </Link>

                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${toneFor(c.id)}`}>
                        {c.category || "ทั่วไป"} · {c.hours} ชั่วโมง
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 text-[10px]">
                      {c.isMandatoryForDepartment ? (
                        <span className="rounded-md bg-purple-500/10 px-1.5 py-0.5 font-bold text-purple-700 dark:text-purple-300">
                          เฉพาะแผนก {me?.department || ""}
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-500/10 px-1.5 py-0.5 font-semibold text-slate-600 dark:text-slate-400">
                          บุคลากรทุกคน
                        </span>
                      )}
                      <span className="rounded-md bg-card border px-1.5 py-0.5 font-semibold text-muted-foreground">
                        {isClassroom ? "🏢 On-site" : "🌐 Online"}
                      </span>
                    </div>

                    {c.round_no != null && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-0.5">
                        <Calendar className="h-3 w-3" />
                        <span>รอบที่ {c.round_no}</span>
                        {c.starts_at && (
                          <span>
                            · {new Date(c.starts_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Main Content & Timeline */}
                <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
                  <div>
                    {/* Header: Title & Test Scores */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Link
                        to="/courses/$courseId"
                        params={{ courseId: c.id }}
                        className="text-base md:text-lg font-bold text-foreground hover:text-primary transition-colors"
                      >
                        {c.title}
                      </Link>

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {c.pre !== undefined && (
                          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary">
                            ก่อนเรียน {c.pre}%
                          </span>
                        )}
                        {c.post !== undefined && (
                          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                            หลังเรียน {c.post}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Timeline Component for Enrolled, or Simple To-Do guide for Unenrolled */}
                    <div className="mt-3">
                      {c.enrolled ? (
                        <CourseTimeline enrollment={timelineProgress} hideTitle={true} className="bg-card/40" />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-rose-500/30 bg-rose-500/5 p-4 text-xs space-y-2">
                          <div className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                            <span>📌 หลักสูตรบังคับประจำหน่วยงาน — ยังไม่ได้เริ่มเข้าอบรม</span>
                          </div>
                          <p className="text-muted-foreground leading-relaxed">
                            {isClassroom
                              ? "หลักสูตรนี้จัดอบรมในห้องประชุม (On-site) กรุณาเลือกรอบการอบรมที่สะดวกเพื่อลงทะเบียน"
                              : "หลักสูตรนี้เป็นบทเรียนออนไลน์ สามารถคลิกเริ่มเรียนและทำแบบทดสอบ Pre-test ได้ทันที"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Smart Next Step CTA bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
                    <span className="text-xs text-muted-foreground">
                      {c.has_cert
                        ? "คุณผ่านเกณฑ์การประเมินหลักสูตรนี้เรียบร้อยแล้ว ✓"
                        : c.status === "not_started"
                        ? "กดปุ่มด้านขวาเพื่อเริ่มดำเนินการหลักสูตรนี้"
                        : "ขั้นตอนถัดไปที่คุณต้องดำเนินการ"}
                    </span>

                    <Link
                      to={action.href}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition hover:scale-[1.02] ${
                        action.tone === "mint"
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20"
                          : action.tone === "amber"
                          ? "bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20"
                          : "bg-primary text-primary-foreground hover:bg-primary-deep shadow-brand"
                      }`}
                    >
                      {action.icon && <span>{action.icon}</span>}
                      <span>{action.label}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
