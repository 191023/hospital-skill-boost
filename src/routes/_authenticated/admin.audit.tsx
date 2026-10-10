import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel, useMe, type Role } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [
    { title: "ประวัติการจัดการสมาชิก — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "ประวัติการจัดการสมาชิกสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:title", content: "ประวัติการจัดการสมาชิก — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "ประวัติการจัดการสมาชิกสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Audit,
});

const actionLabel: Record<string, string> = {
  created: "สมัครสมาชิก", created_by_admin: "เพิ่มสมาชิกโดยผู้ดูแล", updated: "แก้ไขข้อมูล",
  approved: "อนุมัติ", unapproved: "ยกเลิกการอนุมัติ", role_added: "เพิ่มบทบาท", role_removed: "ถอนบทบาท",
};
const fieldLabel: Record<string, string> = { full_name: "ชื่อ", division: "ฝ่าย", department: "แผนก", position: "ตำแหน่ง", email: "อีเมล" };

const PAGE = 200;

function Audit() {
  const { data: me } = useMe();
  const [fAction, setFAction] = useState("");
  const [q, setQ] = useState("");
  const { data: ps } = useQuery({
    queryKey: ["audit-names"],
    enabled: !!me?.isAdmin,
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,email")).data ?? [],
  });
  // Pages of PAGE rows; "load more" fetches older history instead of silently cutting it off.
  const logs = useInfiniteQuery({
    queryKey: ["audit", fAction],
    enabled: !!me?.isAdmin,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase.from("member_audit_log").select("*").order("created_at", { ascending: false }).range(pageParam, pageParam + PAGE - 1);
      if (fAction) q = q.eq("action", fAction);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  });
  const data = useMemo(() => {
    const name = new Map((ps ?? []).map((p) => [p.id, p.full_name || p.email || ""]));
    return (logs.data?.pages.flat() ?? []).map((l) => ({ ...l, actor: l.actor_id ? name.get(l.actor_id) ?? "-" : "ระบบ / ผู้สมัครเอง", target: l.target_id ? name.get(l.target_id) ?? "(ถูกลบ)" : "-" }));
  }, [ps, logs.data]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.filter((l) => !t || `${l.actor} ${l.target}`.toLowerCase().includes(t));
  }, [data, q]);
  if (!me?.isAdmin) return <div className="glass rounded-3xl p-10 text-center">เฉพาะผู้ดูแลระบบ</div>;

  function detail(l: { action: string; details: unknown }) {
    const d = (l.details ?? {}) as Record<string, { from?: string; to?: string } | string | undefined>;
    if (l.action === "updated") return Object.entries(d).map(([k, v]) => `${fieldLabel[k] ?? k}: "${typeof v === "object" ? v.from ?? "" : ""}" → "${typeof v === "object" ? v.to ?? "" : ""}"`).join(" · ");
    if (l.action.startsWith("role_")) return roleLabel[d["role"] as Role] ?? String(d["role"] ?? "");
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
      {logs.hasNextPage && (
        <div className="mt-4 text-center">
          <button onClick={() => logs.fetchNextPage()} disabled={logs.isFetchingNextPage} className="glass rounded-full px-5 py-2 text-sm font-semibold text-primary disabled:opacity-60">
            {logs.isFetchingNextPage ? "กำลังโหลด..." : "โหลดประวัติเก่าเพิ่ม"}
          </button>
        </div>
      )}
    </>
  );
}
