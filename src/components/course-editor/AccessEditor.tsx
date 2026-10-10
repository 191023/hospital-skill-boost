import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { divisions, orgChart } from "@/lib/org";
import { inp } from "./shared";

export function Access({ courseId, audience: initial }: { courseId: string; audience: string }) {
  const qc = useQueryClient();
  const [audience, setAudience] = useState(initial);
  const [search, setSearch] = useState("");
  const { data: rules = [] } = useQuery({
    queryKey: ["access", courseId],
    queryFn: async () => ((await supabase.from("course_access").select("*").eq("course_id", courseId)).data ?? []) as { id: string; kind: string; value: string }[],
  });
  const { data: people = [] } = useQuery({
    queryKey: ["access-people"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, department").eq("approved", true).order("full_name")).data ?? [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["access", courseId] }); qc.invalidateQueries({ queryKey: ["edit-course", courseId] }); };
  const has = (kind: string, value: string) => rules.find((r) => r.kind === kind && r.value === value);
  async function setMode(m: string) {
    setAudience(m);
    const { error } = await supabase.from("courses").update({ audience: m } as never).eq("id", courseId);
    if (error) toast.error(error.message); else { toast.success("บันทึกแล้ว"); refresh(); }
  }
  async function toggle(kind: string, value: string) {
    const r = has(kind, value);
    const { error } = r
      ? await supabase.from("course_access").delete().eq("id", r.id)
      : await supabase.from("course_access").insert({ course_id: courseId, kind, value });
    if (error) toast.error(error.message); else refresh();
  }
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground/70"}`;
  const nameOf = (id: string) => people.find((p) => p.id === id)?.full_name || id.slice(0, 8);
  const found = search.trim() ? people.filter((p) => `${p.full_name} ${p.email}`.toLowerCase().includes(search.toLowerCase())).slice(0, 8) : [];
  return (
    <div className="space-y-4">
      <div className="glass space-y-3 rounded-3xl p-6">
        <div className="font-semibold">ใครเรียนหลักสูตรนี้ได้บ้าง</div>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={audience === "all"} onChange={() => setMode("all")} /> บุคลากรทุกคน</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={audience === "restricted"} onChange={() => setMode("restricted")} /> เฉพาะฝ่าย / แผนก / บุคคลที่เลือก</label>
        {audience === "restricted" && <p className="text-xs text-muted-foreground">ผู้ที่ตรงกับเงื่อนไขข้อใดข้อหนึ่งด้านล่างจะเห็นและลงทะเบียนเรียนได้ ({rules.length} เงื่อนไข)</p>}
        {audience === "restricted" && rules.length === 0 && (
          <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            ⚠ ยังไม่ได้เลือกฝ่าย แผนก หรือบุคคล — ตอนนี้จะไม่มีผู้เรียนคนใดเห็นหลักสูตร หรือสแกน QR เช็คชื่อได้ กรุณาเพิ่มเงื่อนไข หรือเปลี่ยนเป็น "บุคลากรทุกคน"
          </p>
        )}
      </div>
      {audience === "restricted" && (
        <>
          <div className="glass space-y-4 rounded-3xl p-6">
            <div className="font-semibold">เลือกทั้งฝ่าย หรือเฉพาะแผนก</div>
            {divisions.map((d) => (
              <div key={d}>
                <button onClick={() => toggle("division", d)} className={chip(!!has("division", d))}>{has("division", d) ? "✓ " : ""}{d} (ทั้งฝ่าย)</button>
                {!has("division", d) && (
                  <div className="mt-2 flex flex-wrap gap-2 pl-4">
                    {orgChart[d]!.map((dep) => <button key={dep} onClick={() => toggle("department", dep)} className={chip(!!has("department", dep))}>{dep}</button>)}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="glass space-y-3 rounded-3xl p-6">
            <div className="font-semibold">รายบุคคล</div>
            <div className="flex flex-wrap gap-2">
              {rules.filter((r) => r.kind === "user").map((r) => <button key={r.id} onClick={() => toggle("user", r.value)} className={chip(true)}>{nameOf(r.value)} ✕</button>)}
            </div>
            <input className={inp} placeholder="ค้นหาชื่อหรืออีเมล เพื่อเพิ่ม" value={search} onChange={(e) => setSearch(e.target.value)} />
            {found.map((p) => (
              <button key={p.id} onClick={() => { toggle("user", p.id); setSearch(""); }} disabled={!!has("user", p.id)} className="flex w-full justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-mist disabled:opacity-50">
                <span>{p.full_name || p.email}</span><span className="text-xs text-muted-foreground">{p.department}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
