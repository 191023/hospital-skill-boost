import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel, useMe, type Role } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "ประวัติการจัดการสมาชิก — ระบบอบรมออนไลน์" }] }),
  component: Audit,
});

const actionLabel: Record<string, string> = {
  created: "สมัครสมาชิก", created_by_admin: "เพิ่มสมาชิกโดยผู้ดูแล", updated: "แก้ไขข้อมูล",
  approved: "อนุมัติ", unapproved: "ยกเลิกการอนุมัติ", role_added: "เพิ่มบทบาท", role_removed: "ถอนบทบาท",
};
const fieldLabel: Record<string, string> = { full_name: "ชื่อ", division: "ฝ่าย", department: "แผนก", position: "ตำแหน่ง", email: "อีเมล" };

function Audit() {
  const { data: me } = useMe();
  const [fAction, setFAction] = useState("");
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["audit"],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const [{ data: logs }, { data: ps }] = await Promise.all([
        supabase.from("member_audit_log").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("profiles").select("id,full_name,email"),
      ]);
      const name = new Map((ps ?? []).map((p) => [p.id, p.full_name || p.email || ""]));
      return (logs ?? []).map((l) => ({ ...l, actor: l.actor_id ? name.get(l.actor_id) ?? "-" : "ระบบ / ผู้สมัครเอง", target: l.target_id ? name.get(l.target_id) ?? "(ถูกลบ)" : "-" }));
    },
  });
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter((l) => (!fAction || l.action === fAction) && (!t || `${l.actor} ${l.target}`.toLowerCase().includes(t)));
  }, [data, fAction, q]);
  if (!me?.isAdmin) return <div className="glass rounded-3xl p-10 text-center">เฉพาะผู้ดูแลระบบ</div>;

  function detail(l: { action: string; details: unknown }) {
    const d = (l.details ?? {}) as Record<string, any>;
    if (l.action === "updated") return Object.entries(d).map(([k, v]) => `${fieldLabel[k] ?? k}: "${v?.from ?? ""}" → "${v?.to ?? ""}"`).join(" · ");
    if (l.action.startsWith("role_")) return roleLabel[d["role"] as Role] ?? d["role"];
    return "";
  }

  return (
    <>
      <PageHeader eyebrow="ตั้งค่าระบบ" title="ประวัติการจัดการสมาชิก" />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <select value={fAction} onChange={(e) => setFAction(e.target.value)} className="glass rounded-full px-4 py-1.5 outline-none">
          <option value="">ทุกการกระทำ</option>
          {Object.entries(actionLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="glass min-w-[240px] flex-1 rounded-full px-4 py-1.5 outline-none" placeholder="ค้นหาชื่อผู้ดำเนินการหรือสมาชิก..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="glass overflow-x-auto rounded-3xl">
        <table className="w-full text-sm">
          <thead className="bg-mist/60 text-left text-xs text-muted-foreground"><tr><th className="p-4">วันเวลา</th><th>การกระทำ</th><th>สมาชิก</th><th>ผู้ดำเนินการ</th><th className="pr-4">รายละเอียด</th></tr></thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id} className="border-t border-glass-border">
                <td className="whitespace-nowrap p-4 text-xs">{new Date(l.created_at).toLocaleString("th-TH")}</td>
                <td><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{actionLabel[l.action] ?? l.action}</span></td>
                <td className="font-semibold">{l.target}</td>
                <td className="text-xs">{l.actor}</td>
                <td className="pr-4 text-xs text-muted-foreground">{detail(l)}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">ยังไม่มีประวัติ</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
