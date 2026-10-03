import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DeptPicker } from "@/components/DeptPicker";
import { Blobs, Brand } from "@/components/Brand";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ — ระบบอบรมออนไลน์" },
      { name: "description", content: "เข้าสู่ระบบหรือสมัครสมาชิกเพื่อเริ่มเรียน" },
      { property: "og:title", content: "เข้าสู่ระบบ — ระบบอบรมออนไลน์" },
      { property: "og:description", content: "เข้าสู่ระบบหรือสมัครสมาชิกเพื่อเริ่มเรียน" },
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
        if (error) throw error;
        nav({ to: "/dashboard" });
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
        if (data.session) nav({ to: "/dashboard" });
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
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 w-full text-center text-sm text-primary">
          {mode === "in" ? "ยังไม่มีบัญชี? สมัครสมาชิก" : "มีบัญชีแล้ว? เข้าสู่ระบบ"}
        </button>
      </div>
    </div>
  );
}
