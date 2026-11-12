import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel, useMe, type Role } from "@/lib/auth";
import { createMember, resetUserPassword } from "@/lib/admin.functions";
import { parseAuthIdentifier, isSyntheticEmail, getDisplayIdentifier } from "@/lib/auth-identifier";
import { PageHeader } from "@/components/AppShell";
import { DeptPicker } from "@/components/DeptPicker";
import { divisions, orgChart } from "@/lib/org";
import { ImportMembers } from "@/components/ImportMembers";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "จัดการสมาชิก — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { name: "description", content: "จัดการสมาชิกสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:title", content: "จัดการสมาชิก — โรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:description", content: "จัดการสมาชิกสำหรับบุคลากรโรงพยาบาลโอเวอร์บรุ๊ค" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Users,
});

const inp = "w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Users() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const resetPwFn = useServerFn(resetUserPassword);

  const [filter, setFilter] = useState<"all" | "pending">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [q, setQ] = useState("");
  const [fDiv, setFDiv] = useState("");
  const [fDept, setFDept] = useState("");
  const [sort, setSort] = useState<{
    key: "full_name" | "division" | "department" | "position" | "approved";
    dir: 1 | -1;
  }>({ key: "full_name", dir: 1 });

  const { data = [] } = useQuery({
    queryKey: ["admin-users"],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (p ?? []).map((x) => ({
        ...x,
        roles: (r ?? []).filter((y) => y.user_id === x.id).map((y) => y.role as Role),
      }));
    },
  });

  if (!me?.isAdmin) return <div className="glass rounded-3xl p-10 text-center">เฉพาะผู้ดูแลระบบ</div>;

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });
  const pending = data.filter((u) => !u.approved).length;

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    let rows = filter === "pending" ? data.filter((u) => !u.approved) : data;
    if (fDiv) rows = rows.filter((u) => u.division === fDiv);
    if (fDept) rows = rows.filter((u) => u.department === fDept);
    if (term)
      rows = rows.filter((u) =>
        [u.full_name, u.email, u.employee_id, u.division, u.department, u.position].some((v) =>
          (v ?? "").toLowerCase().includes(term)
        )
      );

    const val = (u: (typeof data)[number]) => {
      const raw = sort.key === "approved" ? String(u.approved) : (u[sort.key] ?? "");
      return raw;
    };

    return [...rows].sort((a, b) => {
      const av = val(a) as string;
      const bv = val(b) as string;
      if (sort.key === "approved" && av !== bv) return sort.dir * (av === "true" ? 1 : -1);
      return sort.dir * av.localeCompare(bv, "th");
    });
  }, [data, filter, q, sort, fDiv, fDept]);

  function thLabel(label: string, key: typeof sort.key) {
    const active = sort.key === key;
    return (
      <button
        onClick={() => setSort((s) => ({ key, dir: active && s.dir === 1 ? -1 : 1 }))}
        className={`inline-flex items-center gap-1 hover:text-foreground cursor-pointer ${
          active ? "text-foreground font-semibold" : ""
        }`}
      >
        {label}
        <span className="text-[10px]">{active ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    );
  }

  async function sendReset(email: string) {
    if (!confirm(`ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${email} ?`)) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`ส่งลิงก์รีเซ็ตไปที่ ${email} แล้ว`);
  }

  async function handleDirectReset(user: { id: string; full_name: string; email: string | null; employee_id: string | null }) {
    const idDisplay = getDisplayIdentifier(user.email, user.employee_id);
    const newPw = prompt(
      `กำหนดรหัสผ่านใหม่สำหรับ "${user.full_name}" (${idDisplay})\nกรุณาระบุรหัสผ่านอย่างน้อย 6 ตัวอักษร:`
    );
    if (!newPw) return;
    if (newPw.trim().length < 6) {
      toast.error("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    try {
      await resetPwFn({ data: { userId: user.id, newPassword: newPw.trim() } });
      toast.success(`รีเซ็ตรหัสผ่านของ "${user.full_name}" เป็น "${newPw.trim()}" เรียบร้อยแล้ว 🔑`);
    } catch (err: any) {
      toast.error(`รีเซ็ตรหัสผ่านไม่สำเร็จ: ${err.message || String(err)}`);
    }
  }

  async function setApproved(id: string, v: boolean) {
    const { error } = await supabase.from("profiles").update({ approved: v }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  }

  async function toggleRole(id: string, role: Role, has: boolean) {
    if (id === me!.id && role === "admin") {
      toast.error("ไม่สามารถเปลี่ยนสิทธิ์ผู้ดูแลของตัวเองได้");
      return;
    }
    const { error } = has
      ? await supabase.from("user_roles").delete().eq("user_id", id).eq("role", role)
      : await supabase.from("user_roles").insert({ user_id: id, role });
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  }

  return (
    <>
      <PageHeader
        title="จัดการสมาชิก"
        subtitle={`บุคลากรทั้งหมด ${data.length} คน (รออนุมัติ ${pending} คน)`}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowImport(!showImport);
                setShowAdd(false);
              }}
              className="rounded-2xl border bg-card px-4 py-2 text-sm font-semibold cursor-pointer"
            >
              {showImport ? "ปิดการนำเข้า" : "นำเข้า Excel / CSV"}
            </button>
            <button
              onClick={() => {
                setShowAdd(!showAdd);
                setShowImport(false);
              }}
              className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brand cursor-pointer"
            >
              {showAdd ? "ปิดฟอร์ม" : "+ เพิ่มสมาชิก"}
            </button>
          </div>
        }
      />

      {showImport && (
        <ImportMembers
          existingEmails={data.map((u) => u.email).filter(Boolean) as string[]}
          onDone={() => {
            setShowImport(false);
            refresh();
          }}
        />
      )}
      {showAdd && (
        <AddMember
          onDone={() => {
            setShowAdd(false);
            refresh();
          }}
        />
      )}

      {/* Filter Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer ${
            filter === "all" ? "bg-primary text-primary-foreground shadow-xs" : "bg-card text-muted-foreground"
          }`}
        >
          ทั้งหมด ({data.length})
        </button>
        <button
          onClick={() => setFilter("pending")}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer ${
            filter === "pending"
              ? "bg-amber text-primary-foreground shadow-xs"
              : "bg-card text-muted-foreground"
          }`}
        >
          รออนุมัติ ({pending})
        </button>
        <input
          className="rounded-xl border bg-card px-3 py-1.5 text-xs"
          placeholder="ค้นหาชื่อ, รหัสผู้ใช้, อีเมล, แผนก..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded-xl border bg-card px-2.5 py-1.5 text-xs"
          value={fDiv}
          onChange={(e) => {
            setFDiv(e.target.value);
            setFDept("");
          }}
        >
          <option value="">ทุกฝ่าย</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {fDiv && (
          <select
            className="rounded-xl border bg-card px-2.5 py-1.5 text-xs"
            value={fDept}
            onChange={(e) => setFDept(e.target.value)}
          >
            <option value="">ทุกแผนกในฝ่าย</option>
            {(orgChart[fDiv] ?? []).map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Members Table */}
      <div className="glass overflow-hidden rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-mist text-xs text-muted-foreground">
            <tr>
              <th className="p-4">{thLabel("ชื่อ-นามสกุล / ข้อมูลบัญชี", "full_name")}</th>
              <th>
                {thLabel("ฝ่าย", "division")} / {thLabel("แผนก", "department")} /{" "}
                {thLabel("ตำแหน่ง", "position")}
              </th>
              <th>บทบาท</th>
              <th>{thLabel("สถานะ", "approved")}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => {
              const isSynthetic = isSyntheticEmail(u.email);
              const displayId = getDisplayIdentifier(u.email, u.employee_id);

              return (
                <tr key={u.id} className="border-t border-glass-border">
                  <td className="p-4">
                    <div className="font-semibold">{u.full_name}</div>
                    {isSynthetic ? (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-sky-600 dark:text-sky-400">
                        <span>รหัสผู้ใช้:</span>
                        <span>{displayId}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground">{u.email}</div>
                    )}
                  </td>
                  <td className="text-xs">
                    <div className="text-muted-foreground">{u.division}</div>
                    <div className="font-medium">{u.department}</div>
                    <div className="text-muted-foreground">{u.position}</div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {(["learner", "instructor", "admin"] as Role[]).map((r) => {
                        const has = u.roles.includes(r);
                        return (
                          <button
                            key={r}
                            onClick={() => toggleRole(u.id, r, has)}
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold cursor-pointer ${
                              has ? "bg-primary text-primary-foreground" : "bg-mist text-muted-foreground"
                            }`}
                          >
                            {roleLabel[r]}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="pr-4">
                    {u.approved ? (
                      <button
                        onClick={() => setApproved(u.id, false)}
                        className="rounded-full bg-mint/15 px-2.5 py-0.5 text-[11px] font-semibold text-mint cursor-pointer"
                      >
                        อนุมัติแล้ว ✓
                      </button>
                    ) : (
                      <button
                        onClick={() => setApproved(u.id, true)}
                        className="rounded-full bg-amber px-3 py-1 text-[11px] font-semibold text-primary-foreground cursor-pointer"
                      >
                        อนุมัติ
                      </button>
                    )}

                    <div className="mt-1.5 flex flex-col gap-0.5">
                      {isSynthetic ? (
                        <button
                          onClick={() => handleDirectReset(u)}
                          className="text-left text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          🔑 รีเซ็ตรหัสผ่าน
                        </button>
                      ) : (
                        <>
                          {u.email && (
                            <button
                              onClick={() => sendReset(u.email!)}
                              className="text-left text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                            >
                              ส่งลิงก์รีเซ็ต
                            </button>
                          )}
                          <button
                            onClick={() => handleDirectReset(u)}
                            className="text-left text-[10px] text-muted-foreground hover:underline cursor-pointer"
                          >
                            ตั้งรหัสตรง
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AddMember({ onDone }: { onDone: () => void }) {
  const create = useServerFn(createMember);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    identifier: "",
    password: "",
    full_name: "",
    division: "",
    department: "",
    position: "",
    role: "learner" as Role,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseAuthIdentifier(f.identifier);
    if (!parsed.authEmail) {
      toast.error("กรุณาระบุรหัสพนักงาน หรือ อีเมล");
      return;
    }

    setBusy(true);
    try {
      await create({
        data: {
          email: parsed.authEmail,
          employee_id: parsed.employeeId,
          password: f.password,
          full_name: f.full_name,
          division: f.division,
          department: f.department,
          position: f.position,
          role: f.role,
        },
      });
      toast.success(`เพิ่มสมาชิก "${f.full_name}" (${parsed.displayIdentifier}) เรียบร้อยแล้ว`);
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass mb-6 grid gap-3 rounded-3xl p-5 sm:grid-cols-2">
      <input
        className={inp}
        placeholder="ชื่อ-นามสกุล"
        required
        value={f.full_name}
        onChange={(e) => setF({ ...f, full_name: e.target.value })}
      />
      <input
        className={inp}
        type="text"
        placeholder="รหัสผู้ใช้ (รหัสพนักงาน / เบอร์โทร) หรือ อีเมล"
        required
        value={f.identifier}
        onChange={(e) => setF({ ...f, identifier: e.target.value })}
      />
      <input
        className={inp}
        type="text"
        placeholder="รหัสผ่านเริ่มต้น (อย่างน้อย 6 ตัว)"
        minLength={6}
        required
        value={f.password}
        onChange={(e) => setF({ ...f, password: e.target.value })}
      />
      <DeptPicker
        className={inp}
        division={f.division}
        department={f.department}
        onChange={(division, department) => setF({ ...f, division, department })}
      />
      <input
        className={inp}
        placeholder="ตำแหน่ง"
        value={f.position}
        onChange={(e) => setF({ ...f, position: e.target.value })}
      />
      <select
        className={inp}
        value={f.role}
        onChange={(e) => setF({ ...f, role: e.target.value as Role })}
      >
        {(["learner", "instructor", "admin"] as Role[]).map((r) => (
          <option key={r} value={r}>
            {roleLabel[r]}
          </option>
        ))}
      </select>
      <div className="sm:col-span-2 flex justify-end">
        <button
          disabled={busy}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 cursor-pointer shadow-brand"
        >
          {busy ? "กำลังบันทึก..." : "บันทึกสมาชิก"}
        </button>
      </div>
    </form>
  );
}
