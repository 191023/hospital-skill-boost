import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { importMembers } from "@/lib/admin.functions";
import { orgChart } from "@/lib/org";

type Row = { line: number; full_name: string; email: string; division: string; department: string; position: string; role: "learner" | "instructor" | "admin"; password: string; errors: string[] };

const roleMap: Record<string, Row["role"]> = { "": "learner", learner: "learner", "ผู้เรียน": "learner", instructor: "instructor", "วิทยากร": "instructor", admin: "admin", "ผู้ดูแลระบบ": "admin" };
const HEAD = ["ชื่อ-นามสกุล", "อีเมล", "ฝ่าย", "แผนก", "ตำแหน่ง", "บทบาท", "รหัสผ่าน"];

export function ImportMembers({ existingEmails, onDone }: { existingEmails: string[]; onDone: () => void }) {
  const run = useServerFn(importMembers);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [defaultPw, setDefaultPw] = useState("");
  const [result, setResult] = useState<{ email: string; ok: boolean; error?: string }[] | null>(null);

  function template() {
    const csv = "\uFEFF" + HEAD.join(",") + "\nสมชาย ใจดี,somchai@example.com,ฝ่ายการพยาบาล,ICU,พยาบาลวิชาชีพ,ผู้เรียน,\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "member-template.csv"; a.click();
  }

  async function load(file: File) {
    setResult(null);
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", codepage: 65001 });
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]!]!, { defval: "" });
    const existing = new Set(existingEmails.map((e) => e.toLowerCase()));
    const seen = new Map<string, number>();
    const parsed: Row[] = raw.map((r, i) => {
      const g = (k: string) => String(r[k] ?? "").trim();
      const row: Row = {
        line: i + 2, full_name: g("ชื่อ-นามสกุล"), email: g("อีเมล").toLowerCase(), division: g("ฝ่าย"), department: g("แผนก"),
        position: g("ตำแหน่ง"), role: roleMap[g("บทบาท").toLowerCase()] ?? ("?" as Row["role"]), password: g("รหัสผ่าน"), errors: [],
      };
      if (!row.full_name) row.errors.push("ไม่มีชื่อ");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) row.errors.push("อีเมลไม่ถูกต้อง");
      else if (existing.has(row.email)) row.errors.push("อีเมลซ้ำกับสมาชิกเดิม");
      else if (seen.has(row.email)) row.errors.push(`อีเมลซ้ำกับแถว ${seen.get(row.email)}`);
      else seen.set(row.email, row.line);
      if (row.division && !orgChart[row.division]) row.errors.push("ไม่พบฝ่าย");
      else if (row.department && !(orgChart[row.division] ?? []).includes(row.department)) row.errors.push("แผนกไม่อยู่ในฝ่าย");
      if ((row.role as string) === "?") row.errors.push("บทบาทไม่ถูกต้อง");
      if (row.password && row.password.length < 6) row.errors.push("รหัสผ่านสั้นกว่า 6 ตัว");
      return row;
    });
    setRows(parsed);
  }

  const valid = rows.filter((r) => !r.errors.length);
  const invalid = rows.length - valid.length;
  const needPw = valid.some((r) => !r.password);

  async function save() {
    if (needPw && defaultPw.length < 6) { toast.error("กรุณาตั้งรหัสผ่านเริ่มต้น (อย่างน้อย 6 ตัว) สำหรับแถวที่ไม่ได้ระบุ"); return; }
    setBusy(true);
    try {
      const { results } = await run({ data: { rows: valid.map(({ line: _l, errors: _e, ...r }) => ({ ...r, password: r.password || defaultPw })) } });
      setResult(results);
      const ok = results.filter((r) => r.ok).length;
      toast.success(`นำเข้าสำเร็จ ${ok} คน`);
      setRows([]);
      onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="glass mb-6 rounded-3xl p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-bold">นำเข้าสมาชิกจากไฟล์ CSV / Excel</h3>
        <button onClick={template} className="text-sm text-primary underline">ดาวน์โหลดไฟล์ตัวอย่าง</button>
        <input type="file" accept=".csv,.xlsx" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} className="text-sm" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">คอลัมน์: {HEAD.join(", ")} — ระบบจะตรวจอีเมลซ้ำและข้อมูลผิดพลาดก่อนบันทึก</p>
      {rows.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-mint/15 px-3 py-1 font-semibold text-mint">พร้อมนำเข้า {valid.length}</span>
            <span className="rounded-full bg-coral/15 px-3 py-1 font-semibold text-coral">ผิดพลาด {invalid} (จะไม่ถูกบันทึก)</span>
            {needPw && <input className="rounded-xl border bg-card px-3 py-1.5 text-sm" placeholder="รหัสผ่านเริ่มต้นสำหรับแถวที่ว่าง" value={defaultPw} onChange={(e) => setDefaultPw(e.target.value)} />}
            <button disabled={busy || !valid.length} onClick={save} className="ml-auto rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60">{busy ? "กำลังนำเข้า..." : `บันทึก ${valid.length} คน`}</button>
          </div>
          <div className="mt-3 max-h-80 overflow-auto rounded-2xl border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-mist text-left"><tr><th className="p-2">แถว</th><th>ชื่อ</th><th>อีเมล</th><th>ฝ่าย / แผนก</th><th>บทบาท</th><th>ผลตรวจ</th></tr></thead>
              <tbody>
                {[...rows].sort((a, b) => b.errors.length - a.errors.length).map((r) => (
                  <tr key={r.line} className={`border-t ${r.errors.length ? "bg-coral/10" : ""}`}>
                    <td className="p-2">{r.line}</td><td>{r.full_name}</td><td>{r.email}</td><td>{r.division} / {r.department}</td><td>{r.role}</td>
                    <td className={r.errors.length ? "font-semibold text-coral" : "text-mint"}>{r.errors.length ? r.errors.join(", ") : "✓ ผ่าน"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {result && result.some((r) => !r.ok) && (
        <div className="mt-3 text-xs text-coral">บันทึกไม่สำเร็จ: {result.filter((r) => !r.ok).map((r) => `${r.email} (${r.error})`).join(", ")}</div>
      )}
    </div>
  );
}
