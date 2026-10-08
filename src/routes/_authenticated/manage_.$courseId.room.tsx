import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { ArrowLeft, Armchair, CheckCircle2, Clock3, LayoutGrid, Minus, Plus, RefreshCw, Search, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { sessionLabel } from "@/components/Sessions";
import { Button } from "@/components/ui/button";
import { attendeeSymbol, roomDate, matchesAttendee, roomSeats, ROOM_PAGE_SIZE, type RoomAttendee } from "@/lib/training-room";

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
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [view, setView] = useState<"angle" | "top">("angle");
  const [zoom, setZoom] = useState(1);
  const { data, refetch, isFetching, isRefetchError, dataUpdatedAt } = useSuspenseQuery({
    queryKey: ["training-room", courseId],
    refetchInterval: 10000,
    queryFn: async () => {
      const [c, s, e, a] = await Promise.all([
        supabase.from("courses").select("id,title,training_year").eq("id", courseId).maybeSingle(),
        supabase.from("course_sessions").select("id,round_no,starts_at,ends_at,location,capacity").eq("course_id", courseId).order("round_no"),
        supabase.from("enrollments").select("user_id,session_id,created_at").eq("course_id", courseId).order("created_at").order("user_id"),
        supabase.from("attendance").select("user_id,session_id,checked_at,is_demo").eq("course_id", courseId),
      ]);
      for (const result of [c, s, e, a]) if (result.error) throw result.error;
      const ids = [...new Set((e.data ?? []).map((row) => row.user_id))];
      const p = ids.length ? await supabase.from("profiles").select("id,full_name,division,department,position").in("id", ids) : { data: [], error: null };
      if (p.error) throw p.error;
      const profiles = new Map((p.data ?? []).map((row) => [row.id, row]));
      return { course: c.data, sessions: s.data ?? [], enrollments: (e.data ?? []).map((row) => ({ ...row, profile: profiles.get(row.user_id) })), attendance: a.data ?? [] };
    },
  });
  if (!data.course) return <p>ไม่พบหลักสูตร</p>;
  const activeId = sessionId || data.sessions[0]?.id || "unassigned";
  const session = data.sessions.find((s) => s.id === activeId);
  const attendees: RoomAttendee[] = data.enrollments.filter((e) => activeId === "unassigned" ? !e.session_id : e.session_id === activeId).map((e) => ({
    userId: e.user_id, name: e.profile?.full_name || "ไม่พบชื่อสมาชิก", division: e.profile?.division || "", department: e.profile?.department || "",
    position: e.profile?.position || "", simulated: data.attendance.some((a) => a.user_id === e.user_id && a.session_id === e.session_id && a.is_demo),
    registeredAt: e.created_at, checkedAt: data.attendance.find((a) => a.user_id === e.user_id && a.session_id === e.session_id)?.checked_at ?? null,
  }));
  const count = Math.max(attendees.length, session?.capacity ?? attendees.length);
  const pages = Math.max(1, Math.ceil(count / ROOM_PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const seats = roomSeats(attendees, session?.capacity ?? null, safePage);
  const filtered = attendees.filter((person) => matchesAttendee(person, search, status));
  const highlighted = new Set(filtered.map((person) => person.userId));
  const checked = attendees.filter((p) => p.checkedAt).length;
  const simulated = attendees.filter((p) => p.simulated).length;
  const location = session?.location || "ยังไม่ระบุห้องอบรม";
  const date = roomDate(session?.starts_at ?? null, session?.ends_at ?? null);
  const chosen = seats.find((s) => s.index === selected);
  const changeSession = (id: string) => { setSessionId(id); setSelected(null); setPage(0); setSearch(""); setStatus("all"); };
  return <div className="room-page">
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <Button variant="link" asChild className="h-auto p-0"><Link to="/manage/$courseId" params={{ courseId }}><ArrowLeft />จัดการหลักสูตร</Link></Button>
        <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-primary"><Armchair />ห้องอบรม <span className="text-muted-foreground">· {data.course.training_year}</span></div>
        <h1 className="mt-1 text-2xl font-bold">{data.course.title}</h1>
      </div>
      <Button variant="outline" size="icon" title="อัปเดตสถานะ" aria-label="อัปเดตสถานะ" disabled={isFetching} onClick={() => refetch()}><RefreshCw className={isFetching ? "animate-spin" : ""} /></Button>
    </header>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <label className="min-w-0 flex-1 text-xs font-semibold text-muted-foreground">รอบอบรม
        <select aria-label="รอบอบรม" value={activeId} onChange={(e) => changeSession(e.target.value)} className="mt-1 block w-full max-w-xl rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground">
          {data.sessions.map((s) => <option key={s.id} value={s.id}>{sessionLabel(s)}</option>)}
          <option value="unassigned">{data.sessions.length ? "ยังไม่เลือกรอบ" : "ผู้ลงทะเบียนหลักสูตร"}</option>
        </select>
      </label>
      <div className="text-xs text-muted-foreground">{isRefetchError ? <span className="text-destructive">อัปเดตไม่สำเร็จ กรุณาลองอีกครั้ง</span> : <>อัปเดตล่าสุด {new Date(dataUpdatedAt).toLocaleTimeString("th-TH")}</>}</div>
    </div>
    <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><span className="font-semibold">📍 {location}</span><span className="text-muted-foreground">📅 {date}</span></div>
    {simulated > 0 && <p className="mb-4 border-l-2 border-amber pl-3 text-sm text-muted-foreground">ข้อมูลเช็คชื่อจำลอง {simulated} คน · สำหรับทดสอบ ไม่ใช่การเข้าอบรมจริง</p>}
    <div className="room-stats mb-5 grid grid-cols-2 gap-4 border-y py-4 sm:grid-cols-4">
      {[{ icon: Users, label: "ลงทะเบียน", value: attendees.length, tone: "text-primary" }, { icon: CheckCircle2, label: "เช็คชื่อแล้ว", value: checked, tone: "text-mint" }, { icon: Clock3, label: "รอเช็คชื่อ", value: attendees.length - checked, tone: "text-amber" }, { icon: Armchair, label: "ที่นั่งว่าง", value: session?.capacity == null ? "ไม่จำกัด" : Math.max(0, session.capacity - attendees.length), tone: "text-muted-foreground" }].map(({ icon: Icon, label, value, tone }) => <div key={label}><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className={`size-4 ${tone}`} />{label}</div><div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div></div>)}
    </div>
    {session?.capacity != null && attendees.length > session.capacity && <p className="mb-3 text-sm text-coral">ผู้ลงทะเบียนเกินจำนวนที่นั่ง {attendees.length - session.capacity} คน</p>}
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2"><Button size="sm" variant={view === "angle" ? "default" : "outline"} onClick={() => setView("angle")}><Armchair />มุมห้อง</Button><Button size="sm" variant={view === "top" ? "default" : "outline"} onClick={() => setView("top")}><LayoutGrid />มุมบน</Button></div>
          <div className="flex gap-1"><Button size="icon" variant="ghost" title="ย่อ" aria-label="ย่อ" disabled={zoom <= 0.7} onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}><Minus /></Button><Button size="icon" variant="ghost" title="ขยาย" aria-label="ขยาย" disabled={zoom >= 1.6} onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}><Plus /></Button></div>
        </div>
        <div className="room-canvas relative" aria-label="ภาพห้องอบรมสามมิติ">
          {seats.length ? <SceneBoundary><Suspense fallback={<div className="grid h-full place-items-center text-muted-foreground">กำลังเตรียมห้องอบรม...</div>}><Scene seats={seats} selected={selected} onSelect={setSelected} highlighted={highlighted} view={view} zoom={zoom} roomName={location} date={date} round={session ? `รอบที่ ${session.round_no}` : "ยังไม่เลือกรอบ"} courseTitle={data.course.title} /></Suspense></SceneBoundary> : <div className="grid h-full place-items-center text-muted-foreground">ยังไม่มีผู้ลงทะเบียนในรอบนี้</div>}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-mint" />เช็คชื่อแล้ว</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-amber" />รอเช็คชื่อ</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-room-empty" />ว่าง</span></div>
        {pages > 1 && <div className="mt-4 flex items-center justify-center gap-3"><Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => { setPage(safePage - 1); setSelected(null); }}>ก่อนหน้า</Button><span className="text-xs">ส่วนที่ {safePage + 1} / {pages}</span><Button variant="outline" size="sm" disabled={safePage === pages - 1} onClick={() => { setPage(safePage + 1); setSelected(null); }}>ถัดไป</Button></div>}
      </section>
      <aside className="min-w-0 border-t pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        {chosen && <div className="mb-4 rounded-lg border border-primary/30 bg-card p-4" aria-live="polite">
          <div className="flex items-center justify-between"><span className="text-sm font-bold text-primary">ที่นั่ง {chosen.label}</span><Button variant="ghost" size="icon" aria-label="ปิดรายละเอียด" onClick={() => setSelected(null)}><X /></Button></div>
          <h2 className="mt-1 font-bold">{chosen.attendee && <span role="img" aria-label={attendeeSymbol(chosen.attendee).label}>{attendeeSymbol(chosen.attendee).emoji} </span>}{chosen.attendee?.name ?? "ที่นั่งว่าง"}</h2>
          {chosen.attendee?.simulated && <p className="mt-1 text-xs text-amber">เช็คชื่อจำลอง</p>}
          {chosen.attendee && <><p className="mt-1 text-xs text-muted-foreground">{[chosen.attendee.division, chosen.attendee.department].filter(Boolean).join(" / ")}</p><p className={`mt-3 text-sm font-semibold ${chosen.attendee.checkedAt ? "text-mint" : "text-amber"}`}>{chosen.attendee.checkedAt ? "✓ เช็คชื่อแล้ว" : "รอเช็คชื่อ"}</p>{chosen.attendee.checkedAt && <p className="mt-1 text-xs text-muted-foreground">{new Date(chosen.attendee.checkedAt).toLocaleString("th-TH")}</p>}</>}
        </div>}
        <h2 className="text-base font-bold">ผู้ลงทะเบียน <span className="text-sm text-muted-foreground">{filtered.length} คน</span></h2>
        <div className="relative mt-3"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input aria-label="ค้นหาผู้ลงทะเบียน" placeholder="ค้นหาชื่อ ฝ่าย หรือแผนก" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border bg-card py-2.5 pl-9 pr-3 text-sm" /></div>
        <select aria-label="สถานะเช็คชื่อ" className="mt-2 w-full rounded-lg border bg-card p-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">ทุกสถานะ</option><option value="checked">เช็คชื่อแล้ว</option><option value="waiting">รอเช็คชื่อ</option></select>
        <div className="mt-3 max-h-[430px] space-y-1 overflow-y-auto">
          {filtered.map((person) => { const index = attendees.indexOf(person); const label = `${String.fromCharCode(65 + Math.floor(index / 8))}${String(index % 8 + 1).padStart(2, "0")}`; return <Button key={person.userId} variant="ghost" className="h-auto w-full justify-start whitespace-normal px-2 py-3 text-left" onClick={() => { setPage(Math.floor(index / ROOM_PAGE_SIZE)); setSelected(index); }}>
            <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${person.checkedAt ? "bg-mint/15 text-mint" : "bg-amber/15 text-amber"}`}><span className="text-xl" role="img" aria-label={attendeeSymbol(person).label}>{attendeeSymbol(person).emoji}</span><span className="text-[10px]">{label}</span></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{person.name}</span><span className="block text-[11px] text-muted-foreground">{person.department || person.division || "—"}</span><span className={`block text-[11px] ${person.checkedAt ? "text-mint" : "text-amber"}`}>{person.checkedAt ? `✓ เช็คชื่อแล้ว${person.simulated ? " · จำลอง" : ""}` : "รอเช็คชื่อ"}</span></span>
          </Button>; })}
          {!filtered.length && <p className="py-6 text-center text-sm text-muted-foreground">ไม่พบผู้ลงทะเบียน</p>}
        </div>
      </aside>
    </div>
  </div>;
}