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
  UserCheck,
  UserX,
  Search,
  Filter,
  Check,
  ChevronRight,
  ShieldCheck,
  Layers,
  ArrowLeftRight,
  X,
  Loader2,
  Building2,
  ChevronDown,
  ChevronUp,
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
};

/* ------------------------------------------------------------------------- */
/* SUB-COMPONENT: SESSION ATTENDEES INSPECTOR & SHIFT BALANCER               */
/* ------------------------------------------------------------------------- */
type RecentAllocationInfo = {
  sessionId: string;
  departments: string[];
  userIds: string[];
  timestamp: number;
};

function getDeptColor(dept: string) {
  const hash = dept.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colors = [
    "bg-indigo-600 text-white",
    "bg-teal-600 text-white",
    "bg-sky-600 text-white",
    "bg-violet-600 text-white",
    "bg-amber-600 text-white",
    "bg-rose-600 text-white",
    "bg-emerald-600 text-white",
  ];
  return colors[hash % colors.length] ?? "bg-indigo-600 text-white";
}

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

  // Filter attendees by department & search query (with recent allocation filter support)
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
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition ${
                viewMode === "grouped" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="h-3 w-3" />
              <span>แยกแผนก</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("compact")}
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-medium transition ${
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

          {/* Department Filter Dropdown (Option 1) + Search Bar */}
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
                <div key={dept} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-3 space-y-2.5 shadow-2xs">
                  {/* Distinct Department Header Banner */}
                  <div className="flex items-center justify-between text-xs rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 px-3 py-1.5 font-bold">
                    <div className="flex items-center gap-2 text-foreground font-black">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span>{dept}</span>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900 shadow-2xs">
                      {members.length} คน
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {members.map((m) => {
                      const enr = enrollments.get(m.user_id);
                      const isRecentlyAdded =
                        recentAllocation?.sessionId === session.id &&
                        recentAllocation?.userIds.includes(m.user_id);

                      return (
                        <div
                          key={m.user_id}
                          className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs shadow-2xs transition ${
                            isRecentlyAdded
                              ? "border-2 border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-400/30"
                              : "border-border/80 bg-background hover:border-primary/50 hover:bg-muted/30"
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <div
                              className={`h-7 w-7 rounded-full font-black flex items-center justify-center text-xs shrink-0 shadow-2xs ${getDeptColor(dept)}`}
                            >
                              {m.full_name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-foreground text-xs truncate">{m.full_name}</span>
                                {isRecentlyAdded && (
                                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-emerald-600 text-white shrink-0 shadow-2xs">
                                    ✨ เพิ่งจัดสรร
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate font-medium">{m.position || "ไม่ระบุตำแหน่ง"}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {enr?.attended ? (
                              <span className="text-[10px] bg-emerald-600 text-white font-black px-2.5 py-0.5 rounded-md shadow-2xs">
                                ✓ เช็คชื่อแล้ว
                              </span>
                            ) : (
                              <div className="flex items-center gap-1">
                                {allSessions.length > 1 && (
                                  <select
                                    value={session.id}
                                    disabled={actionLoading}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      onQuickAssign(courseId, m.user_id, val === "unassigned" ? null : val);
                                    }}
                                    className="text-[10px] font-bold rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 px-2 py-0.5 hover:border-indigo-400 transition cursor-pointer shadow-2xs"
                                    title="ย้ายรอบอบรม"
                                  >
                                    <option value={session.id}>รอบที่ {session.round_no}</option>
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
                const isRecentlyAdded =
                  recentAllocation?.sessionId === session.id &&
                  recentAllocation?.userIds.includes(m.user_id);

                return (
                  <span
                    key={m.user_id}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-medium shadow-2xs transition ${
                      isRecentlyAdded
                        ? "border-primary/60 bg-primary/15 ring-1 ring-primary/30 text-foreground"
                        : "border-border/70 bg-card hover:border-primary/40"
                    }`}
                  >
                    <span>{m.full_name}</span>
                    <span className="text-[10px] text-muted-foreground">({m.department || m.division})</span>
                    {isRecentlyAdded && (
                      <span className="text-[9px] font-bold px-1 rounded bg-primary text-primary-foreground">
                        ✨ ใหม่
                      </span>
                    )}
                    {enr?.attended ? (
                      <span className="text-[10px] text-mint font-bold">✓ เช็คชื่อแล้ว</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onQuickAssign(courseId, m.user_id, null)}
                        disabled={actionLoading}
                        title="ถอนออกจากรอบนี้"
                        className="text-muted-foreground hover:text-destructive text-sm leading-none ml-1 cursor-pointer"
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
  const [statusFilter, setStatusFilter] = useState<"all" | "unassigned" | "assigned">("all");

  // Seat counts cache: { [sessionId]: takenCount }
  const [seatsMap, setSeatsMap] = useState<Record<string, number>>({});

  // Context of the most recent batch allocation: { sessionId, departments, userIds, timestamp }
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
      const isAssigned = !!enr?.session_id;

      if (statusFilter === "unassigned" && isAssigned) return false;
      if (statusFilter === "assigned" && !isAssigned) return false;

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

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 rounded-2xl border bg-card p-1 shadow-2xs self-start md:self-auto">
          <button
            onClick={() => setViewMode("allocation")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
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
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
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
            <AlertCircle className="h-3.5 w-3.5 text-amber" />
          </div>
          <div className="text-2xl font-bold text-amber mt-1">{unassignedMembers.length} คน</div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>จัดรอบเรียบร้อยแล้ว</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-mint" />
          </div>
          <div className="text-2xl font-bold text-mint mt-1">
            {totalMembersCount - unassignedMembers.length} คน
          </div>
        </div>
      </div>

      {viewMode === "allocation" ? (
        /* ========================================================================= */
        /* MODE 1: ALLOCATION WORKBENCH (กระดานจัดสรรคนเข้าอบรม - Course Allocation) */
        /* ========================================================================= */
        <div className="space-y-5">
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
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
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
                      <h4 className="font-extrabold text-xs text-foreground truncate" title={course.title}>
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
                        className={`h-full transition-all duration-300 ${pct === 100 ? "bg-mint" : "bg-primary"}`}
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
                      className="w-full rounded-xl border bg-card pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-primary focus:outline-none"
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

                    <div className="flex items-center rounded-xl border border-border bg-card p-0.5 text-[11px] shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setStatusFilter("all")}
                        className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer ${
                          statusFilter === "all" ? "bg-foreground text-background shadow-xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        ทั้งหมด
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("unassigned")}
                        className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer ${
                          statusFilter === "unassigned" ? "bg-amber-500 text-white shadow-xs" : "text-amber-700 dark:text-amber-400 hover:text-amber-800"
                        }`}
                      >
                        ยังไม่จัดรอบ ({unassignedMembers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("assigned")}
                        className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer ${
                          statusFilter === "assigned" ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-700 dark:text-emerald-400 hover:text-emerald-800"
                        }`}
                      >
                        จัดรอบแล้ว
                      </button>
                    </div>
                  </div>
                </div>

                {/* Selection Action Header */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllVisible}
                      className="font-bold text-primary hover:underline cursor-pointer"
                    >
                      เลือกทั้งหมด ({roster.length})
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={selectAllUnassigned}
                      className="font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      เลือกคนที่ยังไม่จัดรอบ ({unassignedMembers.length})
                    </button>
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
                    const assignedRound = enr?.round_no;
                    const isAttended = enr?.attended;

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
                            <div className="font-bold text-xs text-foreground truncate">{m.full_name}</div>
                            <div className="text-[11px] text-muted-foreground truncate font-medium">
                              {m.position} · {m.department || m.division}
                            </div>
                          </div>
                        </div>

                        {/* Status Tag */}
                        <div className="shrink-0 text-right ml-2">
                          {isAttended ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-bold shadow-2xs">
                              <CheckCircle2 className="h-2.5 w-2.5" /> เช็คชื่อแล้ว
                            </span>
                          ) : assignedRound != null ? (
                            <span className="rounded-md bg-blue-600 text-white px-2 py-0.5 text-[10px] font-bold shadow-2xs">
                              รอบที่ {assignedRound}
                            </span>
                          ) : enr ? (
                            <span className="rounded-md bg-amber-500 text-white px-2 py-0.5 text-[10px] font-bold shadow-2xs">
                              ยังไม่ระบุรอบ
                            </span>
                          ) : (
                            <span className="rounded-md bg-muted text-muted-foreground border border-border px-2 py-0.5 text-[10px] font-medium">
                              ยังไม่ลงทะเบียน
                            </span>
                          )}
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
              <div className="flex items-center justify-between">
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber/30 bg-amber/10 px-3 py-1.5 text-xs font-semibold text-amber hover:bg-amber/20 transition"
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
                        {/* Session Header & Capacity Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                              <span className="inline-flex items-center gap-1.5 font-black text-sm bg-primary text-white px-3 py-1 rounded-xl shadow-xs">
                                รอบที่ {s.round_no}
                              </span>
                              {s.location && (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                                  <MapPin className="h-3 w-3 text-primary" /> {s.location}
                                </span>
                              )}
                            </div>
                            {s.starts_at && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
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

                          {/* Seat Gauge */}
                          <div className="sm:text-right shrink-0">
                            {cap != null ? (
                              <div className="space-y-1">
                                {available === 0 ? (
                                  <div className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 px-2.5 py-1 rounded-xl text-xs font-bold shadow-2xs">
                                    ที่นั่งเต็ม (0 / {cap})
                                  </div>
                                ) : available != null && available <= 5 ? (
                                  <div className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 px-2.5 py-1 rounded-xl text-xs font-bold shadow-2xs">
                                    ที่นั่งว่าง <span className="font-black text-amber-700 dark:text-amber-400 text-sm">{available}</span> / {cap} ที่นั่ง
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 px-2.5 py-1 rounded-xl text-xs font-bold shadow-2xs">
                                    ที่นั่งว่าง <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm">{available}</span> / {cap} ที่นั่ง
                                  </div>
                                )}
                                <div className="text-[10px] text-muted-foreground font-medium">
                                  ลูกทีมในสังกัด {teamAttendees.length} คน
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-mint">ไม่จำกัดที่นั่ง</span>
                            )}
                          </div>
                        </div>

                        {/* BIG ACTION BUTTON: Assign selected members to this session */}
                        <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl p-3 border transition ${
                          selectedUserIds.length > 0 && !isFull && !isExceeded
                            ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-400/80 dark:border-emerald-700/80 shadow-xs"
                            : "bg-card/60 border border-border/50"
                        }`}>
                          <div className="text-xs">
                            {selectedUserIds.length > 0 ? (
                              <span className="font-semibold text-emerald-950 dark:text-emerald-100">
                                เตรียมจัดสรรลูกทีม <strong className="font-black text-emerald-700 dark:text-emerald-300 underline">{selectedUserIds.length} คน</strong> เข้าสู่รอบที่ {s.round_no}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">ติ๊กเลือกสมาชิกจากกล่องซ้ายมือ แล้วกดปุ่มเพื่อจัดสรรเข้ารอบนี้</span>
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
                                : "bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md shadow-emerald-600/30 cursor-pointer transform active:scale-95"
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
                                : `จัดสรรสมาชิกที่เลือก (${selectedUserIds.length} คน) เข้ารอบนี้`}
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
                  <div className="rounded-2xl border border-dashed border-border p-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div>
                      <strong>ลงทะเบียนล่วงหน้า (ยังไม่ระบุรอบ):</strong> สมาชิกจะได้รับการลงทะเบียนหลักสูตร และสามารถเข้าไปเลือกรอบอบรมด้วยตนเองได้ในภายหลัง
                    </div>
                    <button
                      onClick={() => handleAssignToSession(null)}
                      disabled={selectedUserIds.length === 0 || actionLoading}
                      className="rounded-xl border bg-card px-3.5 py-2 font-semibold text-foreground hover:bg-muted shrink-0 transition"
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
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-md"
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
            <div className="flex items-center gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อสมาชิก…"
                className="rounded-xl border bg-card px-3 py-1.5 text-xs w-60"
              />
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="rounded-xl border bg-card px-3 py-1.5 text-xs"
              >
                <option value="">ทุกแผนก/หน่วย</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="text-muted-foreground">
              สามารถเปลี่ยนรอบการอบรมให้ลูกทีมแต่ละคนได้ทันทีที่ช่อง Dropdown ของแต่ละวิชา
            </div>
          </div>

          <div className="glass overflow-hidden rounded-3xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-[220px] px-4 py-3">สมาชิก</th>
                    <th className="w-[180px] px-4 py-3">ฝ่าย / แผนก</th>
                    {data.courses.map((course) => (
                      <th key={course.id} className="px-4 py-3 min-w-[260px]">
                        <div className="font-bold text-foreground truncate max-w-[240px]">{course.title}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">
                          {course.course_sessions?.length > 0 ? `${course.course_sessions.length} รอบอบรม` : "ออนไลน์"}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.members
                    .filter((m) => {
                      const q = searchQuery.trim().toLowerCase();
                      if (q && !m.full_name.toLowerCase().includes(q)) return false;
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

                            return (
                              <td key={course.id} className="px-4 py-3">
                                {sessions.length > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <select
                                      disabled={enr?.attended || actionLoading}
                                      value={enr?.session_id ?? ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        handleQuickAssignSingle(course.id, m.user_id, val ? val : null);
                                      }}
                                      className={`rounded-xl border px-2.5 py-1 text-xs font-medium transition ${
                                        enr?.attended
                                          ? "bg-mint/15 text-mint border-mint/30 font-bold"
                                          : enr?.session_id
                                          ? "bg-primary/10 text-primary border-primary/30 font-bold"
                                          : "bg-card text-muted-foreground"
                                      }`}
                                    >
                                      <option value="">(ยังไม่ลงทะเบียน)</option>
                                      {sessions.map((s) => (
                                        <option key={s.id} value={s.id}>
                                          รอบที่ {s.round_no} {s.starts_at ? `(${new Date(s.starts_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })})` : ""}
                                        </option>
                                      ))}
                                    </select>

                                    {enr?.has_cert ? (
                                      <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[10px] font-bold text-mint shrink-0">
                                        ✓ ผ่าน
                                      </span>
                                    ) : enr?.attended ? (
                                      <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[10px] font-bold text-mint shrink-0">
                                        เช็คชื่อแล้ว
                                      </span>
                                    ) : null}
                                  </div>
                                ) : (
                                  /* Online course */
                                  <div className="flex items-center gap-2">
                                    {enr ? (
                                      <span className="rounded-full bg-mint/15 px-2.5 py-0.5 text-xs font-bold text-mint">
                                        ลงทะเบียนแล้ว
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => handleQuickAssignSingle(course.id, m.user_id, null)}
                                        className="rounded-lg border bg-card px-2 py-1 text-xs font-semibold text-primary hover:bg-muted"
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
