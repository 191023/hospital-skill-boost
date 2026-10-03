import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel, useMe, type Role } from "@/lib/auth";
import { createMember } from "@/lib/admin.functions";
import { PageHeader } from "@/components/AppShell";
import { DeptPicker } from "@/components/DeptPicker";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "จัดการสมาชิก — ระบบอบรมออนไลน์" }] }),
  component: Users,
});

const inp = "w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Users() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const [showAdd, setShowAdd] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["admin-users"],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (p ?? []).map((x) => ({ ...x, roles: (r ?? []).filter((y) => y.user_id === x.id).map((y) => y.role as Role) }));
    },
  });
  if (!me?.isAdmin) return <div className="glass rounded-3xl p-10 text-center">เฉพาะผู้ดูแลระบบ</div>;
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });
  const list = filter === "pending" ? data.filter((u) => !u.approved) : data;
  const pending = data.filter((u) => !u.approved).length;

  async function setApproved(id: string, v: boolean) {
    const { error } = await supabase.from("profiles").update({ approved: v }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  async function toggleRole(id: string, role: Role, has: boolean) {
    if (id === me!.id && role === "admin") { toast.error("ไม่สามารถเปลี่ยนสิทธิ์ผู้ดูแลของตัวเองได้"); return; }
    const { error } = has
      ? await supabase.from("user_roles").delete().eq("user_id", id).eq("role", role)
      : await supabase.from("user_roles").insert({ user_id: id, role });
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  return (
    <>
      <PageHeader eyebrow="ตั้งค่าระบบ" title="จัดการสมาชิก" right={<button onClick={() => setShowAdd(!showAdd)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brand">+ เพิ่มสมาชิก</button>} />
      {showAdd && <AddMember onDone={() => { setShowAdd(false); refresh(); }} />}
      <div className="mb-4 flex gap-2 text-sm">
        <button onClick={() => setFilter("all")} className={`rounded-full px-4 py-1.5 ${filter === "all" ? "bg-primary text-primary-foreground" : "glass"}`}>ทั้งหมด ({data.length})</button>
        <button onClick={() => setFilter("pending")} className={`rounded-full px-4 py-1.5 ${filter === "pending" ? "bg-primary text-primary-foreground" : "glass"}`}>รออนุมัติ ({pending})</button>
      </div>
      <div className="glass overflow-x-auto rounded-3xl">
        <table className="w-full text-sm">
          <thead className="bg-mist/60 text-left text-xs text-muted-foreground">
            <tr><th className="p-4">ชื่อ</th><th>ฝ่าย / แผนก / ตำแหน่ง</th><th>บทบาท</th><th>สถานะ</th></tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className="border-t border-glass-border">
                <td className="p-4"><div className="font-semibold">{u.full_name}</div><div className="text-[11px] text-muted-foreground">{u.email}</div></td>
                <td className="text-xs"><div className="text-muted-foreground">{u.division}</div>{u.department}<div className="text-muted-foreground">{u.position}</div></td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {(["learner", "instructor", "admin"] as Role[]).map((r) => {
                      const has = u.roles.includes(r);
                      return (
                        <button key={r} onClick={() => toggleRole(u.id, r, has)} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${has ? "bg-primary text-primary-foreground" : "bg-mist text-muted-foreground"}`}>
                          {roleLabel[r]}
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td className="pr-4">
                  {u.approved ? (
                    <button onClick={() => setApproved(u.id, false)} className="rounded-full bg-mint/15 px-2 py-0.5 text-[11px] font-semibold text-mint">อนุมัติแล้ว</button>
                  ) : (
                    <button onClick={() => setApproved(u.id, true)} className="rounded-full bg-amber px-3 py-1 text-[11px] font-semibold text-primary-foreground">อนุมัติ</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AddMember({ onDone }: { onDone: () => void }) {
  const create = useServerFn(createMember);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ email: "", password: "", full_name: "", division: "", department: "", position: "", role: "learner" as Role });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: f });
      toast.success("เพิ่มสมาชิกแล้ว");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="glass mb-6 grid gap-3 rounded-3xl p-5 sm:grid-cols-2">
      <input className={inp} placeholder="ชื่อ-นามสกุล" required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
      <input className={inp} type="email" placeholder="อีเมล" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <input className={inp} type="text" placeholder="รหัสผ่านเริ่มต้น" minLength={6} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      <DeptPicker className={inp} division={f.division} department={f.department} onChange={(division, department) => setF({ ...f, division, department })} />
      <input className={inp} placeholder="ตำแหน่ง" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} />
      <select className={inp} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
        {(["learner", "instructor", "admin"] as Role[]).map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
      </select>
      <div className="sm:col-span-2 flex justify-end"><button disabled={busy} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "กำลังบันทึก..." : "บันทึกสมาชิก"}</button></div>
    </form>
  );
}
