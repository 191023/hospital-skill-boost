import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  Armchair,
  Building2,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  Footprints,
  GraduationCap,
  LayoutGrid,
  Maximize,
  Minimize,
  Minus,
  Monitor,
  Palette as PaletteIcon,
  Play,
  Plus,
  Radar,
  RefreshCw,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
  Square,
  Timer,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { pickOne, pickPool } from "@/lib/room-picker";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { sessionLabel } from "@/components/Sessions";
import { Button } from "@/components/ui/button";
import {
  attendeeSymbol,
  attendanceKey,
  computeDepartmentZones,
  detectRoomArrivals,
  detectRoomProgressEvents,
  getCountdownInfo,
  getLearnerStage,
  getStageMeta,
  matchesAttendee,
  ROOM_PAGE_SIZE,
  roomDate,
  roomSeats,
  type RoomAttendee,
  type RoomHudPreset,
  type RoomLayoutMode,
  type RoomLiveEvent,
  type RoomQualityTier,
  type RoomSeat,
  type RoomViewMode,
} from "@/lib/training-room";
import { ClassroomHubModal } from "@/components/course-editor/ClassroomHubModal";

const Scene = lazy(() => import("@/components/TrainingRoomScene"));
export const Route = createFileRoute("/_authenticated/manage_/$courseId/room")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ห้องอบรมและสถานะผู้เข้าร่วม — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { name: "description", content: "รายชื่อผู้ลงทะเบียนและสถานะเช็คชื่อแยกตามรอบอบรมในมุมมองที่นั่ง" },
      { property: "og:title", content: "ห้องอบรม — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:description", content: "ติดตามผู้ลงทะเบียนและการเข้าอบรมแต่ละรอบ" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomPage,
});

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        แสดงภาพสามมิติไม่ได้ กรุณาดูรายชื่อด้านข้าง
      </div>
    ) : (
      this.props.children
    );
  }
}

const HUD_PRESET_STYLES: Record<RoomHudPreset, { border: string; badge: string; accent: string; name: string }> = {
  hospital: {
    border: "border-glass-border",
    badge: "bg-primary/15 text-primary",
    accent: "text-primary",
    name: "🏥 Hospital Clean",
  },
  jarvis: {
    border: "border-cyan-500/40 shadow-cyan-500/10",
    badge: "bg-cyan-500/15 text-cyan-400",
    accent: "text-cyan-400",
    name: "💠 JARVIS Cyan",
  },
  emerald: {
    border: "border-emerald-500/40 shadow-emerald-500/10",
    badge: "bg-emerald-500/15 text-emerald-400",
    accent: "text-emerald-400",
    name: "🧬 Bio Emerald",
  },
  amber: {
    border: "border-amber-500/40 shadow-amber-500/10",
    badge: "bg-amber-500/15 text-amber-400",
    accent: "text-amber-400",
    name: "⚡ Gold Command",
  },
};

function RadarMinimap({
  seats,
  selected,
  pulseMap,
  onSelectSeat,
}: {
  seats: RoomSeat[];
  selected: number | null;
  pulseMap: Record<string, number>;
  onSelectSeat: (index: number) => void;
}) {
  if (!seats.length) return null;
  const xs = seats.map((s) => s.x);
  const zs = seats.map((s) => s.z);
  const minX = Math.min(-6.2, ...xs);
  const maxX = Math.max(6.2, ...xs);
  const minZ = Math.min(-1.5, ...zs);
  const maxZ = Math.max(8, ...zs) + 1.2;

  return (
    <div className="relative h-36 w-44 overflow-hidden rounded-xl border border-cyan-500/30 bg-slate-950/90 p-2 shadow-inner">
      {/* Radar Grid Lines */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.14)_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-cyan-500/15" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-cyan-500/15" />

      {/* Stage / Screen bar at top (-Z) */}
      <div className="mx-auto mb-1 h-1.5 w-24 rounded-full bg-cyan-400/50 text-[7px] text-center leading-none text-cyan-200">
        STAGE
      </div>

      {/* Seat dots */}
      <div className="relative h-28 w-full">
        {seats.map((seat) => {
          const leftPct = ((seat.x - minX) / Math.max(1, maxX - minX)) * 88 + 6;
          const topPct = ((seat.z - minZ) / Math.max(1, maxZ - minZ)) * 84 + 6;
          const stage = getLearnerStage(seat.attendee);
          const isPulsing = seat.attendee && (pulseMap[seat.attendee.userId] ?? 0) > Date.now() - 8000;
          const isSelected = selected === seat.index;
          const dotColor =
            stage === "certified"
              ? "bg-emerald-400 shadow-[0_0_6px_#34d399]"
              : stage === "post_pending"
              ? "bg-amber-400"
              : stage === "learning"
              ? "bg-sky-400"
              : stage === "checked"
              ? "bg-teal-400"
              : stage === "waiting"
              ? "bg-orange-500/80"
              : "bg-slate-700/60";

          return (
            <button
              key={seat.index}
              type="button"
              onClick={() => onSelectSeat(seat.index)}
              title={`${seat.label}: ${seat.attendee?.name ?? "ที่นั่งว่าง"}`}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-150 ${dotColor} ${
                isSelected ? "size-3 ring-2 ring-white z-10" : isPulsing ? "size-2.5 animate-ping" : "size-2"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

function RoomPage() {
  const { data: me, isLoading } = useMe();
  const { courseId } = Route.useParams();
  if (isLoading) return <p>กำลังโหลด...</p>;
  if (!me?.isStaff) return <p className="text-muted-foreground">หน้านี้สำหรับผู้ดูแลระบบและวิทยากรเท่านั้น</p>;
  return (
    <Suspense fallback={<p className="text-muted-foreground">กำลังโหลดห้องอบรม...</p>}>
      <RoomContent courseId={courseId} />
    </Suspense>
  );
}

function RoomContent({ courseId }: { courseId: string }) {
  const [sessionId, setSessionId] = useState("");
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState("all");
  const [selected, setSelected] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ index: number; n: number } | null>(null);
  const [page, setPage] = useState(0);
  const [view, setView] = useState<"angle" | "top">("angle");
  const [zoom, setZoom] = useState(1);
  const [kiosk, setKiosk] = useState(false);
  const [walk, setWalk] = useState(true);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pulseMap, setPulseMap] = useState<Record<string, number>>({});
  const prevChecked = useRef<Map<string, string> | null>(null);
  const prevProgress = useRef<
    Map<string, { checked: boolean; preDone: boolean; postPassed: boolean; hasCert: boolean }> | null
  >(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [isFull, setIsFull] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [drawn, setDrawn] = useState<Set<string>>(new Set());
  const [pickDivision, setPickDivision] = useState("all");
  const [rolling, setRolling] = useState(false);
  const [winner, setWinner] = useState<RoomAttendee | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  const [theme, setTheme] = useState<"hall" | "office">(() => {
    if (typeof window === "undefined") return "office";
    return (localStorage.getItem("training-room-theme") as "hall" | "office") || "office";
  });
  const [layoutMode, setLayoutMode] = useState<RoomLayoutMode>("grid");
  const [viewMode, setViewMode] = useState<RoomViewMode>("all");
  const [tourMode, setTourMode] = useState<"off" | "checked" | "waiting" | "zones">("off");
  const [focusZone, setFocusZone] = useState<string | null>(null);
  const [radarOpen, setRadarOpen] = useState(true);
  const [hudPreset, setHudPreset] = useState<RoomHudPreset>(() => {
    if (typeof window === "undefined") return "hospital";
    return (localStorage.getItem("training-room-hud-preset") as RoomHudPreset) || "hospital";
  });
  const [fpsMetrics, setFpsMetrics] = useState<{ fps: number; tier: RoomQualityTier }>({ fps: 60, tier: "high" });
  const [liveEvents, setLiveEvents] = useState<RoomLiveEvent[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const changeTheme = (newTheme: "hall" | "office") => {
    setTheme(newTheme);
    try {
      localStorage.setItem("training-room-theme", newTheme);
    } catch {}
  };

  const changeHudPreset = (preset: RoomHudPreset) => {
    setHudPreset(preset);
    try {
      localStorage.setItem("training-room-hud-preset", preset);
    } catch {}
  };

  useEffect(() => {
    const sync = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
    };
  }, []);

  const { data, refetch, isFetching, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ["training-room", courseId],
    refetchInterval: 10000,
    queryFn: async () => {
      const [c, s, e, a, permission, ls, att, certs] = await Promise.all([
        supabase.from("courses").select("id,title,training_year,pass_score").eq("id", courseId).maybeSingle(),
        supabase.from("course_sessions").select("id,round_no,starts_at,ends_at,location,capacity").eq("course_id", courseId).order("round_no"),
        supabase.from("enrollments").select("user_id,session_id,created_at").eq("course_id", courseId).is("deleted_at", null).order("created_at").order("user_id"),
        supabase.from("attendance").select("user_id,session_id,checked_at,is_demo").eq("course_id", courseId),
        supabase.rpc("can_edit_course", { _course: courseId }),
        supabase.from("lessons").select("id").eq("course_id", courseId).is("deleted_at", null),
        supabase.from("test_attempts").select("user_id,kind,percent,passed").eq("course_id", courseId),
        supabase.from("certificates").select("user_id").eq("course_id", courseId),
      ]);
      for (const result of [c, s, e, a, permission]) if (result.error) throw result.error;
      const ids = [...new Set((e.data ?? []).map((row) => row.user_id))];
      const lessonIds = (ls.data ?? []).map((l) => l.id);
      const [p, prog] = await Promise.all([
        ids.length
          ? supabase.from("profiles").select("id,full_name,division,department,position").in("id", ids)
          : Promise.resolve({ data: [], error: null }),
        ids.length && lessonIds.length
          ? supabase.from("lesson_progress").select("user_id,lesson_id").in("user_id", ids).in("lesson_id", lessonIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (p.error) throw p.error;
      const profiles = new Map((p.data ?? []).map((row) => [row.id, row]));
      return {
        course: c.data,
        canCheckIn: permission.data === true,
        sessions: s.data ?? [],
        enrollments: (e.data ?? []).map((row) => ({ ...row, profile: profiles.get(row.user_id) })),
        attendance: a.data ?? [],
        totalLessons: lessonIds.length,
        lessonProgress: prog.data ?? [],
        attempts: att.data ?? [],
        certs: certs.data ?? [],
      };
    },
  });

  // Realtime WebSocket subscription for instant check-in, exam submission, and certificate issuance
  useEffect(() => {
    const channel = supabase
      .channel(`room-live-${courseId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance", filter: `course_id=eq.${courseId}` }, () => {
        void refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "test_attempts", filter: `course_id=eq.${courseId}` }, () => {
        void refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "certificates", filter: `course_id=eq.${courseId}` }, () => {
        void refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "enrollments", filter: `course_id=eq.${courseId}` }, () => {
        void refetch();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [courseId, refetch]);

  const checkIn = useMutation({
    mutationFn: async ({ userId, roundId }: { userId: string; roundId: string | null }) => {
      const { data: res, error } = await supabase.rpc("staff_check_in", {
        _course: courseId,
        _user: userId,
        ...(roundId ? { _session: roundId } : {}),
      });
      if (error) throw error;
      return res;
    },
    onSuccess: async (_, variables) => {
      toast.success("เช็คชื่อเข้าอบรมแล้ว");
      const key = attendanceKey(variables.userId, variables.roundId);
      const curNow = Date.now();
      setPulseMap((prev) => ({ ...prev, [key]: curNow }));
      setFocus(null);
      await refetch();
    },
    onError: (error) => toast.error(error.message || "เช็คชื่อไม่สำเร็จ กรุณาลองอีกครั้ง"),
  });

  if (!data.course) return <p>ไม่พบหลักสูตร</p>;
  const activeId = sessionId || data.sessions[0]?.id || "unassigned";
  const session = data.sessions.find((s) => s.id === activeId);
  const countdown = getCountdownInfo(session?.starts_at ?? null, session?.ends_at ?? null, now);

  // Build learner progress lookup maps
  const certSet = useMemo(() => new Set((data.certs ?? []).map((c) => c.user_id)), [data.certs]);
  const lessonsByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of data.lessonProgress ?? []) {
      map.set(row.user_id, (map.get(row.user_id) ?? 0) + 1);
    }
    return map;
  }, [data.lessonProgress]);

  const attemptsByUser = useMemo(() => {
    const map = new Map<
      string,
      { preDone: boolean; preScore: number | null; postDone: boolean; postPassed: boolean; postScore: number | null }
    >();
    for (const a of data.attempts ?? []) {
      const cur = map.get(a.user_id) ?? {
        preDone: false,
        preScore: null,
        postDone: false,
        postPassed: false,
        postScore: null,
      };
      const score = a.percent != null ? Math.round(Number(a.percent)) : null;
      if (a.kind === "pre") {
        cur.preDone = true;
        if (score != null && (cur.preScore == null || score > cur.preScore)) cur.preScore = score;
      } else if (a.kind === "post") {
        cur.postDone = true;
        if (a.passed) cur.postPassed = true;
        if (score != null && (cur.postScore == null || score > cur.postScore)) cur.postScore = score;
      }
      map.set(a.user_id, cur);
    }
    return map;
  }, [data.attempts]);

  const attendees: RoomAttendee[] = data.enrollments
    .filter((e) => (activeId === "unassigned" ? !e.session_id : e.session_id === activeId))
    .map((e) => {
      const attInfo = attemptsByUser.get(e.user_id);
      const hasCert = certSet.has(e.user_id);
      return {
        userId: e.user_id,
        name: e.profile?.full_name || "ไม่พบชื่อสมาชิก",
        division: e.profile?.division || "",
        department: e.profile?.department || "",
        position: e.profile?.position || "",
        simulated: data.attendance.some((a) => a.user_id === e.user_id && a.session_id === e.session_id && a.is_demo),
        registeredAt: e.created_at,
        checkedAt: data.attendance.find((a) => a.user_id === e.user_id && a.session_id === e.session_id)?.checked_at ?? null,
        preDone: attInfo?.preDone ?? false,
        preScore: attInfo?.preScore ?? null,
        lessonsDone: lessonsByUser.get(e.user_id) ?? 0,
        totalLessons: data.totalLessons ?? 0,
        postDone: attInfo?.postDone ?? false,
        postPassed: (attInfo?.postPassed ?? false) || hasCert,
        postScore: attInfo?.postScore ?? null,
        hasCert,
      };
    });

  // เอฟเฟกต์เช็คชื่อใหม่
  useEffect(() => {
    if (!data) return;
    const { snapshot, arrivals } = detectRoomArrivals(data.attendance, prevChecked.current, Date.now());
    prevChecked.current = snapshot;
    if (Object.keys(arrivals).length) {
      setPulseMap((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(arrivals)) {
          if (!prev[k] || Date.now() - prev[k] > 8000) {
            next[k] = v;
          }
        }
        return next;
      });
    }
  }, [data]);

  const count = Math.max(attendees.length, session?.capacity ?? attendees.length);
  const pages = Math.max(1, Math.ceil(count / ROOM_PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const seats = useMemo(
    () => roomSeats(attendees, session?.capacity ?? null, safePage, layoutMode),
    [attendees, session?.capacity, safePage, layoutMode],
  );
  const zones = useMemo(
    () => (layoutMode === "zones" ? computeDepartmentZones(seats) : []),
    [layoutMode, seats],
  );
  const divisions = [...new Set(attendees.map((p) => p.division).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "th"),
  );

  // Detect live learner progress events (check-in, pre-test, post-test, certificate)
  useEffect(() => {
    if (!seats.length) return;
    const { snapshot, events } = detectRoomProgressEvents(seats, prevProgress.current, Date.now());
    prevProgress.current = snapshot;
    if (events.length > 0) {
      setLiveEvents((prev) => [...events, ...prev].slice(0, 15));
    }
  }, [seats]);

  // Smart Auto-Tour Mode loop
  const tourCursor = useRef(0);
  useEffect(() => {
    if (tourMode === "off") return;
    setWalk(false);
    setKiosk(false);

    const stepTour = () => {
      if (tourMode === "zones" && zones.length > 0) {
        const z = zones[tourCursor.current % zones.length];
        tourCursor.current += 1;
        if (z) {
          setSelected(null);
          setFocus(null);
          setFocusZone(z.division);
        }
        return;
      }
      const candidates = seats.filter((s) => {
        if (!s.attendee) return false;
        if (tourMode === "checked") return Boolean(s.attendee.checkedAt);
        if (tourMode === "waiting") return !s.attendee.checkedAt;
        return true;
      });
      if (!candidates.length) return;
      const target = candidates[tourCursor.current % candidates.length];
      tourCursor.current += 1;
      if (target) {
        setFocusZone(null);
        setSelected(target.index);
        setFocus({ index: target.index, n: Date.now() });
      }
    };

    stepTour();
    const id = window.setInterval(stepTour, 4500);
    return () => window.clearInterval(id);
  }, [tourMode, seats, zones]);

  // แยก 2 ฝั่ง: ฝั่งซ้าย (ยังไม่เช็คอิน) และ ฝั่งขวา (เช็คชื่อแล้ว)
  const waitingList = attendees.filter((p) => !p.checkedAt);
  const checkedList = attendees
    .filter((p) => Boolean(p.checkedAt))
    .sort((a, b) => new Date(b.checkedAt!).getTime() - new Date(a.checkedAt!).getTime());
  const certifiedCount = attendees.filter((p) => p.hasCert || p.postPassed).length;

  const filteredWaiting = waitingList.filter((p) => matchesAttendee(p, search, "waiting", division));
  const filteredChecked = checkedList.filter((p) => matchesAttendee(p, search, "checked", division));

  // Highlighted set respects BOTH search/division AND the 5 View Filter Modes (viewMode)
  const highlighted = useMemo(() => {
    const matching = attendees.filter(
      (p) =>
        matchesAttendee(p, search, viewMode, division) &&
        (!focusZone || (p.division || "ไม่ระบุฝ่าย") === focusZone),
    );
    return new Set(matching.map((person) => person.userId));
  }, [attendees, search, viewMode, division, focusZone]);

  const checked = checkedList.length;
  const location = session?.location || "ยังไม่ระบุห้องอบรม";
  const date = roomDate(session?.starts_at ?? null, session?.ends_at ?? null);
  const chosen = seats.find((s) => s.index === selected);
  const roundLabel = session ? `รอบที่ ${session.round_no}` : "ยังไม่เลือกรอบ";
  const stats = {
    registered: attendees.length,
    checked,
    waiting: waitingList.length,
    free: session?.capacity == null ? "ไม่จำกัด" : Math.max(0, session.capacity - attendees.length),
  };
  const updatedLabel = dataUpdatedAt ? `อัปเดต ${new Date(dataUpdatedAt).toLocaleTimeString("th-TH")}` : "";
  const sessionPulses = Object.fromEntries(
    attendees.map((a) => [a.userId, pulseMap[attendanceKey(a.userId, activeId === "unassigned" ? null : activeId)] ?? 0]),
  );

  const handleSelectSeat = (index: number) => {
    setTourMode("off");
    setFocusZone(null);
    setSelected(index);
    setFocus({ index, n: Date.now() });
  };

  const handleSelectZone = (divName: string) => {
    setTourMode("off");
    setSelected(null);
    setFocus(null);
    setFocusZone((prev) => (prev === divName ? null : divName));
  };

  const sceneProps = {
    seats,
    selected,
    onSelect: handleSelectSeat,
    highlighted,
    view,
    zoom,
    roomName: location,
    date,
    round: roundLabel,
    courseTitle: data.course.title,
    kiosk,
    walk,
    focus,
    pulseMap: sessionPulses,
    stats,
    updatedLabel,
    countdownText: countdown.label,
    celebrate,
    theme,
    zones,
    focusZone,
    onSelectZone: handleSelectZone,
    liveEvents,
    onMetrics: (fps: number, tier: RoomQualityTier) => setFpsMetrics({ fps, tier }),
  };

  const changeSession = (id: string) => {
    setSessionId(id);
    setSelected(null);
    setPage(0);
    setSearch("");
    setDivision("all");
    setFocus(null);
    setFocusZone(null);
    setTourMode("off");
    setDrawn(new Set());
    setWinner(null);
  };
  const toggleKiosk = () => {
    setKiosk((k) => !k);
    setWalk(false);
    setFocus(null);
    setTourMode("off");
  };
  const toggleWalk = () => {
    setWalk((w) => !w);
    setKiosk(false);
    setFocus(null);
    setTourMode("off");
  };
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void pageRef.current?.requestFullscreen?.().catch(() => toast.error("เบราว์เซอร์นี้ไม่รองรับการแสดงเต็มหน้าจอ"));
  };
  const pool = pickPool(attendees, pickDivision, drawn);
  const eligible = pickPool(attendees, pickDivision, new Set()).length;
  const seatOf = (userId: string) => attendees.findIndex((a) => a.userId === userId);

  const draw = () => {
    const final = pickOne(pool);
    if (!final || rolling) return;
    setRolling(true);
    setWinner(null);
    setTourMode("off");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ticks = reduce ? 0 : 10;
    const step = () => {
      if (ticks-- > 0) {
        const p = pickOne(pool)!;
        const i = seatOf(p.userId);
        setPage(Math.floor(i / ROOM_PAGE_SIZE));
        setSelected(i);
        setWinner(p);
        window.setTimeout(step, 90 + (10 - ticks) * 15);
        return;
      }
      const i = seatOf(final.userId);
      setPage(Math.floor(i / ROOM_PAGE_SIZE));
      setSelected(i);
      setFocus({ index: i, n: Date.now() });
      setWinner(final);
      setDrawn((d) => new Set(d).add(final.userId));
      setCelebrate(Date.now());
      setRolling(false);
    };
    step();
  };

  const handleDemoCheckIn = () => {
    let pick = waitingList.length ? waitingList[Math.floor(Math.random() * waitingList.length)]! : null;
    let isReal = true;
    if (!pick) {
      if (attendees.length) {
        pick = attendees[Math.floor(Math.random() * attendees.length)]!;
        isReal = false;
      }
    }
    if (!pick) {
      toast.info("ไม่พบรายชื่อในรอบนี้");
      return;
    }
    const key = attendanceKey(pick.userId, activeId === "unassigned" ? null : activeId);
    const nowTs = Date.now();
    setPulseMap((prev) => ({ ...prev, [key]: nowTs }));
    const seatIdx = seatOf(pick.userId);
    const seatLabel = `${String.fromCharCode(65 + Math.floor(seatIdx / 8))}${String((seatIdx % 8) + 1).padStart(2, "0")}`;
    setLiveEvents((prev) => [
      {
        id: `demo-${pick!.userId}-${nowTs}`,
        userId: pick!.userId,
        name: pick!.name,
        division: pick!.division,
        seatLabel,
        seatIndex: seatIdx,
        kind: "check_in",
        text: `✅ ${pick!.name} เช็คชื่อเข้าห้อง (${seatLabel})`,
        timestamp: nowTs,
      },
      ...prev.slice(0, 14),
    ]);
    if (isReal && data.canCheckIn) {
      checkIn.mutate({ userId: pick.userId, roundId: activeId === "unassigned" ? null : activeId });
    } else {
      toast.success(`จำลองการเช็คชื่อ: ${pick.name}`);
    }
  };

  const fullButton = (
    <Button size="sm" variant={isFull ? "default" : "outline"} className="h-8 text-xs" onClick={toggleFull}>
      {isFull ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
      {isFull ? "ออกเต็มจอ" : "เต็มจอ"}
    </Button>
  );

  const capture = () => {
    const el = document.querySelector<HTMLCanvasElement>(".room-canvas canvas");
    if (!el) return;
    const link = document.createElement("a");
    link.href = el.toDataURL("image/png");
    link.download = `ห้องอบรม-${location.replace(/\s+/g, "-")}-${roundLabel}.png`;
    link.click();
  };

  const presetStyle = HUD_PRESET_STYLES[hudPreset];
  const latestBannerEvent = liveEvents.find((ev) => now - ev.timestamp < 6000);
  const activeZoneSummary = focusZone ? zones.find((z) => z.division === focusZone) : null;

  if (kiosk)
    return (
      <div className="room-page" ref={pageRef}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Armchair className="size-3.5" />
              {roundLabel} <span className="text-muted-foreground">· {data.course.training_year}</span>
            </div>
            <h1 className="truncate text-xl font-bold">{data.course.title}</h1>
            <p className="text-xs text-muted-foreground">
              📍 {location} · 📅 {date}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <div className="flex items-center gap-2 rounded-xl border bg-card/80 px-3 py-1.5 shadow-xs">
              <Timer className="size-4 text-primary" />
              <span className="font-mono text-sm">{countdown.nowText}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  countdown.state === "in_progress"
                    ? "bg-mint/15 text-mint font-bold"
                    : "bg-primary/10 text-primary font-bold"
                }`}
              >
                {countdown.label}
              </span>
            </div>
            <span>
              ลงทะเบียน <span className="text-primary">{attendees.length}</span>
            </span>
            <span>
              เช็คชื่อแล้ว <span className="text-mint">{checked}</span>
            </span>
            <span>
              รอเช็คชื่อ <span className="text-amber">{waitingList.length}</span>
            </span>
            {fullButton}
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={toggleKiosk}>
              <X className="size-3.5" />
              ปิดโหมดจอ
            </Button>
          </div>
        </div>
        <div className="room-canvas kiosk-canvas relative" aria-label="ภาพห้องอบรมสามมิติ">
          {seats.length ? (
            <SceneBoundary>
              <Suspense
                fallback={<div className="grid h-full place-items-center text-muted-foreground">กำลังเตรียมห้องอบรม...</div>}
              >
                <Scene {...sceneProps} />
              </Suspense>
            </SceneBoundary>
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">ยังไม่มีผู้ลงทะเบียนในรอบนี้</div>
          )}
        </div>
      </div>
    );

  return (
    <div className="room-page space-y-2.5" ref={pageRef}>
      {/* COMPACT COMMAND HUD BAR */}
      <header
        className={`flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border bg-card/90 px-3.5 py-2 shadow-xs backdrop-blur-md ${presetStyle.border}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
            <Link to="/manage/$courseId" params={{ courseId }} title="กลับไปจัดการหลักสูตร">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0 max-w-[260px]">
            <div className="truncate text-xs font-bold text-foreground leading-tight">{data.course.title}</div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <span>📍 {location}</span>
              <span>·</span>
              <span>📅 {date}</span>
            </div>
          </div>
          <select
            aria-label="รอบอบรม"
            value={activeId}
            onChange={(e) => changeSession(e.target.value)}
            className="rounded-lg border bg-background px-2.5 py-1 text-xs font-semibold text-foreground cursor-pointer outline-none"
          >
            {data.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {sessionLabel(s)}
              </option>
            ))}
            <option value="unassigned">{data.sessions.length ? "ยังไม่เลือกรอบ" : "ผู้ลงทะเบียน"}</option>
          </select>

          {/* Layout Mode Switcher: Grid vs Department Zones */}
          <div className="flex items-center rounded-lg border bg-background/80 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setLayoutMode("grid");
                setFocusZone(null);
              }}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition ${
                layoutMode === "grid" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
              title="เรียงแถวตามลำดับลงทะเบียน"
            >
              <LayoutGrid className="size-3" /> ผังแถว
            </button>
            <button
              type="button"
              onClick={() => {
                setLayoutMode("zones");
                setWalk(false);
              }}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition ${
                layoutMode === "zones" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
              title="จัดกลุ่มที่นั่งแยกโซนตามฝ่าย/แผนกอัตโนมัติ"
            >
              <Building2 className="size-3" /> โซนฝ่าย
            </button>
          </div>
        </div>

        {/* LIVE CLOCK & COUNTDOWN PILL */}
        <div className="flex items-center gap-2 rounded-full border border-glass-border bg-background/80 px-3.5 py-1 shadow-inner text-xs">
          <Clock3 className={`size-3.5 ${presetStyle.accent}`} />
          <span className="font-mono font-bold text-foreground">{countdown.nowText}</span>
          <span className="text-muted-foreground">·</span>
          <span className={`font-semibold ${countdown.state === "in_progress" ? "text-mint animate-pulse" : presetStyle.accent}`}>
            {countdown.label}
          </span>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold text-mint hover:bg-mint/10 border-mint/40"
            onClick={handleDemoCheckIn}
            title="จำลองการเช็คชื่อ 1 คน เพื่อดูแอนิเมชันคนเดินและชื่อลอย"
          >
            <Sparkles className="size-3.5 text-mint" />
            จำลองเช็คชื่อ
          </Button>
          <Button variant={pickerOpen ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setPickerOpen(!pickerOpen)}>
            <Shuffle className="size-3.5" />
            สุ่มชื่อ
          </Button>

          {/* Auto-Tour Mode Selector */}
          <select
            aria-label="โหมดบินสำรวจอัตโนมัติ"
            value={tourMode}
            onChange={(e) => {
              const val = e.target.value as "off" | "checked" | "waiting" | "zones";
              if (val === "zones" && layoutMode !== "zones") setLayoutMode("zones");
              setTourMode(val);
            }}
            className={`h-8 rounded-lg border px-2 text-xs font-semibold outline-none cursor-pointer ${
              tourMode !== "off" ? "border-primary bg-primary/15 text-primary" : "bg-background/80 text-foreground"
            }`}
            title="โหมดกล้องบินสำรวจผู้เรียนอัตโนมัติ (Tour Mode)"
          >
            <option value="off">🎥 บินสำรวจ: ปิด</option>
            <option value="checked">✈️ บินดู: ผู้เช็คชื่อแล้ว</option>
            <option value="waiting">🔍 บินดู: ผู้รอเช็คชื่อ</option>
            <option value="zones">🏢 บินดู: รายโซนฝ่าย</option>
          </select>

          <div className="flex items-center rounded-lg border bg-background/80 p-0.5">
            <Button
              size="icon"
              variant={view === "angle" && !walk ? "default" : "ghost"}
              className="size-7"
              onClick={() => {
                setView("angle");
                setWalk(false);
                setFocus(null);
                setFocusZone(null);
                setTourMode("off");
              }}
              title="มุมมองเฉียง"
            >
              <Armchair className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant={view === "top" && !walk ? "default" : "ghost"}
              className="size-7"
              onClick={() => {
                setView("top");
                setWalk(false);
                setFocus(null);
                setFocusZone(null);
                setTourMode("off");
              }}
              title="มุมมองแปลนด้านบน (2D Top-Down)"
            >
              <LayoutGrid className="size-3.5" />
            </Button>
            <Button size="icon" variant={walk ? "default" : "ghost"} className="size-7" onClick={toggleWalk} title="หมุน/เดินสำรวจอิสระ">
              <Footprints className="size-3.5" />
            </Button>
          </div>
          <Button size="icon" variant="ghost" className="size-8" title="จับภาพห้อง PNG" onClick={capture}>
            <Camera className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="default"
            className="h-8 text-xs font-semibold bg-primary text-primary-foreground shadow-brand gap-1.5"
            onClick={() => setHubOpen(true)}
            title="เปิดจอใหญ่ฉาย QR Code สำหรับสแกนเข้าห้องอบรม (Classroom Hub)"
          >
            <Monitor className="size-3.5" /> ฉายจอ QR
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={toggleKiosk} title="โหมดจอหน้าห้อง 3D">
            โหมดจอ 3D
          </Button>
          {fullButton}
          <Button variant="ghost" size="icon" className="size-8" title="อัปเดตสถานะ" disabled={isFetching} onClick={() => refetch()}>
            <RefreshCw className={isFetching ? "animate-spin size-3.5" : "size-3.5"} />
          </Button>
        </div>
      </header>

      {/* MASSIVE FULL-BLEED 3D VIEWPORT WITH FLOATING GLASS HUD OVERLAYS */}
      <div
        className={`room-canvas relative w-full overflow-hidden rounded-2xl border shadow-2xl ${presetStyle.border}`}
        aria-label="ภาพห้องอบรมสามมิติ"
      >
        {seats.length ? (
          <SceneBoundary>
            <Suspense
              fallback={<div className="grid h-full place-items-center text-muted-foreground">กำลังเตรียมห้องอบรม...</div>}
            >
              <Scene {...sceneProps} />
            </Suspense>
          </SceneBoundary>
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">ยังไม่มีผู้ลงทะเบียนในรอบนี้</div>
        )}

        {/* TOP-CENTER VIEW FILTER MODES BAR (JARVIS 5-MODE SPOTLIGHT FILTER) */}
        <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-1 rounded-full border border-glass-border bg-card/90 p-1 shadow-xl backdrop-blur-md text-[11px]">
          {(
            [
              { id: "all", label: `ทั้งหมด (${attendees.length})` },
              { id: "checked", label: `✓ เช็คชื่อแล้ว (${checked})` },
              { id: "waiting", label: `⏳ รอเช็คชื่อ (${waitingList.length})` },
              { id: "post_pending", label: `💻 กำลังเรียน/รอสอบ` },
              { id: "certified", label: `🎓 ผ่านเกณฑ์ (${certifiedCount})` },
            ] as { id: RoomViewMode; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setViewMode(m.id)}
              className={`rounded-full px-3 py-1 font-semibold transition-all ${
                viewMode === m.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* LEFT FLOATING HUD: รอเช็คชื่อ (ด้านนอกห้อง) */}
        {leftOpen ? (
          <aside className="absolute left-3.5 top-14 bottom-16 w-76 z-20 flex flex-col rounded-2xl border border-glass-border bg-card/85 p-3 shadow-2xl backdrop-blur-md transition-all duration-300">
            <div className="flex items-center justify-between border-b pb-2 mb-2">
              <div className="flex items-center gap-2">
                <UserX className="size-4 text-amber" />
                <h2 className="text-xs font-bold text-foreground">
                  รอเช็คชื่อ <span className="font-normal text-muted-foreground">(นอกห้อง)</span>
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-bold text-amber">
                  {filteredWaiting.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={() => setLeftOpen(false)}
                  title="ย่อแถบ"
                >
                  <ChevronLeft className="size-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5 mb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
                <input
                  aria-label="ค้นหารายชื่อรอเช็คชื่อ"
                  placeholder="ค้นหาชื่อ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border bg-background/80 py-1 pl-7 pr-2 text-xs"
                />
              </div>
              <select
                aria-label="กรองฝ่ายรอเช็คชื่อ"
                className="w-full rounded-lg border bg-background/80 p-1 text-xs"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
              >
                <option value="all">ทุกฝ่าย</option>
                {divisions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
              {filteredWaiting.map((person) => {
                const index = attendees.indexOf(person);
                return (
                  <div
                    key={person.userId}
                    className="group flex items-center justify-between rounded-xl border border-transparent bg-background/70 p-2 hover:border-amber/40 hover:bg-card/90 transition shadow-xs"
                  >
                    <div
                      className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                      onClick={() => {
                        setPage(Math.floor(index / ROOM_PAGE_SIZE));
                        handleSelectSeat(index);
                      }}
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-amber/10 text-amber text-sm font-bold">
                        {attendeeSymbol(person).emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-foreground">{person.name}</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {person.department || person.division || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!filteredWaiting.length && (
                <p className="py-8 text-center text-xs text-muted-foreground">ไม่มีผู้รอเช็คชื่อ</p>
              )}
            </div>
          </aside>
        ) : (
          <Button
            variant="outline"
            className="absolute left-3.5 top-3.5 z-20 rounded-full border border-amber/40 bg-card/90 px-3 py-1.5 text-xs font-bold text-amber shadow-2xl backdrop-blur-md hover:bg-card"
            onClick={() => setLeftOpen(true)}
          >
            <UserX className="size-3.5 mr-1" /> รอเช็คชื่อ ({waitingList.length}) <ChevronRight className="size-3.5 ml-1" />
          </Button>
        )}

        {/* RIGHT FLOATING HUD: เช็คชื่อแล้ว (เข้าห้องแล้ว) */}
        {rightOpen ? (
          <aside className="absolute right-3.5 top-14 bottom-48 w-80 z-20 flex flex-col rounded-2xl border border-glass-border bg-card/85 p-3 shadow-2xl backdrop-blur-md transition-all duration-300">
            <div className="flex items-center justify-between border-b pb-2 mb-2">
              <div className="flex items-center gap-2">
                <UserCheck className="size-4 text-mint" />
                <h2 className="text-xs font-bold text-foreground">
                  เช็คชื่อแล้ว <span className="font-normal text-muted-foreground">(เข้าห้องแล้ว)</span>
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[11px] font-bold text-mint">
                  {filteredChecked.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={() => setRightOpen(false)}
                  title="ย่อแถบ"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
              {filteredChecked.map((person, idx) => {
                const index = attendees.indexOf(person);
                const label = `${String.fromCharCode(65 + Math.floor(index / 8))}${String((index % 8) + 1).padStart(2, "0")}`;
                const isTopRecent = idx === 0;
                const stage = getLearnerStage(person);
                const stageMeta = getStageMeta(stage);
                return (
                  <div
                    key={person.userId}
                    onClick={() => {
                      setPage(Math.floor(index / ROOM_PAGE_SIZE));
                      handleSelectSeat(index);
                    }}
                    className={`group flex items-center justify-between rounded-xl border p-2 cursor-pointer transition shadow-xs ${
                      isTopRecent
                        ? "border-mint/60 bg-mint/10 animate-checkin-pulse"
                        : "border-transparent bg-background/70 hover:border-mint/30 hover:bg-card/90"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-mint/15 text-mint text-sm font-bold">
                        {attendeeSymbol(person).emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="truncate text-xs font-bold text-foreground">{person.name}</span>
                          {isTopRecent && (
                            <span className="rounded-full bg-mint px-1.5 py-0.2 text-[9px] font-bold text-primary-foreground">
                              ล่าสุด
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {person.department || person.division || "—"} · {stageMeta.shortLabel}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-primary font-mono">{label}</span>
                      {person.checkedAt && (
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {new Date(person.checkedAt).toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {!filteredChecked.length && (
                <p className="py-8 text-center text-xs text-muted-foreground">ยังไม่มีผู้เช็คชื่อ</p>
              )}
            </div>
          </aside>
        ) : (
          <Button
            variant="outline"
            className="absolute right-3.5 top-3.5 z-20 rounded-full border border-mint/40 bg-card/90 px-3 py-1.5 text-xs font-bold text-mint shadow-2xl backdrop-blur-md hover:bg-card"
            onClick={() => setRightOpen(true)}
          >
            <ChevronLeft className="size-3.5 mr-1" />
            <UserCheck className="size-3.5 mr-1" /> เช็คชื่อแล้ว ({checkedList.length})
          </Button>
        )}

        {/* FLOATING DEPARTMENT ZONE SUMMARY CARD (WHEN A ZONE IS CLICKED IN 3D) */}
        {activeZoneSummary && !chosen && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 w-full max-w-sm rounded-2xl border border-primary/40 bg-card/95 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                <Building2 className="size-3.5" /> โซนหน่วยงาน: {activeZoneSummary.division}
              </span>
              <Button variant="ghost" size="icon" className="size-6" onClick={() => setFocusZone(null)}>
                <X className="size-3.5" />
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-background/80 p-2">
                <div className="text-[10px] text-muted-foreground">ลงทะเบียน</div>
                <div className="font-bold text-foreground">{activeZoneSummary.total} คน</div>
              </div>
              <div className="rounded-xl bg-mint/10 p-2">
                <div className="text-[10px] text-mint">เช็คชื่อแล้ว</div>
                <div className="font-bold text-mint">{activeZoneSummary.checked} คน</div>
              </div>
              <div className="rounded-xl bg-amber/10 p-2">
                <div className="text-[10px] text-amber">รอเช็คชื่อ</div>
                <div className="font-bold text-amber">{activeZoneSummary.total - activeZoneSummary.checked} คน</div>
              </div>
            </div>
          </div>
        )}

        {/* FLOATING SELECTED SEAT INSPECTOR CARD (WITH 4-STAGE PROGRESS) */}
        {chosen && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 w-full max-w-sm rounded-2xl border border-primary/40 bg-card/95 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary">
                ที่นั่ง {chosen.label} {chosen.zone ? `· ${chosen.zone}` : ""}
              </span>
              <Button variant="ghost" size="icon" className="size-6" onClick={() => setSelected(null)}>
                <X className="size-3.5" />
              </Button>
            </div>
            <div className="mt-1.5 flex items-center gap-2.5">
              <span className="text-2xl">{chosen.attendee && attendeeSymbol(chosen.attendee).emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-foreground truncate">
                  {chosen.attendee?.name ?? "ที่นั่งว่าง"}
                </div>
                {chosen.attendee && (
                  <div className="text-[11px] text-muted-foreground truncate">
                    {[chosen.attendee.division, chosen.attendee.department].filter(Boolean).join(" / ")}
                  </div>
                )}
              </div>
              {chosen.attendee && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    getStageMeta(getLearnerStage(chosen.attendee)).badgeClass
                  }`}
                >
                  {getStageMeta(getLearnerStage(chosen.attendee)).shortLabel}
                </span>
              )}
            </div>

            {chosen.attendee && (
              <div className="mt-2.5 grid grid-cols-4 gap-1 text-center text-[10px]">
                <div
                  className={`rounded-lg py-1 font-semibold ${
                    chosen.attendee.checkedAt ? "bg-mint/15 text-mint" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {chosen.attendee.checkedAt ? "✓ เช็คชื่อ" : "รอเช็คชื่อ"}
                </div>
                <div
                  className={`rounded-lg py-1 font-semibold ${
                    chosen.attendee.preDone ? "bg-sky-500/15 text-sky-500" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {chosen.attendee.preDone
                    ? `Pre ${chosen.attendee.preScore != null ? `${chosen.attendee.preScore}%` : "✓"}`
                    : "Pre-test"}
                </div>
                <div
                  className={`rounded-lg py-1 font-semibold ${
                    (chosen.attendee.lessonsDone ?? 0) > 0
                      ? "bg-indigo-500/15 text-indigo-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  บทเรียน {chosen.attendee.lessonsDone ?? 0}/{chosen.attendee.totalLessons ?? 0}
                </div>
                <div
                  className={`rounded-lg py-1 font-semibold ${
                    chosen.attendee.postPassed || chosen.attendee.hasCert
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {chosen.attendee.postPassed || chosen.attendee.hasCert
                    ? `Post ${chosen.attendee.postScore != null ? `${chosen.attendee.postScore}%` : "🎓"}`
                    : "Post-test"}
                </div>
              </div>
            )}

            {chosen.attendee && data.canCheckIn && !chosen.attendee.checkedAt && (
              <Button
                className="mt-2.5 w-full h-8 text-xs"
                disabled={checkIn.isPending}
                onClick={() =>
                  checkIn.mutate({
                    userId: chosen.attendee!.userId,
                    roundId: activeId === "unassigned" ? null : activeId,
                  })
                }
              >
                <CheckCircle2 className="size-3.5" /> {checkIn.isPending ? "กำลังเช็คชื่อ..." : "เช็คชื่อเข้าห้อง"}
              </Button>
            )}
          </div>
        )}

        {/* FLOATING LUCKY DRAW MODAL */}
        {pickerOpen && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 w-full max-w-md rounded-2xl border border-primary/40 bg-card/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b pb-2 mb-2.5">
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <Shuffle className="size-4" /> สุ่มผู้เข้าอบรม
              </div>
              <Button variant="ghost" size="icon" className="size-6" onClick={() => setPickerOpen(false)}>
                <X className="size-3.5" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <select
                aria-label="สุ่มจากฝ่าย"
                className="rounded-lg border bg-background px-2.5 py-1 text-xs"
                value={pickDivision}
                disabled={rolling}
                onChange={(e) => {
                  setPickDivision(e.target.value);
                  setDrawn(new Set());
                  setWinner(null);
                }}
              >
                <option value="all">ทุกฝ่าย</option>
                {divisions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <Button size="sm" className="h-8 text-xs" disabled={rolling || !pool.length} onClick={draw}>
                <Shuffle className="size-3.5" />
                {drawn.size ? "คนถัดไป" : "สุ่ม"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={rolling || !drawn.size}
                onClick={() => {
                  setDrawn(new Set());
                  setWinner(null);
                }}
              >
                <RotateCcw className="size-3.5" />
                เริ่มใหม่
              </Button>
            </div>
            <div className="text-[11px] text-muted-foreground mb-2">
              เหลือ {pool.length}/{eligible} คน (เฉพาะผู้เช็คชื่อจริง)
            </div>
            {winner && (
              <div
                className={`rounded-xl p-2.5 text-center text-sm font-bold ${
                  rolling ? "text-muted-foreground bg-muted" : "bg-primary text-primary-foreground animate-bounce"
                }`}
              >
                {rolling ? "กำลังสุ่ม…" : `🎉 ${winner.name} (${winner.division || "—"})`}
              </div>
            )}
          </div>
        )}

        {/* JARVIS REALTIME ALERT BANNER (ABOVE BOTTOM BAR) */}
        {latestBannerEvent && (
          <div
            onClick={() => handleSelectSeat(latestBannerEvent.seatIndex)}
            className="cursor-pointer absolute bottom-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 rounded-full border border-cyan-400/50 bg-slate-950/90 px-4 py-1.5 text-xs font-bold text-white shadow-2xl backdrop-blur-md animate-bounce"
          >
            <Activity className="size-3.5 text-cyan-400 animate-pulse" />
            <span>{latestBannerEvent.text}</span>
          </div>
        )}

        {/* BOTTOM-RIGHT 2D MINI RADAR ROOM MAP */}
        <div className="absolute bottom-3.5 right-3.5 z-20 flex flex-col items-end gap-1.5">
          {radarOpen && (
            <RadarMinimap
              seats={seats}
              selected={selected}
              pulseMap={sessionPulses}
              onSelectSeat={handleSelectSeat}
            />
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRadarOpen((r) => !r)}
            className="h-7 rounded-full border-cyan-500/40 bg-card/90 px-2.5 text-[11px] font-semibold text-foreground shadow-lg backdrop-blur-md"
          >
            <Compass className="size-3 mr-1 text-cyan-500" />
            {radarOpen ? "ซ่อนเรดาร์ 2D" : "เรดาร์ผังที่นั่ง 2D"}
          </Button>
        </div>

        {/* BOTTOM-CENTER FLOATING STATUS, THEME, HUD PALETTE & FPS BAR */}
        <div
          className={`absolute bottom-3.5 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-2.5 rounded-full border bg-card/90 px-4 py-2 shadow-2xl backdrop-blur-md text-xs ${presetStyle.border}`}
        >
          <span className="flex items-center gap-1.5 font-semibold text-mint">
            <i className="size-2 rounded-full bg-mint" />
            เช็คชื่อ {checked}
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-amber">
            <i className="size-2 rounded-full bg-amber" />
            รอ {waitingList.length}
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-emerald-500">
            <i className="size-2 rounded-full bg-emerald-500" />
            ผ่านเกณฑ์ {certifiedCount}
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
            <i className="size-2 rounded-full bg-room-empty" />
            ว่าง {stats.free}
          </span>
          <span className="text-muted-foreground">|</span>
          <div className="flex items-center gap-1 font-semibold text-primary">
            <select
              value={theme}
              onChange={(e) => changeTheme(e.target.value as "hall" | "office")}
              className="rounded-lg bg-transparent font-bold text-primary outline-none cursor-pointer text-xs"
            >
              <option value="office">🏢 Modern Office</option>
              <option value="hall">🏛️ Training Hall</option>
            </select>
          </div>
          <span className="text-muted-foreground">|</span>
          <div className="flex items-center gap-1 font-semibold">
            <select
              aria-label="ธีมสี HUD"
              value={hudPreset}
              onChange={(e) => changeHudPreset(e.target.value as RoomHudPreset)}
              className={`rounded-lg bg-transparent font-bold outline-none cursor-pointer text-xs ${presetStyle.accent}`}
            >
              <option value="hospital">🏥 Hospital Clean</option>
              <option value="jarvis">💠 JARVIS Cyan</option>
              <option value="emerald">🧬 Bio Emerald</option>
              <option value="amber">⚡ Gold Command</option>
            </select>
          </div>
          {!walk && (
            <>
              <span className="text-muted-foreground">|</span>
              <div className="flex items-center gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6"
                  title="ย่อ"
                  disabled={zoom <= 0.7}
                  onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
                >
                  <Minus className="size-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6"
                  title="ขยาย"
                  disabled={zoom >= 1.6}
                  onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            </>
          )}
          <span className="text-muted-foreground">|</span>
          <span
            className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground"
            title="อัตราเฟรมเรตและระดับคุณภาพกราฟิกอัตโนมัติ (Adaptive LOD)"
          >
            {fpsMetrics.fps} FPS · {fpsMetrics.tier.toUpperCase()}
          </span>
        </div>
      </div>

      <ClassroomHubModal
        courseId={courseId}
        courseTitle={data.course.title}
        open={hubOpen}
        onClose={() => setHubOpen(false)}
        initialMode="projector"
      />
    </div>
  );
}
