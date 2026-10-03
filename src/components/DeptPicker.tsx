import { divisions, orgChart } from "@/lib/org";

export function DeptPicker({ division, department, onChange, className }: { division: string; department: string; onChange: (division: string, department: string) => void; className: string }) {
  return (
    <>
      <select required className={className} value={division} onChange={(e) => onChange(e.target.value, "")}>
        <option value="">— เลือกฝ่าย —</option>
        {divisions.map((d) => <option key={d}>{d}</option>)}
      </select>
      <select required className={className} value={department} disabled={!division} onChange={(e) => onChange(division, e.target.value)}>
        <option value="">— เลือกแผนก —</option>
        {(orgChart[division] ?? []).map((d) => <option key={d}>{d}</option>)}
      </select>
    </>
  );
}
