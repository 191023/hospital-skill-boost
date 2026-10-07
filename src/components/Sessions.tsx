import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type Session = {
  id: string; course_id: string; round_no: number; starts_at: string | null; ends_at: string | null;
  location: string; capacity: number | null; checkin_code: string;
};

const inp = "w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function sessionLabel(s: Pick<Session, "round_no" | "starts_at" | "ends_at" | "location">) {
  const d = s.starts_at ? new Date(s.starts_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "ยังไม่กำหนดวัน";
  const e = s.ends_at ? "–" + new Date(s.ends_at).toLocaleTimeString("th-TH", { timeStyle: "short" }) : "";
  return `รอบที่ ${s.round_no} · ${d}${e}${s.location ? ` · ${s.location}` : ""}`;
}

const toLocal = (v: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

export function useSessions(courseId: string) {
  return useQuery({
    queryKey: ["sessions", courseId],
    queryFn: async () => {
      const [{ data: s }, { data: seats }] = await Promise.all([
        supabase.from("course_sessions").select("*").eq("course_id", courseId).order("round_no"),
        supabase.rpc("session_seats", { _course: courseId }),
      ]);
      const taken = new Map((seats ?? []).map((x) => [x.session_id, x.taken]));
      return ((s ?? []) as Session[]).map((x) => ({ ...x, taken: taken.get(x.id) ?? 0 }));
    },
  });
}

export function SessionManager({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { data } = useSessions(courseId);
  const refresh = () => qc.invalidateQueries({ queryKey: ["sessions", courseId] });

  async function add() {
    const next = Math.max(0, ...(data ?? []).map((s) => s.round_no)) + 1;
    const { error } = await supabase.from("course_sessions").insert({ course_id: courseId, round_no: next });
    if (error) toast.error(error.message); else { toast.success(`เพิ่มรอบที่ ${next} แล้ว`); refresh(); }
  }

  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5">
        <div>
          <h2 className="font-bold">รอบอบรม</h2>
          <p className="text-sm text-muted-foreground">ผู้เรียนเลือกรอบได้เอง แต่ละรอบมี QR เช็คชื่อของตัวเอง (พิมพ์ได้ที่หน้า QR Code)</p>
        </div>
        <button onClick={add} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brand">+ เพิ่มรอบอบรม</button>
      </div>
      {data?.length === 0 && <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">ยังไม่มีรอบอบรม — หลักสูตรนี้จะใช้ QR เช็คชื่อรวมแบบเดิม</div>}
      {data?.map((s) => <SessionRow key={s.id} s={s} onChange={refresh} />)}
    </div>
  );
}

function SessionRow({ s, onChange }: { s: Session & { taken: number }; onChange: () => void }) {
  const [f, setF] = useState({ round_no: s.round_no, starts_at: toLocal(s.starts_at), ends_at: toLocal(s.ends_at), location: s.location, capacity: s.capacity == null ? "" : String(s.capacity) });
  async function save() {
    const { error } = await supabase.from("course_sessions").update({
      round_no: Number(f.round_no) || 1, starts_at: fromLocal(f.starts_at), ends_at: fromLocal(f.ends_at),
      location: f.location, capacity: f.capacity === "" ? null : Math.max(1, Number(f.capacity)),
    }).eq("id", s.id);
    if (error) toast.error(error.message); else { toast.success("บันทึกรอบอบรมแล้ว"); onChange(); }
  }
  async function del() {
    if (!confirm(`ลบรอบที่ ${s.round_no}? ผู้ที่เลือกรอบนี้จะกลับเป็น "ยังไม่เลือกรอบ"`)) return;
    const { error } = await supabase.from("course_sessions").delete().eq("id", s.id);
    if (error) toast.error(error.message); else onChange();
  }
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-bold text-primary">รอบที่ {s.round_no}</div>
        <div className="text-xs text-muted-foreground">ลงทะเบียนแล้ว {s.taken}{s.capacity ? `/${s.capacity}` : ""} คน · รหัสเช็คชื่อ {s.checkin_code}</div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs">รอบที่<input type="number" min={1} className={inp} value={f.round_no} onChange={(e) => setF({ ...f, round_no: Number(e.target.value) })} /></label>
        <label className="text-xs">เริ่ม<input type="datetime-local" className={inp} value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></label>
        <label className="text-xs">สิ้นสุด<input type="datetime-local" className={inp} value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} /></label>
        <label className="text-xs">สถานที่<input className={inp} value={f.location} placeholder="เช่น ห้องประชุม 1" onChange={(e) => setF({ ...f, location: e.target.value })} /></label>
        <label className="text-xs">จำนวนที่นั่ง<input type="number" min={1} className={inp} value={f.capacity} placeholder="ไม่จำกัด" onChange={(e) => setF({ ...f, capacity: e.target.value })} /></label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={del} className="rounded-xl px-4 py-2 text-sm text-destructive">ลบรอบ</button>
        <button onClick={save} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">บันทึก</button>
      </div>
    </div>
  );
}

export function SessionPicker({ courseId, current, locked }: { courseId: string; current: string | null; locked: boolean }) {
  const qc = useQueryClient();
  const { data } = useSessions(courseId);
  if (!data || data.length === 0) return null;
  async function choose(id: string) {
    const { error } = await supabase.rpc("choose_session", { _session: id });
    if (error) { toast.error(error.message); return; }
    toast.success("เลือกรอบอบรมเรียบร้อย");
    qc.invalidateQueries();
  }
  return (
    <div className="glass rounded-3xl p-6">
      <h3 className="font-bold">รอบอบรม</h3>
      <p className="mt-1 text-xs text-muted-foreground">{locked ? "คุณเช็คชื่อเข้าอบรมแล้ว" : current ? "เปลี่ยนรอบได้จนกว่าจะเช็คชื่อ" : "เลือกรอบที่สะดวกเข้าอบรมในห้อง"}</p>
      <div className="mt-3 space-y-2">
        {data.map((s) => {
          const full = s.capacity != null && s.taken >= s.capacity && current !== s.id;
          const mine = current === s.id;
          return (
            <button key={s.id} disabled={locked || full || mine} onClick={() => choose(s.id)}
              className={`w-full rounded-2xl border p-3 text-left text-sm ${mine ? "border-primary bg-primary/10" : "border-glass-border bg-card"} disabled:cursor-default ${full ? "opacity-50" : ""}`}>
              <div className="font-semibold">{sessionLabel(s)}</div>
              <div className="text-xs text-muted-foreground">
                {mine ? "✓ รอบของคุณ · " : ""}{s.capacity ? (full ? "ที่นั่งเต็ม" : `เหลือ ${s.capacity - s.taken} ที่นั่ง`) : "ไม่จำกัดที่นั่ง"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
