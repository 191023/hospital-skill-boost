import { createFileRoute, Link } from "@tanstack/react-router";
import { useMe } from "@/lib/auth";
import { useMyCourses, type CourseProgress } from "@/lib/data";
import { PageHeader } from "@/components/AppShell";
import { coverFor, toneFor } from "@/components/Brand";
import { CourseTimeline } from "@/components/CourseTimeline";
import { ArrowRight, Award, Calendar, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-courses")({
  head: () => ({ meta: [
    { title: "หลักสูตรของฉัน — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "หลักสูตรของฉันสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:title", content: "หลักสูตรของฉัน — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "หลักสูตรของฉันสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MyCourses,
});

function getNextAction(c: CourseProgress): { label: string; tone: "mint" | "primary" | "amber"; icon?: string } {
  if (c.has_cert) {
    return { label: "ดูใบประกาศนียบัตร", tone: "mint", icon: "🎓" };
  }
  if (c.has_sessions && !c.session_id) {
    return { label: "เลือกรอบการอบรม", tone: "amber", icon: "🗓️" };
  }
  if (c.require_pretest && !c.pre_done) {
    return { label: "ทำแบบทดสอบก่อนเรียน (Pre-test)", tone: "amber", icon: "✍️" };
  }
  if (c.has_sessions && !c.attended) {
    return { label: "รอสแกนเช็คชื่อเข้าห้องอบรม", tone: "primary", icon: "📍" };
  }
  if (c.total_lessons > 0 && c.lessons_done < c.total_lessons) {
    return { label: `เรียนต่อ (${c.lessons_done}/${c.total_lessons} บท)`, tone: "primary", icon: "📖" };
  }
  if (c.require_posttest && !c.post_done) {
    return { label: "ทำแบบทดสอบหลังเรียน (Post-test)", tone: "amber", icon: "✍️" };
  }
  if (c.require_survey && !c.survey_done) {
    return { label: "ทำแบบประเมินความพึงพอใจ", tone: "primary", icon: "📋" };
  }
  return { label: "เข้าสู่หลักสูตร", tone: "primary", icon: "👉" };
}

function MyCourses() {
  const { data: me } = useMe();
  const { data = [], isLoading } = useMyCourses(me?.id);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="การเรียนของฉัน" title="หลักสูตรของฉัน" />

      {isLoading && <div className="text-muted-foreground">กำลังโหลดข้อมูลหลักสูตร...</div>}

      {!isLoading && data.length === 0 && (
        <div className="glass rounded-3xl p-10 text-center text-muted-foreground">
          ยังไม่ได้ลงทะเบียนหลักสูตรใด{" "}
          <Link to="/courses" className="font-semibold text-primary underline underline-offset-4">
            เลือกดูหลักสูตรทั้งหมด
          </Link>
        </div>
      )}

      <div className="grid gap-5">
        {data.map((c) => {
          const action = getNextAction(c);
          return (
            <div
              key={c.id}
              className="glass overflow-hidden rounded-3xl p-4 md:p-5 transition hover:shadow-lg"
            >
              <div className="flex flex-col lg:flex-row gap-5">
                {/* Cover & Course meta */}
                <div className="flex flex-col sm:flex-row lg:flex-col sm:w-auto lg:w-56 shrink-0 gap-3">
                  <Link to="/courses/$courseId" params={{ courseId: c.id }} className="group relative block overflow-hidden rounded-2xl">
                    <img
                      src={coverFor(c.id, c.cover_url)}
                      alt={c.title}
                      loading="lazy"
                      className="h-36 sm:h-32 lg:h-36 w-full sm:w-48 lg:w-full rounded-2xl object-cover transition duration-300 group-hover:scale-105"
                    />
                    {c.has_cert && (
                      <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-mint/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                        <CheckCircle2 className="h-3 w-3" /> สำเร็จ
                      </span>
                    )}
                  </Link>

                  <div className="flex-1 space-y-1">
                    <div className={`text-[11px] font-bold uppercase tracking-wider ${toneFor(c.id)}`}>
                      {c.category || "ทั่วไป"} · {c.hours} ชั่วโมง
                    </div>
                    {c.round_no != null && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>รอบที่ {c.round_no}</span>
                        {c.starts_at && (
                          <span>· {new Date(c.starts_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
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
                          <span className="rounded-full bg-mint/15 px-2.5 py-0.5 font-medium text-mint">
                            หลังเรียน {c.post}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Timeline Component */}
                    <div className="mt-3">
                      <CourseTimeline enrollment={c} hideTitle={true} className="bg-card/40" />
                    </div>
                  </div>

                  {/* Smart Next Step CTA bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
                    <span className="text-xs text-muted-foreground">
                      {c.has_cert
                        ? "คุณผ่านเกณฑ์การประเมินหลักสูตรนี้เรียบร้อยแล้ว"
                        : "ขั้นตอนถัดไปที่คุณต้องดำเนินการ"}
                    </span>

                    <Link
                      to="/courses/$courseId"
                      params={{ courseId: c.id }}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs transition ${
                        action.tone === "mint"
                          ? "bg-mint text-white hover:bg-mint/90 shadow-mint/20"
                          : action.tone === "amber"
                          ? "bg-amber text-foreground hover:bg-amber/90 shadow-amber/20"
                          : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
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
