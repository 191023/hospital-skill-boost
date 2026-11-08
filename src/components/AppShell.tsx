import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, roleLabel } from "@/lib/auth";
import { Blobs, Brand } from "@/components/Brand";
import { FontSizeControl } from "@/components/FontSizeControl";
import { ThemeControl } from "@/components/ThemeControl";
import { OfflineSyncIndicator } from "@/components/OfflineSyncIndicator";

const navCls = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-foreground/70 hover:bg-sidebar-accent";
const activeCls = "flex items-center gap-3 rounded-xl px-3 py-2.5 bg-primary text-primary-foreground font-semibold shadow-brand";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  const items: { to: string; label: string; icon: string; show: boolean }[] = [
    { to: "/dashboard", label: "แดชบอร์ด", icon: "◈", show: true },
    { to: "/courses", label: "หลักสูตรทั้งหมด", icon: "▤", show: true },
    { to: "/calendar", label: "ปฏิทินการอบรม", icon: "📅", show: true },
    { to: "/my-courses", label: "หลักสูตรของฉัน", icon: "▶", show: true },
    { to: "/certificates", label: "ใบประกาศ", icon: "▣", show: true },
    { to: "/manage", label: "จัดการหลักสูตร", icon: "✎", show: !!me?.isStaff },
    { to: "/admin/reports", label: "สรุปผลอบรม", icon: "▥", show: !!me?.isStaff },
    { to: "/admin/users", label: "จัดการสมาชิก", icon: "👥", show: !!me?.isAdmin },
    { to: "/admin/qr", label: "QR Code", icon: "▦", show: !!me?.isStaff },
    { to: "/admin/audit", label: "ประวัติสมาชิก", icon: "◷", show: !!me?.isAdmin },
    { to: "/manage-team", label: "ทีมของฉัน", icon: "⚑", show: !!me?.isTeamManager },
    { to: "/admin/org", label: "โครงสร้างองค์กร", icon: "⌗", show: !!me?.isAdmin },
    { to: "/settings", label: "ตั้งค่าระบบ", icon: "⚙", show: true },
  ];

  return (
    <div className="relative h-screen overflow-hidden bg-page">
      <Blobs />
      <div className="relative flex h-full w-full overflow-hidden">
        <aside className="no-print hidden h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-sidebar-border bg-sidebar p-5 backdrop-blur-2xl lg:flex">
          <div className="space-y-6">
            <Brand />
            <nav className="flex flex-col gap-1 text-sm">
              {items.filter((i) => i.show).map((i) => (
                <Link key={i.to} to={i.to} className={navCls} activeProps={{ className: activeCls }}>
                  <span>{i.icon}</span> {i.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-auto shrink-0 space-y-3 pt-6">
            <OfflineSyncIndicator className="w-full justify-between" />
            <div className="space-y-2 rounded-2xl border border-glass-border bg-glass/60 p-2.5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground">ขนาดอักษร:</span>
                <FontSizeControl compact />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground">ธีม & โทนสี:</span>
                <ThemeControl compact />
              </div>
            </div>
            <div className="glass rounded-2xl p-4 shadow-none">
              <div className="text-sm font-semibold truncate">{me?.full_name || "..."}</div>
              <div className="text-xs text-muted-foreground truncate">{me?.department}</div>
              <div className="mt-1 text-xs font-semibold text-mint">{me?.roles.map((r) => roleLabel[r]).join(" · ")}</div>
              <div className="mt-3 flex gap-3">
                <Link to="/settings" className="text-xs font-semibold text-primary">ตั้งค่า / บัญชี</Link>
                <button onClick={signOut} className="text-xs font-semibold text-coral">ออกจากระบบ</button>
              </div>
            </div>
          </div>
        </aside>
        <main className="h-full min-w-0 flex-1 overflow-y-auto p-6 lg:p-10">
          <OfflineSyncIndicator className="mb-3 lg:hidden w-full justify-between" />
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 lg:hidden">
            <div className="flex flex-wrap gap-1.5">
              {items.filter((i) => i.show).map((i) => (
                <Link key={i.to} to={i.to} className="glass rounded-full px-3 py-1 text-xs" activeProps={{ className: "rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground" }}>
                  {i.label}
                </Link>
              ))}
              <button onClick={signOut} className="rounded-full px-3 py-1 text-xs text-coral">ออก</button>
            </div>
            <div className="flex items-center gap-1.5">
              <ThemeControl compact />
              <FontSizeControl compact />
            </div>
          </div>
          {isLoading ? (
            <div className="text-muted-foreground">กำลังโหลด...</div>
          ) : me && !me.approved ? (
            <div className="glass mx-auto mt-20 max-w-lg rounded-3xl p-8 text-center">
              <div className="text-4xl">⏳</div>
              <h1 className="mt-4 text-xl font-bold">รอผู้ดูแลระบบอนุมัติ</h1>
              <p className="mt-2 text-sm text-muted-foreground">บัญชีของคุณสมัครเรียบร้อยแล้ว เมื่อผู้ดูแลอนุมัติ คุณจะเริ่มเรียนได้ทันที</p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, right }: { eyebrow: string; title: string; right?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-deep/70">{eyebrow}</div>
        <h1 className="mt-1 text-3xl font-bold">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function Stat({ label, value, note, tone = "mint" }: { label: string; value: ReactNode; note?: string; tone?: "mint" | "amber" | "primary" | "coral" }) {
  const toneCls = { mint: "text-mint", amber: "text-amber", primary: "text-primary", coral: "text-coral" }[tone];
  return (
    <div className="glass rounded-3xl p-5">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      {note && <div className={`mt-1 text-xs font-semibold ${toneCls}`}>{note}</div>}
    </div>
  );
}

export function Bar({ value, tone = "primary" }: { value: number; tone?: "primary" | "mint" | "coral" | "gradient" }) {
  const c = { primary: "bg-primary", mint: "bg-mint", coral: "bg-coral", gradient: "bg-progress-gradient" }[tone];
  return (
    <div className="h-1.5 w-full rounded-full bg-mist">
      <div className={`h-1.5 rounded-full ${c}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
