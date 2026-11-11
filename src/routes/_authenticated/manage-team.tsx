import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import {
  Users,
  LayoutGrid,
  Calendar,
  CheckCircle2,
  Clock3,
  MapPin,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Search,
  Check,
  ShieldCheck,
  Layers,
  X,
  Loader2,
  Building2,
  ChevronDown,
  ChevronUp,
  Award,
  GraduationCap,
  Percent,
  CheckCheck,
  Download,
  FileSpreadsheet,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/manage-team")({
  head: () => ({
    meta: [
      { title: "ทีมของฉัน — ศูนย์จัดสรรการอบรม โรงพยาบาลโอเวอร์บรุ๊ค" },
      { name: "description", content: "จัดสรรบุคลากรเข้าอบรมในแต่ละหลักสูตรและรอบการอบรม" },
      { property: "og:title", content: "ทีมของฉัน — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:description", content: "จัดสรรบุคลากรเข้าอบรมในแต่ละหลักสูตรและรอบการอบรม" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamAllocationHub,
});

type SessionInfo = {
  id: string;
  round_no: number;
  starts_at: string | null;
  ends_at: string | null;
  location: string;
  capacity: number | null;
};

type CourseInfo = {
  id: string;
  title: string;
  category: string | null;
  hours: number | null;
  cover_url: string | null;
  course_sessions: SessionInfo[];
};

type Member = {
  user_id: string;
  full_name: string;
  division: string;
  department: string;
  position: string;
  approved: boolean;
};

type Enrollment = {
  user_id: string;
  course_id: string;
  session_id: string | null;
  round_no: number | null;
  starts_at: string | null;
  attended: boolean;
  has_cert: boolean;
  require_pretest: boolean;
  pre_done: boolean;
  total_lessons?: number;
  lessons_done?: number;
  require_posttest?: boolean;
  post_done?: boolean;
  require_survey?: boolean;
  survey_done?: boolean;
  issue_certificate?: boolean;
};

type RecentAllocationInfo = {
  sessionId: string;
  departments: string[];
  userIds: string[];
  timestamp: number;
};

type TrainingProcessStatus = "certified" | "attended" | "need_pretest" | "assigned" | "unassigned";

function getTrainingProcessStatus(enr: Enrollment | undefined): {
  key: TrainingProcessStatus;
  label: string;
  shortLabel: string;
  badgeClass: string;
  icon: typeof CheckCircle2;
} {
  if (!enr || !enr.session_id) {
    return {
      key: "unassigned",
      label: enr ? "ลงทะเบียนแล้ว (ยังไม่จัดรอบ)" : "ยังไม่จัดรอบ",
      shortLabel: "ยังไม่จัดรอบ",
      badgeClass: "bg-muted text-muted-foreground border-border/80",
      icon: Clock3,
    };
  }
  if (enr.has_cert) {
    return {
      key: "certified",
      label: "สำเร็จ (ได้รับใบประกาศแล้ว)",
      shortLabel: "ได้ใบประกาศ 🎓",
      badgeClass: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300/80 dark:border-emerald-700/80 font-bold",
      icon: Award,
    };
  }
  if (enr.attended) {
    return {
      key: "attended",
      label: "เช็คชื่อเข้าห้องแล้ว (รอจบหลักสูตร)",
      shortLabel: "เช็คชื่อแล้ว ✓",
      badgeClass: "bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-300/80 dark:border-teal-700/80 font-bold",
      icon: CheckCircle2,
    };
  }
  if (enr.require_pretest && !enr.pre_done) {
    return {
      key: "need_pretest",
      label: `รอบที่ ${enr.round_no} (ค้างทำแบบทดสอบก่อนเรียน)`,
      shortLabel: 'ค้าง Pre-test',
      badgeClass: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300/80 dark:border-amber-700/80 font-bold",
      icon: AlertCircle,
    };
  }
  return {
    key: "assigned",
    label: `รอบที่ ${enr.round_no} (รอวันอบรม)`,
    shortLabel: `รอบที่ ${enr.round_no}`,
    badgeClass: "bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-300/80 dark:border-sky-700/80 font-bold",
    icon: Calendar,
  };
}

function getDeptAvatarStyle(dept: string) {
  const hash = dept.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const styles = [
    "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-300/60 dark:border-sky-700/60",
    "bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-300/60 dark:border-teal-700/60",
    "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-300/60 dark:border-indigo-700/60",
    "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-300/60 dark:border-violet-700/60",
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60",
    "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60",
  ];
  return styles[hash % styles.length] ?? styles[0];
}

/* ------------------------------------------------------------------------- */
/* SUB-COMPONENT: SESSION ATTENDEES INSPECTOR & SHIFT BALANCER               */
/* ------------------------------------------------------------------------- */
function SessionAttendeesSection({
  session,
  allSessions,
  courseId,
  attendees,
  enrollments,
  actionLoading,
  onQuickAssign,
  recentAllocation,
  onClearRecentAllocation,
}: {
  session: SessionInfo;
  allSessions: SessionInfo[];
  courseId: string;
  attendees: Member[];
  enrollments: Map<string, Enrollment>;
  actionLoading: boolean;
  onQuickAssign: (courseId: string, userId: string, targetSessionId: string | null) => Promise<void>;
  recentAllocation?: RecentAllocationInfo | null;
  onClearRecentAllocation?: () => void;
}) {
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grouped" | "compact">("grouped");
  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-focus active for this session when recent allocation exists
  const isRecentFocusActive =
    recentAllocation?.sessionId === session.id &&
    recentAllocation.departments.length > 0 &&
    deptFilter === "all";

  // Departments breakdown count
  const deptCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of attendees) {
      const dept = m.department || m.division || "ไม่ระบุแผนก";
      map.set(dept, (map.get(dept) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([dept, count]) => ({ dept, count }))
      .sort((a, b) => b.count - a.count);
  }, [attendees]);

  // Filter attendees by department & search query
  const filteredAttendees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return attendees.filter((m) => {
      const dept = m.department || m.division || "ไม่ระบุแผนก";
      if (isRecentFocusActive) {
        if (!recentAllocation!.departments.includes(dept)) return false;
      } else if (deptFilter !== "all" && dept !== deptFilter) {
        return false;
      }
      if (q) {
        const matchName = m.full_name.toLowerCase().includes(q);
        const matchPos = m.position.toLowerCase().includes(q);
        const matchDept = dept.toLowerCase().includes(q);
        if (!matchName && !matchPos && !matchDept) return false;
      }
      return true;
    });
  }, [attendees, deptFilter, searchQuery, isRecentFocusActive, recentAllocation]);

  // Group filtered attendees by department
  const groupedAttendees = useMemo(() => {
    const map = new Map<string, Member[]>();
    for (const m of filteredAttendees) {
      const dept = m.department || m.division || "ไม่ระบุแผนก";
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filteredAttendees]);

  if (attendees.length === 0) {
    return (
      <div className="py-3 text-center text-xs text-muted-foreground italic bg-muted/20 rounded-2xl border border-dashed border-border/60">
        ยังไม่มีสมาชิกในสังกัดลงทะเบียนในรอบนี้
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 hover:text-primary transition cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span>สมาชิกในสังกัดที่จัดไว้ในรอบนี้ ({attendees.length} คน)</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-lg border border-border/70 bg-card p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode("grouped")}
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition cursor-pointer ${
                viewMode === "grouped" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="h-3 w-3" />
              <span>แยกแผนก</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("compact")}
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition cursor-pointer ${
                viewMode === "compact" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-3 w-3" />
              <span>ชิปย่อ</span>
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-2">
          {/* Flash Notification Banner when recent allocation auto-focus is active */}
          {isRecentFocusActive && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-primary/10 border border-primary/25 px-3 py-2 text-xs text-primary animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Sparkles className="h-4 w-4 shrink-0 text-primary animate-pulse" />
                <span>
                  กำลังแสดงเฉพาะแผนกที่เพิ่งจัดสรร:{" "}
                  <strong className="font-bold underline decoration-primary/50">{recentAllocation.departments.join(", ")}</strong>{" "}
                  ({filteredAttendees.length} คนในรอบนี้)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClearRecentAllocation?.();
                  setDeptFilter("all");
                }}
                className="rounded-lg bg-primary text-primary-foreground px-2.5 py-1 text-[11px] font-bold hover:bg-primary/90 transition shrink-0 cursor-pointer shadow-xs"
              >
                ดูทุกแผนก
              </button>
            </div>
          )}

          {/* Department Filter Dropdown + Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {deptCounts.length > 1 ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-[220px] max-w-md">
                <div className="relative w-full">
                  <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary pointer-events-none" />
                  <select
                    value={isRecentFocusActive ? "recent" : deptFilter}
                    onChange={(e) => {
                      onClearRecentAllocation?.();
                      const val = e.target.value;
                      setDeptFilter(val === "recent" ? "all" : val);
                    }}
                    className={`w-full appearance-none pl-8 pr-8 py-1.5 text-xs rounded-xl border transition cursor-pointer font-medium ${
                      deptFilter !== "all" || isRecentFocusActive
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                        : "border-border/80 bg-background text-foreground hover:border-primary/50"
                    }`}
                    title="เลือกกรองตามหน่วยงาน/แผนก"
                  >
                    {isRecentFocusActive && (
                      <option value="recent">
                        ⚡ เพิ่งจัดสรร: {recentAllocation?.departments.join(", ")} ({filteredAttendees.length} คน)
                      </option>
                    )}
                    <option value="all">🏢 แสดงทุกแผนกในรอบนี้ ({attendees.length} คน)</option>
                    {deptCounts.map(({ dept, count }) => (
                      <option key={dept} value={dept}>
                        {dept} ({count} คน)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>

                {(deptFilter !== "all" || isRecentFocusActive) && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearRecentAllocation?.();
                      setDeptFilter("all");
                    }}
                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground underline shrink-0 px-1 cursor-pointer"
                    title="แสดงทุกแผนก"
                  >
                    ล้าง
                  </button>
                )}
              </div>
            ) : (
              <div />
            )}

            {attendees.length >= 4 && (
              <div className="relative shrink-0 sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="ค้นหารายชื่อในรอบนี้..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1 text-xs rounded-xl border border-border/80 bg-background/80 placeholder:text-muted-foreground/60 focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {filteredAttendees.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl">
              ไม่พบสมาชิกที่ตรงกับเงื่อนไข{" "}
              <button
                type="button"
                onClick={() => {
                  setDeptFilter("all");
                  setSearchQuery("");
                }}
                className="text-primary underline ml-1 font-semibold cursor-pointer"
              >
                ล้างการค้นหา
              </button>
            </div>
          ) : viewMode === "grouped" ? (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {groupedAttendees.map(([dept, members]) => (
                <div key={dept} className="rounded-2xl border border-border/70 bg-card p-3 space-y-2.5 shadow-2xs">
                  {/* Clean Department Header Banner */}
                  <div className="flex items-center justify-between text-xs rounded-xl bg-muted/60 border border-border/60 px-3 py-1.5 font-bold">
                    <div className="flex items-center gap-2 text-foreground font-bold">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span>{dept}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-foreground/10 text-foreground border border-border/50">
                      {members.length} คน
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {members.map((m) => {
                      const enr = enrollments.get(m.user_id);
                      const status = getTrainingProcessStatus(enr);
                      const StatusIcon = status.icon;
                      const isRecentlyAdded =
                        recentAllocation?.sessionId === session.id &&
                        recentAllocation?.userIds.includes(m.user_id);

                      return (
                        <div
                          key={m.user_id}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border p-3 text-xs shadow-2xs transition ${
                            isRecentlyAdded
                              ? "border-2 border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-400/30"
                              : "border-border/80 bg-background hover:border-primary/50 hover:bg-muted/30"
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-3 flex-1">
                            <div
                              className={`h-8 w-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs ${getDeptAvatarStyle(dept)}`}
                            >
                              {m.full_name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-foreground text-xs sm:text-sm whitespace-normal leading-snug">{m.full_name}</span>
                                {isRecentlyAdded && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-600 text-white shrink-0 shadow-2xs">
                                    ✨ เพิ่งจัดสรร
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate font-medium">
                                {m.position || "ไม่ระบุตำแหน่ง"}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
                            {/* Process Status Tag */}
                            {status.key !== "assigned" && (
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border shadow-2xs ${status.badgeClass}`}
                                title={status.label}
                              >
                                <StatusIcon className="h-2.5 w-2.5" />
                                <span>{status.shortLabel}</span>
                              </span>
                            )}

                            {/* Actions: Move or Remove */}
                            {!enr?.attended && (
                              <div className="flex items-center gap-1">
                                {allSessions.length > 1 && (
                                  <select
                                    value={session.id}
                                    disabled={actionLoading}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      onQuickAssign(courseId, m.user_id, val === "unassigned" ? null : val);
                                    }}
                                    className="text-[10px] font-bold rounded-lg border border-border bg-card px-1.5 py-0.5 hover:border-primary transition cursor-pointer"
                                    title="ย้ายรอบอบรม"
                                  >
                                    <option value={session.id}>รอบ {session.round_no}</option>
                                    {allSessions
                                      .filter((other) => other.id !== session.id)
                                      .map((other) => (
                                        <option key={other.id} value={other.id}>
                                          ย้ายไป รอบ {other.round_no}
                                        </option>
                                      ))}
                                    <option value="unassigned">ถอนออกจากรอบนี้</option>
                                  </select>
                                )}

                                <button
                                  type="button"
                                  onClick={() => onQuickAssign(courseId, m.user_id, null)}
                                  disabled={actionLoading}
                                  title="ถอนออกจากรอบนี้"
                                  className="text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 p-1 rounded-lg transition cursor-pointer"
                                >
                                  <X className="h-3.5 w-3.5 stroke-[2.5]" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
              {filteredAttendees.map((m) => {
                const enr = enrollments.get(m.user_id);
                const status = getTrainingProcessStatus(enr);
                const StatusIcon = status.icon;
                const isRecentlyAdded =
                  recentAllocation?.sessionId === session.id &&
                  recentAllocation?.userIds.includes(m.user_id);

                return (
                  <span
                    key={m.user_id}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-medium shadow-2xs transition ${
                      isRecentlyAdded
                        ? "border-emerald-500 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/30"
                        : "border-border/70 bg-card hover:border-primary/40"
                    }`}
                  >
                    <span className="font-semibold">{m.full_name}</span>
                    <span className="text-[10px] text-muted-foreground">({m.department || m.division})</span>
                    <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-md border ${status.badgeClass}`}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      <span>{status.shortLabel}</span>
                    </span>
                    {!enr?.attended && (
                      <button
                        type="button"
                        onClick={() => onQuickAssign(courseId, m.user_id, null)}
                        disabled={actionLoading}
                        title="ถอนออกจากรอบนี้"
                        className="text-muted-foreground hover:text-destructive text-sm leading-none ml-0.5 cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* MAIN COMPONENT: TEAM ALLOCATION HUB                                       */
/* ------------------------------------------------------------------------- */
type StatusFilterType = "all" | "unassigned" | "assigned" | "need_pretest" | "attended" | "certified";

function TeamAllocationHub() {
  const { data: me } = useMe();
  const qc = useQueryClient();

  // Primary navigation: Allocation Board vs Matrix Overview
  const [viewMode, setViewMode] = useState<"allocation" | "matrix">("allocation");

  // Selected course for the allocation board
  const [activeCourseId, setActiveCourseId] = useState<string>("");

  // Member selection for batch assignment
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters for member roster
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("all");

  // Seat counts cache: { [sessionId]: takenCount }
  const [seatsMap, setSeatsMap] = useState<Record<string, number>>({});

  // Context of the most recent batch allocation
  const [recentAllocation, setRecentAllocation] = useState<RecentAllocationInfo | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["team-allocation-hub", me?.id],
    enabled: !!me?.isTeamManager,
    queryFn: async () => {
      const [{ data: members }, { data: enr }, { data: courses }] = await Promise.all([
        supabase.rpc("get_team_members"),
        supabase.rpc("get_team_enrollments"),
        supabase
          .from("courses")
          .select("id,title,category,hours,cover_url,course_sessions(id,round_no,starts_at,ends_at,location,capacity)")
          .eq("published", true)
          .order("title"),
      ]);

      return {
        members: (members ?? []) as Member[],
        enr: (enr ?? []) as Enrollment[],
        courses: (courses ?? []) as CourseInfo[],
      };
    },
  });

  // Set default active course on load
  useEffect(() => {
    if (data?.courses && data.courses.length > 0 && !activeCourseId) {
      const firstId = data.courses[0]?.id;
      if (firstId) setActiveCourseId(firstId);
    }
  }, [data, activeCourseId]);

  // Fetch real-time session seats when active course changes
  useEffect(() => {
    if (!activeCourseId) return;
    supabase.rpc("session_seats", { _course: activeCourseId }).then(({ data: seats }) => {
      if (seats) {
        const map: Record<string, number> = {};
        for (const row of seats) {
          map[row.session_id] = row.taken;
        }
        setSeatsMap(map);
      }
    });
  }, [activeCourseId]);

  const activeCourse = useMemo(
    () => data?.courses.find((c) => c.id === activeCourseId) ?? data?.courses[0],
    [data, activeCourseId]
  );

  const departments = useMemo(() => {
    if (!data?.members) return [];
    return [...new Set(data.members.map((m) => m.department || m.division).filter(Boolean))].sort();
  }, [data?.members]);

  // Map enrollments for active course
  const activeCourseEnrollments = useMemo(() => {
    if (!data?.enr || !activeCourse) return new Map<string, Enrollment>();
    const map = new Map<string, Enrollment>();
    for (const e of data.enr) {
      if (e.course_id === activeCourse.id) {
        map.set(e.user_id, e);
      }
    }
    return map;
  }, [data?.enr, activeCourse]);

  // Status counts for the active course
  const statusCounts = useMemo(() => {
    if (!data?.members) {
      return { all: 0, unassigned: 0, assigned: 0, need_pretest: 0, attended: 0, certified: 0 };
    }
    let unassigned = 0;
    let assigned = 0;
    let need_pretest = 0;
    let attended = 0;
    let certified = 0;

    for (const m of data.members) {
      const enr = activeCourseEnrollments.get(m.user_id);
      const status = getTrainingProcessStatus(enr);
      if (status.key === "unassigned") unassigned++;
      else if (status.key === "assigned") assigned++;
      else if (status.key === "need_pretest") need_pretest++;
      else if (status.key === "attended") attended++;
      else if (status.key === "certified") certified++;
    }

    return {
      all: data.members.length,
      unassigned,
      assigned,
      need_pretest,
      attended,
      certified,
    };
  }, [data?.members, activeCourseEnrollments]);

  // Roster members for active course
  const roster = useMemo(() => {
    if (!data?.members || !activeCourse) return [];
    const q = searchQuery.trim().toLowerCase();

    return data.members.filter((m) => {
      if (q && !m.full_name.toLowerCase().includes(q) && !(m.position || "").toLowerCase().includes(q)) {
        return false;
      }
      if (filterDept && (m.department || m.division) !== filterDept) {
        return false;
      }
      const enr = activeCourseEnrollments.get(m.user_id);
      const status = getTrainingProcessStatus(enr);

      if (statusFilter === "unassigned" && status.key !== "unassigned") return false;
      if (statusFilter === "assigned" && status.key !== "assigned") return false;
      if (statusFilter === "need_pretest" && status.key !== "need_pretest") return false;
      if (statusFilter === "attended" && status.key !== "attended") return false;
      if (statusFilter === "certified" && status.key !== "certified") return false;

      return true;
    });
  }, [data?.members, activeCourse, activeCourseEnrollments, searchQuery, filterDept, statusFilter]);

  // Unassigned members count for active course
  const unassignedMembers = useMemo(() => {
    if (!data?.members) return [];
    return data.members.filter((m) => !activeCourseEnrollments.get(m.user_id)?.session_id);
  }, [data?.members, activeCourseEnrollments]);

  // Execution: Assign selected members to a target session
  async function handleAssignToSession(targetSessionId: string | null) {
    if (!activeCourse) return;
    if (selectedUserIds.length === 0) {
      toast.error("กรุณาเลือกสมาชิกอย่างน้อย 1 คนจากรายชื่อด้านซ้าย");
      return;
    }

    const assignedUserIds = [...selectedUserIds];
    const targetMemberDepts = Array.from(
      new Set(
        (data?.members ?? [])
          .filter((m) => assignedUserIds.includes(m.user_id))
          .map((m) => m.department || m.division || "ไม่ระบุแผนก")
      )
    );

    setActionLoading(true);
    try {
      const { data: res, error } = await supabase.rpc("manager_assign_course", {
        _course: activeCourse.id,
        _session: targetSessionId,
        _user_ids: assignedUserIds,
      });

      if (error) {
        toast.error("จัดสรรไม่สำเร็จ: " + error.message);
        return;
      }

      const summary = res as {
        success: boolean;
        assigned_count: number;
        skipped_attended: number;
      };

      const targetSession = activeCourse.course_sessions.find((s) => s.id === targetSessionId);
      const sessionTitle = targetSession ? `รอบที่ ${targetSession.round_no}` : "ลงทะเบียน (ไม่ระบุรอบ)";

      toast.success(
        `จัดสรรสมาชิก ${summary.assigned_count} คน เข้าสู่${sessionTitle} สำเร็จ!${
          summary.skipped_attended > 0 ? ` (ข้าม ${summary.skipped_attended} คนที่เช็คชื่อเข้าห้องแล้ว)` : ""
        }`,
        { duration: 4000 }
      );

      // Track recent allocation for automatic department focus in session view
      if (targetSessionId) {
        setRecentAllocation({
          sessionId: targetSessionId,
          departments: targetMemberDepts,
          userIds: assignedUserIds,
          timestamp: Date.now(),
        });
      } else {
        setRecentAllocation(null);
      }

      // Refresh data and reset selection
      setSelectedUserIds([]);
      await qc.invalidateQueries({ queryKey: ["team-allocation-hub"] });
      // Re-fetch seats
      supabase.rpc("session_seats", { _course: activeCourse.id }).then(({ data: seats }) => {
        if (seats) {
          const map: Record<string, number> = {};
          for (const row of seats) {
            map[row.session_id] = row.taken;
          }
          setSeatsMap(map);
        }
      });
    } catch (err: any) {
      toast.error("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // Quick single-member assignment in matrix or board
  async function handleQuickAssignSingle(courseId: string, userId: string, targetSessionId: string | null) {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc("manager_assign_course", {
        _course: courseId,
        _session: targetSessionId,
        _user_ids: [userId],
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("บันทึกการจัดรอบเรียบร้อย");
      qc.invalidateQueries({ queryKey: ["team-allocation-hub"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // Selection handlers
  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllVisible = () => {
    const ids = roster.map((m) => m.user_id);
    setSelectedUserIds((prev) => [...new Set([...prev, ...ids])]);
  };

  const selectAllUnassigned = () => {
    const ids = unassignedMembers.map((m) => m.user_id);
    setSelectedUserIds(ids);
  };

  const selectAllNeedPretest = () => {
    const ids = (data?.members ?? [])
      .filter((m) => {
        const enr = activeCourseEnrollments.get(m.user_id);
        return enr?.require_pretest && !enr?.pre_done;
      })
      .map((m) => m.user_id);
    setSelectedUserIds(ids);
  };

  // 1-Click Export: สรุปผลการอบรมของวิชาที่เลือก
  async function exportCourseSummary() {
    if (!activeCourse || !data?.members) {
      toast.error("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }

    const XLSX = await import("xlsx");
    const rows = data.members.map((m, idx) => {
      const enr = activeCourseEnrollments.get(m.user_id);
      const st = getTrainingProcessStatus(enr);
      return {
        "ลำดับ": idx + 1,
        "ชื่อ-นามสกุล": m.full_name,
        "ฝ่าย": m.division || "-",
        "แผนก": m.department || "-",
        "ตำแหน่ง": m.position || "-",
        "หลักสูตร": activeCourse.title,
        "สถานะการอบรม": st.label,
        "รอบอบรม": enr?.round_no ? `รอบที่ ${enr.round_no}` : "ยังไม่จัดรอบ",
        "วันเวลาอบรม": enr?.starts_at ? new Date(enr.starts_at).toLocaleString("th-TH") : "-",
        "เช็คชื่อเข้าห้อง": enr?.attended ? "เช็คชื่อแล้ว ✓" : "ยังไม่เช็คชื่อ",
        "คะแนน Pre-test (%)": enr?.pre_score != null ? `${enr.pre_score}%` : "-",
        "คะแนน Post-test (%)": enr?.post_score != null ? `${enr.post_score}%` : "-",
        "ผลการประเมิน": enr?.has_cert ? "ผ่านเกณฑ์ (ได้ใบประกาศแล้ว) 🎓" : "ยังไม่ผ่านเกณฑ์",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "สรุปผลการอบรม");
    const cleanTitle = activeCourse.title.replace(/[\/\\?%*:|"<>]/g, "_").slice(0, 30);
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `รายงานสรุปผลอบรม_${cleanTitle}_${dateStr}.xlsx`);
    toast.success(`ส่งออกรายงานวิชา ${activeCourse.title} เรียบร้อยแล้ว 📊`);
  }

  // 1-Click Export: สรุปภาพรวม Matrix ทุกวิชาของแผนก (สำหรับหัวหน้างาน / ตรวจ HA)
  async function exportMatrixSummary() {
    if (!data?.members || !data?.courses) {
      toast.error("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }

    const XLSX = await import("xlsx");

    // Sheet 1: Matrix รายบุคคล x ทุกวิชา
    const matrixRows = data.members.map((m, idx) => {
      const row: Record<string, any> = {
        "ลำดับ": idx + 1,
        "ชื่อ-นามสกุล": m.full_name,
        "ฝ่าย": m.division || "-",
        "แผนก": m.department || "-",
        "ตำแหน่ง": m.position || "-",
      };

      let passedCount = 0;
      data.courses.forEach((c) => {
        const enr = data.enr.find((e) => e.user_id === m.user_id && e.course_id === c.id);
        const st = getTrainingProcessStatus(enr);
        row[c.title] = st.shortLabel;
        if (enr?.has_cert) passedCount++;
      });

      row["จำนวนวิชาที่ผ่าน"] = `${passedCount}/${data.courses.length}`;
      row["อัตราสำเร็จ (%)"] = `${Math.round((passedCount / data.courses.length) * 100)}%`;
      return row;
    });

    // Sheet 2: สรุปเปอร์เซ็นต์ผ่านแต่ละวิชาของหน่วยงาน
    const courseStatsRows = data.courses.map((c, idx) => {
      const enrs = data.enr.filter((e) => e.course_id === c.id);
      const passed = enrs.filter((e) => e.has_cert).length;
      const attended = enrs.filter((e) => e.attended).length;
      const assigned = enrs.filter((e) => !!e.session_id).length;
      const total = data.members.length;

      return {
        "ลำดับ": idx + 1,
        "ชื่อหลักสูตร": c.title,
        "หมวดหมู่": c.category || "ทั่วไป",
        "จำนวนชั่วโมง": c.hours || 0,
        "จำนวนบุคลากรในสังกัด": total,
        "จัดรอบแล้ว (คน)": assigned,
        "เช็คชื่อเข้าห้องแล้ว (คน)": attended,
        "ผ่านเกณฑ์แล้ว (คน)": passed,
        "สัดส่วนผ่านเกณฑ์ (%)": `${total > 0 ? Math.round((passed / total) * 100) : 0}%`,
      };
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(matrixRows);
    const ws2 = XLSX.utils.json_to_sheet(courseStatsRows);
    XLSX.utils.book_append_sheet(wb, ws1, "Matrix_รายบุคคล");
    XLSX.utils.book_append_sheet(wb, ws2, "สถิติสรุปตามวิชา");

    const deptName = (me?.department || me?.division || "ทีม").replace(/[\/\\?%*:|"<>]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `รายงานผลอบรมภาพรวม_${deptName}_${dateStr}.xlsx`);
    toast.success(`ส่งออกรายงานภาพรวมแผนก ${deptName} เรียบร้อยแล้ว 📑`);
  }

  if (!me?.isTeamManager) {
    return (
      <div className="glass rounded-3xl p-12 text-center space-y-2">
        <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto" />
        <h3 className="text-lg font-bold">เฉพาะหัวหน้าฝ่าย / หัวหน้าแผนก / หัวหน้าหน่วย</h3>
        <p className="text-sm text-muted-foreground">สำหรับบริหารจัดการและจัดสรรสมาชิกในหน่วยงานเข้าอบรม</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return <div className="text-muted-foreground p-8">กำลังโหลดศูนย์จัดสรรการอบรม...</div>;
  }

  const totalMembersCount = data.members.length;

  return (
    <div className="space-y-6">
      {/* 1. Header & Executive Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <PageHeader eyebrow="ศูนย์จัดสรรและบริหารการอบรม" title="ทีมของฉัน" />
          <p className="text-xs text-muted-foreground -mt-3">
            จัดสรรบุคลากรในสังกัดเข้าอบรมตามรอบที่กำหนด ดูแลโควต้าที่นั่ง และติดตามความคืบหน้ารายบุคคล
          </p>
        </div>

        {/* Actions & View Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* 1-Click Export Actions */}
          <div className="flex items-center gap-1 rounded-2xl border border-glass-border bg-glass/80 p-1 shadow-2xs backdrop-blur-md">
            <button
              onClick={exportCourseSummary}
              title="ส่งออกรายงาน Excel สรุปผลของวิชาที่เลือกในปัจจุบัน"
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground/80 hover:bg-card hover:text-primary transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export วิชานี้ (.xlsx)</span>
            </button>
            <button
              onClick={exportMatrixSummary}
              title="ส่งออกรายงานภาพรวมทุกหลักสูตรของสมาชิกในแผนก (สำหรับตรวจ HA)"
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground/80 hover:bg-card hover:text-primary transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>Export ภาพรวมแผนก (.xlsx)</span>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 rounded-2xl border bg-card p-1 shadow-2xs">
            <button
              onClick={() => setViewMode("allocation")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                viewMode === "allocation"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>กระดานจัดสรรการอบรม (Allocation Board)</span>
            </button>
            <button
              onClick={() => setViewMode("matrix")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                viewMode === "matrix"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              <span>ตารางสรุปภาพรวม Matrix</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass rounded-2xl p-4">
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>สมาชิกในสังกัดทั้งหมด</span>
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">{totalMembersCount} คน</div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>หลักสูตรเปิดอบรม</span>
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary mt-1">{data.courses.length} หลักสูตร</div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>ยังไม่จัดรอบในวิชานี้</span>
            <Clock3 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{statusCounts.unassigned} คน</div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>จัดรอบแล้วในวิชานี้</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {totalMembersCount - statusCounts.unassigned} คน
          </div>
        </div>
      </div>

      {viewMode === "allocation" ? (
        /* ========================================================================= */
        /* MODE 1: ALLOCATION WORKBENCH (กระดานจัดสรรคนเข้าอบรม - Course Allocation) */
        /* ========================================================================= */
        <div className="space-y-5">
          {/* Step-by-Step Guided Workflow Banner */}
          <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card/90 to-primary/5 p-3.5 shadow-xs">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">ขั้นตอนการจัดสรรลูกทีมเข้าอบรม</h4>
                  <p className="text-[11px] text-muted-foreground">ทำตาม 3 ขั้นตอนง่ายๆ ด้านล่าง</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 md:max-w-2xl">
                {/* Step 1 */}
                <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
                    1
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-foreground text-[11px] truncate">เลือกหลักสูตร</div>
                    <div className="text-[10px] text-muted-foreground truncate">{activeCourse?.title || "เลือกจากแถบด้านล่าง"}</div>
                  </div>
                </div>

                {/* Step 2 */}
                <div
                  className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition ${
                    selectedUserIds.length > 0
                      ? "border-primary bg-primary/10 text-primary shadow-2xs"
                      : "border-border/70 bg-background/80"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                      selectedUserIds.length > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    2
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-[11px] truncate">ติ๊กเลือกลูกทีม</div>
                    <div className="text-[10px] truncate">
                      {selectedUserIds.length > 0 ? `✓ เลือกแล้ว ${selectedUserIds.length} คน` : "ติ๊กจากกล่องซ้ายมือ"}
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div
                  className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition ${
                    selectedUserIds.length > 0
                      ? "border-emerald-500/80 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 shadow-2xs"
                      : "border-border/70 bg-background/80"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                      selectedUserIds.length > 0 ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    3
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-[11px] truncate">กดส่งเข้าห้องอบรม</div>
                    <div className="text-[10px] truncate">
                      {selectedUserIds.length > 0 ? "กดปุ่มในรอบที่ต้องการ" : "ปุ่มทางขวามือ"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Course Selector Tabs - Compact Sleek Ribbon */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">เลือกหลักสูตรที่ต้องการจัดสรร:</span>
              <span className="text-[11px]">{data.courses.length} หลักสูตรที่เปิดรับสมัคร</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
              {data.courses.map((course) => {
                const isSelected = course.id === activeCourse?.id;
                const enrCount = data.enr.filter((e) => e.course_id === course.id && !!e.session_id).length;
                const pct = totalMembersCount > 0 ? Math.round((enrCount / totalMembersCount) * 100) : 0;
                const sessionsCount = course.course_sessions?.length ?? 0;

                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => {
                      setActiveCourseId(course.id);
                      setSelectedUserIds([]);
                    }}
                    className={`group text-left rounded-xl border p-2.5 transition duration-150 relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? "border-2 border-primary bg-primary/15 ring-2 ring-primary/40 shadow-sm"
                        : "border border-border/80 bg-card hover:border-primary/50 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate max-w-[100px] ${
                          isSelected ? "bg-primary text-white shadow-2xs" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {course.category || "ทั่วไป"}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          pct === 100
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : pct > 0
                            ? "bg-primary text-white shadow-2xs"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>

                    <div className="mt-1.5 min-w-0">
                      <h4 className="font-bold text-xs text-foreground truncate" title={course.title}>
                        {course.title}
                      </h4>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5 font-medium">
                        <span>จัดแล้ว {enrCount}/{totalMembersCount} คน</span>
                        <span>{sessionsCount > 0 ? `${sessionsCount} รอบ` : "ออนไลน์"}</span>
                      </div>
                    </div>

                    {/* Progress track at bottom edge */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/60">
                      <div
                        className={`h-full transition-all duration-300 ${pct === 100 ? "bg-emerald-500" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allocation Workbench: Left (Roster) & Right (Sessions) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* ------------------------------------------------------------- */}
            {/* LEFT COLUMN: TEAM MEMBERS ROSTER (45% on desktop)              */}
            {/* ------------------------------------------------------------- */}
            <div className="lg:col-span-5 glass rounded-3xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="font-bold text-base text-foreground">รายชื่อสมาชิกในทีม</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    แสดง {roster.length} จาก {totalMembersCount} คน
                  </span>
                </div>

                {/* Filters */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ค้นหาชื่อ หรือตำแหน่ง…"
                      className="w-full rounded-xl border bg-card pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-primary focus:outline-hidden"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <select
                      value={filterDept}
                      onChange={(e) => setFilterDept(e.target.value)}
                      className="rounded-xl border bg-card px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      <option value="">ทุกแผนก/หน่วย</option>
                      {departments.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>

                    {/* Status Pipeline Filter Pills */}
                    <div className="flex flex-wrap items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setStatusFilter("all")}
                        className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer ${
                          statusFilter === "all"
                            ? "bg-foreground text-background shadow-xs"
                            : "bg-card text-muted-foreground hover:text-foreground border border-border/60"
                        }`}
                      >
                        ทั้งหมด ({statusCounts.all})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("unassigned")}
                        className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer flex items-center gap-1 ${
                          statusFilter === "unassigned"
                            ? "bg-amber-600 text-white shadow-xs"
                            : "bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-300/40"
                        }`}
                      >
                        <Clock3 className="h-3 w-3" />
                        <span>ยังไม่จัดรอบ ({statusCounts.unassigned})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("assigned")}
                        className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer flex items-center gap-1 ${
                          statusFilter === "assigned"
                            ? "bg-sky-600 text-white shadow-xs"
                            : "bg-sky-500/10 text-sky-800 dark:text-sky-300 hover:bg-sky-500/20 border border-sky-300/40"
                        }`}
                      >
                        <Calendar className="h-3 w-3" />
                        <span>จัดรอบแล้ว ({statusCounts.assigned})</span>
                      </button>
                      {statusCounts.need_pretest > 0 && (
                        <button
                          type="button"
                          onClick={() => setStatusFilter("need_pretest")}
                          className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer flex items-center gap-1 ${
                            statusFilter === "need_pretest"
                              ? "bg-amber-500 text-white shadow-xs"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-300/40"
                          }`}
                        >
                          <AlertCircle className="h-3 w-3" />
                          <span>ค้าง Pre-test ({statusCounts.need_pretest})</span>
                        </button>
                      )}
                      {statusCounts.attended > 0 && (
                        <button
                          type="button"
                          onClick={() => setStatusFilter("attended")}
                          className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer flex items-center gap-1 ${
                            statusFilter === "attended"
                              ? "bg-teal-600 text-white shadow-xs"
                              : "bg-teal-500/10 text-teal-800 dark:text-teal-300 hover:bg-teal-500/20 border border-teal-300/40"
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>เช็คชื่อแล้ว ({statusCounts.attended})</span>
                        </button>
                      )}
                      {statusCounts.certified > 0 && (
                        <button
                          type="button"
                          onClick={() => setStatusFilter("certified")}
                          className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer flex items-center gap-1 ${
                            statusFilter === "certified"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-300/40"
                          }`}
                        >
                          <Award className="h-3 w-3" />
                          <span>ได้ใบประกาศ ({statusCounts.certified})</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Selection Action Header */}
                <div className="flex flex-wrap items-center justify-between text-xs pt-1 border-t border-border/40 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={selectAllVisible}
                      className="font-bold text-primary hover:underline cursor-pointer"
                    >
                      เลือกทั้งหมด ({roster.length})
                    </button>
                    {unassignedMembers.length > 0 && (
                      <>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={selectAllUnassigned}
                          className="font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          เลือกคนที่ยังไม่จัดรอบ ({unassignedMembers.length})
                        </button>
                      </>
                    )}
                    {statusCounts.need_pretest > 0 && (
                      <>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={selectAllNeedPretest}
                          className="font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          เลือกคนที่ค้าง Pre-test ({statusCounts.need_pretest})
                        </button>
                      </>
                    )}
                  </div>

                  {selectedUserIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedUserIds([])}
                      className="text-muted-foreground hover:text-destructive flex items-center gap-1 cursor-pointer"
                    >
                      <X className="h-3 w-3" /> ล้างการเลือก
                    </button>
                  )}
                </div>

                {/* Roster List */}
                <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                  {roster.map((m) => {
                    const enr = activeCourseEnrollments.get(m.user_id);
                    const isSelected = selectedUserIds.includes(m.user_id);
                    const status = getTrainingProcessStatus(enr);
                    const StatusIcon = status.icon;

                    return (
                      <div
                        key={m.user_id}
                        onClick={() => toggleSelectUser(m.user_id)}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border transition cursor-pointer ${
                          isSelected
                            ? "border-2 border-primary bg-primary/15 shadow-xs ring-1 ring-primary/30"
                            : "border-border/70 bg-card hover:border-primary/50 hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                              isSelected
                                ? "border-primary bg-primary text-white font-black"
                                : "border-muted-foreground/50 bg-background"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>

                          <div className="min-w-0">
                            <div className="font-bold text-xs text-foreground whitespace-normal">{m.full_name}</div>
                            <div className="text-[11px] text-muted-foreground truncate font-medium">
                              {m.position} · {m.department || m.division}
                            </div>
                          </div>
                        </div>

                        {/* Semantic Pipeline Status Tag */}
                        <div className="shrink-0 text-right ml-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] border shadow-2xs ${status.badgeClass}`}
                            title={status.label}
                          >
                            <StatusIcon className="h-2.5 w-2.5" />
                            <span>{status.shortLabel}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {roster.length === 0 && (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                      ไม่พบสมาชิกตามเงื่อนไขการค้นหา
                    </div>
                  )}
                </div>
              </div>

              {/* Selection Status Banner at bottom of left column */}
              <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  เลือกสมาชิกแล้ว: <span className="text-primary font-bold">{selectedUserIds.length}</span> คน
                </span>
                {selectedUserIds.length > 0 && (
                  <span className="text-muted-foreground text-[11px]">
                    กดปุ่มจัดสรรในรอบด้านขวา ➔
                  </span>
                )}
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* RIGHT COLUMN: SESSIONS ALLOCATION CARDS (55% on desktop)       */}
            {/* ------------------------------------------------------------- */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-base text-foreground">รอบการอบรมและโควต้าที่นั่ง</h3>
                  <p className="text-xs text-muted-foreground">
                    หลักสูตร: <strong>{activeCourse?.title}</strong>
                  </p>
                </div>

                {/* Quick Helper: Select Unassigned */}
                {unassignedMembers.length > 0 && (
                  <button
                    onClick={selectAllUnassigned}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>เลือกผู้ที่ยังตกค้าง ({unassignedMembers.length} คน)</span>
                  </button>
                )}
              </div>

              {activeCourse && (activeCourse.course_sessions?.length ?? 0) > 0 ? (
                <div className="space-y-4">
                  {activeCourse.course_sessions.map((s) => {
                    const hospitalTaken = seatsMap[s.id] ?? 0;
                    const cap = s.capacity;
                    const available = cap != null ? Math.max(0, cap - hospitalTaken) : null;
                    const isFull = available != null && available === 0;
                    const fillPct = cap != null && cap > 0 ? Math.min(100, Math.round((hospitalTaken / cap) * 100)) : 0;

                    // Team members in this session
                    const teamAttendees = (data.members ?? []).filter((m) => {
                      const e = activeCourseEnrollments.get(m.user_id);
                      return e?.session_id === s.id;
                    });

                    const isExceeded = available != null && selectedUserIds.length > available;

                    return (
                      <div
                        key={s.id}
                        className="glass rounded-3xl p-5 border border-border/70 hover:border-primary/30 transition space-y-4"
                      >
                        {/* Session Header & Capacity Gauge */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="inline-flex items-center gap-1.5 font-bold text-sm bg-primary text-white px-3 py-1 rounded-xl shadow-xs">
                                รอบที่ {s.round_no}
                              </span>
                              {s.location && (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                                  <MapPin className="h-3 w-3 text-primary" /> {s.location}
                                </span>
                              )}
                            </div>
                            {s.starts_at && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                                <Calendar className="h-3.5 w-3.5 text-primary" />
                                <span>
                                  {new Date(s.starts_at).toLocaleDateString("th-TH", {
                                    weekday: "long",
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                                <span>
                                  · {new Date(s.starts_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} -{" "}
                                  {s.ends_at ? new Date(s.ends_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : ""} น.
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Visual Seat Capacity Gauge */}
                          <div className="sm:text-right shrink-0 min-w-[200px] space-y-1.5">
                            {cap != null ? (
                              <div>
                                <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
                                  {available === 0 ? (
                                    <span className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 px-2.5 py-0.5 rounded-lg text-xs font-bold">
                                      <AlertCircle className="h-3 w-3" /> ที่นั่งเต็ม (0 / {cap})
                                    </span>
                                  ) : available != null && available <= 5 ? (
                                    <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 px-2.5 py-0.5 rounded-lg text-xs font-bold">
                                      <AlertCircle className="h-3 w-3" /> เหลือว่าง {available} / {cap} ที่ (ใกล้เต็ม)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 px-2.5 py-0.5 rounded-lg text-xs font-bold">
                                      <CheckCircle2 className="h-3 w-3" /> เหลือว่าง {available} / {cap} ที่นั่ง
                                    </span>
                                  )}
                                </div>

                                {/* Progress bar gauge */}
                                <div className="mt-1.5 flex items-center gap-2">
                                  <div className="h-2 flex-1 rounded-full bg-muted/80 overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-300 ${
                                        available === 0
                                          ? "bg-rose-500"
                                          : available != null && available <= 5
                                          ? "bg-amber-500"
                                          : "bg-emerald-500"
                                      }`}
                                      style={{ width: `${fillPct}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-muted-foreground font-semibold shrink-0">
                                    {fillPct}% เต็ม
                                  </span>
                                </div>

                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  ลูกทีมในสังกัด {teamAttendees.length} คน (จองรวม รพ. {hospitalTaken}/{cap} ที่)
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-mint">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> ไม่จำกัดที่นั่ง
                                </span>
                                <div className="text-[10px] text-muted-foreground">
                                  ลูกทีมในสังกัด {teamAttendees.length} คน
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* BIG ACTION BUTTON: Assign selected members to this session */}
                        <div
                          className={`flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl p-3.5 border transition ${
                            selectedUserIds.length > 0 && !isFull && !isExceeded
                              ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-400/80 dark:border-emerald-700/80 shadow-xs"
                              : isExceeded
                              ? "bg-rose-50/70 dark:bg-rose-950/30 border-2 border-rose-300 dark:border-rose-800"
                              : "bg-card/60 border border-border/50"
                          }`}
                        >
                          <div className="text-xs">
                            {selectedUserIds.length > 0 ? (
                              isExceeded ? (
                                <span className="font-semibold text-rose-700 dark:text-rose-300">
                                  ⚠️ โควต้าที่นั่งไม่เพียงพอ: เลือกไว้ {selectedUserIds.length} คน แต่รอบนี้ว่างเพียง {available} ที่นั่ง
                                </span>
                              ) : isFull ? (
                                <span className="font-semibold text-rose-700 dark:text-rose-300">
                                  รอบนี้ที่นั่งเต็มแล้ว กรุณาเลือกรอบอื่น
                                </span>
                              ) : (
                                <span className="font-semibold text-emerald-950 dark:text-emerald-100">
                                  พร้อมจัดสรรลูกทีม <strong className="font-black text-emerald-700 dark:text-emerald-300 underline">{selectedUserIds.length} คน</strong> เข้าสู่รอบที่ {s.round_no}
                                </span>
                              )
                            ) : (
                              <span className="text-muted-foreground">
                                ← ติ๊กเลือกสมาชิกจากกล่องซ้ายมือ แล้วกดปุ่มนี้เพื่อจัดสรรเข้ารอบที่ {s.round_no}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAssignToSession(s.id)}
                            disabled={selectedUserIds.length === 0 || isFull || isExceeded || actionLoading}
                            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-xs ${
                              selectedUserIds.length === 0
                                ? "bg-muted text-muted-foreground opacity-60 cursor-not-allowed"
                                : isExceeded
                                ? "bg-destructive/15 text-destructive border border-destructive/30 cursor-not-allowed"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/30 cursor-pointer transform active:scale-95"
                            }`}
                          >
                            {actionLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                            )}
                            <span>
                              {isExceeded
                                ? `ที่นั่งไม่พอ (เหลือ ${available} ที่)`
                                : isFull
                                ? "รอบนี้เต็มแล้ว"
                                : selectedUserIds.length > 0
                                ? `จัดสรรลูกทีม (${selectedUserIds.length} คน) เข้ารอบที่ ${s.round_no}`
                                : `จัดสรรเข้ารอบที่ ${s.round_no}`}
                            </span>
                          </button>
                        </div>

                        {/* Team Members in this session list with Department Inspector */}
                        <SessionAttendeesSection
                          session={s}
                          allSessions={activeCourse.course_sessions}
                          courseId={activeCourse.id}
                          attendees={teamAttendees}
                          enrollments={activeCourseEnrollments}
                          actionLoading={actionLoading}
                          onQuickAssign={handleQuickAssignSingle}
                          recentAllocation={recentAllocation}
                          onClearRecentAllocation={() => setRecentAllocation(null)}
                        />
                      </div>
                    );
                  })}

                  {/* Fallback Option: Enroll without session */}
                  <div className="rounded-2xl border border-dashed border-border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div>
                      <strong>ลงทะเบียนล่วงหน้า (ยังไม่ระบุรอบ):</strong> สมาชิกจะได้รับการลงทะเบียนหลักสูตร และสามารถเข้าไปเลือกรอบอบรมด้วยตนเองได้ในภายหลัง
                    </div>
                    <button
                      onClick={() => handleAssignToSession(null)}
                      disabled={selectedUserIds.length === 0 || actionLoading}
                      className="rounded-xl border bg-card px-3.5 py-2 font-semibold text-foreground hover:bg-muted shrink-0 transition cursor-pointer"
                    >
                      ลงทะเบียน {selectedUserIds.length} คน (ยังไม่ระบุรอบ)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="glass rounded-3xl p-8 text-center space-y-3">
                  <CheckCircle2 className="h-8 w-8 text-mint mx-auto" />
                  <h4 className="font-bold text-foreground">หลักสูตรออนไลน์ (เรียนผ่านระบบได้ทันที)</h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    หลักสูตรนี้ไม่มีรอบอบรมในห้องเรียน เมื่อกดจัดสรร สมาชิกจะสามารถเริ่มเรียนบทเรียนออนไลน์ได้ทันที
                  </p>
                  <button
                    onClick={() => handleAssignToSession(null)}
                    disabled={selectedUserIds.length === 0 || actionLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-md cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>ลงทะเบียนให้สมาชิกที่เลือก ({selectedUserIds.length} คน)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* MODE 2: TEAM ROSTER MATRIX (ตาราง Matrix กะทัดรัด สรุปทุกคน x ทุกหลักสูตร) */
        /* ========================================================================= */
        <div className="space-y-4">
          <div className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อสมาชิก…"
                  className="rounded-xl border bg-card pl-8 pr-3 py-1.5 text-xs w-60"
                />
              </div>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="rounded-xl border bg-card px-3 py-1.5 text-xs text-muted-foreground"
              >
                <option value="">ทุกแผนก/หน่วย</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Award className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>ได้ใบประกาศ: <strong>{data.enr.filter((e) => e.has_cert).length}</strong></span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span>เช็คชื่อแล้ว: <strong>{data.enr.filter((e) => e.attended).length}</strong></span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                <span>จัดรอบแล้ว: <strong>{data.enr.filter((e) => !!e.session_id).length}</strong></span>
              </span>
            </div>
          </div>

          <div className="glass overflow-hidden rounded-3xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-[220px] px-4 py-3">สมาชิก</th>
                    <th className="w-[180px] px-4 py-3">ฝ่าย / แผนก</th>
                    {data.courses.map((course) => {
                      const courseEnrs = data.enr.filter((e) => e.course_id === course.id);
                      const certCount = courseEnrs.filter((e) => e.has_cert).length;

                      return (
                        <th key={course.id} className="px-4 py-3 min-w-[260px]">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-foreground truncate max-w-[180px]" title={course.title}>
                              {course.title}
                            </span>
                            {certCount > 0 && (
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-300/40 shrink-0">
                                🎓 {certCount}/{totalMembersCount}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-normal">
                            {course.course_sessions?.length > 0 ? `${course.course_sessions.length} รอบอบรม` : "ออนไลน์"}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.members
                    .filter((m) => {
                      const q = searchQuery.trim().toLowerCase();
                      if (q && !m.full_name.toLowerCase().includes(q) && !(m.position || "").toLowerCase().includes(q)) return false;
                      if (filterDept && (m.department || m.division) !== filterDept) return false;
                      return true;
                    })
                    .map((m) => {
                      return (
                        <tr key={m.user_id} className="border-t align-middle hover:bg-muted/20 transition">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground text-xs">{m.full_name}</div>
                            <div className="text-[11px] text-muted-foreground">{m.position}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {m.department || m.division}
                          </td>

                          {/* Columns per course */}
                          {data.courses.map((course) => {
                            const enr = data.enr.find((e) => e.user_id === m.user_id && e.course_id === course.id);
                            const sessions = course.course_sessions ?? [];
                            const status = getTrainingProcessStatus(enr);
                            const StatusIcon = status.icon;

                            return (
                              <td key={course.id} className="px-4 py-3">
                                {sessions.length > 0 ? (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <select
                                        disabled={enr?.attended || actionLoading}
                                        value={enr?.session_id ?? ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          handleQuickAssignSingle(course.id, m.user_id, val ? val : null);
                                        }}
                                        className={`rounded-xl border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                                          enr?.attended
                                            ? "bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-300/40 font-bold"
                                            : enr?.session_id
                                            ? "bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-300/40 font-bold"
                                            : "bg-card text-muted-foreground border-border/80"
                                        }`}
                                      >
                                        <option value="">(ยังไม่จัดรอบ)</option>
                                        {sessions.map((s) => (
                                          <option key={s.id} value={s.id}>
                                            รอบที่ {s.round_no} {s.starts_at ? `(${new Date(s.starts_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })})` : ""}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Rich Process Badge */}
                                    {enr && (
                                      <div>
                                        <span
                                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] border shadow-2xs ${status.badgeClass}`}
                                          title={status.label}
                                        >
                                          <StatusIcon className="h-2.5 w-2.5" />
                                          <span>{status.shortLabel}</span>
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  /* Online course */
                                  <div className="space-y-1">
                                    {enr ? (
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-bold border shadow-2xs ${status.badgeClass}`}
                                        >
                                          <StatusIcon className="h-3 w-3" />
                                          <span>{status.shortLabel}</span>
                                        </span>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handleQuickAssignSingle(course.id, m.user_id, null)}
                                        className="rounded-lg border bg-card px-2.5 py-1 text-xs font-semibold text-primary hover:bg-muted transition cursor-pointer"
                                      >
                                        + ลงทะเบียน
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
