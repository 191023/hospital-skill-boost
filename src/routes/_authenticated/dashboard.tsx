import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMe } from "@/lib/auth";
import { useAssignedCourses, type CourseStatus } from "@/lib/data";
import { PageHeader, Stat, Bar } from "@/components/AppShell";
import { coverFor, toneFor } from "@/components/Brand";
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  Sparkles,
  AlertTriangle,
  Building2,
  Check,
  Search,
  Bell,
  Flame,
  ChevronDown,
  ChevronUp,
  X,
  AlertOctagon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "แดชบอร์ด — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { name: "description", content: "แดชบอร์ดสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:title", content: "แดชบอร์ด — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:description", content: "แดชบอร์ดสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
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

  const withBoth = courses.filter((c) => c.pre !== undefined && c.post !== undefined).slice(0, 3);
  const completedCourses = courses.filter((c) => c.has_cert && c.certId);

  const [collapsedAlerts, setCollapsedAlerts] = useState(false);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);

  // Compute Deadline & Urgent Alerts
  const deadlineAlerts = useMemo(() => {
    const list: {
      id: string;
      level: "critical" | "warning" | "info";
      badgeText: string;
      title: string;
      courseTitle: string;
      description: string;
      actionLabel: string;
      actionHref: string;
    }[] = [];

    for (const c of courses) {
      if (c.status === "completed") continue;

      // 1. Session upcoming within 7 days
      if (c.starts_at && !c.attended) {
        const diffDays = Math.ceil((new Date(c.starts_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 7) {
          list.push({
            id: `session-${c.id}-${c.session_id}`,
            level: diffDays <= 1 ? "critical" : "warning",
            badgeText: diffDays === 0 ? "🚨 วันนี้" : diffDays === 1 ? "⏰ พรุ่งนี้" : `📅 อีก ${diffDays} วัน`,
            title: diffDays === 0 ? `มีการอบรมวันนี้: ${c.title}` : `รอบอบรมใกล้ถึงกำหนด: ${c.title}`,
            courseTitle: c.title,
            description: `รอบที่ ${c.round_no ?? 1} วันที่ ${new Date(c.starts_at).toLocaleDateString("th-TH", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })} — กรุณาเตรียมสแกนเช็คชื่อเข้าห้องอบรม`,
            actionLabel: "ดูรอบอบรม",
            actionHref: `/courses/${c.id}`,
          });
        }
      }

      // 2. Post-test pending
      const lessonsFinished = c.total_lessons > 0 ? c.lessons_done >= c.total_lessons : true;
      if ((c.attended || lessonsFinished) && c.require_posttest && !c.post_done) {
        list.push({
          id: `posttest-${c.id}`,
          level: "critical",
          badgeText: "✍️ รอทำแบบทดสอบ",
          title: `ค้างทำ Post-test: ${c.title}`,
          courseTitle: c.title,
          description: `คุณเข้าร่วมการอบรมแล้ว กรุณาทำแบบทดสอบหลังเรียนให้ผ่านเพื่อรับใบประกาศนียบัตร`,
          actionLabel: "ทำแบบทดสอบทันที",
          actionHref: `/courses/${c.id}/test/post`,
        });
      }

      // 3. Department mandatory not started
      if (c.isMandatoryForDepartment && c.status === "not_started") {
        list.push({
          id: `mandatory-${c.id}`,
          level: "warning",
          badgeText: "📌 หลักสูตรเฉพาะแผนก",
          title: `ยังไม่เริ่มอบรม: ${c.title}`,
          courseTitle: c.title,
          description: `หลักสูตรเฉพาะสำหรับฝ่าย ${me?.division || "ทั่วไป"} / แผนก ${me?.department || "ทั่วไป"} ประจำปี ${c.training_year}`,
          actionLabel: c.action.label,
          actionHref: c.action.href,
        });
      }
    }

    return list.filter((a) => !dismissedAlertIds.includes(a.id));
  }, [courses, me?.division, me?.department, dismissedAlertIds]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ระบบพัฒนาศักยภาพบุคลากร"
        title={`สวัสดี คุณ${me?.full_name ?? "บุคลากร"}`}
        right={
          <div className="flex items-center gap-2">
            <Link
              to="/calendar"
              className="glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold hover:border-primary/40 transition-colors"
            >
              <Calendar className="size-3.5 text-primary" /> ปฏิทินรอบอบรม
            </Link>
            <Link
              to="/courses"
              className="glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold hover:border-primary/40 transition-colors"
            >
              <BookOpen className="size-3.5 text-primary" /> คลังหลักสูตรทั้งหมด
            </Link>
          </div>
        }
      />

      {/* 0. Deadline & Urgent Alerts Ribbon */}
      {deadlineAlerts.length > 0 && (
        <section
          aria-label="แจ้งเตือนความเร่งด่วนและกำหนดเวลาอบรม"
          className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-card to-rose-500/10 p-5 shadow-sm backdrop-blur-xl space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <span className="grid size-7 place-items-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Bell className="size-4 animate-bounce" />
              </span>
              <span>แจ้งเตือนกำหนดเวลาอบรมและความเร่งด่วน ({deadlineAlerts.length} รายการ)</span>
            </div>

            <div className="flex items-center gap-2">
              {deadlineAlerts.length > 1 && (
                <button
                  type="button"
                  onClick={() => setCollapsedAlerts(!collapsedAlerts)}
                  className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-card/80 transition"
                >
                  <span>{collapsedAlerts ? `แสดงทั้งหมด (${deadlineAlerts.length})` : "ย่อลง"}</span>
                  {collapsedAlerts ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
                </button>
              )}
            </div>
          </div>

          {/* Alert cards list */}
          <div className="grid gap-2.5">
            {(collapsedAlerts ? deadlineAlerts.slice(0, 1) : deadlineAlerts).map((alert) => {
              const isCrit = alert.level === "critical";
              return (
                <div
                  key={alert.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-3.5 border transition-all ${
                    isCrit
                      ? "border-rose-500/40 bg-rose-500/10"
                      : "border-amber-500/30 bg-card/60"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                        isCrit ? "bg-rose-500 text-white" : "bg-amber-500 text-white"
                      }`}
                    >
                      {isCrit ? <Flame className="size-3.5" /> : <Clock className="size-3.5" />}
                    </span>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            isCrit
                              ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                              : "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                          }`}
                        >
                          {alert.badgeText}
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                          {alert.title}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{alert.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <Link
                      to={alert.actionHref}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition shadow-xs ${
                        isCrit
                          ? "bg-rose-600 text-white hover:bg-rose-700"
                          : "bg-amber-500 text-white hover:bg-amber-600"
                      }`}
                    >
                      <span>{alert.actionLabel}</span>
                      <ChevronRight className="size-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDismissedAlertIds((prev) => [...prev, alert.id])}
                      title="ซ่อนการแจ้งเตือนนี้"
                      className="rounded-lg p-1 text-muted-foreground hover:bg-card hover:text-foreground transition"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 1. Welcome & Department Onboarding Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-mint/10 p-6 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Building2 className="size-3.5" />
              <span>
                ฝ่าย{me?.division || "ทั่วไป"} · แผนก{me?.department || "ทั่วไป"}
              </span>
              {me?.position && <span>· {me.position}</span>}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              หลักสูตรอบรมประจำหน่วยงานของคุณ
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm leading-relaxed text-muted-foreground">
              {stats.notStarted > 0 ? (
                <>
                  คุณมี <span className="font-bold text-rose-600 dark:text-rose-400">{stats.notStarted} หลักสูตร</span>{" "}
                  ที่ต้องเข้าอบรมเพื่อผ่านเกณฑ์มาตรฐานโรงพยาบาล (HA & Continuous Medical Education)
                </>
              ) : stats.inProgress > 0 ? (
                <>
                  คุณกำลังอยู่ระหว่างอบรม{" "}
                  <span className="font-bold text-amber-600 dark:text-amber-400">{stats.inProgress} หลักสูตร</span>{" "}
                  สามารถกดเรียนต่อจากบทเรียนล่าสุดได้ทันที
                </>
              ) : stats.total > 0 && stats.completed === stats.total ? (
                <>🎉 ยอดเยี่ยมมาก! คุณผ่านการอบรมครบถ้วนทุกหลักสูตรประจำปีเรียบร้อยแล้ว</>
              ) : (
                <>ยินดีต้อนรับสู่ระบบพัฒนาศักยภาพบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค</>
              )}
            </p>
          </div>

          {/* Quick Progress Meter */}
          <div className="glass flex w-full max-w-sm flex-col gap-2 rounded-2xl p-4 shadow-none lg:w-72 shrink-0">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground">ความคืบหน้าภาพรวม</span>
              <span className="text-primary font-bold">
                {stats.completed} / {stats.total} หลักสูตร ({stats.overallPct}%)
              </span>
            </div>
            <Bar value={stats.overallPct} tone="mint" />
            <div className="text-[11px] text-muted-foreground">
              สะสมแล้ว {stats.totalHoursCompleted} ชั่วโมงการอบรม
            </div>
          </div>
        </div>
      </section>

      {/* 2. Key Stats Grid */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="หลักสูตรที่ต้องอบรม"
          value={stats.total}
          note="ประจำปีนี้"
          tone="primary"
        />
        <Stat
          label="ต้องเริ่มอบรม"
          value={stats.notStarted}
          note={stats.notStarted > 0 ? "⚠️ รอดำเนินการ" : "ครบถ้วนแล้ว"}
          tone={stats.notStarted > 0 ? "coral" : "mint"}
        />
        <Stat
          label="กำลังเรียน / รอรอบ"
          value={stats.inProgress}
          note="ยังไม่เสร็จสิ้น"
          tone="amber"
        />
        <Stat
          label="ผ่านเกณฑ์แล้ว"
          value={stats.completed}
          note={`${stats.totalHoursCompleted} ชั่วโมงสะสม`}
          tone="mint"
        />
      </section>

      {/* 3. Main Learning Center & Course Status Section */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-3xl p-5 sm:p-6 lg:col-span-2 space-y-5">
          {/* Section Header & Filter Pills */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span>หลักสูตรและการดำเนินการ</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                คลิกปุ่ม Action เพื่อเข้าสู่ขั้นตอนถัดไปของแต่ละหลักสูตรได้ทันที
              </p>
            </div>
            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="ค้นหาชื่อหลักสูตร..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-full border bg-card/60 pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Interactive Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                filter === "all"
                  ? "bg-primary text-primary-foreground shadow-brand"
                  : "glass text-foreground/70 hover:bg-card/80"
              }`}
            >
              ทั้งหมด ({stats.total})
            </button>
            <button
              onClick={() => setFilter("not_started")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filter === "not_started"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "glass text-rose-700 dark:text-rose-400 hover:bg-rose-500/10"
              }`}
            >
              <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
              ต้องเริ่ม ({stats.notStarted})
            </button>
            <button
              onClick={() => setFilter("in_progress")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filter === "in_progress"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "glass text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
              }`}
            >
              <span className="size-2 rounded-full bg-amber-500" />
              กำลังเรียน / รอรอบ ({stats.inProgress})
            </button>
            <button
              onClick={() => setFilter("completed")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filter === "completed"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "glass text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              <span className="size-2 rounded-full bg-emerald-500" />
              ผ่านแล้ว ({stats.completed})
            </button>
          </div>

          {/* Course Cards List */}
          {isLoading && (
            <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
              กำลังโหลดรายการหลักสูตร...
            </div>
          )}

          {!isLoading && filteredCourses.length === 0 && (
            <div className="rounded-2xl border border-dashed p-10 text-center space-y-3">
              <div className="text-3xl">📭</div>
              <div className="text-sm font-semibold">ไม่พบหลักสูตรในหมวดนี้</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {filter !== "all"
                  ? "คุณสามารถเลือกดูหมวดอื่น หรือคลิก 'ทั้งหมด' เพื่อดูหลักสูตรที่มีสิทธิ์อบรม"
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

          <div className="grid gap-4">
            {filteredCourses.map((c) => {
              const isClassroom = c.training_type === "classroom";
              return (
                <div
                  key={c.id}
                  className="glass group relative overflow-hidden rounded-2xl p-4 sm:p-5 transition hover:shadow-md hover:border-primary/40 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Cover thumbnail */}
                    <div className="relative h-28 w-full sm:w-44 shrink-0 overflow-hidden rounded-xl">
                      <img
                        src={coverFor(c.id, c.cover_url)}
                        alt={c.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                          {c.category || "ทั่วไป"}
                        </span>
                        {c.hours ? (
                          <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                            ⏱ {c.hours} ชม.
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Course details */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {/* Target & Type Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          {c.isMandatoryForDepartment ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-0.5 font-bold text-purple-700 dark:text-purple-300 border border-purple-500/20">
                              <Building2 className="size-3" /> เฉพาะแผนก {me?.department || ""}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-0.5 font-semibold text-slate-700 dark:text-slate-300 border border-slate-500/20">
                              👥 บุคลากรทุกคน
                            </span>
                          )}

                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[10px] ${
                              isClassroom
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                : "bg-primary/15 text-primary"
                            }`}
                          >
                            {isClassroom ? "🏢 On-site ในห้อง" : "🌐 Online"}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {c.status === "completed" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              <Check className="size-3.5 stroke-[3]" /> ผ่านแล้ว
                            </span>
                          ) : c.status === "in_progress" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              <span className="size-2 rounded-full bg-amber-500" /> กำลังเรียน
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300 border border-rose-500/30">
                              <span className="size-2 rounded-full bg-rose-500 animate-pulse" /> ยังไม่เริ่ม
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title */}
                      <Link
                        to="/courses/$courseId"
                        params={{ courseId: c.id }}
                        className="block font-bold text-base hover:text-primary transition-colors line-clamp-1"
                      >
                        {c.title}
                      </Link>

                      {c.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {c.description}
                        </p>
                      )}

                      {/* Mini Step Flow Indicators */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                        {c.require_pretest && (
                          <span
                            className={`rounded-md px-2 py-0.5 ${
                              c.pre_done
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold"
                                : "bg-card border text-muted-foreground"
                            }`}
                          >
                            {c.pre_done ? "✓ Pre-test" : "Pre-test"}
                          </span>
                        )}
                        {c.has_sessions && (
                          <span
                            className={`rounded-md px-2 py-0.5 ${
                              c.attended
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold"
                                : c.session_id
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
                                : "bg-card border text-muted-foreground"
                            }`}
                          >
                            {c.attended ? "✓ เช็คชื่อแล้ว" : c.session_id ? `รอบที่ ${c.round_no ?? 1}` : "รอบอบรม"}
                          </span>
                        )}
                        {c.total_lessons > 0 && (
                          <span
                            className={`rounded-md px-2 py-0.5 ${
                              c.lessons_done >= c.total_lessons
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold"
                                : "bg-card border text-muted-foreground"
                            }`}
                          >
                            บทเรียน ({c.lessons_done}/{c.total_lessons})
                          </span>
                        )}
                        {c.require_posttest && (
                          <span
                            className={`rounded-md px-2 py-0.5 ${
                              c.post_done
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold"
                                : "bg-card border text-muted-foreground"
                            }`}
                          >
                            {c.post_done ? "✓ Post-test" : "Post-test"}
                          </span>
                        )}
                        {c.issue_certificate && (
                          <span
                            className={`rounded-md px-2 py-0.5 ${
                              c.has_cert
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold"
                                : "bg-card border text-muted-foreground"
                            }`}
                          >
                            {c.has_cert ? "✓ ใบประกาศ" : "ใบประกาศ"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Action Row: Progress Bar + Primary Action Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t pt-3">
                    <div className="flex-1 max-w-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">ความคืบหน้า</span>
                        <span className="font-semibold text-foreground">{c.pct}%</span>
                      </div>
                      <Bar value={c.pct} tone={c.status === "completed" ? "mint" : "primary"} />
                    </div>

                    <Link
                      to={c.action.href}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-sm transition-all hover:scale-[1.02] ${
                        c.action.tone === "mint"
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20"
                          : c.action.tone === "amber"
                          ? "bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20"
                          : "bg-primary text-primary-foreground hover:bg-primary-deep shadow-brand"
                      }`}
                    >
                      <span>{c.action.icon}</span>
                      <span>{c.action.label}</span>
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Side Column: Quick Access, Certificates & Scores */}
        <div className="space-y-6">
          {/* Quick Guide Card */}
          <div className="glass rounded-3xl p-6 space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
              <Sparkles className="size-4 text-primary" />
              <span>ลำดับขั้นตอนการเข้าอบรม</span>
            </h3>
            <ol className="space-y-2.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  1
                </span>
                <span>กด <strong>"เริ่มเข้าอบรม"</strong> หรือเลือกรอบอบรมที่สะดวก</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  2
                </span>
                <span>ทำแบบทดสอบก่อนเรียน (Pre-test) เพื่อวัดความรู้พื้นฐาน</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  3
                </span>
                <span>เข้าอบรม / เรียนบทเรียนออนไลน์ให้ครบถ้วน</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  4
                </span>
                <span>ทำแบบทดสอบหลังเรียน (Post-test) ให้ผ่านเกณฑ์ แล้วรับใบประกาศนียบัตรทันที</span>
              </li>
            </ol>
          </div>

          {/* Certificates Quick Access */}
          <div className="glass rounded-3xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
                <GraduationCap className="size-4 text-mint" />
                <span>ใบประกาศที่ได้รับ</span>
              </h3>
              <Link to="/certificates" className="text-xs font-semibold text-primary hover:underline">
                ดูทั้งหมด ({completedCourses.length}) →
              </Link>
            </div>

            {completedCourses.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                ยังไม่มีใบประกาศนียบัตร เมื่อเรียนและสอบผ่านจะแสดงที่นี่
              </div>
            ) : (
              <div className="space-y-2">
                {completedCourses.slice(0, 3).map((c) => (
                  <Link
                    key={c.id}
                    to="/certificates/$certId"
                    params={{ certId: c.certId! }}
                    className="glass flex items-center justify-between rounded-2xl p-3 shadow-none transition hover:bg-card hover:scale-[1.01]"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="truncate text-xs font-bold">{c.title}</div>
                      <div className="text-[11px] text-muted-foreground">{c.hours} ชั่วโมงอบรม</div>
                    </div>
                    <span className="rounded-full bg-mint/15 px-2.5 py-1 text-[11px] font-bold text-mint shrink-0">
                      ดูใบประกาศ
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Test Performance Comparison */}
          <div className="glass rounded-3xl p-6 space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
              <Award className="size-4 text-amber-500" />
              <span>การเปรียบเทียบผลสอบ (Pre vs Post)</span>
            </h3>
            <p className="text-xs text-muted-foreground">คะแนนก่อนเรียนเทียบกับหลังเรียน</p>

            {withBoth.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                ทำแบบทดสอบก่อนและหลังเรียนเพื่อดูพัฒนาการคะแนนที่นี่
              </div>
            ) : (
              <>
                <div className="mt-4 flex h-36 items-end justify-around gap-3 pt-2">
                  {withBoth.flatMap((c, i) => [
                    <Col
                      key={c.id + "pre"}
                      h={c.pre!}
                      label="ก่อน"
                      cls="bg-mist/80 border border-glass-border"
                    />,
                    <Col
                      key={c.id + "post"}
                      h={c.post!}
                      label="หลัง"
                      cls={i === 0 ? "bg-brand-gradient shadow-brand" : "bg-mint"}
                      strong
                    />,
                  ])}
                </div>
                <div className="glass mt-3 rounded-2xl p-3 shadow-none space-y-1">
                  {withBoth.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-xs py-0.5">
                      <span className="truncate text-muted-foreground max-w-[180px]">{c.title}</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {c.post! - c.pre! >= 0 ? "+" : ""}
                        {(c.post! - c.pre!).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Col({ h, label, cls, strong }: { h: number; label: string; cls: string; strong?: boolean }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-end gap-1.5">
      <div className="text-[10px] font-semibold">{h}%</div>
      <div
        className={`w-full rounded-t-xl transition-all duration-500 ${cls}`}
        style={{ height: `${Math.max(6, h * 0.85)}%` }}
      />
      <div className={`text-[10px] font-semibold ${strong ? "text-primary" : "text-muted-foreground"}`}>
        {label}
      </div>
    </div>
  );
}
