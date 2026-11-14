import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { DeptPicker } from "@/components/DeptPicker";
import { Blobs, Brand } from "@/components/Brand";
import { Medical3DBackground } from "@/components/Medical3DBackground";
import { parseAuthIdentifier } from "@/lib/auth-identifier";
import { User, Mail } from "lucide-react";

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
  const [signupType, setSignupType] = useState<"staff_id" | "email">("staff_id");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    identifier: "",
    password: "",
    full_name: "",
    division: "",
    department: "",
    position: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (data.user && !error) {
        goNext();
      } else if (error) {
        supabase.auth.signOut({ scope: "local" }).catch(() => {});
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        goNext();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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
      const isLovable =
        typeof window !== "undefined" &&
        (window.location.hostname.endsWith(".lovable.app") ||
          window.location.hostname.endsWith(".lovableproject.com"));

      if (isLovable) {
        try {
          const result = await lovable.auth.signInWithOAuth("google", {
            redirect_uri: window.location.origin + "/auth",
          });
          if (!result.error) {
            if (result.redirected) return;
            goNext();
            return;
          }
        } catch {
          // Fallback to Supabase OAuth below
        }
      }

      // Direct Supabase OAuth
      const redirectUri = `${window.location.origin}/auth`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        if (
          error.message.includes("provider is not enabled") ||
          error.message.includes("Unsupported provider")
        ) {
          toast.error(
            "ยังไม่ได้เปิดใช้งาน Google Provider ใน Supabase Auth (ต้องใส่ Google Client ID & Secret)"
          );
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อ Google OAuth"
      );
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    const parsed = parseAuthIdentifier(f.identifier);
    if (!parsed.authEmail) {
      toast.error("กรุณากรอกรหัสผู้ใช้ หรือ อีเมล ก่อนกดลืมรหัสผ่าน");
      return;
    }

    if (parsed.type !== "email") {
      toast.info(
        `สำหรับผู้เข้าใช้งานด้วยรหัสผู้ใช้ (${parsed.displayIdentifier}): กรุณาติดต่อหัวหน้าฝ่าย/แผนก หรือผู้ดูแลระบบ HR เพื่อขอรีเซ็ตรหัสผ่าน 🔑`,
        { duration: 8000 }
      );
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.authEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseAuthIdentifier(f.identifier);

    if (!parsed.authEmail) {
      toast.error("กรุณาระบุรหัสผู้ใช้ หรือ อีเมล");
      return;
    }

    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.authEmail,
          password: f.password,
        });
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            throw new Error(
              parsed.type === "employee_id" || parsed.type === "phone"
                ? `รหัสผู้ใช้ (${parsed.displayIdentifier}) หรือรหัสผ่านไม่ถูกต้อง (หากยังไม่มีบัญชี กรุณาสมัครสมาชิก)`
                : "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
            );
          }
          throw error;
        }
        goNext();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.authEmail,
          password: f.password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: {
              full_name: f.full_name,
              division: f.division,
              department: f.department,
              position: f.position,
              employee_id: parsed.employeeId || null,
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          goNext();
        } else {
          if (parsed.type === "employee_id" || parsed.type === "phone") {
            toast.success("สมัครสมาชิกสำเร็จ! กรุณารอผู้ดูแลระบบอนุมัติเข้าใช้งานระบบ 🏥");
            setMode("in");
          } else {
            toast.success("สมัครสำเร็จ กรุณายืนยันอีเมล แล้วรอผู้ดูแลอนุมัติ");
          }
        }
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const detected = parseAuthIdentifier(f.identifier);

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-page px-4">
      <Medical3DBackground />
      <Blobs />
      <div className="glass relative z-10 w-full max-w-md rounded-3xl p-8 backdrop-blur-xl shadow-brand">
        <Brand />
        <h1 className="mt-6 text-2xl font-bold">{mode === "in" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {mode === "in"
            ? "รองรับรหัสพนักงาน, รหัสนักศึกษา, เบอร์โทร หรืออีเมล"
            : "กรอกข้อมูลบุคลากรเพื่อลงทะเบียนเข้าสู่ระบบฝึกอบรม"}
        </p>

        {mode === "up" && (
          <div className="mt-4 flex rounded-xl border border-glass-border bg-glass p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setSignupType("staff_id");
                setF({ ...f, identifier: "" });
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 font-semibold transition cursor-pointer ${
                signupType === "staff_id"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>ใช้รหัสผู้ใช้ (ไม่มีอีเมล)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSignupType("email");
                setF({ ...f, identifier: "" });
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 font-semibold transition cursor-pointer ${
                signupType === "email"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              <span>ใช้อีเมล</span>
            </button>
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "up" && (
            <>
              <input
                className={input}
                placeholder="ชื่อ-นามสกุล (เช่น นายสมชาย ใจดี)"
                required
                value={f.full_name}
                onChange={(e) => setF({ ...f, full_name: e.target.value })}
              />
              <DeptPicker
                className={input}
                division={f.division}
                department={f.department}
                onChange={(division, department) => setF({ ...f, division, department })}
              />
              <input
                className={input}
                placeholder="ตำแหน่ง (เช่น พนักงานบริการทั่วไป, รปภ., ช่างเทคนิค, นศ.ฝึกงาน)"
                value={f.position}
                onChange={(e) => setF({ ...f, position: e.target.value })}
              />
            </>
          )}

          <div className="relative">
            <input
              className={input}
              type={mode === "up" && signupType === "email" ? "email" : "text"}
              placeholder={
                mode === "in"
                  ? "รหัสผู้ใช้ หรือ อีเมล"
                  : signupType === "staff_id"
                  ? "รหัสผู้ใช้ (รหัสพนักงาน / นศ. / เบอร์โทร)"
                  : "อีเมล (เช่น somchai@gmail.com)"
              }
              required
              value={f.identifier}
              onChange={(e) => setF({ ...f, identifier: e.target.value })}
            />
            {f.identifier.trim() && (
              <span className="absolute right-3 top-2.5 rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                {detected.type === "email"
                  ? "อีเมล"
                  : detected.type === "phone"
                  ? "เบอร์โทร"
                  : "รหัสผู้ใช้"}
              </span>
            )}
          </div>

          <input
            className={input}
            type="password"
            placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
            minLength={6}
            required
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
          />

          <button
            disabled={busy}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-brand disabled:opacity-60 cursor-pointer"
          >
            {busy ? "กำลังดำเนินการ..." : mode === "in" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </button>

          {mode === "in" && (
            <button
              type="button"
              onClick={forgot}
              disabled={busy}
              className="w-full text-center text-xs text-muted-foreground hover:text-primary cursor-pointer"
            >
              ลืมรหัสผ่าน?
            </button>
          )}
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
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border bg-card py-2.5 text-sm font-semibold shadow-sm disabled:opacity-60 cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.44 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1z"
            />
            <path
              fill="#EA4335"
              d="M12 4.76c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.87 8.87 4.76 12 4.76z"
            />
          </svg>
          เข้าสู่ระบบด้วย Google
        </button>

        <button
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setF({ ...f, identifier: "", password: "" });
          }}
          className="mt-4 w-full text-center text-sm text-primary cursor-pointer hover:underline"
        >
          {mode === "in" ? "ยังไม่มีบัญชี? สมัครสมาชิก" : "มีบัญชีแล้ว? เข้าสู่ระบบ"}
        </button>
      </div>
    </div>
  );
}
