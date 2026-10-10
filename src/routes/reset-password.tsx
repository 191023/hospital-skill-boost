import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Blobs, Brand } from "@/components/Brand";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "ตั้งรหัสผ่านใหม่ — ระบบอบรมออนไลน์" },
    { name: "description", content: "ตั้งรหัสผ่านใหม่สำหรับบัญชีระบบอบรมออนไลน์" },
    { property: "og:title", content: "ตั้งรหัสผ่านใหม่ — ระบบอบรมออนไลน์" },
    { property: "og:description", content: "ตั้งรหัสผ่านใหม่สำหรับบัญชีระบบอบรมออนไลน์" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPassword,
});

const input = "w-full rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState({ a: "", b: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.a !== pw.b) { toast.error("รหัสผ่านทั้งสองช่องไม่ตรงกัน"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw.a });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("ตั้งรหัสผ่านใหม่เรียบร้อย");
    nav({ to: "/dashboard", replace: true });
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-page px-4">
      <Blobs />
      <div className="glass relative w-full max-w-md rounded-3xl p-8">
        <Brand />
        <h1 className="mt-6 text-2xl font-bold">ตั้งรหัสผ่านใหม่</h1>
        {!ready ? (
          <p className="mt-4 text-sm text-muted-foreground">กำลังตรวจสอบลิงก์... หากค้างนาน ลิงก์อาจหมดอายุ กรุณาขอลิงก์ใหม่จากหน้าเข้าสู่ระบบ</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input className={input} type="password" placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)" minLength={6} required value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} />
            <input className={input} type="password" placeholder="ยืนยันรหัสผ่านใหม่" minLength={6} required value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />
            <button disabled={busy} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
