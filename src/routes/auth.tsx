import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { DeptPicker } from "@/components/DeptPicker";
import { Blobs, Brand } from "@/components/Brand";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ — ระบบอบรมออนไลน์" },
      { name: "description", content: "เข้าสู่ระบบหรือสมัครสมาชิกเพื่อเริ่มเรียน" },
      { property: "og:title", content: "เข้าสู่ระบบ — ระบบอบรมออนไลน์" },
      { property: "og:description", content: "เข้าสู่ระบบหรือสมัครสมาชิกเพื่อเริ่มเรียน" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const input = "w-full rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ email: "", password: "", full_name: "", division: "", department: "", position: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goNext();
    });
  }, [nav]);

  function goNext() {
    const next = sessionStorage.getItem("after-auth");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      sessionStorage.removeItem("after-auth");
      window.location.assign(next);
    } else nav({ to: "/dashboard" });
  }

  async function signInGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) {
        toast.error("เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
        return;
      }
      if (result.redirected) return;
      goNext();
    } catch {
      toast.error("เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
        if (error) throw error;
        goNext();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: f.email,
          password: f.password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: { full_name: f.full_name, division: f.division, department: f.department, position: f.position },
          },
        });
        if (error) throw error;
        if (data.session) goNext();
        else toast.success("สมัครสำเร็จ กรุณายืนยันอีเมล แล้วรอผู้ดูแลอนุมัติ");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-page px-4">
      <Blobs />
      <div className="glass relative w-full max-w-md rounded-3xl p-8">
        <Brand />
        <h1 className="mt-6 text-2xl font-bold">{mode === "in" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</h1>
        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "up" && (
            <>
              <input className={input} placeholder="ชื่อ-นามสกุล" required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
              <DeptPicker className={input} division={f.division} department={f.department} onChange={(division, department) => setF({ ...f, division, department })} />
              <input className={input} placeholder="ตำแหน่ง" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} />
            </>
          )}
          <input className={input} type="email" placeholder="อีเมล" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <input className={input} type="password" placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)" minLength={6} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <button disabled={busy} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-brand disabled:opacity-60">
            {busy ? "กำลังดำเนินการ..." : mode === "in" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </button>
        </form>
        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          หรือ
          <div className="h-px flex-1 bg-border" />
        </div>
        <button
          type="button"
          onClick={signInGoogle}
          disabled={busy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border bg-card py-2.5 text-sm font-semibold shadow-sm disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.44 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1z" />
            <path fill="#EA4335" d="M12 4.76c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.87 8.87 4.76 12 4.76z" />
          </svg>
          เข้าสู่ระบบด้วย Google
        </button>
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 w-full text-center text-sm text-primary">
          {mode === "in" ? "ยังไม่มีบัญชี? สมัครสมาชิก" : "มีบัญชีแล้ว? เข้าสู่ระบบ"}
        </button>
      </div>
    </div>
  );
}
