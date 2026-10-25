import { useMemo } from "react";
import { Check, Clock3, Lock, Award, FileText, Users, BookOpen, CheckCircle2, ChevronRight } from "lucide-react";

export type TimelineEnrollment = {
  user_id: string;
  course_id: string;
  course_title: string;
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
};

export type StepItem = {
  id: "session" | "pretest" | "attendance" | "lessons" | "posttest" | "survey" | "cert";
  label: string;
  shortLabel: string;
  detail: string;
  status: "completed" | "current" | "locked";
};

export function buildTimelineSteps(e: TimelineEnrollment): StepItem[] {
  const steps: StepItem[] = [];

  // 1. Session selection (if course has sessions)
  if (e.has_sessions) {
    const isDone = !!e.session_id;
    steps.push({
      id: "session",
      label: "เลือกรอบ",
      shortLabel: "รอบ",
      detail: isDone ? (e.round_no ? `รอบ ${e.round_no}` : "เลือกรอบแล้ว") : "ยังไม่เลือกรอบ",
      status: isDone ? "completed" : "current",
    });
  }

  // 2. Pre-test (if required)
  if (e.require_pretest) {
    const priorDone = !e.has_sessions || !!e.session_id;
    const isDone = e.pre_done;
    steps.push({
      id: "pretest",
      label: "Pre-test",
      shortLabel: "Pre",
      detail: isDone ? "ทำแล้ว" : priorDone ? "รอทำข้อสอบ" : "รอเลือกรอบ",
      status: isDone ? "completed" : priorDone ? "current" : "locked",
    });
  }

  // 3. Attendance check-in (if course has sessions)
  if (e.has_sessions) {
    const priorDone = !!e.session_id && (!e.require_pretest || e.pre_done);
    const isDone = e.attended;
    steps.push({
      id: "attendance",
      label: "เข้าห้องอบรม",
      shortLabel: "เช็คชื่อ",
      detail: isDone ? "เช็คชื่อแล้ว" : priorDone ? "รอเช็คชื่อ" : "รอ Pre-test",
      status: isDone ? "completed" : priorDone ? "current" : "locked",
    });
  }

  // 4. Lessons (if has lessons)
  if (e.total_lessons > 0) {
    const priorDone = !e.has_sessions || e.attended;
    const isDone = e.lessons_done >= e.total_lessons;
    steps.push({
      id: "lessons",
      label: "บทเรียน",
      shortLabel: "บทเรียน",
      detail: `${e.lessons_done}/${e.total_lessons} บท`,
      status: isDone ? "completed" : priorDone ? "current" : "locked",
    });
  }

  // 5. Post-test (if required)
  if (e.require_posttest) {
    const priorDone = (!e.has_sessions || e.attended) && (e.total_lessons === 0 || e.lessons_done >= e.total_lessons);
    const isDone = e.post_done;
    steps.push({
      id: "posttest",
      label: "Post-test",
      shortLabel: "Post",
      detail: isDone ? "ผ่านแล้ว" : priorDone ? "รอสอบ" : "รอบทเรียน",
      status: isDone ? "completed" : priorDone ? "current" : "locked",
    });
  }

  // 6. Survey (if required)
  if (e.require_survey) {
    const priorDone = (!e.has_sessions || e.attended) && (!e.require_posttest || e.post_done) && (e.total_lessons === 0 || e.lessons_done >= e.total_lessons);
    const isDone = e.survey_done;
    steps.push({
      id: "survey",
      label: "แบบประเมิน",
      shortLabel: "ประเมิน",
      detail: isDone ? "ประเมินแล้ว" : priorDone ? "รอประเมิน" : "รอสอบ",
      status: isDone ? "completed" : priorDone ? "current" : "locked",
    });
  }

  // 7. Certificate (if issued)
  if (e.issue_certificate) {
    const priorDone = (!e.has_sessions || e.attended) &&
      (!e.require_pretest || e.pre_done) &&
      (!e.require_posttest || e.post_done) &&
      (!e.require_survey || e.survey_done) &&
      (e.total_lessons === 0 || e.lessons_done >= e.total_lessons);
    const isDone = e.has_cert;
    steps.push({
      id: "cert",
      label: "ใบประกาศ",
      shortLabel: "ใบประกาศ",
      detail: isDone ? "ได้รับแล้ว" : priorDone ? "รอออกใบ" : "รอครบเงื่อนไข",
      status: isDone ? "completed" : priorDone ? "current" : "locked",
    });
  }

  return steps;
}

export function CourseTimeline({
  enrollment,
  hideTitle = false,
  className = "",
}: {
  enrollment: TimelineEnrollment;
  hideTitle?: boolean;
  className?: string;
}) {
  const steps = useMemo(() => buildTimelineSteps(enrollment), [enrollment]);

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const totalCount = steps.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const currentStep = steps.find((s) => s.status === "current");
  const isAllDone = totalCount > 0 && completedCount === totalCount;

  return (
    <div className={`rounded-2xl border border-border/50 bg-card/60 p-3 shadow-xs transition hover:border-primary/20 ${className}`}>
      {/* Top Header: Course info & Overall Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!hideTitle ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{enrollment.course_title}</span>
            {enrollment.round_no != null && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                รอบที่ {enrollment.round_no}
                {enrollment.starts_at && ` · ${new Date(enrollment.starts_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}`}
              </span>
            )}
          </div>
        ) : (
          <div className="text-xs font-medium text-muted-foreground">
            เส้นทางความคืบหน้า (Timeline)
          </div>
        )}

        {/* Overall Status Badge */}
        <div>
          {isAllDone ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/15 px-3 py-0.5 text-xs font-semibold text-mint">
              <CheckCircle2 className="h-3.5 w-3.5" /> สำเร็จหลักสูตร 100%
            </span>
          ) : currentStep ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span>{currentStep.label}: {currentStep.detail}</span>
              <span className="text-[11px] font-semibold opacity-70">({pct}%)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              กำลังดำเนินการ ({pct}%)
            </span>
          )}
        </div>
      </div>

      {/* Desktop Connected Timeline (shown on md+ screens) */}
      <div className="mt-3.5 hidden sm:flex items-center w-full">
        {steps.map((step, idx) => {
          const isComp = step.status === "completed";
          const isCurr = step.status === "current";
          const nextStep = steps[idx + 1];
          const isLineActive = isComp && (nextStep?.status === "completed" || nextStep?.status === "current");

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="group relative flex flex-col items-center">
                {/* Node Icon */}
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                    isComp
                      ? "bg-mint text-white shadow-xs shadow-mint/30"
                      : isCurr
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-xs"
                      : "border border-border/80 bg-muted/60 text-muted-foreground"
                  }`}
                  title={`${step.label}: ${step.detail}`}
                >
                  {isComp ? (
                    <Check className="h-4 w-4 stroke-[2.5]" />
                  ) : isCurr ? (
                    <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                  ) : (
                    <span className="text-[10px] opacity-75">{idx + 1}</span>
                  )}
                </div>

                {/* Step Name */}
                <span
                  className={`mt-1.5 text-center text-[11px] whitespace-nowrap ${
                    isComp ? "font-medium text-foreground" : isCurr ? "font-bold text-primary" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>

                {/* Step Detail */}
                <span
                  className={`text-center text-[10px] whitespace-nowrap ${
                    isCurr ? "font-semibold text-primary/90" : "text-muted-foreground/80"
                  }`}
                >
                  {step.detail}
                </span>
              </div>

              {/* Connecting line */}
              {idx < steps.length - 1 && (
                <div className="mx-2 flex-1 pb-8">
                  <div
                    className={`h-[2.5px] w-full rounded-full transition-colors ${
                      isLineActive ? "bg-mint" : isComp ? "bg-mint/40" : "bg-border/60"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile Responsive Pill Stepper (shown on mobile < sm) */}
      <div className="mt-2.5 flex sm:hidden flex-wrap items-center gap-1 text-xs">
        {steps.map((step, idx) => {
          const isComp = step.status === "completed";
          const isCurr = step.status === "current";

          return (
            <div key={step.id} className="flex items-center gap-1">
              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${
                  isComp
                    ? "bg-mint/15 font-medium text-mint"
                    : isCurr
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted/70 text-muted-foreground/70"
                }`}
              >
                {isComp ? <Check className="h-3 w-3 stroke-[2.5]" /> : isCurr ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
                <span>{step.label}</span>
                <span className="text-[10px] opacity-80">({step.detail})</span>
              </span>

              {idx < steps.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
