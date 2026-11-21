import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { importMembers } from "@/lib/admin.functions";
import { useOrgChart } from "@/lib/org";
import { parseAuthIdentifier } from "@/lib/auth-identifier";

type Row = {
  line: number;
  full_name: string;
  email: string;
  employee_id?: string;
  display_id: string;
  division: string;
  department: string;
  position: string;
  role: "learner" | "instructor" | "admin";
  manager_role: "none" | "division_head" | "department_head";
  password: string;
  alreadyExists?: boolean;
  errors: string[];
};

const roleMap: Record<string, Row["role"]> = {
  "": "learner",
  learner: "learner",
  ผู้เรียน: "learner",
  instructor: "instructor",
  วิทยากร: "instructor",
  admin: "admin",
  ผู้ดูแลระบบ: "admin",
};

const managerRoleMap: Record<string, Row["manager_role"]> = {
  "": "none",
  "-": "none",
  ทั่วไป: "none",
  none: "none",
  หัวหน้าฝ่าย: "division_head",
  division_head: "division_head",
  หัวหน้าแผนก: "department_head",
  หัวหน้าหน่วย: "department_head",
  หัวหน้าหน่วยงาน: "department_head",
  หัวหน้าทีม: "department_head",
  department_head: "department_head",
};

const managerRoleLabel: Record<Row["manager_role"], string> = {
  none: "—",
  division_head: "หัวหน้าฝ่าย",
  department_head: "หัวหน้าแผนก/หน่วย",
};

const HEAD = [
  "ชื่อ-นามสกุล",
  "รหัสผู้ใช้ หรือ อีเมล",
  "ฝ่าย",
  "แผนก",
  "ตำแหน่ง",
  "บทบาท",
  "สถานะหัวหน้า",
  "รหัสผ่าน",
];

export function ImportMembers({ existingEmails, onDone }: { existingEmails: string[]; onDone: () => void }) {
  const run = useServerFn(importMembers);
  const { orgChart } = useOrgChart();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [defaultPw, setDefaultPw] = useState("");
  const [result, setResult] = useState<{ email: string; ok: boolean; error?: string }[] | null>(null);

  async function downloadExcelTemplate() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const sampleRows = [
      {
        "ชื่อ-นามสกุล": "นพ. สมชาย ใจดี",
        "รหัสผู้ใช้ หรือ อีเมล": "660101",
        "ฝ่าย": "องค์กรแพทย์",
        "แผนก": "คณะแพทย์ประจำการโรงพยาบาล",
        "ตำแหน่ง": "หัวหน้าองค์กรแพทย์",
        "บทบาท": "ผู้เรียน",
        "สถานะหัวหน้า": "หัวหน้าฝ่าย",
        "รหัสผ่าน": "OBH123456",
      },
      {
        "ชื่อ-นามสกุล": "พว. สมหญิง รักบริการ",
        "รหัสผู้ใช้ หรือ อีเมล": "660102",
        "ฝ่าย": "ฝ่ายการพยาบาล",
        "แผนก": "แผนกผู้ป่วยนอก (OPD)",
        "ตำแหน่ง": "หัวหน้าแผนกผู้ป่วยนอก",
        "บทบาท": "ผู้เรียน",
        "สถานะหัวหน้า": "หัวหน้าแผนก",
        "รหัสผ่าน": "OBH123456",
      },
      {
        "ชื่อ-นามสกุล": "สมศักดิ์ ปลอดภัย",
        "รหัสผู้ใช้ หรือ อีเมล": "660103",
        "ฝ่าย": "ฝ่ายการพยาบาล",
        "แผนก": "แผนกผู้ป่วยนอก (OPD)",
        "ตำแหน่ง": "พยาบาลวิชาชีพ",
        "บทบาท": "ผู้เรียน",
        "สถานะหัวหน้า": "",
        "รหัสผ่าน": "OBH123456",
      },
    ];

    const wsMembers = XLSX.utils.json_to_sheet(sampleRows, { header: HEAD });
    wsMembers["!cols"] = [
      { wch: 24 },
      { wch: 22 },
      { wch: 26 },
      { wch: 28 },
      { wch: 24 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, wsMembers, "รายชื่อบุคลากร");

    const refRows: { "ฝ่าย": string; "แผนก": string; "คำอธิบายตัวเลือก": string }[] = [];
    Object.entries(orgChart).forEach(([div, depts], idx) => {
      if (depts.length === 0) {
        refRows.push({
          "ฝ่าย": div,
          "แผนก": "",
          "คำอธิบายตัวเลือก": idx === 0 ? "บทบาท: ผู้เรียน | วิทยากร | ผู้ดูแลระบบ" : "",
        });
      } else {
        depts.forEach((dept, dIdx) => {
          refRows.push({
            "ฝ่าย": div,
            "แผนก": dept,
            "คำอธิบายตัวเลือก":
              idx === 0 && dIdx === 0
                ? "บทบาท: ผู้เรียน | วิทยากร | ผู้ดูแลระบบ"
                : idx === 0 && dIdx === 1
                ? "สถานะหัวหน้า: หัวหน้าฝ่าย | หัวหน้าแผนก | (เว้นว่างสำหรับบุคลากรทั่วไป)"
                : "",
          });
        });
      }
    });

    const wsRef = XLSX.utils.json_to_sheet(refRows);
    wsRef["!cols"] = [{ wch: 28 }, { wch: 32 }, { wch: 56 }];
    XLSX.utils.book_append_sheet(wb, wsRef, "รายชื่อฝ่ายและแผนกอ้างอิง");

    XLSX.writeFile(wb, "member-import-template.xlsx");
  }

  async function load(file: File) {
    setResult(null);
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", codepage: 65001 });
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]!]!, { defval: "" });
    const existing = new Set(existingEmails.map((e) => e.toLowerCase()));
    const seen = new Map<string, number>();

    const parsed: Row[] = raw.map((r, i) => {
      const g = (k: string) => String(r[k] ?? r[k.toLowerCase()] ?? "").trim();
      const rawId =
        g("รหัสผู้ใช้ หรือ อีเมล") ||
        g("รหัสพนักงาน หรือ อีเมล") ||
        g("อีเมล หรือ รหัสพนักงาน") ||
        g("รหัสพนักงาน") ||
        g("รหัสผู้ใช้") ||
        g("อีเมล") ||
        g("email");
      const parsedId = parseAuthIdentifier(rawId);
      const rawManager = (g("สถานะหัวหน้า") || g("ระดับหัวหน้า") || g("หัวหน้า")).toLowerCase();

      const row: Row = {
        line: i + 2,
        full_name: g("ชื่อ-นามสกุล") || g("ชื่อ"),
        email: parsedId.authEmail,
        employee_id: parsedId.employeeId,
        display_id: parsedId.displayIdentifier,
        division: g("ฝ่าย"),
        department: g("แผนก"),
        position: g("ตำแหน่ง"),
        role: roleMap[g("บทบาท").toLowerCase()] ?? ("?" as Row["role"]),
        manager_role: managerRoleMap[rawManager] ?? "none",
        password: g("รหัสผ่าน"),
        errors: [],
      };

      if (!row.full_name) row.errors.push("ไม่มีชื่อ");
      if (!rawId) {
        row.errors.push("ไม่มีรหัสพนักงานหรืออีเมล");
      } else if (!parsedId.authEmail) {
        row.errors.push("รหัสพนักงานหรืออีเมลไม่ถูกต้อง");
      } else if (existing.has(parsedId.authEmail)) {
        row.alreadyExists = true;
      } else if (seen.has(parsedId.authEmail)) {
        row.errors.push(`ซ้ำกับแถว ${seen.get(parsedId.authEmail)}`);
      } else {
        seen.set(parsedId.authEmail, row.line);
      }

      if (row.division && !orgChart[row.division]) row.errors.push("ไม่พบฝ่าย");
      else if (row.department && !(orgChart[row.division] ?? []).includes(row.department)) {
        row.errors.push("แผนกไม่อยู่ในฝ่าย");
      }
      if ((row.role as string) === "?") row.errors.push("บทบาทไม่ถูกต้อง");
      if (row.password && row.password.length < 6) row.errors.push("รหัสผ่านสั้นกว่า 6 ตัว");
      return row;
    });

    setRows(parsed);
  }

  const valid = rows.filter((r) => !r.errors.length && !r.alreadyExists);
  const skippedExisting = rows.filter((r) => r.alreadyExists && !r.errors.length).length;
  const invalid = rows.filter((r) => r.errors.length > 0).length;
  const needPw = valid.some((r) => !r.password);

  async function save() {
    if (needPw && defaultPw.length < 6) {
      toast.error("กรุณาตั้งรหัสผ่านเริ่มต้น (อย่างน้อย 6 ตัว) สำหรับแถวที่ไม่ได้ระบุ");
      return;
    }
    setBusy(true);
    setProgressText(`0 / ${valid.length}`);
    try {
      const payloadRows = valid.map(({ line: _l, errors: _e, display_id: _d, alreadyExists: _a, ...r }) => ({
        ...r,
        password: r.password || defaultPw,
      }));
      const BATCH_SIZE = 10;
      const allResults: { email: string; ok: boolean; error?: string }[] = [];

      for (let i = 0; i < payloadRows.length; i += BATCH_SIZE) {
        const chunk = payloadRows.slice(i, i + BATCH_SIZE);
        setProgressText(`${Math.min(payloadRows.length, i + chunk.length)} / ${payloadRows.length}`);
        const { results } = await run({ data: { rows: chunk } });
        allResults.push(...results);
      }

      setResult(allResults);
      const ok = allResults.filter((r) => r.ok).length;
      toast.success(
        `นำเข้าสำเร็จ ${ok} / ${payloadRows.length} คน${
          skippedExisting > 0 ? ` (ข้ามที่มีในระบบแล้ว ${skippedExisting} คน)` : ""
        }`,
      );
      setRows([]);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setProgressText("");
    }
  }

  return (
    <div className="glass mb-6 rounded-3xl p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-bold">นำเข้าสมาชิกจากไฟล์ Excel (.xlsx) / CSV</h3>
        <button onClick={downloadExcelTemplate} className="text-sm font-semibold text-primary underline cursor-pointer">
          ดาวน์โหลดไฟล์ตัวอย่าง (.xlsx)
        </button>
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => e.target.files?.[0] && load(e.target.files[0])}
          className="text-sm"
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        รองรับทั้ง <b>อีเมล</b> และ <b>รหัสผู้ใช้ (รหัสพนักงาน / นศ. / เบอร์โทร)</b> พร้อมตั้งค่า <b>หัวหน้าฝ่าย / หัวหน้าแผนก</b> อัตโนมัติ — คอลัมน์: {HEAD.join(", ")}
      </p>
      {rows.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-mint/15 px-3 py-1 font-semibold text-mint">
              พร้อมนำเข้าใหม่ {valid.length} คน
            </span>
            {skippedExisting > 0 && (
              <span className="rounded-full bg-sky-500/15 px-3 py-1 font-semibold text-sky-600 dark:text-sky-400">
                มีในระบบแล้ว {skippedExisting} คน (ข้ามอัตโนมัติ ไม่สร้างซ้ำ)
              </span>
            )}
            {invalid > 0 && (
              <span className="rounded-full bg-coral/15 px-3 py-1 font-semibold text-coral">
                ข้อมูลผิดพลาด {invalid} คน (จะไม่ถูกบันทึก)
              </span>
            )}
            {needPw && (
              <input
                className="rounded-xl border bg-card px-3 py-1.5 text-sm"
                placeholder="รหัสผ่านเริ่มต้นสำหรับแถวที่ว่าง (อย่างน้อย 6 ตัว)"
                value={defaultPw}
                onChange={(e) => setDefaultPw(e.target.value)}
              />
            )}
            <button
              disabled={busy || !valid.length}
              onClick={save}
              className="ml-auto rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60 cursor-pointer"
            >
              {busy ? `กำลังนำเข้า (${progressText})...` : `บันทึก ${valid.length} คน`}
            </button>
          </div>
          <div className="mt-3 max-h-80 overflow-auto rounded-2xl border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-mist text-left">
                <tr>
                  <th className="p-2">แถว</th>
                  <th>ชื่อ</th>
                  <th>รหัสผู้ใช้ / อีเมล</th>
                  <th>ฝ่าย / แผนก</th>
                  <th>บทบาท</th>
                  <th>สถานะหัวหน้า</th>
                  <th>ผลตรวจ</th>
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort((a, b) => b.errors.length - a.errors.length)
                  .map((r) => (
                    <tr key={r.line} className={`border-t ${r.errors.length ? "bg-coral/10" : ""}`}>
                      <td className="p-2">{r.line}</td>
                      <td>{r.full_name}</td>
                      <td className="font-mono">{r.display_id}</td>
                      <td>
                        {r.division} / {r.department}
                      </td>
                      <td>{r.role}</td>
                      <td className="font-semibold text-primary">{managerRoleLabel[r.manager_role]}</td>
                      <td
                        className={
                          r.errors.length
                            ? "font-semibold text-coral"
                            : r.alreadyExists
                            ? "font-semibold text-sky-600 dark:text-sky-400"
                            : "text-mint"
                        }
                      >
                        {r.errors.length
                          ? r.errors.join(", ")
                          : r.alreadyExists
                          ? "⏭️ มีในระบบแล้ว (ข้ามอัตโนมัติ)"
                          : "✓ พร้อมนำเข้า"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {result && result.some((r) => !r.ok) && (
        <div className="mt-3 text-xs text-coral">
          บันทึกไม่สำเร็จ: {result.filter((r) => !r.ok).map((r) => `${r.email} (${r.error})`).join(", ")}
        </div>
      )}
    </div>
  );
}
