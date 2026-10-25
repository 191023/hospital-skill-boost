import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  UserCheck,
  AlertTriangle,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Search,
  Filter,
  ExternalLink,
  CalendarDays,
  ListFilter,
  ShieldAlert,
  Sparkles,
  X,
  ArrowUpRight,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

type CalendarSession = {
  session_id: string;
  course_id: string;
  course_title: string;
  course_category: string | null;
  course_hours: number | null;
  instructor_name: string | null;
  audience: string;
  published: boolean;
  round_no: number;
  starts_at: string | null;
  ends_at: string | null;
  location: string;
  capacity: number | null;
  checkin_code: string;
  taken_seats: number;
  is_my_session: boolean;
  my_checked_in: boolean;
  team_attendees_count: number;
};

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const WEEKDAYS = [
  { short: "จ.", full: "จันทร์", type: "weekday" as const },
  { short: "อ.", full: "อังคาร", type: "weekday" as const },
  { short: "พ.", full: "พุธ", type: "weekday" as const },
  { short: "พฤ.", full: "พฤหัสบดี", type: "weekday" as const },
  { short: "ศ.", full: "ศุกร์", type: "weekday" as const },
  { short: "ส.", full: "เสาร์", type: "saturday" as const },
  { short: "อา.", full: "อาทิตย์", type: "sunday" as const },
];

export type ActiveCoursePlan = {
  course_id: string;
  course_title: string;
  course_category: string | null;
  course_hours: number | null;
  instructor_name: string | null;
  total_sessions: number;
  open_sessions: number;
  total_capacity: number | null;
  total_taken: number;
  remaining_seats: number | null;
  next_session: CalendarSession | null;
  is_my_enrolled: boolean;
  my_session_round: number | null;
  team_attendees_count: number;
  status: "open" | "low" | "full";
  date_span_label: string;
};

const formatThaiShort = (iso: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  const thaiMonthsShort = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${thaiMonthsShort[d.getMonth()]} ${(d.getFullYear() + 543) % 100}`;
};

export function CalendarPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"month" | "agenda">("month");
  const [filterScope, setFilterScope] = useState<"all" | "mine" | "team">("all");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedSession, setSelectedSession] = useState<CalendarSession | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Month boundary for query: fetch the active training year range
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const rangeStart = useMemo(() => new Date(year, 0, 1).toISOString(), [year]);
  const rangeEnd = useMemo(() => new Date(year + 1, 11, 31).toISOString(), [year]);

  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ["calendar-sessions", rangeStart, rangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_calendar_sessions", {
        _start: rangeStart,
        _end: rangeEnd,
      });
      if (error) throw error;
      return (data ?? []) as CalendarSession[];
    },
  });

  // Extract distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      if (s.course_category) set.add(s.course_category.trim());
    });
    return Array.from(set).sort();
  }, [sessions]);

  // Compute Active Training Plans grouped by Course across the entire year
  const activePlans = useMemo(() => {
    const map = new Map<string, CalendarSession[]>();
    sessions.forEach((s) => {
      const list = map.get(s.course_id) ?? [];
      list.push(s);
      map.set(s.course_id, list);
    });

    const plans: ActiveCoursePlan[] = [];
    const now = new Date();

    map.forEach((courseSessions, courseId) => {
      if (courseSessions.length === 0) return;

      // Sort by start time
      const sorted = [...courseSessions].sort((a, b) => {
        const ta = a.starts_at ? new Date(a.starts_at).getTime() : 0;
        const tb = b.starts_at ? new Date(b.starts_at).getTime() : 0;
        return ta - tb;
      });

      const first = sorted[0]!;
      // Find upcoming session (starts_at >= now or closest)
      const upcoming = sorted.find((s) => s.starts_at && new Date(s.starts_at) >= now) ?? sorted[0] ?? null;

      let totalCapacity: number | null = 0;
      let totalTaken = 0;
      let hasUnlimited = false;
      let isMyEnrolled = false;
      let mySessionRound: number | null = null;
      let teamCount = 0;
      let openCount = 0;

      sorted.forEach((s) => {
        if (s.capacity === null) {
          hasUnlimited = true;
        } else {
          totalCapacity = (totalCapacity ?? 0) + s.capacity;
        }
        totalTaken += s.taken_seats;
        if (s.capacity === null || s.taken_seats < s.capacity) {
          openCount++;
        }
        if (s.is_my_session) {
          isMyEnrolled = true;
          mySessionRound = s.round_no;
        }
        teamCount += s.team_attendees_count;
      });

      const remainingSeats = hasUnlimited ? null : Math.max(0, (totalCapacity ?? 0) - totalTaken);
      let status: "open" | "low" | "full" = "open";
      if (!hasUnlimited && (totalCapacity ?? 0) > 0 && remainingSeats === 0) {
        status = "full";
      } else if (!hasUnlimited && remainingSeats !== null && remainingSeats <= 5) {
        status = "low";
      }

      // Format date span
      const startStr = sorted[0]?.starts_at ? formatThaiShort(sorted[0].starts_at) : "";
      const lastSession = sorted[sorted.length - 1];
      const endStr = lastSession?.starts_at ? formatThaiShort(lastSession.starts_at) : "";
      const dateSpanLabel = startStr === endStr ? startStr : `${startStr} – ${endStr}`;

      plans.push({
        course_id: courseId,
        course_title: first.course_title,
        course_category: first.course_category,
        course_hours: first.course_hours,
        instructor_name: first.instructor_name,
        total_sessions: sorted.length,
        open_sessions: openCount,
        total_capacity: hasUnlimited ? null : totalCapacity,
        total_taken: totalTaken,
        remaining_seats: remainingSeats,
        next_session: upcoming,
        is_my_enrolled: isMyEnrolled,
        my_session_round: mySessionRound,
        team_attendees_count: teamCount,
        status,
        date_span_label: dateSpanLabel,
      });
    });

    // Sort: courses with nearest upcoming sessions first
    return plans.sort((a, b) => {
      const ta = a.next_session?.starts_at ? new Date(a.next_session.starts_at).getTime() : 0;
      const tb = b.next_session?.starts_at ? new Date(b.next_session.starts_at).getTime() : 0;
      return ta - tb;
    });
  }, [sessions]);

  // Conflict detection: Learner overlapping sessions
  const myEnrolledSessions = useMemo(() => {
    return sessions.filter((s) => s.is_my_session && s.starts_at);
  }, [sessions]);

  const getLearnerConflicts = (target: CalendarSession) => {
    if (!target.starts_at) return [];
    const tStart = new Date(target.starts_at).getTime();
    const tEnd = target.ends_at ? new Date(target.ends_at).getTime() : tStart + 3600000;

    return myEnrolledSessions.filter((s) => {
      if (s.session_id === target.session_id) return false;
      if (!s.starts_at) return false;
      const sStart = new Date(s.starts_at).getTime();
      const sEnd = s.ends_at ? new Date(s.ends_at).getTime() : sStart + 3600000;
      return tStart < sEnd && tEnd > sStart;
    });
  };

  // Staff conflict detection: Room collision
  const getRoomCollisions = (target: CalendarSession) => {
    if (!target.starts_at || !target.location || target.location.trim() === "") return [];
    const tStart = new Date(target.starts_at).getTime();
    const tEnd = target.ends_at ? new Date(target.ends_at).getTime() : tStart + 3600000;

    return sessions.filter((s) => {
      if (s.session_id === target.session_id) return false;
      if (!s.starts_at) return false;
      if (s.location.trim().toLowerCase() !== target.location.trim().toLowerCase()) return false;
      const sStart = new Date(s.starts_at).getTime();
      const sEnd = s.ends_at ? new Date(s.ends_at).getTime() : sStart + 3600000;
      return tStart < sEnd && tEnd > sStart;
    });
  };

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (selectedCourseId && s.course_id !== selectedCourseId) return false;
      if (filterScope === "mine" && !s.is_my_session) return false;
      if (filterScope === "team" && s.team_attendees_count === 0) return false;
      if (categoryFilter !== "all" && s.course_category?.trim() !== categoryFilter) return false;
      if (onlyAvailable && s.capacity !== null && s.taken_seats >= s.capacity) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchTitle = s.course_title.toLowerCase().includes(q);
        const matchLoc = s.location?.toLowerCase().includes(q);
        const matchInst = s.instructor_name?.toLowerCase().includes(q);
        if (!matchTitle && !matchLoc && !matchInst) return false;
      }
      return true;
    });
  }, [sessions, selectedCourseId, filterScope, categoryFilter, onlyAvailable, search]);

  // Calendar Grid builder
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday-first week: Mon (1) -> 0, ..., Sat (6) -> 5, Sun (0) -> 6
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    // Previous month padding
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
        key: `prev-${prevMonthLastDay - i}`,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
        key: `cur-${i}`,
      });
    }

    // Next month padding to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        key: `next-${i}`,
      });
    }

    return days;
  }, [year, month]);

  // Sessions map by YYYY-MM-DD
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, CalendarSession[]>();
    filteredSessions.forEach((s) => {
      if (!s.starts_at) return;
      const d = new Date(s.starts_at);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const list = map.get(dateKey) ?? [];
      list.push(s);
      map.set(dateKey, list);
    });
    return map;
  }, [filteredSessions]);

  // Select / Switch session action
  const handleChooseSession = async (s: CalendarSession) => {
    setIsActionLoading(true);
    try {
      const { error } = await supabase.rpc("choose_session", { _session: s.session_id });
      if (error) throw error;
      toast.success(`ลงทะเบียนรอบที่ ${s.round_no} วิชา "${s.course_title}" เรียบร้อยแล้ว`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["calendar-sessions"] }),
        qc.invalidateQueries({ queryKey: ["my-enrollments"] }),
        refetch(),
      ]);
      setSelectedSession(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  // iCalendar generator
  const downloadIcs = (s: CalendarSession) => {
    if (!s.starts_at) {
      toast.error("รอบนี้ยังไม่กำหนดวันเวลา");
      return;
    }
    const formatIcsDate = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const start = new Date(s.starts_at);
    const end = s.ends_at ? new Date(s.ends_at) : new Date(start.getTime() + (s.course_hours || 1) * 3600000);

    const title = `${s.course_title} (รอบที่ ${s.round_no})`;
    const description = `หลักสูตรอบรม โรงพยาบาลโอเวอร์บรุ๊ค\\nวิทยากร: ${s.instructor_name || "-"}\\nรหัสเช็คชื่อ: ${s.checkin_code}`;
    const location = s.location || "โรงพยาบาลโอเวอร์บรุ๊ค";

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Overbrook Hospital//SkillBoost//TH",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:session-${s.session_id}@overbrook.hospital`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `training-${s.session_id}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("ดาวน์โหลดไฟล์ปฏิทิน (.ics) เรียบร้อย");
  };

  const openGoogleCalendar = (s: CalendarSession) => {
    if (!s.starts_at) return;
    const start = new Date(s.starts_at);
    const end = s.ends_at ? new Date(s.ends_at) : new Date(start.getTime() + (s.course_hours || 1) * 3600000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const title = encodeURIComponent(`${s.course_title} (รอบที่ ${s.round_no})`);
    const details = encodeURIComponent(
      `หลักสูตรอบรม รพ.โอเวอร์บรุ๊ค\nวิทยากร: ${s.instructor_name || "-"}\nรหัสเช็คชื่อ: ${s.checkin_code}`
    );
    const loc = encodeURIComponent(s.location || "โรงพยาบาลโอเวอร์บรุ๊ค");
    const dates = `${fmt(start)}/${fmt(end)}`;

    const gUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${loc}`;
    window.open(gUrl, "_blank");
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="กำหนดการและตารางอบรม"
        title="ปฏิทินการอบรม (Training Calendar)"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-card p-1 shadow-sm border">
              <button
                onClick={() => setViewMode("month")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === "month"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                รายเดือน
              </button>
              <button
                onClick={() => setViewMode("agenda")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === "agenda"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ListFilter className="h-3.5 w-3.5" />
                กำหนดการ
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
              className="text-xs font-medium"
            >
              วันนี้
            </Button>
          </div>
        }
      />

      {/* Responsive 2-column layout: side overview deck + main calendar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Side Column: แถบสรุปแผนการอบรม (Active Training Plans Overview) วางด้านข้างของตารางปฏิทิน */}
        <aside className="order-2 lg:order-1 lg:col-span-4 xl:col-span-3 space-y-4 lg:sticky lg:top-4">
          <div className="glass space-y-4 rounded-3xl p-5 shadow-sm border border-white/40">
            <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shrink-0">
                    <Sparkles className="size-4 text-primary" />
                  </span>
                  <h2 className="text-sm font-bold text-foreground truncate">
                    แผนการอบรมที่เปิดรับ
                  </h2>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  คลิกเพื่อโฟกัสรอบในปฏิทิน
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="rounded-full bg-card px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground border">
                  {activePlans.length} วิชา
                </span>
                {selectedCourseId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCourseId(null)}
                    className="h-6 px-1.5 text-[11px] text-coral hover:text-coral font-semibold"
                    title="ล้างการเลือกวิชา"
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Selected Course Filter Pill in Side Panel */}
            {selectedCourseId && (
              <div className="rounded-xl bg-primary/10 border border-primary/30 p-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-primary text-[11px]">📌 กำลังโฟกัส:</span>
                  <button
                    onClick={() => setSelectedCourseId(null)}
                    className="text-[10px] text-primary hover:underline font-bold"
                  >
                    แสดงทั้งหมด
                  </button>
                </div>
                <p className="font-semibold text-foreground text-xs line-clamp-1">
                  {activePlans.find((p) => p.course_id === selectedCourseId)?.course_title}
                </p>
              </div>
            )}

            {/* Course Cards List (scrollable on desktop) */}
            {isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                กำลังโหลดข้อมูลแผนการอบรม...
              </div>
            ) : activePlans.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                ยังไม่มีแผนการอบรมที่เปิดรับสมัครในขณะนี้
              </div>
            ) : (
              <div className="space-y-3 max-h-[calc(100vh-210px)] overflow-y-auto pr-1">
                {activePlans.map((plan) => {
                  const isSelected = selectedCourseId === plan.course_id;

                  return (
                    <div
                      key={plan.course_id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedCourseId(null);
                        } else {
                          setSelectedCourseId(plan.course_id);
                          if (plan.next_session?.starts_at) {
                            setCurrentDate(new Date(plan.next_session.starts_at));
                          }
                          document.getElementById("calendar-schedule-section")?.scrollIntoView({ behavior: "smooth" });
                        }
                      }}
                      className={`group cursor-pointer rounded-2xl p-3.5 transition-all border flex flex-col justify-between text-left ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-brand ring-2 ring-primary/40 scale-[1.01]"
                          : "bg-card/70 hover:bg-card hover:border-primary/40 hover:shadow-sm"
                      }`}
                    >
                      <div className="space-y-1.5">
                        {/* Category & Status Pill */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-semibold text-primary truncate max-w-[120px]">
                            {plan.course_category || "ทั่วไป"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              plan.status === "full"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                : plan.status === "low"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                plan.status === "full"
                                  ? "bg-rose-500"
                                  : plan.status === "low"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500 animate-pulse"
                              }`}
                            />
                            {plan.status === "full" ? "เต็มแล้ว" : plan.status === "low" ? "ใกล้เต็ม" : "เปิดรับ"}
                          </span>
                        </div>

                        {/* Course Title */}
                        <h3 className="text-xs font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                          {plan.course_title}
                        </h3>

                        {/* Date Span & Next Round */}
                        <div className="space-y-1 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                          <div className="flex items-center gap-1.5 truncate">
                            <CalendarIcon className="size-3 text-primary shrink-0" />
                            <span>{plan.date_span_label} ({plan.total_sessions} รอบ)</span>
                          </div>

                          {plan.next_session?.starts_at && (
                            <div className="flex items-center gap-1.5 font-semibold text-foreground truncate">
                              <ArrowUpRight className="size-3 text-emerald-600 shrink-0" />
                              <span>รอบถัดไป: {formatThaiShort(plan.next_session.starts_at)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Badges & Quota */}
                      <div className="mt-2.5 pt-2 border-t border-border/40 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">ที่นั่งว่าง</span>
                          <span
                            className={`font-bold ${
                              plan.status === "full"
                                ? "text-rose-600"
                                : plan.status === "low"
                                ? "text-amber-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {plan.remaining_seats !== null
                              ? `ว่าง ${plan.remaining_seats} ที่`
                              : "ไม่จำกัด"}
                          </span>
                        </div>

                        {/* Personal Status Badge */}
                        {plan.is_my_enrolled && (
                          <div className="flex items-center gap-1 rounded-lg bg-indigo-600/10 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                            <CheckCircle2 className="size-3 text-indigo-600" />
                            ลงรอบ {plan.my_session_round} แล้ว
                          </div>
                        )}

                        {plan.team_attendees_count > 0 && (
                          <div className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            <Users className="size-3 text-amber-600" />
                            ลูกน้อง {plan.team_attendees_count} คน
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Main Calendar Column: ตัวกรองและตารางปฏิทิน */}
        <main className="order-1 lg:order-2 lg:col-span-8 xl:col-span-9 space-y-6 min-w-0">
          {/* Selected Course Filter Active Banner */}
          {selectedCourseId && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-primary/10 border border-primary/30 p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary">📌 กำลังโฟกัสเฉพาะหลักสูตร:</span>
                <span className="font-semibold text-foreground">
                  {activePlans.find((p) => p.course_id === selectedCourseId)?.course_title}
                </span>
                <span className="text-muted-foreground">
                  (ตารางปฏิทินแสดงเฉพาะรอบอบรมของวิชานี้)
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCourseId(null)}
                className="h-7 text-xs font-semibold"
              >
                แสดงทุกหลักสูตร
              </Button>
            </div>
          )}

      {/* Filter and Control Bar */}
      <div id="calendar-schedule-section" className="glass space-y-4 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-bold tracking-tight text-foreground min-w-[180px] text-center">
              {THAI_MONTHS[month]} {year + 543}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Quick Scope Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterScope("all")}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                filterScope === "all"
                  ? "bg-primary text-primary-foreground shadow-brand"
                  : "bg-card text-muted-foreground hover:bg-mist"
              }`}
            >
              ทั้งหมด ({sessions.length})
            </button>
            <button
              onClick={() => setFilterScope("mine")}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                filterScope === "mine"
                  ? "bg-primary text-primary-foreground shadow-brand"
                  : "bg-card text-muted-foreground hover:bg-mist"
              }`}
            >
              รอบที่ฉันลงไว้ ({sessions.filter((s) => s.is_my_session).length})
            </button>
            {me?.isTeamManager && (
              <button
                onClick={() => setFilterScope("team")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  filterScope === "team"
                    ? "bg-primary text-primary-foreground shadow-brand"
                    : "bg-card text-muted-foreground hover:bg-mist"
                }`}
              >
                สมาชิกในสังกัด ({sessions.filter((s) => s.team_attendees_count > 0).length})
              </button>
            )}
          </div>
        </div>

        {/* Search & Extra Filters */}
        <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหาหลักสูตร, วิทยากร, ห้อง..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border bg-card pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-xl border bg-card px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">ทุกหมวดหมู่วิชา</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              className="rounded border-mist text-primary focus:ring-primary"
            />
            แสดงเฉพาะรอบที่มีที่นั่งว่าง
          </label>

          {/* Color Legend with distinct Saturday (purple) and Sunday (rose) */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-purple-400 border border-purple-500/30" /> เสาร์ (ม่วง)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-400 border border-rose-500/30" /> อาทิตย์ (แดง)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-card border border-border" /> จ-ศ
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> ว่าง
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> ใกล้เต็ม
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> เต็ม
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigo-500" /> ของฉัน
            </span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="glass rounded-3xl p-12 text-center text-muted-foreground">
          กำลังโหลดตารางการอบรม...
        </div>
      ) : viewMode === "month" ? (
        /* Month View Grid */
        <div className="glass overflow-hidden rounded-3xl border border-white/40 shadow-sm">
          {/* Weekday Header: Distinct Saturday (Purple) vs Sunday (Rose) vs Weekdays */}
          <div className="grid grid-cols-7 border-b border-border/50 text-center text-xs font-semibold">
            {WEEKDAYS.map((day) => (
              <div
                key={day.short}
                className={`py-3 transition-colors ${
                  day.type === "saturday"
                    ? "bg-purple-50/80 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-bold border-b-2 border-b-purple-400"
                    : day.type === "sunday"
                    ? "bg-rose-50/80 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold border-b-2 border-b-rose-400"
                    : "bg-card/70 text-foreground/85 font-bold border-b-2 border-b-primary/40"
                }`}
              >
                <span>{day.short}</span>
                <span className="hidden sm:inline text-[10px] ml-1 opacity-70">
                  {day.type === "saturday" ? "(เสาร์)" : day.type === "sunday" ? "(อาทิตย์)" : "(จ-ศ)"}
                </span>
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border/40">
            {calendarDays.map(({ date, isCurrentMonth, key }) => {
              const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
              const daySessions = sessionsByDate.get(dateKey) ?? [];
              const today = isToday(date);
              const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday
              const isSaturday = dayOfWeek === 6;
              const isSunday = dayOfWeek === 0;

              const hasSessions = daySessions.length > 0;

              return (
                <div
                  key={key}
                  className={`min-h-[115px] p-2 transition-colors flex flex-col justify-between ${
                    !isCurrentMonth
                      ? isSaturday
                        ? "bg-purple-950/5 opacity-30"
                        : isSunday
                        ? "bg-rose-950/5 opacity-30"
                        : "bg-muted/10 opacity-30"
                      : isSaturday
                      ? "bg-purple-50/40 hover:bg-purple-50/75 dark:bg-purple-950/25 dark:hover:bg-purple-950/45"
                      : isSunday
                      ? "bg-rose-50/40 hover:bg-rose-50/75 dark:bg-rose-950/25 dark:hover:bg-rose-950/45"
                      : "bg-card/35 hover:bg-card/75"
                  } ${today ? "ring-2 ring-inset ring-primary/80 bg-primary/10 shadow-sm" : ""}`}
                >
                  <div>
                    <div className="flex items-start justify-between px-1 mb-1">
                      <span
                        className={`transition-all select-none ${
                          today
                            ? hasSessions
                              ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm"
                              : isSaturday
                              ? "flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-purple-600 text-white text-xl sm:text-2xl font-black shadow-brand"
                              : isSunday
                              ? "flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-rose-600 text-white text-xl sm:text-2xl font-black shadow-brand"
                              : "flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl sm:text-2xl font-black shadow-brand"
                            : hasSessions
                            ? `text-xs font-bold ${
                                isSaturday
                                  ? isCurrentMonth
                                    ? "text-purple-700 dark:text-purple-300 font-extrabold"
                                    : "text-purple-400/50"
                                  : isSunday
                                  ? isCurrentMonth
                                    ? "text-rose-700 dark:text-rose-400 font-extrabold"
                                    : "text-rose-400/50"
                                  : isCurrentMonth
                                  ? "text-foreground font-semibold"
                                  : "text-muted-foreground"
                              }`
                            : `text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-none ${
                                isSaturday
                                  ? isCurrentMonth
                                    ? "text-purple-700/90 dark:text-purple-300"
                                    : "text-purple-400/25"
                                  : isSunday
                                  ? isCurrentMonth
                                    ? "text-rose-700/90 dark:text-rose-400"
                                    : "text-rose-400/25"
                                  : isCurrentMonth
                                  ? "text-foreground/85"
                                  : "text-muted-foreground/25"
                              }`
                        }`}
                      >
                        {date.getDate()}
                      </span>

                      <div className="flex flex-col items-end gap-1">
                        {isSaturday && isCurrentMonth && (
                          <span className="text-[9px] rounded px-1.5 py-0.5 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/20">
                            เสาร์
                          </span>
                        )}
                        {isSunday && isCurrentMonth && (
                          <span className="text-[9px] rounded px-1.5 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold border border-rose-500/20">
                            อาทิตย์
                          </span>
                        )}
                        {hasSessions && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5 border border-primary/20">
                            {daySessions.length} รอบ
                          </span>
                        )}
                      </div>
                    </div>

                    {!hasSessions && isCurrentMonth && (
                      <div className="pt-2 px-1">
                        <span className="text-[10px] text-muted-foreground/50 font-medium">
                          ไม่มีรอบอบรม
                        </span>
                      </div>
                    )}

                    {/* Sessions in day */}
                    {hasSessions && (
                      <div className="mt-1 space-y-1">
                    {daySessions.slice(0, 3).map((s) => {
                      const isFull = s.capacity !== null && s.taken_seats >= s.capacity;
                      const isLow = s.capacity !== null && s.capacity - s.taken_seats <= 3;

                      return (
                        <button
                          key={s.session_id}
                          onClick={() => setSelectedSession(s)}
                          className={`w-full text-left truncate rounded-lg px-1.5 py-1 text-[11px] font-medium transition-all shadow-sm flex items-center justify-between gap-1 ${
                            s.is_my_session
                              ? "bg-indigo-600 text-white font-semibold shadow-brand"
                              : isFull
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                              : isLow
                              ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-emerald-50 text-emerald-900 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-200"
                          }`}
                        >
                          <span className="truncate">
                            {s.starts_at && new Date(s.starts_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}{" "}
                            {s.course_title}
                          </span>
                          {s.team_attendees_count > 0 && (
                            <span className="shrink-0 text-[10px] bg-primary/20 rounded px-1 text-primary-deep font-bold">
                              👥{s.team_attendees_count}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {daySessions.length > 3 && (
                      <button
                        onClick={() => {
                          const first = daySessions[0];
                          if (first) setSelectedSession(first);
                        }}
                        className="w-full text-center text-[10px] font-semibold text-primary hover:underline py-0.5"
                      >
                        +{daySessions.length - 3} รอบเพิ่มเติม
                      </button>
                    )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Agenda View */
        <div className="space-y-4">
          {filteredSessions.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center text-muted-foreground">
              ไม่พบตารางการอบรมที่ตรงกับเงื่อนไข
            </div>
          ) : (
            filteredSessions.map((s) => {
              const learnerConflicts = getLearnerConflicts(s);
              const roomCollisions = me?.isStaff ? getRoomCollisions(s) : [];
              const isFull = s.capacity !== null && s.taken_seats >= s.capacity;
              const isLow = s.capacity !== null && s.capacity - s.taken_seats <= 3;

              return (
                <div
                  key={s.session_id}
                  className={`glass rounded-3xl p-5 transition-all hover:border-primary/50 ${
                    s.is_my_session ? "border-l-4 border-l-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/10" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        {s.course_category && (
                          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                            {s.course_category}
                          </span>
                        )}
                        <span className="text-xs font-bold text-muted-foreground">
                          รอบที่ {s.round_no}
                        </span>
                        {s.is_my_session && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                            <CheckCircle2 className="h-3 w-3" />
                            ฉันลงทะเบียนรอบนี้
                          </span>
                        )}
                        {s.my_checked_in && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                            <CheckCircle2 className="h-3 w-3" />
                            เช็คชื่อแล้ว
                          </span>
                        )}
                        {s.team_attendees_count > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 px-2.5 py-0.5 text-[11px] font-semibold">
                            <Users className="h-3 w-3" />
                            สมาชิกในสังกัด {s.team_attendees_count} คน
                          </span>
                        )}
                        {s.starts_at && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              new Date(s.starts_at).getDay() === 6
                                ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-400/40"
                                : new Date(s.starts_at).getDay() === 0
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-400/40"
                                : "bg-card border border-border/80 text-muted-foreground"
                            }`}
                          >
                            {new Date(s.starts_at).getDay() === 6
                              ? "วันเสาร์ (ม่วง)"
                              : new Date(s.starts_at).getDay() === 0
                              ? "วันอาทิตย์ (แดง)"
                              : "วันธรรมดา (จันทร์-ศุกร์)"}
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-foreground hover:text-primary transition-colors">
                        <Link to="/courses/$courseId" params={{ courseId: s.course_id }}>
                          {s.course_title}
                        </Link>
                      </h3>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                        <span className={`flex items-center gap-1 ${
                          s.starts_at && new Date(s.starts_at).getDay() === 6
                            ? "text-purple-700 dark:text-purple-400 font-bold"
                            : s.starts_at && new Date(s.starts_at).getDay() === 0
                            ? "text-rose-600 dark:text-rose-400 font-bold"
                            : ""
                        }`}>
                          <CalendarIcon className={`h-3.5 w-3.5 ${
                            s.starts_at && new Date(s.starts_at).getDay() === 6
                              ? "text-purple-600"
                              : s.starts_at && new Date(s.starts_at).getDay() === 0
                              ? "text-rose-500"
                              : "text-primary"
                          }`} />
                          {s.starts_at
                            ? new Date(s.starts_at).toLocaleDateString("th-TH", {
                                dateStyle: "long",
                              })
                            : "ยังไม่กำหนดวัน"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {s.starts_at
                            ? new Date(s.starts_at).toLocaleTimeString("th-TH", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                          {s.ends_at
                            ? ` - ${new Date(s.ends_at).toLocaleTimeString("th-TH", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : ""}
                        </span>
                        {s.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            {s.location}
                          </span>
                        )}
                        {s.instructor_name && (
                          <span className="text-muted-foreground">
                            วิทยากร: <strong className="text-foreground">{s.instructor_name}</strong>
                          </span>
                        )}
                      </div>

                      {/* Conflict Warnings */}
                      {learnerConflicts.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-rose-500/10 p-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          เวลาซ้ำซ้อนกับหลักสูตรที่คุณลงไว้:{" "}
                          {learnerConflicts.map((c) => c.course_title).join(", ")}
                        </div>
                      )}

                      {roomCollisions.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-amber-500/10 p-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                          <ShieldAlert className="h-4 w-4 shrink-0" />
                          แจ้งเตือนห้องซ้ำซ้อน: ห้อง {s.location} มีการจัดหลักสูตร{" "}
                          {roomCollisions.map((c) => c.course_title).join(", ")} ในเวลาเดียวกัน
                        </div>
                      )}
                    </div>

                    {/* Seat Quota & Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">โควต้าที่นั่ง</div>
                        <div className="text-sm font-bold">
                          {isFull ? (
                            <span className="text-rose-600 font-extrabold">เต็มแล้ว ({s.taken_seats}/{s.capacity})</span>
                          ) : isLow ? (
                            <span className="text-amber-600">
                              เหลือ {s.capacity! - s.taken_seats} ที่ (จาก {s.capacity})
                            </span>
                          ) : s.capacity ? (
                            <span className="text-emerald-600">
                              ว่าง {s.capacity - s.taken_seats} ที่ ({s.taken_seats}/{s.capacity})
                            </span>
                          ) : (
                            <span className="text-muted-foreground">ไม่จำกัด ({s.taken_seats} คน)</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadIcs(s)}
                          className="h-8 gap-1 text-xs"
                          title="ดาวน์โหลดไฟล์ .ics"
                        >
                          <Download className="h-3 w-3" />
                          .ics
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setSelectedSession(s)}
                          className="h-8 text-xs font-semibold"
                        >
                          ดูรายละเอียด
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
        </main>
      </div>

      {/* Session Details & Action Modal */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        {selectedSession && (
          <DialogContent className="glass max-w-lg rounded-3xl p-6">
            <DialogHeader>
              <div className="flex items-center gap-2">
                {selectedSession.course_category && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {selectedSession.course_category}
                  </span>
                )}
                <span className="text-xs font-bold text-muted-foreground">
                  รอบที่ {selectedSession.round_no}
                </span>
              </div>
              <DialogTitle className="mt-1 text-xl font-bold">
                {selectedSession.course_title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                กลุ่มเป้าหมาย: {selectedSession.audience || "บุคลากรทุกท่าน"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-card/60 p-4 border text-xs">
                <div>
                  <span className="text-muted-foreground block">วันเวลาจัดอบรม</span>
                  <strong className="text-foreground">
                    {selectedSession.starts_at
                      ? new Date(selectedSession.starts_at).toLocaleString("th-TH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "ยังไม่กำหนด"}
                    {selectedSession.ends_at &&
                      ` - ${new Date(selectedSession.ends_at).toLocaleTimeString("th-TH", {
                        timeStyle: "short",
                      })}`}
                  </strong>
                </div>

                <div>
                  <span className="text-muted-foreground block">สถานที่ / ห้องอบรม</span>
                  <strong className="text-foreground">{selectedSession.location || "-"}</strong>
                </div>

                <div>
                  <span className="text-muted-foreground block">วิทยากร</span>
                  <strong className="text-foreground">{selectedSession.instructor_name || "-"}</strong>
                </div>

                <div>
                  <span className="text-muted-foreground block">สถานะที่นั่ง</span>
                  <strong
                    className={
                      selectedSession.capacity && selectedSession.taken_seats >= selectedSession.capacity
                        ? "text-rose-600"
                        : "text-emerald-600"
                    }
                  >
                    {selectedSession.capacity
                      ? `${selectedSession.taken_seats} / ${selectedSession.capacity} ที่นั่ง`
                      : `ลงทะเบียน ${selectedSession.taken_seats} คน (ไม่จำกัด)`}
                  </strong>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap gap-2">
                {selectedSession.is_my_session && (
                  <div className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600/10 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <UserCheck className="h-4 w-4" />
                    คุณลงทะเบียนในรอบนี้แล้ว
                  </div>
                )}
                {selectedSession.my_checked_in && (
                  <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    เช็คชื่อเข้าเรียนแล้ว
                  </div>
                )}
                {selectedSession.team_attendees_count > 0 && (
                  <div className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <Users className="h-4 w-4" />
                    มีลูกน้องในสังกัดลงรอบนี้ {selectedSession.team_attendees_count} คน
                  </div>
                )}
              </div>

              {/* Conflict alerts in dialog */}
              {getLearnerConflicts(selectedSession).length > 0 && (
                <div className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>คำเตือน:</strong> ช่วงเวลานี้ชนกับหลักสูตรที่คุณลงไว้:
                    <ul className="list-disc pl-4 mt-1">
                      {getLearnerConflicts(selectedSession).map((c) => (
                        <li key={c.session_id}>{c.course_title} (รอบที่ {c.round_no})</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Calendar Sync actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadIcs(selectedSession)}
                  className="flex-1 gap-1 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  บันทึกลง Outlook / Apple (.ics)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openGoogleCalendar(selectedSession)}
                  className="flex-1 gap-1 text-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  เพิ่มใน Google Calendar
                </Button>
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-2">
                <Button variant="ghost" asChild size="sm">
                  <Link to="/courses/$courseId" params={{ courseId: selectedSession.course_id }}>
                    ดูหน้ารายละเอียดวิชา →
                  </Link>
                </Button>

                <div className="flex items-center gap-2">
                  {!selectedSession.is_my_session && (
                    <Button
                      onClick={() => handleChooseSession(selectedSession)}
                      disabled={
                        isActionLoading ||
                        (selectedSession.capacity !== null &&
                          selectedSession.taken_seats >= selectedSession.capacity)
                      }
                      className="font-semibold"
                    >
                      {isActionLoading
                        ? "กำลังบันทึก..."
                        : selectedSession.capacity !== null &&
                          selectedSession.taken_seats >= selectedSession.capacity
                        ? "ที่นั่งเต็มแล้ว"
                        : "เลือกรอบนี้"}
                    </Button>
                  )}

                  {me?.isStaff && (
                    <Button variant="outline" asChild size="sm">
                      <Link
                        to="/manage/$courseId/room"
                        params={{ courseId: selectedSession.course_id }}
                      >
                        เข้าห้อง 3D Room
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
