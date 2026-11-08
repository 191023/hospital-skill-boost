import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Monitor,
  Projector,
  Search,
  CheckCircle2,
  Clock,
  Users,
  AlertCircle,
  X,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Sparkles,
  UserPlus,
  RefreshCw,
  QrCode,
  Calendar,
  MapPin,
  Check,
  RotateCcw,
  Loader2,
  Building2,
  Award,
  Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QRImg, origin } from "@/components/QR";
import { Button } from "@/components/ui/button";

type Session = {
  id: string;
  round_no: number;
  starts_at: string | null;
  ends_at: string | null;
  location: string;
  capacity: number | null;
  checkin_code?: string;
};

type Attendee = {
  userId: string;
  name: string;
  department: string;
  division: string;
  position: string;
  sessionId: string | null;
  checkedIn: boolean;
  checkedAt: string | null;
  requirePretest: boolean;
  preDone: boolean;
};

type RecentArrival = {
  id: string;
  name: string;
  department: string;
  time: string;
};

// Melodic hospital chime using Web Audio API (Zero external assets needed)
function playAudioChime(type: "checkin" | "walkin") {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === "checkin") {
      // 2-tone melodic chime: D5 -> A5
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.1); // A5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.12);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.45);
    } else {
      // 3-tone celebratory walk-in chime: F#5 -> A5 -> D6
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(739.99, now); // F#5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5
      osc.frequency.setValueAtTime(1174.66, now + 0.16); // D6

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.55);
    }
  } catch {
    // Audio autoplay restrictions ignored safely
  }
}

export function ClassroomHubModal({
  courseId,
  courseTitle,
  open,
  onClose,
  initialMode = "projector",
}: {
  courseId: string;
  courseTitle: string;
  open: boolean;
  onClose: () => void;
  initialMode?: "kiosk" | "projector";
}) {
  const qc = useQueryClient();
  const modalRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<"kiosk" | "projector">(initialMode);

  // Sync mode whenever modal is opened
  useEffect(() => {
    if (open) {
      setMode(initialMode);
    }
  }, [open, initialMode]);

  const [activeSessionId, setActiveSessionId] = useState<string>("all");
  const [kioskTab, setKioskTab] = useState<"all" | "waiting" | "checked" | "walkin">("all");
  const [search, setSearch] = useState("");
  const [walkinSearch, setWalkinSearch] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [recentArrivals, setRecentArrivals] = useState<RecentArrival[]>([]);
  const [currentTime, setCurrentTime] = useState<string>("");

  // Digital clock for projector mode
  useEffect(() => {
    const updateClock = () => {
      const d = new Date();
      setCurrentTime(
        d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch attendees, sessions, and course info
  const { data, refetch } = useQuery({
    queryKey: ["classroom-hub-data", courseId],
    enabled: open,
    queryFn: async () => {
      const [{ data: enr = [] }, { data: atd = [] }, { data: sess = [] }, { data: course }] =
        await Promise.all([
          supabase.from("enrollments").select("id,user_id,session_id,created_at,deleted_at").eq("course_id", courseId).is("deleted_at", null),
          supabase.from("attendance").select("user_id,session_id,checked_at,is_demo").eq("course_id", courseId),
          supabase.from("course_sessions").select("id,round_no,starts_at,ends_at,location,capacity,checkin_code").eq("course_id", courseId).order("round_no"),
          supabase.from("courses").select("id,title,checkin_code,require_pretest").eq("id", courseId).maybeSingle(),
        ]);

      const userIds = (enr ?? []).map((e) => e.user_id);
      const [{ data: profiles = [] }, { data: preAttempts = [] }] = await Promise.all([
        userIds.length > 0
          ? supabase.from("profiles").select("id,full_name,department,division,position").in("id", userIds)
          : Promise.resolve({ data: [] }),
        userIds.length > 0
          ? supabase.from("test_attempts").select("user_id").eq("course_id", courseId).eq("kind", "pre")
          : Promise.resolve({ data: [] }),
      ]);

      const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const amap = new Map((atd ?? []).map((a) => [a.user_id, a]));
      const preSet = new Set((preAttempts ?? []).map((t) => t.user_id));

      const attendees: Attendee[] = (enr ?? []).map((e) => {
        const p = pmap.get(e.user_id);
        const a = amap.get(e.user_id);
        return {
          userId: e.user_id,
          name: p?.full_name || "ไม่ระบุชื่อ",
          department: p?.department || "ไม่ระบุแผนก",
          division: p?.division || "ไม่ระบุฝ่าย",
          position: p?.position || "-",
          sessionId: e.session_id,
          checkedIn: !!a,
          checkedAt: a?.checked_at || null,
          requirePretest: course?.require_pretest ?? false,
          preDone: preSet.has(e.user_id),
        };
      });

      return {
        attendees,
        sessions: (sess as Session[]) ?? [],
        courseCheckinCode: course?.checkin_code || "",
      };
    },
  });

  // Supabase Realtime live sync
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel(`classroom-hub-${courseId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendance",
          filter: `course_id=eq.${courseId}`,
        },
        async (payload) => {
          void refetch();
          if (soundEnabled) playAudioChime("checkin");

          // Fetch profile of the new attendee for the live arrival feed
          const newUserId = (payload.new as Record<string, any>)["user_id"];
          if (newUserId) {
            const { data: p } = await supabase
              .from("profiles")
              .select("full_name,department")
              .eq("id", newUserId)
              .maybeSingle();

            if (p) {
              const arrival: RecentArrival = {
                id: `${newUserId}-${Date.now()}`,
                name: p.full_name,
                department: p.department || "บุคลากร",
                time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
              };
              setRecentArrivals((prev) => [arrival, ...prev.slice(0, 9)]);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "enrollments",
          filter: `course_id=eq.${courseId}`,
        },
        () => {
          void refetch();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, courseId, soundEnabled, refetch]);

  // Set default session when data loads
  useEffect(() => {
    if (data?.sessions && data.sessions.length > 0 && activeSessionId === "all") {
      const first = data.sessions[0];
      if (first) setActiveSessionId(first.id);
    }
  }, [data?.sessions, activeSessionId]);

  // Walk-in directory search
  const { data: walkinProfiles = [] } = useQuery({
    queryKey: ["walkin-staff-search", walkinSearch],
    enabled: kioskTab === "walkin" && walkinSearch.trim().length >= 2,
    queryFn: async () => {
      const q = walkinSearch.trim().toLowerCase();
      const { data: res } = await supabase
        .from("profiles")
        .select("id,full_name,department,division,position")
        .eq("approved", true)
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8);
      return res ?? [];
    },
  });

  const activeSession = useMemo(() => {
    return data?.sessions.find((s) => s.id === activeSessionId) ?? data?.sessions[0];
  }, [data?.sessions, activeSessionId]);

  // Filtered attendees for the active round
  const currentAttendees = useMemo(() => {
    if (!data?.attendees) return [];
    return data.attendees.filter((a) => {
      if (activeSessionId !== "all" && a.sessionId !== activeSessionId) return false;
      return true;
    });
  }, [data?.attendees, activeSessionId]);

  // Stats
  const stats = useMemo(() => {
    const total = currentAttendees.length;
    const checked = currentAttendees.filter((a) => a.checkedIn).length;
    const waiting = total - checked;
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
    const cap = activeSession?.capacity;
    const free = cap != null ? Math.max(0, cap - checked) : null;
    return { total, checked, waiting, pct, cap, free };
  }, [currentAttendees, activeSession]);

  // Kiosk filtered view
  const visibleKioskAttendees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return currentAttendees.filter((a) => {
      if (kioskTab === "waiting" && a.checkedIn) return false;
      if (kioskTab === "checked" && !a.checkedIn) return false;
      if (q) {
        const matchName = a.name.toLowerCase().includes(q);
        const matchDept = a.department.toLowerCase().includes(q);
        const matchPos = a.position.toLowerCase().includes(q);
        if (!matchName && !matchDept && !matchPos) return false;
      }
      return true;
    });
  }, [currentAttendees, kioskTab, search]);

  // Action: Fast Check-in 1-Click
  async function handleFastCheckIn(a: Attendee) {
    setActionLoading(true);
    try {
      const targetSession = a.sessionId || (activeSession ? activeSession.id : null);
      const { error } = await supabase.rpc("staff_check_in", {
        _course: courseId,
        _user: a.userId,
        ...(targetSession ? { _session: targetSession } : {}),
      });

      if (error) throw error;

      if (soundEnabled) playAudioChime("checkin");
      toast.success(`เช็คชื่อคุณ ${a.name} สำเร็จ! ✨`);

      // Add to recent arrivals
      const arrival: RecentArrival = {
        id: `${a.userId}-${Date.now()}`,
        name: a.name,
        department: a.department,
        time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      };
      setRecentArrivals((prev) => [arrival, ...prev.slice(0, 9)]);

      await refetch();
      await qc.invalidateQueries({ queryKey: ["manage-attendees", courseId] });
      await qc.invalidateQueries({ queryKey: ["training-room", courseId] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "เช็คชื่อไม่สำเร็จ");
    } finally {
      setActionLoading(false);
    }
  }

  // Action: Undo Check-in
  async function handleUndoCheckIn(a: Attendee) {
    if (!confirm(`ต้องการยกเลิกการเช็คชื่อคุณ ${a.name} หรือไม่?`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc("staff_remove_attendance", {
        _course: courseId,
        _user: a.userId,
      });
      if (error) throw error;
      toast.success(`ยกเลิกการเช็คชื่อคุณ ${a.name} แล้ว`);
      await refetch();
      await qc.invalidateQueries({ queryKey: ["manage-attendees", courseId] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setActionLoading(false);
    }
  }

  // Action: Walk-in Quick Register & Check-in
  async function handleWalkinEnrollAndCheckIn(userId: string, userName: string) {
    setActionLoading(true);
    try {
      const targetSession = activeSession ? activeSession.id : null;
      // 1. Enroll user in this session
      const { error: enrollErr } = await supabase.rpc("staff_enroll_user", {
        _course: courseId,
        _user: userId,
        _session: targetSession,
      });
      if (enrollErr) throw enrollErr;

      // 2. Check in user
      const { error: checkErr } = await supabase.rpc("staff_check_in", {
        _course: courseId,
        _user: userId,
        ...(targetSession ? { _session: targetSession } : {}),
      });
      if (checkErr) throw checkErr;

      if (soundEnabled) playAudioChime("walkin");
      toast.success(`ลงทะเบียน Walk-in และเช็คชื่อคุณ ${userName} สำเร็จ! 🎉`, { duration: 4000 });

      setWalkinSearch("");
      setKioskTab("all");
      await refetch();
      await qc.invalidateQueries({ queryKey: ["manage-attendees", courseId] });
      await qc.invalidateQueries({ queryKey: ["training-room", courseId] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setActionLoading(false);
    }
  }

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void modalRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  if (!open) return null;

  const currentCheckinCode = activeSession?.checkin_code || data?.courseCheckinCode || "";
  const checkinUrl = `${origin()}/checkin/${courseId}/${currentCheckinCode}`;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-xl animate-in fade-in duration-150 overflow-hidden"
    >
      {/* 1. TOP MASTER BAR */}
      <header className="flex flex-wrap items-center justify-between border-b border-border/80 bg-card/80 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Monitor className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground sm:text-base">{courseTitle}</h2>
              <span className="rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold border border-emerald-300/40">
                🟢 Live On-site Hub
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              ศูนย์ปฏิบัติการหน้าห้องอบรม: เคาน์เตอร์ลงทะเบียนด่วน และ จอฉายโปรเจกเตอร์
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode Switcher */}
          <div className="flex items-center rounded-xl border border-border bg-background p-0.5 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => setMode("kiosk")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer ${
                mode === "kiosk"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="size-3.5" />
              <span>เคาน์เตอร์เช็คชื่อด่วน (Desk)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("projector")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer ${
                mode === "projector"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Projector className="size-3.5" />
              <span>จอโปรเจกเตอร์เวที (Stage)</span>
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "ปิดเสียงตอบรับ" : "เปิดเสียงตอบรับ"}
            className={`flex size-9 items-center justify-center rounded-xl border transition cursor-pointer ${
              soundEnabled
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "ออกจากโหมดเต็มจอ" : "แสดงเต็มหน้าจอ (Fullscreen)"}
            className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted transition cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* 2. ROUND / SESSION CONTROLS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs sm:px-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <Calendar className="size-3.5 text-primary" />
            <span>เลือกรอบอบรม:</span>
          </span>
          {data?.sessions && data.sessions.length > 0 ? (
            <div className="flex items-center gap-1 flex-wrap">
              {data.sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSessionId(s.id)}
                  className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer ${
                    activeSessionId === s.id
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "bg-card text-muted-foreground hover:text-foreground border border-border"
                  }`}
                >
                  รอบที่ {s.round_no}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setActiveSessionId("all")}
                className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer ${
                  activeSessionId === "all"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-card text-muted-foreground hover:text-foreground border border-border"
                }`}
              >
                ดูรวมทุกรอบ
              </button>
            </div>
          ) : (
            <span className="text-muted-foreground">หลักสูตรนี้ไม่มีรอบแยก</span>
          )}

          {activeSession && activeSessionId !== "all" && (
            <div className="flex items-center gap-2 text-muted-foreground text-[11px] ml-2">
              {activeSession.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3 text-primary" />
                  <span>{activeSession.location}</span>
                </span>
              )}
              {activeSession.starts_at && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3 text-primary" />
                  <span>
                    {new Date(activeSession.starts_at).toLocaleTimeString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    -{" "}
                    {activeSession.ends_at
                      ? new Date(activeSession.ends_at).toLocaleTimeString("th-TH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}{" "}
                    น.
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3 font-semibold">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            <span>เช็คชื่อแล้ว {stats.checked} / {stats.total} คน ({stats.pct}%)</span>
          </span>
          {stats.cap != null && (
            <span className="text-muted-foreground">
              ที่นั่งว่าง {stats.free} / {stats.cap} ที่
            </span>
          )}
        </div>
      </div>

      {/* 3. MAIN WORKBENCH: MODE 1 (KIOSK DESK) VS MODE 2 (PROJECTOR) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {mode === "kiosk" ? (
          /* ========================================================================= */
          /* MODE 1: DESK FAST-KIOSK CHECK-IN                                           */
          /* ========================================================================= */
          <div className="mx-auto max-w-6xl space-y-5">
            {/* KPI Ribbon & Live Progress Meter */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-border bg-card p-3.5 shadow-2xs">
                <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>ผู้ลงทะเบียนทั้งหมด</span>
                  <Users className="size-3.5 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold text-foreground mt-1">{stats.total} คน</div>
              </div>

              <div className="rounded-2xl border border-emerald-300/40 bg-emerald-500/10 p-3.5 shadow-2xs">
                <div className="text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between font-bold">
                  <span>เช็คชื่อเข้าห้องแล้ว</span>
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                  {stats.checked} คน ({stats.pct}%)
                </div>
              </div>

              <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-3.5 shadow-2xs">
                <div className="text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between font-bold">
                  <span>ยังไม่มาลงทะเบียน</span>
                  <Clock className="size-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                  {stats.waiting} คน
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-3.5 shadow-2xs">
                <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>โควต้าที่นั่งรอบนี้</span>
                  <Building2 className="size-3.5 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground mt-1">
                  {stats.cap != null ? `${stats.free} / ${stats.cap}` : "ไม่จำกัด"}
                </div>
              </div>
            </div>

            {/* Quick Projector Switcher Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3.5 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Projector className="size-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">ต้องการฉาย QR Code ขึ้นจอใหญ่โปรเจกเตอร์หน้าห้อง?</div>
                  <div className="text-[11px] text-muted-foreground">สลับเป็นโหมดเวทีเพื่อแสดง QR Code ขนาดใหญ่ พร้อมรหัสตัวเลขและเคาน์เตอร์</div>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setMode("projector")}
                className="gap-1.5 bg-primary text-primary-foreground shadow-brand cursor-pointer"
              >
                <Projector className="size-4" />
                <span>ฉายจอใหญ่โปรเจกเตอร์ (Stage QR)</span>
              </Button>
            </div>

            {/* Attendance Progress Track */}
            <div className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-foreground">ความคืบหน้าการเช็คชื่อเข้าอบรม</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">{stats.pct}% ครบแล้ว</span>
              </div>
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${stats.pct}%` }}
                />
              </div>
            </div>

            {/* Controls Bar: Tabs & Rapid Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center rounded-xl border border-border bg-card p-0.5 text-xs shadow-2xs flex-wrap">
                <button
                  type="button"
                  onClick={() => setKioskTab("all")}
                  className={`rounded-lg px-3 py-1.5 font-bold transition cursor-pointer ${
                    kioskTab === "all" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ทั้งหมด ({currentAttendees.length})
                </button>
                <button
                  type="button"
                  onClick={() => setKioskTab("waiting")}
                  className={`rounded-lg px-3 py-1.5 font-bold transition cursor-pointer ${
                    kioskTab === "waiting"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "text-amber-800 dark:text-amber-300 hover:text-amber-900"
                  }`}
                >
                  ยังไม่เช็คชื่อ ({stats.waiting})
                </button>
                <button
                  type="button"
                  onClick={() => setKioskTab("checked")}
                  className={`rounded-lg px-3 py-1.5 font-bold transition cursor-pointer ${
                    kioskTab === "checked"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-emerald-800 dark:text-emerald-300 hover:text-emerald-900"
                  }`}
                >
                  เช็คชื่อแล้ว ({stats.checked})
                </button>
                <button
                  type="button"
                  onClick={() => setKioskTab("walkin")}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 font-bold transition cursor-pointer ${
                    kioskTab === "walkin"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-indigo-800 dark:text-indigo-300 hover:text-indigo-900"
                  }`}
                >
                  <UserPlus className="size-3.5" />
                  <span>+ ลงทะเบียน Walk-in ด่วน</span>
                </button>
              </div>

              {/* Fast Search input */}
              {kioskTab !== "walkin" && (
                <div className="relative sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="พิมพ์ชื่อ, แผนก, หรือตำแหน่ง..."
                    autoFocus
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-border bg-card placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* TAB CONTENT 1: ATTENDEE LIST FOR RAPID CHECK-IN */}
            {kioskTab !== "walkin" ? (
              <div className="space-y-2">
                {visibleKioskAttendees.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                    ไม่พบรายชื่อผู้เข้าอบรมที่ตรงกับเงื่อนไข
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {visibleKioskAttendees.map((a) => (
                      <div
                        key={a.userId}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 text-xs transition ${
                          a.checkedIn
                            ? "border-emerald-300/60 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        {/* Member Details */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`flex size-10 items-center justify-center rounded-xl text-sm font-bold shrink-0 shadow-2xs ${
                              a.checkedIn
                                ? "bg-emerald-600 text-white"
                                : "bg-muted text-muted-foreground border border-border"
                            }`}
                          >
                            {a.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-foreground">{a.name}</span>
                              {a.requirePretest && !a.preDone && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300/60 px-2 py-0.5 text-[10px] font-bold">
                                  <AlertCircle className="size-3" />
                                  <span>ค้าง Pre-test</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {a.position} · {a.department || a.division}
                            </div>
                          </div>
                        </div>

                        {/* Check-in Action Button */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          {a.checkedIn ? (
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white px-3 py-2 text-xs font-bold shadow-xs">
                                <Check className="size-3.5 stroke-[3]" />
                                <span>เช็คชื่อแล้ว {a.checkedAt ? new Date(a.checkedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : ""} น.</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleUndoCheckIn(a)}
                                disabled={actionLoading}
                                title="ยกเลิกการเช็คชื่อ"
                                className="flex size-8 items-center justify-center rounded-xl border border-rose-300/60 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition cursor-pointer"
                              >
                                <RotateCcw className="size-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleFastCheckIn(a)}
                              disabled={actionLoading}
                              className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-black shadow-md shadow-emerald-600/30 cursor-pointer transition transform active:scale-95"
                            >
                              <CheckCircle2 className="size-4" />
                              <span>✓ เช็คชื่อทันที (1 คลิก)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* TAB CONTENT 2: WALK-IN QUICK REGISTRATION */
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2.5 text-indigo-700 dark:text-indigo-300">
                  <UserPlus className="size-5" />
                  <div>
                    <h3 className="font-bold text-sm text-foreground">ลงทะเบียนด่วนหน้างาน (Walk-in Attendee)</h3>
                    <p className="text-xs text-muted-foreground">
                      ค้นหาชื่อพนักงานในโรงพยาบาล เพื่อลงทะเบียนเข้าสู่รอบนี้และเช็คชื่อเข้าห้องอบรมทันที
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={walkinSearch}
                    onChange={(e) => setWalkinSearch(e.target.value)}
                    placeholder="พิมพ์ชื่อ หรืออีเมลพนักงานอย่างน้อย 2 ตัวอักษร..."
                    autoFocus
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-2">
                  {walkinSearch.trim().length < 2 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      พิมพ์ชื่อพนักงานเพื่อเริ่มค้นหา
                    </div>
                  ) : walkinProfiles.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      ไม่พบบุคลากรที่ตรงกับคำค้นหา
                    </div>
                  ) : (
                    walkinProfiles.map((p) => {
                      const alreadyEnrolled = currentAttendees.some((a) => a.userId === p.id);
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-xs bg-background"
                        >
                          <div>
                            <div className="font-bold text-foreground text-sm">{p.full_name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {p.position} · {p.department || p.division}
                            </div>
                          </div>

                          {alreadyEnrolled ? (
                            <span className="rounded-lg bg-muted text-muted-foreground px-3 py-1.5 text-xs font-semibold">
                              อยู่ในรอบนี้แล้ว
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleWalkinEnrollAndCheckIn(p.id, p.full_name)}
                              disabled={actionLoading}
                              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                            >
                              <UserPlus className="size-3.5" />
                              + ลงทะเบียน & เช็คชื่อทันที
                            </Button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* MODE 2: STAGE PROJECTOR FULL-SCREEN PRESENTATION                           */
          /* ========================================================================= */
          <div className="mx-auto max-w-5xl flex flex-col items-center justify-center text-center space-y-6 py-6">
            {/* Stage Header */}
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 text-primary px-3 py-1 text-xs font-bold border border-primary/30">
                <Sparkles className="size-3.5" />
                <span>โรงพยาบาลโอเวอร์บรุ๊ค · เช็คชื่อเข้าอบรม On-site</span>
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                {courseTitle}
              </h1>
              {activeSession && (
                <div className="flex items-center justify-center gap-3 text-xs sm:text-sm text-muted-foreground font-medium flex-wrap">
                  <span className="font-bold text-foreground bg-card border border-border px-3 py-1 rounded-lg">
                    รอบที่ {activeSession.round_no}
                  </span>
                  {activeSession.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5 text-primary" />
                      <span>{activeSession.location}</span>
                    </span>
                  )}
                  {activeSession.starts_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5 text-primary" />
                      <span>
                        {new Date(activeSession.starts_at).toLocaleTimeString("th-TH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        -{" "}
                        {activeSession.ends_at
                          ? new Date(activeSession.ends_at).toLocaleTimeString("th-TH", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}{" "}
                        น.
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Giant Stage QR Code */}
            <div className="relative group rounded-3xl border-2 border-primary/50 bg-card p-6 shadow-2xl shadow-primary/10 max-w-md w-full">
              <QRImg value={checkinUrl} size={280} className="mx-auto rounded-2xl shadow-md" />
              <div className="mt-4 text-xs font-bold text-muted-foreground flex items-center justify-center gap-2">
                <QrCode className="size-4 text-primary" />
                <span>เปิดกล้องมือถือสแกน QR Code นี้ เพื่อเช็คชื่อเข้าห้องอบรม</span>
              </div>
              {currentCheckinCode && (
                <div className="mt-4 flex flex-col items-center justify-center gap-1.5 border-t border-border/80 pt-4">
                  <span className="text-xs text-muted-foreground font-semibold">หรือกรอกรหัสตัวเลขเช็คอิน (Check-in Code):</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-2xl bg-primary/15 border-2 border-primary/40 px-5 py-2 font-mono text-3xl font-black tracking-widest text-primary shadow-inner">
                      {currentCheckinCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(currentCheckinCode);
                        toast.success(`คัดลอกรหัส ${currentCheckinCode} แล้ว`);
                      }}
                      className="rounded-xl border border-border bg-card p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                      title="คัดลอกรหัส"
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Digital Clock & Live Attendance Meter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
              <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-xs">
                <div className="text-[11px] text-muted-foreground">เวลาปัจจุบัน</div>
                <div className="text-2xl font-black font-mono text-primary mt-1">{currentTime}</div>
              </div>

              <div className="rounded-2xl border border-emerald-300/40 bg-emerald-500/10 p-4 shadow-xs">
                <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">
                  ผู้เข้าอบรมเช็คชื่อแล้ว
                </div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                  {stats.checked} / {stats.total} คน ({stats.pct}%)
                </div>
              </div>
            </div>

            {/* Live Arrival Stream Ticker */}
            {recentArrivals.length > 0 && (
              <div className="w-full max-w-xl rounded-2xl border border-border bg-card/70 p-4 space-y-2 text-left">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-emerald-500 animate-pulse" />
                  <span>ผู้เข้าอบรมที่เพิ่งเช็คชื่อเข้ามาสดๆ ร้อนๆ:</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {recentArrivals.map((arr) => (
                    <div
                      key={arr.id}
                      className="flex items-center justify-between text-xs rounded-xl bg-background border border-border/80 px-3 py-1.5 animate-in slide-in-from-top-1 duration-200"
                    >
                      <span className="font-bold text-foreground">✨ {arr.name}</span>
                      <span className="text-muted-foreground text-[11px]">
                        ({arr.department}) · {arr.time} น.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
