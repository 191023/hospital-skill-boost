import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel, useMe, type Role } from "@/lib/auth";
import { createMember, resetUserPassword } from "@/lib/admin.functions";
import { parseAuthIdentifier, isSyntheticEmail, getDisplayIdentifier } from "@/lib/auth-identifier";
import { PageHeader } from "@/components/AppShell";
import { DeptPicker } from "@/components/DeptPicker";
import { useOrgChart } from "@/lib/org";
import { ImportMembers } from "@/components/ImportMembers";
import { ChevronLeft, ChevronRight, RotateCcw, Search, X } from "lucide-react";

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

type SortKey =
  | "identifier"
  | "full_name"
  | "division"
  | "department"
  | "position"
  | "role"
  | "approved"
  | "created_at";

type ManagerLevel = "none" | "division_head" | "department_head";

function Users() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { divisions, orgChart } = useOrgChart();
  const resetPwFn = useServerFn(resetUserPassword);

  const [filter, setFilter] = useState<"all" | "approved" | "pending">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [q, setQ] = useState("");
  const [fDiv, setFDiv] = useState("");
  const [fDept, setFDept] = useState("");
  const [fRole, setFRole] = useState<"" | Role>("");
  const [fManager, setFManager] = useState<"" | "any_head" | "division_head" | "department_head" | "none">("");
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState<number>(1);
  const [sort, setSort] = useState<{
    key: SortKey;
    dir: 1 | -1;
  }>({ key: "full_name", dir: 1 });

  const { data: rawData } = useQuery({
    queryKey: ["admin-users"],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const [{ data: p }, { data: r }, { data: units }, { data: mgrs }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("org_units").select("id, name, kind, parent_id"),
        supabase.from("org_unit_managers").select("user_id, org_unit_id"),
      ]);

      const unitMap = new Map((units ?? []).map((u) => [u.id, u]));
      const mgrsByUser = new Map<string, { unitId: string; name: string; kind: string }[]>();
      for (const m of mgrs ?? []) {
        const u = unitMap.get(m.org_unit_id);
        if (!u) continue;
        const arr = mgrsByUser.get(m.user_id) ?? [];
        arr.push({ unitId: u.id, name: u.name, kind: u.kind });
        mgrsByUser.set(m.user_id, arr);
      }

      const users = (p ?? []).map((x) => {
        const roles = (r ?? []).filter((y) => y.user_id === x.id).map((y) => y.role as Role);
        const managedUnits = mgrsByUser.get(x.id) ?? [];
        const isDivHead = managedUnits.some((u) => u.kind === "division");
        const isDeptHead = managedUnits.some((u) => u.kind === "unit");
        const managerLevel: ManagerLevel = isDivHead
          ? "division_head"
          : isDeptHead
          ? "department_head"
          : "none";
        const displayId = getDisplayIdentifier(x.email, x.employee_id);
        return {
          ...x,
          roles: roles.length ? roles : (["learner"] as Role[]),
          managedUnits,
          managerLevel,
          displayId,
        };
      });

      return {
        users,
        units: units ?? [],
      };
    },
  });

  const data = rawData?.users ?? [];
  const orgUnits = rawData?.units ?? [];

  // Reset to page 1 whenever filters or search change
  useEffect(() => {
    setPage(1);
  }, [filter, q, fDiv, fDept, fRole, fManager, pageSize]);

  if (!me?.isAdmin) return <div className="glass rounded-3xl p-10 text-center">เฉพาะผู้ดูแลระบบ</div>;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["org-admin"] });
  };
  const pending = data.filter((u) => !u.approved).length;
  const approvedCount = data.filter((u) => u.approved).length;
  const managersCount = data.filter((u) => u.managerLevel !== "none").length;

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    let rows =
      filter === "pending"
        ? data.filter((u) => !u.approved)
        : filter === "approved"
        ? data.filter((u) => u.approved)
        : data;

    if (fDiv) rows = rows.filter((u) => u.division === fDiv);
    if (fDept) rows = rows.filter((u) => u.department === fDept);
    if (fRole) rows = rows.filter((u) => u.roles.includes(fRole));
    if (fManager) {
      if (fManager === "any_head") rows = rows.filter((u) => u.managerLevel !== "none");
      else rows = rows.filter((u) => u.managerLevel === fManager);
    }

    if (term) {
      rows = rows.filter((u) =>
        [u.full_name, u.displayId, u.email, u.employee_id, u.division, u.department, u.position].some((v) =>
          (v ?? "").toLowerCase().includes(term),
        ),
      );
    }

    const roleRank = (u: (typeof data)[number]) => {
      if (u.roles.includes("admin")) return 3;
      if (u.roles.includes("instructor")) return 2;
      if (u.managerLevel === "division_head") return 1.8;
      if (u.managerLevel === "department_head") return 1.5;
      return 1;
    };

    return [...rows].sort((a, b) => {
      if (sort.key === "approved") {
        if (a.approved !== b.approved) return sort.dir * (a.approved ? -1 : 1);
      } else if (sort.key === "created_at") {
        return sort.dir * (a.created_at || "").localeCompare(b.created_at || "");
      } else if (sort.key === "role") {
        const diff = roleRank(b) - roleRank(a);
        if (diff !== 0) return sort.dir * diff;
      } else if (sort.key === "identifier") {
        return sort.dir * (a.displayId || "").localeCompare(b.displayId || "", "th", { numeric: true });
      } else {
        const av = String(a[sort.key] ?? "");
        const bv = String(b[sort.key] ?? "");
        const cmp = av.localeCompare(bv, "th", { numeric: true });
        if (cmp !== 0) return sort.dir * cmp;
      }
      return (a.full_name || "").localeCompare(b.full_name || "", "th", { numeric: true });
    });
  }, [data, filter, q, sort, fDiv, fDept, fRole, fManager]);

  const totalFiltered = list.length;
  const effectivePageSize = pageSize <= 0 ? Math.max(1, totalFiltered) : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / effectivePageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * effectivePageSize;
  const pagedList = pageSize <= 0 ? list : list.slice(startIndex, startIndex + effectivePageSize);

  const hasActiveFilters =
    filter !== "all" || Boolean(q.trim() || fDiv || fDept || fRole || fManager);

  function resetAllFilters() {
    setFilter("all");
    setQ("");
    setFDiv("");
    setFDept("");
    setFRole("");
    setFManager("");
    setPage(1);
  }

  function thLabel(label: string, key: SortKey) {
    const active = sort.key === key;
    return (
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, dir: active && s.dir === 1 ? -1 : 1 }))}
        className={`inline-flex items-center gap-1 hover:text-foreground cursor-pointer transition ${
          active ? "text-primary font-bold" : ""
        }`}
      >
        <span>{label}</span>
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

  async function handleDirectReset(user: {
    id: string;
    full_name: string;
    email: string | null;
    employee_id: string | null;
  }) {
    const idDisplay = getDisplayIdentifier(user.email, user.employee_id);
    const newPw = prompt(
      `กำหนดรหัสผ่านใหม่สำหรับ "${user.full_name}" (${idDisplay})\nกรุณาระบุรหัสผ่านอย่างน้อย 6 ตัวอักษร:`,
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

  async function handleManagerLevelChange(
    user: (typeof data)[number],
    nextLevel: ManagerLevel,
  ) {
    // Remove existing manager assignments for this user first
    await supabase.from("org_unit_managers").delete().eq("user_id", user.id);

    if (nextLevel === "none") {
      toast.success(`ปรับสถานะ "${user.full_name}" เป็นสมาชิกทั่วไปแล้ว`);
      refresh();
      return;
    }

    const divUnit = orgUnits.find((u) => u.kind === "division" && u.name === user.division);
    if (!divUnit) {
      toast.error(`กรุณาระบุฝ่ายของ "${user.full_name}" ให้ตรงกับโครงสร้างองค์กรก่อนตั้งเป็นหัวหน้า`);
      refresh();
      return;
    }

    if (nextLevel === "division_head") {
      const { error } = await supabase
        .from("org_unit_managers")
        .insert({ user_id: user.id, org_unit_id: divUnit.id });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`ตั้ง "${user.full_name}" เป็นหัวหน้าฝ่าย (${divUnit.name}) เรียบร้อยแล้ว`);
    } else if (nextLevel === "department_head") {
      const deptUnit = orgUnits.find(
        (u) => u.kind === "unit" && u.parent_id === divUnit.id && u.name === user.department,
      );
      const targetUnitId = deptUnit?.id || divUnit.id;
      const targetName = deptUnit?.name || divUnit.name;
      const { error } = await supabase
        .from("org_unit_managers")
        .insert({ user_id: user.id, org_unit_id: targetUnitId });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`ตั้ง "${user.full_name}" เป็นหัวหน้าแผนก (${targetName}) เรียบร้อยแล้ว`);
    }
    refresh();
  }

  return (
    <>
      <PageHeader
        eyebrow="ผู้ดูแลระบบ"
        title="จัดการสมาชิก"
        subtitle={`บุคลากรทั้งหมด ${data.length} คน · อนุมัติแล้ว ${approvedCount} คน · รออนุมัติ ${pending} คน · หัวหน้าฝ่าย/แผนก ${managersCount} คน`}
        right={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setShowImport(!showImport);
                setShowAdd(false);
              }}
              className="rounded-2xl border bg-card px-4 py-2 text-sm font-semibold hover:border-primary/50 transition cursor-pointer"
            >
              {showImport ? "ปิดการนำเข้า" : "📥 นำเข้า Excel / CSV"}
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

      {/* Advanced Filter & Search Toolbar */}
      <div className="glass mb-4 rounded-2xl p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer transition ${
                filter === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card text-muted-foreground hover:text-foreground border border-border/60"
              }`}
            >
              ทั้งหมด ({data.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("approved")}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer transition ${
                filter === "approved"
                  ? "bg-mint text-primary-foreground shadow-xs"
                  : "bg-card text-muted-foreground hover:text-foreground border border-border/60"
              }`}
            >
              อนุมัติแล้ว ({approvedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("pending")}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer transition ${
                filter === "pending"
                  ? "bg-amber text-primary-foreground shadow-xs"
                  : "bg-card text-muted-foreground hover:text-foreground border border-border/60"
              }`}
            >
              รออนุมัติ ({pending})
            </button>
          </div>

          {/* Summary & Page Size Selector */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              แสดง{" "}
              <strong className="text-foreground">
                {totalFiltered === 0 ? 0 : startIndex + 1}–{Math.min(totalFiltered, startIndex + pagedList.length)}
              </strong>{" "}
              จาก <strong className="text-primary">{totalFiltered}</strong> คน
              {totalFiltered !== data.length && ` (กรองจากทั้งหมด ${data.length} คน)`}
            </span>
            <select
              aria-label="จำนวนรายการต่อหน้า"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-xl border bg-card px-2.5 py-1 text-xs font-semibold text-foreground"
            >
              <option value={25}>25 คน / หน้า</option>
              <option value={50}>50 คน / หน้า</option>
              <option value={100}>100 คน / หน้า</option>
              <option value={0}>แสดงทั้งหมด</option>
            </select>
          </div>
        </div>

        {/* Multi-Dimension Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              className="w-full rounded-xl border bg-card pl-8 pr-8 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="ค้นหาชื่อ-นามสกุล, รหัสผู้ใช้ (เช่น P0259, DR45), อีเมล, แผนก, ตำแหน่ง..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                title="ล้างคำค้นหา"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <select
            aria-label="กรองตามฝ่าย"
            className="rounded-xl border bg-card px-2.5 py-1.5 text-xs"
            value={fDiv}
            onChange={(e) => {
              setFDiv(e.target.value);
              setFDept("");
            }}
          >
            <option value="">ทุกฝ่าย ({divisions.length})</option>
            {divisions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {fDiv && (
            <select
              aria-label="กรองตามแผนก"
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

          <select
            aria-label="กรองตามบทบาท"
            className="rounded-xl border bg-card px-2.5 py-1.5 text-xs"
            value={fRole}
            onChange={(e) => setFRole(e.target.value as "" | Role)}
          >
            <option value="">ทุกบทบาท</option>
            <option value="learner">ผู้เรียน</option>
            <option value="instructor">วิทยากร</option>
            <option value="admin">ผู้ดูแลระบบ</option>
          </select>

          <select
            aria-label="กรองตามระดับหัวหน้า"
            className="rounded-xl border bg-card px-2.5 py-1.5 text-xs"
            value={fManager}
            onChange={(e) =>
              setFManager(
                e.target.value as "" | "any_head" | "division_head" | "department_head" | "none",
              )
            }
          >
            <option value="">ทุกระดับหัวหน้า</option>
            <option value="any_head">👑 เฉพาะหัวหน้าฝ่าย / แผนก ({managersCount})</option>
            <option value="division_head">👑 หัวหน้าฝ่าย</option>
            <option value="department_head">🏅 หัวหน้าแผนก / หน่วย</option>
            <option value="none">บุคลากรทั่วไป</option>
          </select>

          <select
            aria-label="เรียงลำดับตาม"
            className="rounded-xl border bg-card px-2.5 py-1.5 text-xs font-semibold text-primary"
            value={`${sort.key}:${sort.dir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(":");
              setSort({ key: k as SortKey, dir: Number(d) as 1 | -1 });
            }}
          >
            <option value="full_name:1">เรียง: ชื่อ ก → ฮ</option>
            <option value="full_name:-1">เรียง: ชื่อ ฮ → ก</option>
            <option value="identifier:1">เรียง: รหัสผู้ใช้ A → Z</option>
            <option value="identifier:-1">เรียง: รหัสผู้ใช้ Z → A</option>
            <option value="division:1">เรียง: ฝ่าย ก → ฮ</option>
            <option value="department:1">เรียง: แผนก ก → ฮ</option>
            <option value="position:1">เรียง: ตำแหน่ง ก → ฮ</option>
            <option value="created_at:-1">เรียง: วันที่เพิ่ม (ล่าสุดก่อน)</option>
            <option value="created_at:1">เรียง: วันที่เพิ่ม (เก่าสุดก่อน)</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 rounded-xl border border-coral/40 bg-coral/10 px-3 py-1.5 text-xs font-semibold text-coral hover:bg-coral/20 transition cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>ล้างตัวกรอง</span>
            </button>
          )}
        </div>
      </div>

      {/* Members Table */}
      <div className="glass overflow-hidden rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[880px]">
            <thead className="bg-mist text-xs text-muted-foreground">
              <tr>
                <th className="w-14 py-3.5 pl-4 pr-2 text-center font-bold">#</th>
                <th className="w-44 py-3.5 px-3">{thLabel("รหัสผู้ใช้ / อีเมล", "identifier")}</th>
                <th className="py-3.5 px-3">{thLabel("ชื่อ-นามสกุล", "full_name")}</th>
                <th className="py-3.5 px-3">
                  {thLabel("ฝ่าย", "division")} / {thLabel("แผนก", "department")} /{" "}
                  {thLabel("ตำแหน่ง", "position")}
                </th>
                <th className="py-3.5 px-3">{thLabel("บทบาท & สถานะหัวหน้า", "role")}</th>
                <th className="py-3.5 pl-3 pr-4">{thLabel("สถานะ & การจัดการ", "approved")}</th>
              </tr>
            </thead>
            <tbody>
              {pagedList.map((u, idx) => {
                const isSynthetic = isSyntheticEmail(u.email);
                const rowNumber = startIndex + idx + 1;

                return (
                  <tr key={u.id} className="border-t border-glass-border hover:bg-muted/20 transition">
                    {/* 1. Row Sequence Number (#) */}
                    <td className="py-3.5 pl-4 pr-2 text-center font-mono text-xs font-bold text-muted-foreground">
                      {rowNumber}
                    </td>

                    {/* 2. User ID / Email */}
                    <td className="py-3.5 px-3">
                      {isSynthetic ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 text-xs font-mono font-bold text-sky-700 dark:text-sky-300">
                          {u.displayId}
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="text-xs font-mono font-semibold text-foreground break-all">
                            {u.email}
                          </div>
                          {u.employee_id && (
                            <div className="text-[10px] font-mono text-sky-600 dark:text-sky-400">
                              รหัส: {u.employee_id}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 3. Full Name */}
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-foreground">{u.full_name}</div>
                      {u.managedUnits.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {u.managedUnits.map((mu) => (
                            <span
                              key={mu.unitId}
                              className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300"
                            >
                              {mu.kind === "division" ? "👑 หัวหน้าฝ่าย:" : "🏅 หัวหน้าแผนก:"} {mu.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* 4. Division / Department / Position */}
                    <td className="py-3.5 px-3 text-xs">
                      <div className="text-muted-foreground">{u.division || "—"}</div>
                      <div className="font-semibold text-foreground">{u.department || "—"}</div>
                      <div className="text-muted-foreground">{u.position || "—"}</div>
                    </td>

                    {/* 5. Roles & Manager Level Assignment */}
                    <td className="py-3.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {(["learner", "instructor", "admin"] as Role[]).map((r) => {
                          const has = u.roles.includes(r);
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => toggleRole(u.id, r, has)}
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold cursor-pointer transition ${
                                has
                                  ? "bg-primary text-primary-foreground shadow-2xs"
                                  : "bg-mist text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {roleLabel[r]}
                            </button>
                          );
                        })}
                      </div>

                      {/* Quick Manager Assignment Dropdown */}
                      <div className="mt-2">
                        <select
                          aria-label={`ตั้งค่าระดับหัวหน้าของ ${u.full_name}`}
                          value={u.managerLevel}
                          onChange={(e) =>
                            handleManagerLevelChange(u, e.target.value as ManagerLevel)
                          }
                          className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold outline-none cursor-pointer ${
                            u.managerLevel !== "none"
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                              : "border-border bg-card text-muted-foreground"
                          }`}
                        >
                          <option value="none">สถานะหัวหน้า: สมาชิกทั่วไป</option>
                          <option value="department_head">🏅 ตั้งเป็น: หัวหน้าแผนก/หน่วย</option>
                          <option value="division_head">👑 ตั้งเป็น: หัวหน้าฝ่าย</option>
                        </select>
                      </div>
                    </td>

                    {/* 6. Approval Status & Password Actions */}
                    <td className="py-3.5 pl-3 pr-4">
                      {u.approved ? (
                        <button
                          type="button"
                          onClick={() => setApproved(u.id, false)}
                          className="rounded-full bg-mint/15 px-2.5 py-0.5 text-[11px] font-semibold text-mint cursor-pointer"
                        >
                          อนุมัติแล้ว ✓
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setApproved(u.id, true)}
                          className="rounded-full bg-amber px-3 py-1 text-[11px] font-semibold text-primary-foreground cursor-pointer"
                        >
                          อนุมัติ
                        </button>
                      )}

                      <div className="mt-1.5 flex flex-col gap-0.5">
                        {isSynthetic ? (
                          <button
                            type="button"
                            onClick={() => handleDirectReset(u)}
                            className="text-left text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                          >
                            🔑 รีเซ็ตรหัสผ่าน
                          </button>
                        ) : (
                          <>
                            {u.email && (
                              <button
                                type="button"
                                onClick={() => sendReset(u.email!)}
                                className="text-left text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                              >
                                ส่งลิงก์รีเซ็ต
                              </button>
                            )}
                            <button
                              type="button"
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

              {pagedList.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                    ไม่พบรายชื่อสมาชิกที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pageSize > 0 && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-glass-border bg-card/50 px-4 py-3 text-xs">
            <div className="text-muted-foreground">
              หน้า <strong className="text-foreground">{safePage}</strong> จาก{" "}
              <strong className="text-foreground">{totalPages}</strong> (ลำดับที่ {startIndex + 1}–
              {Math.min(totalFiltered, startIndex + pagedList.length)} จาก {totalFiltered} คน)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-xl border bg-card px-3 py-1.5 font-semibold disabled:opacity-40 hover:border-primary/40 transition cursor-pointer"
              >
                <ChevronLeft className="size-3.5" /> ก่อนหน้า
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-xl border bg-card px-3 py-1.5 font-semibold disabled:opacity-40 hover:border-primary/40 transition cursor-pointer"
              >
                ถัดไป <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
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
    manager_role: "none" as ManagerLevel,
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
          manager_role: f.manager_role,
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
      <div className="grid grid-cols-2 gap-2">
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
        <select
          className={inp}
          value={f.manager_role}
          onChange={(e) => setF({ ...f, manager_role: e.target.value as ManagerLevel })}
        >
          <option value="none">สมาชิกทั่วไป</option>
          <option value="department_head">🏅 หัวหน้าแผนก/หน่วย</option>
          <option value="division_head">👑 หัวหน้าฝ่าย</option>
        </select>
      </div>
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
