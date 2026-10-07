import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { thaiDate } from "@/lib/data";
import { QRImg, origin } from "@/components/QR";
import { sessionLabel, type Session } from "@/components/Sessions";

export const Route = createFileRoute("/_authenticated/admin/qr")({
  head: () => ({ meta: [{ title: "QR Code ใบประกาศและหลักสูตร — ระบบอบรมออนไลน์" }] }),
  component: QrPage,
});

const sel = "rounded-xl border bg-card px-3 py-2 text-sm";

function QrPage() {
  const [tab, setTab] = useState<"cert" | "course" | "checkin">("cert");
  const [fCourse, setFCourse] = useState("");
  const [fYear, setFYear] = useState("");
  const qc = useQueryClient();
  async function newCode(id: string, session?: boolean) {
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    const { error } = session
      ? await supabase.from("course_sessions").update({ checkin_code: code }).eq("id", id)
      : await supabase.from("courses").update({ checkin_code: code }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("สร้างรหัสเช็คชื่อใหม่แล้ว QR เดิมใช้ไม่ได้อีก");
    qc.invalidateQueries({ queryKey: ["qr-page"] });
  }

  const { data } = useQuery({
    queryKey: ["qr-page"],
    queryFn: async () => {
      const [{ data: courses }, { data: certs }, { data: profs }, { data: sess }] = await Promise.all([
        supabase.from("courses").select("id,title,training_year,hours,category,published,checkin_code").order("training_year", { ascending: false }),
        supabase.from("certificates").select("id,cert_no,issued_at,course_id,user_id").order("issued_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name,department"),
        supabase.from("course_sessions").select("*").order("round_no"),
      ]);
      return { sessions: (sess ?? []) as Session[], courses: courses ?? [], certs: certs ?? [], profs: new Map((profs ?? []).map((p) => [p.id, p])) };
    },
  });

  const years = useMemo(() => [...new Set((data?.courses ?? []).map((c) => c.training_year))].sort((a, b) => b - a), [data]);
  const courseMap = useMemo(() => new Map((data?.courses ?? []).map((c) => [c.id, c])), [data]);
  const courses = (data?.courses ?? []).filter((c) => (!fYear || String(c.training_year) === fYear) && (!fCourse || c.id === fCourse));
  const certs = (data?.certs ?? []).filter((x) => {
    const c = courseMap.get(x.course_id);
    return c && (!fYear || String(c.training_year) === fYear) && (!fCourse || c.id === fCourse);
  });

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">QR Code</h1>
        <button onClick={() => window.print()} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brand">พิมพ์ / บันทึก PDF</button>
      </div>
      <div className="no-print glass flex flex-wrap items-center gap-2 rounded-2xl p-3">
        {(["cert", "course", "checkin"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "bg-card"}`}>
            {t === "cert" ? "QR ใบประกาศ" : t === "course" ? "QR โปสเตอร์หลักสูตร" : "QR เช็คชื่อหน้าห้อง"}
          </button>
        ))}
        <select className={sel} value={fYear} onChange={(e) => setFYear(e.target.value)}>
          <option value="">ทุกปี</option>
          {years.map((y) => <option key={y} value={y}>ปี {y}</option>)}
        </select>
        <select className={sel} value={fCourse} onChange={(e) => setFCourse(e.target.value)}>
          <option value="">ทุกหลักสูตร</option>
          {(data?.courses ?? []).filter((c) => !fYear || String(c.training_year) === fYear).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">{tab === "cert" ? `${certs.length} ใบ` : `${courses.length} หลักสูตร`}</span>
      </div>

      {!data ? <div className="text-muted-foreground">กำลังโหลด...</div> : tab === "cert" ? (
        certs.length === 0 ? <div className="glass rounded-3xl p-10 text-center text-muted-foreground">ยังไม่มีใบประกาศตามตัวกรองนี้</div> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {certs.map((x) => {
              const p = data.profs.get(x.user_id);
              const c = courseMap.get(x.course_id)!;
              return (
                <a key={x.id} href={`/verify/${x.cert_no}`} target="_blank" rel="noreferrer" className="glass break-inside-avoid rounded-2xl p-4 text-center">
                  <QRImg value={`${origin()}/verify/${x.cert_no}`} size={140} className="mx-auto" />
                  <div className="mt-2 font-semibold">{p?.full_name ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">{p?.department}</div>
                  <div className="mt-1 text-xs text-primary">{c.title} · ปี {c.training_year}</div>
                  <div className="text-[11px] text-muted-foreground">{x.cert_no} · {thaiDate(x.issued_at)}</div>
                </a>
              );
            })}
          </div>
        )
      ) : tab === "checkin" ? (
        <div className="grid gap-5 md:grid-cols-2">
          {courses.flatMap((c) => {
            const ss = data.sessions.filter((s) => s.course_id === c.id);
            return ss.length ? ss.map((s) => (
              <div key={s.id} className="glass break-inside-avoid rounded-3xl p-6 text-center">
                <div className="text-sm font-semibold text-primary-deep">โรงพยาบาลโอเวอร์บรุ๊ค · เช็คชื่อเข้าอบรม</div>
                <h2 className="mt-2 text-xl font-bold text-primary">{c.title}</h2>
                <div className="mt-1 text-sm font-semibold">{sessionLabel(s)}</div>
                <QRImg value={`${origin()}/checkin/${c.id}/${s.checkin_code}`} size={220} className="mx-auto mt-4" />
                <div className="mt-3 text-lg font-bold">สแกนเพื่อเช็คชื่อเข้าอบรม</div>
                <div className="text-xs text-muted-foreground">รหัส {s.checkin_code}</div>
                <button onClick={() => newCode(s.id, true)} className="no-print mt-3 rounded-xl bg-card px-4 py-2 text-xs font-semibold text-primary">↻ สร้างรหัสใหม่</button>
                {!c.published && <div className="no-print mt-2 text-xs text-destructive">หลักสูตรนี้ยังไม่เผยแพร่ — เช็คชื่อไม่ได้</div>}
              </div>
            )) : [(
            <div key={c.id} className="glass break-inside-avoid rounded-3xl p-6 text-center">
              <div className="text-sm font-semibold text-primary-deep">โรงพยาบาลโอเวอร์บรุ๊ค · เช็คชื่อเข้าอบรม</div>
              <h2 className="mt-2 text-xl font-bold text-primary">{c.title}</h2>
              <div className="mt-1 text-xs text-muted-foreground">ปี {c.training_year} · {c.hours} ชั่วโมง</div>
              <QRImg value={`${origin()}/checkin/${c.id}/${c.checkin_code}`} size={220} className="mx-auto mt-4" />
              <div className="mt-3 text-lg font-bold">สแกนเพื่อเช็คชื่อเข้าอบรม</div>
              <div className="text-xs text-muted-foreground">รหัส {c.checkin_code}</div>
              <button onClick={() => newCode(c.id)} className="no-print mt-3 rounded-xl bg-card px-4 py-2 text-xs font-semibold text-primary">↻ สร้างรหัสใหม่ (สำหรับรอบอบรมใหม่)</button>
              {!c.published && <div className="no-print mt-2 text-xs text-destructive">หลักสูตรนี้ยังไม่เผยแพร่ — เช็คชื่อไม่ได้</div>}
            </div>
          )];
          })}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {courses.map((c) => (
            <div key={c.id} className="glass break-inside-avoid rounded-3xl p-6 text-center">
              <div className="text-sm font-semibold text-primary-deep">โรงพยาบาลโอเวอร์บรุ๊ค · ศูนย์พัฒนาศักยภาพบุคลากร</div>
              <div className="mt-1 text-xs text-muted-foreground">{c.category || "ทั่วไป"} · {c.hours} ชั่วโมง · ปี {c.training_year}</div>
              <h2 className="mt-2 text-xl font-bold text-primary">{c.title}</h2>
              <QRImg value={`${origin()}/join/${c.id}`} size={200} className="mx-auto mt-4" />
              <div className="mt-3 font-semibold">สแกนเพื่อลงทะเบียนเรียน</div>
              <div className="text-xs text-muted-foreground">เข้าสู่ระบบแล้วลงทะเบียนให้อัตโนมัติ</div>
              {!c.published && <div className="no-print mt-2 text-xs text-destructive">หลักสูตรนี้ยังไม่เผยแพร่</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
