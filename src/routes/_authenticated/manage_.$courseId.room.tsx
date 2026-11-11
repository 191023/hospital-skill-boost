import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Armchair, Camera, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Footprints, LayoutGrid, Maximize, Minimize, Minus, Monitor, Plus, RefreshCw, RotateCcw, Search, Shuffle, Sparkles, Timer, Users, X, UserCheck, UserX } from "lucide-react";
import { pickOne, pickPool } from "@/lib/room-picker";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { sessionLabel } from "@/components/Sessions";
import { Button } from "@/components/ui/button";
import { attendeeSymbol, attendanceKey, detectRoomArrivals, roomDate, matchesAttendee, roomSeats, getCountdownInfo, ROOM_PAGE_SIZE, type RoomAttendee } from "@/lib/training-room";
import { ClassroomHubModal } from "@/components/course-editor/ClassroomHubModal";

const Scene = lazy(() => import("@/components/TrainingRoomScene"));
export const Route = createFileRoute("/_authenticated/manage_/$courseId/room")({
  ssr: false,
  head: () => ({ meta: [
    { title: "ห้องอบรมและสถานะผู้เข้าร่วม — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "รายชื่อผู้ลงทะเบียนและสถานะเช็คชื่อแยกตามรอบอบรมในมุมมองที่นั่ง" },
    { property: "og:title", content: "ห้องอบรม — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "ติดตามผู้ลงทะเบียนและการเข้าอบรมแต่ละรอบ" },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: RoomPage,
});

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? <div className="flex h-full items-center justify-center text-muted-foreground">แสดงภาพสามมิติไม่ได้ กรุณาดูรายชื่อด้านข้าง</div> : this.props.children; }
}

function RoomPage() {
  const { data: me, isLoading } = useMe();
  const { courseId } = Route.useParams();
  if (isLoading) return <p>กำลังโหลด...</p>;
  if (!me?.isStaff) return <p className="text-muted-foreground">หน้านี้สำหรับผู้ดูแลระบบและวิทยากรเท่านั้น</p>;
  return <Suspense fallback={<p className="text-muted-foreground">กำลังโหลดห้องอบรม...</p>}><RoomContent courseId={courseId} /></Suspense>;
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
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const changeTheme = (newTheme: "hall" | "office") => {
    setTheme(newTheme);
    try { localStorage.setItem("training-room-theme", newTheme); } catch {}
  };

  useEffect(() => {
    const sync = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
    };
  }, []);

  const { data, refetch, isFetching, isRefetchError, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ["training-room", courseId],
    refetchInterval: 10000,
    queryFn: async () => {
      const [c, s, e, a, permission] = await Promise.all([
        supabase.from("courses").select("id,title,training_year").eq("id", courseId).maybeSingle(),
        supabase.from("course_sessions").select("id,round_no,starts_at,ends_at,location,capacity").eq("course_id", courseId).order("round_no"),
        supabase.from("enrollments").select("user_id,session_id,created_at").eq("course_id", courseId).is("deleted_at", null).order("created_at").order("user_id"),
        supabase.from("attendance").select("user_id,session_id,checked_at,is_demo").eq("course_id", courseId),
        supabase.rpc("can_edit_course", { _course: courseId }),
      ]);
      for (const result of [c, s, e, a, permission]) if (result.error) throw result.error;
      const ids = [...new Set((e.data ?? []).map((row) => row.user_id))];
      const p = ids.length ? await supabase.from("profiles").select("id,full_name,division,department,position").in("id", ids) : { data: [], error: null };
      if (p.error) throw p.error;
      const profiles = new Map((p.data ?? []).map((row) => [row.id, row]));
      return { course: c.data, canCheckIn: permission.data === true, sessions: s.data ?? [], enrollments: (e.data ?? []).map((row) => ({ ...row, profile: profiles.get(row.user_id) })), attendance: a.data ?? [] };
    },
  });

  const checkIn = useMutation({
    mutationFn: async ({ userId, roundId }: { userId: string; roundId: string | null }) => {
      const { data: res, error } = await supabase.rpc("staff_check_in", { _course: courseId, _user: userId, ...(roundId ? { _session: roundId } : {}) });
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

  const attendees: RoomAttendee[] = data.enrollments.filter((e) => activeId === "unassigned" ? !e.session_id : e.session_id === activeId).map((e) => ({
    userId: e.user_id, name: e.profile?.full_name || "ไม่พบชื่อสมาชิก", division: e.profile?.division || "", department: e.profile?.department || "",
    position: e.profile?.position || "", simulated: data.attendance.some((a) => a.user_id === e.user_id && a.session_id === e.session_id && a.is_demo),
    registeredAt: e.created_at, checkedAt: data.attendance.find((a) => a.user_id === e.user_id && a.session_id === e.session_id)?.checked_at ?? null,
  }));

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
  const seats = roomSeats(attendees, session?.capacity ?? null, safePage);
  const divisions = [...new Set(attendees.map((p) => p.division).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));

  // แยก 2 ฝั่ง: ฝั่งซ้าย (ยังไม่เช็คอิน) และ ฝั่งขวา (เช็คชื่อแล้ว)
  const waitingList = attendees.filter((p) => !p.checkedAt);
  const checkedList = attendees.filter((p) => Boolean(p.checkedAt)).sort((a, b) => new Date(b.checkedAt!).getTime() - new Date(a.checkedAt!).getTime());

  const filteredWaiting = waitingList.filter((p) => matchesAttendee(p, search, "waiting", division));
  const filteredChecked = checkedList.filter((p) => matchesAttendee(p, search, "checked", division));
  const highlighted = new Set([...filteredWaiting, ...filteredChecked].map((person) => person.userId));

  const checked = checkedList.length;
  const simulated = attendees.filter((p) => p.simulated).length;
  const location = session?.location || "ยังไม่ระบุห้องอบรม";
  const date = roomDate(session?.starts_at ?? null, session?.ends_at ?? null);
  const chosen = seats.find((s) => s.index === selected);
  const roundLabel = session ? `รอบที่ ${session.round_no}` : "ยังไม่เลือกรอบ";
  const stats = { registered: attendees.length, checked, waiting: waitingList.length, free: session?.capacity == null ? "ไม่จำกัด" : Math.max(0, session.capacity - attendees.length) };
  const updatedLabel = dataUpdatedAt ? `อัปเดต ${new Date(dataUpdatedAt).toLocaleTimeString("th-TH")}` : "";
  const sessionPulses = Object.fromEntries(attendees.map((a) => [a.userId, pulseMap[attendanceKey(a.userId, activeId === "unassigned" ? null : activeId)] ?? 0]));
  const sceneProps = { seats, selected, onSelect: setSelected, highlighted, view, zoom, roomName: location, date, round: roundLabel, courseTitle: data.course.title, kiosk, walk, focus, pulseMap: sessionPulses, stats, updatedLabel, countdownText: countdown.label, celebrate, theme };

  const changeSession = (id: string) => { setSessionId(id); setSelected(null); setPage(0); setSearch(""); setDivision("all"); setFocus(null); setDrawn(new Set()); setWinner(null); };
  const toggleKiosk = () => { setKiosk((k) => !k); setWalk(false); setFocus(null); };
  const toggleWalk = () => { setWalk((w) => !w); setKiosk(false); setFocus(null); };
  const toggleFull = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void pageRef.current?.requestFullscreen?.().catch(() => toast.error("เบราว์เซอร์นี้ไม่รองรับการแสดงเต็มหน้าจอ")); };
  const pool = pickPool(attendees, pickDivision, drawn);
  const eligible = pickPool(attendees, pickDivision, new Set()).length;
  const seatOf = (userId: string) => attendees.findIndex((a) => a.userId === userId);

  const draw = () => {
    const final = pickOne(pool);
    if (!final || rolling) return;
    setRolling(true); setWinner(null);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ticks = reduce ? 0 : 10;
    const step = () => {
      if (ticks-- > 0) {
        const p = pickOne(pool)!; const i = seatOf(p.userId);
        setPage(Math.floor(i / ROOM_PAGE_SIZE)); setSelected(i); setWinner(p);
        window.setTimeout(step, 90 + (10 - ticks) * 15);
        return;
      }
      const i = seatOf(final.userId);
      setPage(Math.floor(i / ROOM_PAGE_SIZE)); setSelected(i); setFocus({ index: i, n: Date.now() });
      setWinner(final); setDrawn((d) => new Set(d).add(final.userId)); setCelebrate(Date.now()); setRolling(false);
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
    setPulseMap((prev) => ({ ...prev, [key]: Date.now() }));
    if (isReal && data.canCheckIn) {
      checkIn.mutate({ userId: pick.userId, roundId: activeId === "unassigned" ? null : activeId });
    } else {
      toast.success(`จำลองการเช็คชื่อ: ${pick.name}`);
    }
  };

  const fullButton = <Button size="sm" variant={isFull ? "default" : "outline"} className="h-8 text-xs" onClick={toggleFull}>{isFull ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}{isFull ? "ออกเต็มจอ" : "เต็มจอ"}</Button>;

  const capture = () => {
    const el = document.querySelector<HTMLCanvasElement>(".room-canvas canvas");
    if (!el) return;
    const link = document.createElement("a");
    link.href = el.toDataURL("image/png");
    link.download = `ห้องอบรม-${location.replace(/\s+/g, "-")}-${roundLabel}.png`;
    link.click();
  };

  if (kiosk) return <div className="room-page" ref={pageRef}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary"><Armchair className="size-3.5" />{roundLabel} <span className="text-muted-foreground">· {data.course.training_year}</span></div>
        <h1 className="truncate text-xl font-bold">{data.course.title}</h1>
        <p className="text-xs text-muted-foreground">📍 {location} · 📅 {date}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <div className="flex items-center gap-2 rounded-xl border bg-card/80 px-3 py-1.5 shadow-xs">
          <Timer className="size-4 text-primary" />
          <span className="font-mono text-sm">{countdown.nowText}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${countdown.state === "in_progress" ? "bg-mint/15 text-mint font-bold" : "bg-primary/10 text-primary font-bold"}`}>{countdown.label}</span>
        </div>
        <span>ลงทะเบียน <span className="text-primary">{attendees.length}</span></span>
        <span>เช็คชื่อแล้ว <span className="text-mint">{checked}</span></span>
        <span>รอเช็คชื่อ <span className="text-amber">{waitingList.length}</span></span>
        {fullButton}<Button variant="outline" size="sm" className="h-8 text-xs" onClick={toggleKiosk}><X className="size-3.5" />ปิดโหมดจอ</Button>
      </div>
    </div>
    <div className="room-canvas kiosk-canvas relative" aria-label="ภาพห้องอบรมสามมิติ">
      {seats.length ? <SceneBoundary><Suspense fallback={<div className="grid h-full place-items-center text-muted-foreground">กำลังเตรียมห้องอบรม...</div>}><Scene {...sceneProps} /></Suspense></SceneBoundary> : <div className="grid h-full place-items-center text-muted-foreground">ยังไม่มีผู้ลงทะเบียนในรอบนี้</div>}
    </div>
  </div>;

  return <div className="room-page space-y-2.5" ref={pageRef}>
    
    {/* COMPACT SINGLE-LINE COMMAND HUD BAR */}
    <header className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-glass-border bg-card/90 px-3.5 py-2 shadow-xs backdrop-blur-md">
      <div className="flex items-center gap-2.5 min-w-0">
        <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
          <Link to="/manage/$courseId" params={{ courseId }} title="กลับไปจัดการหลักสูตร"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div className="min-w-0 max-w-[320px]">
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
          {data.sessions.map((s) => <option key={s.id} value={s.id}>{sessionLabel(s)}</option>)}
          <option value="unassigned">{data.sessions.length ? "ยังไม่เลือกรอบ" : "ผู้ลงทะเบียน"}</option>
        </select>
      </div>

      {/* LIVE CLOCK & COUNTDOWN PILL */}
      <div className="flex items-center gap-2 rounded-full border border-glass-border bg-background/80 px-3.5 py-1 shadow-inner text-xs">
        <Clock3 className="size-3.5 text-primary" />
        <span className="font-mono font-bold text-foreground">{countdown.nowText}</span>
        <span className="text-muted-foreground">·</span>
        <span className={`font-semibold ${countdown.state === "in_progress" ? "text-mint animate-pulse" : "text-primary"}`}>
          {countdown.label}
        </span>
      </div>

      {/* CONTROLS */}
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="h-8 text-xs font-semibold text-mint hover:bg-mint/10 border-mint/40" onClick={handleDemoCheckIn} title="จำลองการเช็คชื่อ 1 คน เพื่อดูแอนิเมชันคนเดินและชื่อลอย">
          <Sparkles className="size-3.5 text-mint" />
          จำลองเช็คชื่อ
        </Button>
        <Button variant={pickerOpen ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setPickerOpen(!pickerOpen)}>
          <Shuffle className="size-3.5" />
          สุ่มชื่อ
        </Button>
        <div className="flex items-center rounded-lg border bg-background/80 p-0.5">
          <Button size="icon" variant={view === "angle" ? "default" : "ghost"} className="size-7" onClick={() => { setView("angle"); setFocus(null); }} title="มุมมองห้อง">
            <Armchair className="size-3.5" />
          </Button>
          <Button size="icon" variant={view === "top" ? "default" : "ghost"} className="size-7" onClick={() => { setView("top"); setFocus(null); }} title="มุมมองบน">
            <LayoutGrid className="size-3.5" />
          </Button>
          <Button size="icon" variant={walk ? "default" : "ghost"} className="size-7" onClick={toggleWalk} title="เดินสำรวจ">
            <Footprints className="size-3.5" />
          </Button>
        </div>
        <Button size="icon" variant="ghost" className="size-8" title="จับภาพห้อง PNG" onClick={capture}><Camera className="size-4" /></Button>
        <Button size="sm" variant="default" className="h-8 text-xs font-semibold bg-primary text-primary-foreground shadow-brand gap-1.5" onClick={() => setHubOpen(true)} title="เปิดจอใหญ่ฉาย QR Code สำหรับสแกนเข้าห้องอบรม (Classroom Hub)"><Monitor className="size-3.5" /> ฉายจอ QR</Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={toggleKiosk} title="โหมดจอหน้าห้อง 3D">โหมดจอ 3D</Button>
        {fullButton}
        <Button variant="ghost" size="icon" className="size-8" title="อัปเดตสถานะ" disabled={isFetching} onClick={() => refetch()}><RefreshCw className={isFetching ? "animate-spin size-3.5" : "size-3.5"} /></Button>
      </div>
    </header>

    {/* MASSIVE FULL-BLEED 3D VIEWPORT WITH FLOATING GLASS HUD OVERLAYS */}
    <div className="room-canvas relative w-full overflow-hidden rounded-2xl border border-glass-border shadow-2xl" aria-label="ภาพห้องอบรมสามมิติ">
      {seats.length ? <SceneBoundary><Suspense fallback={<div className="grid h-full place-items-center text-muted-foreground">กำลังเตรียมห้องอบรม...</div>}><Scene {...sceneProps} /></Suspense></SceneBoundary> : <div className="grid h-full place-items-center text-muted-foreground">ยังไม่มีผู้ลงทะเบียนในรอบนี้</div>}

      {/* LEFT FLOATING HUD: รอเช็คชื่อ (ด้านนอกห้อง) */}
      {leftOpen ? (
        <aside className="absolute left-3.5 top-3.5 bottom-3.5 w-76 z-20 flex flex-col rounded-2xl border border-glass-border bg-card/85 p-3 shadow-2xl backdrop-blur-md transition-all duration-300">
          <div className="flex items-center justify-between border-b pb-2 mb-2">
            <div className="flex items-center gap-2">
              <UserX className="size-4 text-amber" />
              <h2 className="text-xs font-bold text-foreground">รอเช็คชื่อ <span className="font-normal text-muted-foreground">(นอกห้อง)</span></h2>
            </div>
            <div className="flex items-center gap-1">
              <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-bold text-amber">{filteredWaiting.length}</span>
              <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground" onClick={() => setLeftOpen(false)} title="ย่อแถบ"><ChevronLeft className="size-4" /></Button>
            </div>
          </div>
          <div className="space-y-1.5 mb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
              <input aria-label="ค้นหารายชื่อรอเช็คชื่อ" placeholder="ค้นหาชื่อ..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border bg-background/80 py-1 pl-7 pr-2 text-xs" />
            </div>
            <select aria-label="กรองฝ่ายรอเช็คชื่อ" className="w-full rounded-lg border bg-background/80 p-1 text-xs" value={division} onChange={(e) => setDivision(e.target.value)}>
              <option value="all">ทุกฝ่าย</option>
              {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {filteredWaiting.map((person) => {
              const index = attendees.indexOf(person);
              return (
                <div key={person.userId} className="group flex items-center justify-between rounded-xl border border-transparent bg-background/70 p-2 hover:border-amber/40 hover:bg-card/90 transition shadow-xs">
                  <div className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" onClick={() => { setPage(Math.floor(index / ROOM_PAGE_SIZE)); setSelected(index); setFocus({ index, n: Date.now() }); }}>
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-amber/10 text-amber text-sm font-bold">
                      {attendeeSymbol(person).emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-foreground">{person.name}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{person.department || person.division || "—"}</div>
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
        <aside className="absolute right-3.5 top-3.5 bottom-3.5 w-80 z-20 flex flex-col rounded-2xl border border-glass-border bg-card/85 p-3 shadow-2xl backdrop-blur-md transition-all duration-300">
          <div className="flex items-center justify-between border-b pb-2 mb-2">
            <div className="flex items-center gap-2">
              <UserCheck className="size-4 text-mint" />
              <h2 className="text-xs font-bold text-foreground">เช็คชื่อแล้ว <span className="font-normal text-muted-foreground">(เข้าห้องแล้ว)</span></h2>
            </div>
            <div className="flex items-center gap-1">
              <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[11px] font-bold text-mint">{filteredChecked.length}</span>
              <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground" onClick={() => setRightOpen(false)} title="ย่อแถบ"><ChevronRight className="size-4" /></Button>
            </div>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {filteredChecked.map((person, idx) => {
              const index = attendees.indexOf(person);
              const label = `${String.fromCharCode(65 + Math.floor(index / 8))}${String(index % 8 + 1).padStart(2, "0")}`;
              const isTopRecent = idx === 0;
              return (
                <div
                  key={person.userId}
                  onClick={() => { setPage(Math.floor(index / ROOM_PAGE_SIZE)); setSelected(index); setFocus({ index, n: Date.now() }); }}
                  className={`group flex items-center justify-between rounded-xl border p-2 cursor-pointer transition shadow-xs ${
                    isTopRecent ? "border-mint/60 bg-mint/10 animate-checkin-pulse" : "border-transparent bg-background/70 hover:border-mint/30 hover:bg-card/90"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-mint/15 text-mint text-sm font-bold">
                      {attendeeSymbol(person).emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-xs font-bold text-foreground">{person.name}</span>
                        {isTopRecent && <span className="rounded-full bg-mint px-1.5 py-0.2 text-[9px] font-bold text-primary-foreground">ล่าสุด</span>}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">{person.department || person.division || "—"}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold text-primary font-mono">{label}</span>
                    {person.checkedAt && (
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {new Date(person.checkedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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
          <ChevronLeft className="size-3.5 mr-1" /><UserCheck className="size-3.5 mr-1" /> เช็คชื่อแล้ว ({checkedList.length})
        </Button>
      )}

      {/* FLOATING SELECTED SEAT CARD */}
      {chosen && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-sm rounded-2xl border border-primary/40 bg-card/95 p-3.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between"><span className="text-xs font-bold text-primary">ที่นั่ง {chosen.label}</span><Button variant="ghost" size="icon" className="size-6" onClick={() => setSelected(null)}><X className="size-3.5" /></Button></div>
          <div className="mt-1 flex items-center gap-2.5">
            <span className="text-2xl">{chosen.attendee && attendeeSymbol(chosen.attendee).emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-foreground truncate">{chosen.attendee?.name ?? "ที่นั่งว่าง"}</div>
              {chosen.attendee && <div className="text-[11px] text-muted-foreground truncate">{[chosen.attendee.division, chosen.attendee.department].filter(Boolean).join(" / ")}</div>}
            </div>
            {chosen.attendee?.checkedAt && <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[11px] font-bold text-mint">✓ เช็คชื่อแล้ว</span>}
          </div>
          {chosen.attendee && data.canCheckIn && !chosen.attendee.checkedAt && (
            <Button className="mt-2.5 w-full h-8 text-xs" disabled={checkIn.isPending} onClick={() => checkIn.mutate({ userId: chosen.attendee!.userId, roundId: activeId === "unassigned" ? null : activeId })}>
              <CheckCircle2 className="size-3.5" /> {checkIn.isPending ? "กำลังเช็คชื่อ..." : "เช็คชื่อเข้าห้อง"}
            </Button>
          )}
        </div>
      )}

      {/* FLOATING LUCKY DRAW MODAL */}
      {pickerOpen && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-md rounded-2xl border border-primary/40 bg-card/95 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b pb-2 mb-2.5">
            <div className="flex items-center gap-2 text-sm font-bold text-primary"><Shuffle className="size-4" /> สุ่มผู้เข้าอบรม</div>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => setPickerOpen(false)}><X className="size-3.5" /></Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <select aria-label="สุ่มจากฝ่าย" className="rounded-lg border bg-background px-2.5 py-1 text-xs" value={pickDivision} disabled={rolling} onChange={(e) => { setPickDivision(e.target.value); setDrawn(new Set()); setWinner(null); }}>
              <option value="all">ทุกฝ่าย</option>{divisions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <Button size="sm" className="h-8 text-xs" disabled={rolling || !pool.length} onClick={draw}><Shuffle className="size-3.5" />{drawn.size ? "คนถัดไป" : "สุ่ม"}</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={rolling || !drawn.size} onClick={() => { setDrawn(new Set()); setWinner(null); }}><RotateCcw className="size-3.5" />เริ่มใหม่</Button>
          </div>
          <div className="text-[11px] text-muted-foreground mb-2">เหลือ {pool.length}/{eligible} คน (เฉพาะผู้เช็คชื่อจริง)</div>
          {winner && <div className={`rounded-xl p-2.5 text-center text-sm font-bold ${rolling ? "text-muted-foreground bg-muted" : "bg-primary text-primary-foreground animate-bounce"}`}>{rolling ? "กำลังสุ่ม…" : `🎉 ${winner.name} (${winner.division || "—"})`}</div>}
        </div>
      )}

      {/* BOTTOM-CENTER FLOATING STATUS & THEME BAR */}
      <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-3 rounded-full border border-glass-border bg-card/90 px-4 py-2 shadow-2xl backdrop-blur-md text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-mint"><i className="size-2 rounded-full bg-mint" />เช็คชื่อ {checked}</span>
        <span className="flex items-center gap-1.5 font-semibold text-amber"><i className="size-2 rounded-full bg-amber" />รอ {waitingList.length}</span>
        <span className="flex items-center gap-1.5 font-semibold text-muted-foreground"><i className="size-2 rounded-full bg-room-empty" />ว่าง {stats.free}</span>
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
        {!walk && (
          <>
            <span className="text-muted-foreground">|</span>
            <div className="flex items-center gap-0.5">
              <Button size="icon" variant="ghost" className="size-6" title="ย่อ" disabled={zoom <= 0.7} onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}><Minus className="size-3" /></Button>
              <Button size="icon" variant="ghost" className="size-6" title="ขยาย" disabled={zoom >= 1.6} onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}><Plus className="size-3" /></Button>
            </div>
          </>
        )}
      </div>

    </div>
    <ClassroomHubModal
      courseId={courseId}
      courseTitle={data.course.title}
      open={hubOpen}
      onClose={() => setHubOpen(false)}
      initialMode="projector"
    />
  </div>;
}


