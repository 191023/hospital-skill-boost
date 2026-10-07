import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/attend/$courseId/$code")({
  head: () => ({ meta: [{ title: "เช็คชื่อเข้าอบรม — ระบบอบรมออนไลน์" }] }),
  component: Attend,
});

type Res = { title: string; checked_at: string; new: boolean; round: number | null };

function Attend() {
  const { courseId, code } = Route.useParams();
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState("");
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    sessionStorage.removeItem("after-auth");
    supabase.rpc("check_in", { _course: courseId, _code: code }).then(({ data, error }) => {
      if (error) setErr(error.message);
      else setRes(data as unknown as Res);
    });
  }, [courseId, code]);

  return (
    <div className="mx-auto max-w-md">
      <div className="glass rounded-3xl p-8 text-center">
        {!res && !err && <div className="text-muted-foreground">กำลังบันทึกการเข้าอบรม...</div>}
        {err && (
          <>
            <div className="text-4xl">✕</div>
            <div className="mt-3 font-bold text-destructive">เช็คชื่อไม่สำเร็จ</div>
            <p className="mt-1 text-sm text-muted-foreground">{err}</p>
          </>
        )}
        {res && (
          <>
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-mint/25 text-3xl text-primary-deep">✓</div>
            <div className="mt-3 text-lg font-bold">{res.new ? "เช็คชื่อเข้าอบรมเรียบร้อย" : "คุณเช็คชื่อไว้แล้ว"}</div>
            <div className="mt-1 font-semibold text-primary">{res.title}{res.round ? ` · รอบที่ ${res.round}` : ""}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              เวลา {new Date(res.checked_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
            </div>
            <Link to="/courses/$courseId" params={{ courseId }} className="mt-5 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand">ไปที่หลักสูตร</Link>
          </>
        )}
      </div>
    </div>
  );
}
