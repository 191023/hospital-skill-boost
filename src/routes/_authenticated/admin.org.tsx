import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/admin/org")({
  head: () => ({ meta: [
    { title: "โครงสร้างองค์กร — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { name: "description", content: "จัดการฝ่าย แผนก/หน่วย และหัวหน้าสำหรับการจัดอบรม โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:title", content: "โครงสร้างองค์กร — โรงพยาบาลโอเวอร์บรุ๊ค" },
    { property: "og:description", content: "จัดการฝ่าย แผนก/หน่วย และหัวหน้า" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: OrgPage,
});

type Unit = { id: string; name: string; kind: string; parent_id: string | null };
type Mgr = { user_id: string; org_unit_id: string };
type Person = { id: string; full_name: string; org_unit_id: string | null; division: string | null; department: string | null };

const sel = "rounded-xl border bg-card px-3 py-1.5 text-xs";

function OrgPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [newDivision, setNewDivision] = useState("");
  const { data } = useQuery({
    queryKey: ["org-admin"],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const [{ data: units }, { data: mgrs }, { data: people }] = await Promise.all([
        supabase.from("org_units").select("*").order("name"),
        supabase.from("org_unit_managers").select("*"),
        supabase.from("profiles").select("id,full_name,org_unit_id,division,department").order("full_name"),
      ]);
      return { units: (units ?? []) as Unit[], mgrs: (mgrs ?? []) as Mgr[], people: (people ?? []) as Person[] };
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["org-admin"] });
  const byId = useMemo(() => new Map((data?.people ?? []).map((p) => [p.id, p])), [data]);

  if (!me?.isAdmin) return <div className="glass rounded-3xl p-10 text-center">เฉพาะผู้ดูแลระบบ</div>;
  if (!data) return <div className="text-muted-foreground">กำลังโหลด...</div>;

  const divisions = data.units.filter((u) => u.kind === "division");
  const unitsOf = (id: string) => data.units.filter((u) => u.parent_id === id);
  const membersOf = (id: string) => data.people.filter((p) => p.org_unit_id === id);
  const countDivision = (d: Unit) => membersOf(d.id).length + unitsOf(d.id).reduce((n, u) => n + membersOf(u.id).length, 0);
  const unassigned = data.people.filter((p) => !p.org_unit_id);

  async function add(name: string, kind: "division" | "unit", parent_id: string | null) {
    const n = name.trim();
    if (!n) return;
    const { error } = await supabase.from("org_units").insert({ name: n, kind, parent_id });
    if (error) { toast.error(error.message.includes("duplicate") ? "มีชื่อนี้อยู่แล้ว" : error.message); return; }
    toast.success("เพิ่มแล้ว");
    refresh();
  }
  async function rename(u: Unit) {
    const n = prompt("ชื่อใหม่", u.name)?.trim();
    if (!n || n === u.name) return;
    const { error } = await supabase.from("org_units").update({ name: n }).eq("id", u.id);
    if (error) { toast.error(error.message.includes("duplicate") ? "มีชื่อนี้อยู่แล้ว" : error.message); return; }
    toast.success("เปลี่ยนชื่อแล้ว (ข้อมูลสมาชิกอัปเดตตาม)");
    refresh(); qc.invalidateQueries({ queryKey: ["me"] });
  }
  async function remove(u: Unit) {
    if (!confirm(`ลบ "${u.name}"? สมาชิกในหน่วยนี้จะกลับเป็น "ยังไม่จัดเข้าหน่วย"`)) return;
    const { error } = await supabase.from("org_units").delete().eq("id", u.id);
    if (error) { toast.error(error.message.includes("foreign key") ? "ต้องลบแผนก/หน่วยภายใต้ฝ่ายนี้ก่อน" : error.message); return; }
    refresh();
  }
  async function addManager(user_id: string, org_unit_id: string) {
    if (!user_id) return;
    const { error } = await supabase.from("org_unit_managers").insert({ user_id, org_unit_id });
    if (error) { toast.error(error.message); return; }
    toast.success("ตั้งหัวหน้าแล้ว");
    refresh(); qc.invalidateQueries({ queryKey: ["me"] });
  }
  async function removeManager(user_id: string, org_unit_id: string) {
    const { error } = await supabase.from("org_unit_managers").delete().eq("user_id", user_id).eq("org_unit_id", org_unit_id);
    if (error) { toast.error(error.message); return; }
    refresh(); qc.invalidateQueries({ queryKey: ["me"] });
  }
  async function assign(personId: string, unitId: string) {
    if (!unitId) return;
    const { error } = await supabase.from("profiles").update({ org_unit_id: unitId }).eq("id", personId);
    if (error) { toast.error(error.message); return; }
    toast.success("จัดเข้าหน่วยแล้ว");
    refresh();
  }

  const UnitCard = ({ u, indent }: { u: Unit; indent?: boolean }) => {
    const mg = data.mgrs.filter((m) => m.org_unit_id === u.id);
    const candidates = data.people.filter((p) => !mg.some((m) => m.user_id === p.id));
    return (
      <div className={`glass rounded-2xl p-4 ${indent ? "ml-6" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${u.kind === "division" ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"}`}>
              {u.kind === "division" ? "ฝ่าย" : "แผนก/หน่วย"}
            </span>
            <span className="ml-2 font-bold">{u.name}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {u.kind === "division" ? `${countDivision(u)} คน (รวมทุกหน่วย)` : `${membersOf(u.id).length} คน`}
            </span>
          </div>
          <div className="flex gap-2 text-xs">
            <button onClick={() => rename(u)} className="font-semibold text-primary">เปลี่ยนชื่อ</button>
            <button onClick={() => remove(u)} className="text-destructive">ลบ</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">หัวหน้า:</span>
          {mg.length === 0 && <span className="text-xs text-muted-foreground">— ยังไม่ได้ตั้ง</span>}
          {mg.map((m) => (
            <span key={m.user_id} className="inline-flex items-center gap-1 rounded-full bg-mint/15 px-2.5 py-0.5 text-xs font-semibold text-mint">
              {byId.get(m.user_id)?.full_name || "(ไม่พบ)"}
              <button onClick={() => removeManager(m.user_id, u.id)} className="text-muted-foreground hover:text-destructive" aria-label="ถอดหัวหน้า">×</button>
            </span>
          ))}
          <select className={sel} value="" onChange={(e) => addManager(e.target.value, u.id)} aria-label={`เพิ่มหัวหน้า ${u.name}`}>
            <option value="">+ เพิ่มหัวหน้า</option>
            {candidates.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="ผู้ดูแลระบบ" title="โครงสร้างองค์กร" />
      <div className="glass rounded-3xl p-5 text-sm text-muted-foreground">
        หัวหน้าฝ่ายจัดการได้ทุกคนในฝ่ายและทุกหน่วยภายใต้ฝ่าย · หัวหน้าแผนก/หน่วยจัดการได้เฉพาะหน่วยของตน · หัวหน้าหนึ่งคนดูแลได้หลายหน่วย
      </div>

      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); add(newDivision, "division", null); setNewDivision(""); }}>
        <input value={newDivision} onChange={(e) => setNewDivision(e.target.value)} placeholder="ชื่อฝ่ายใหม่ เช่น ฝ่ายการพยาบาล"
          className="min-w-[240px] flex-1 rounded-xl border bg-card px-3 py-2 text-sm" aria-label="ชื่อฝ่ายใหม่" />
        <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brand">+ เพิ่มฝ่าย</button>
      </form>

      {unassigned.length > 0 && (
        <div className="glass rounded-3xl border border-amber/40 p-5">
          <h2 className="font-bold text-amber">สมาชิกที่ยังไม่ได้จัดเข้าหน่วย ({unassigned.length})</h2>
          <p className="mt-1 text-xs text-muted-foreground">ข้อมูลฝ่าย/แผนกเดิมของสมาชิกไม่ตรงกับโครงสร้างใด กรุณาเลือกหน่วยที่ถูกต้อง</p>
          <div className="mt-3 space-y-2">
            {unassigned.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{p.full_name || "(ไม่มีชื่อ)"}</span>
                  <span className="ml-2 text-xs text-muted-foreground">เดิม: {[p.division, p.department].filter(Boolean).join(" / ") || "—"}</span>
                </div>
                <select className={sel} value="" onChange={(e) => assign(p.id, e.target.value)} aria-label={`จัด ${p.full_name} เข้าหน่วย`}>
                  <option value="">จัดเข้าหน่วย…</option>
                  {divisions.map((d) => (
                    <optgroup key={d.id} label={d.name}>
                      <option value={d.id}>{d.name} (ประจำฝ่าย)</option>
                      {unitsOf(d.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-5">
        {divisions.map((d) => (
          <div key={d.id} className="space-y-2">
            <UnitCard u={d} />
            {unitsOf(d.id).map((u) => <UnitCard key={u.id} u={u} indent />)}
            <AddUnit onAdd={(n) => add(n, "unit", d.id)} />
          </div>
        ))}
        {divisions.length === 0 && <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">ยังไม่มีฝ่าย</div>}
      </div>
    </div>
  );
}

function AddUnit({ onAdd }: { onAdd: (n: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form className="ml-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); onAdd(v); setV(""); }}>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="+ เพิ่มแผนก/หน่วยในฝ่ายนี้" className="min-w-[200px] flex-1 rounded-xl border bg-card px-3 py-1.5 text-xs" aria-label="ชื่อแผนกหรือหน่วยใหม่" />
      <button className="rounded-xl border px-3 py-1.5 text-xs font-semibold text-primary">เพิ่ม</button>
    </form>
  );
}
