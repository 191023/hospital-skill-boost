import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// From hospital org chart: division (ฝ่าย) -> departments (แผนก)
export const orgChart: Record<string, string[]> = {
  "ฝ่ายการเงิน": [
    "การเงิน"
  ],
  "ฝ่ายการพยาบาล": [
    "ICU",
    "บริการเคลื่อนย้ายผู้ป่วย",
    "ผู้ป่วยนอก OPD B",
    "ผู้ป่วยนอก OPD K",
    "ผู้ป่วยใน KR1",
    "ผู้ป่วยใน KR4",
    "ผู้ป่วยใน KR5",
    "ผู้ป่วยใน KR6",
    "ผู้ป่วยใน KR7",
    "ผู้ป่วยใน PR3",
    "ผู้ป่วยใน PR4",
    "ผู้ป่วยใน PR5",
    "ผู้ป่วยใน PR6",
    "แผนกห้องคลอดเด็กอ่อน",
    "ศูนย์ไตเทียม",
    "ศูนย์สุขภาพ",
    "ศูนย์หัวใจ",
    "หน่วยจ่ายกลาง",
    "หน่วยยานพาหนะ",
    "ห้องฉุกเฉิน",
    "ห้องผ่าตัด"
  ],
  "ฝ่ายเทคโนโลยีสารสนเทศ": [
    "วิศวกรรมคอมพิวเตอร์",
    "เวชสถิติ",
    "สารสนเทศองค์กร",
    "หน่วยเทคนิคเครื่องมือแพทย์"
  ],
  "ฝ่ายบัญชี": [
    "บัญชี"
  ],
  "ฝ่ายพัฒนาคุณภาพ": [
    "พัฒนาคุณภาพ"
  ],
  "ฝ่ายลูกค้าสัมพันธ์": [
    "ประสานการแพทย์",
    "สื่อสารการตลาด",
    "หน่วยสื่อสาร"
  ],
  "ฝ่ายวิศวกรรมและสิ่งแวดล้อม": [
    "เคหะรักษ์",
    "ช่างเทคนิคควบคุมระบบ",
    "ซักรีด",
    "หน่วยรักษาความปลอดภัย",
    "หน่วยสนาม"
  ],
  "ฝ่ายศาสนกิจ": [
    "ศาสนกิจ"
  ],
  "ฝ่ายสนับสนุนการแพทย์": [
    "กายภาพบำบัด",
    "เภสัชกรรม",
    "โภชนาการ",
    "รังสีร่วมรักษา",
    "รังสีวิทยา",
    "ห้องปฏิบัติการ"
  ],
  "ฝ่ายสำนักงาน": [
    "ทรัพยากรบุคคล",
    "พัสดุ-จัดซื้อ",
    "สำนักเลขา"
  ],
  "องค์กรแพทย์": [
    "คณะแพทย์ประจำการโรงพยาบาล",
    "คณะแพทย์สมทบ"
  ]
};

export const divisions = Object.keys(orgChart);
export const divisionOf = (dept: string) => divisions.find((d) => orgChart[d]!.includes(dept)) ?? "";

export function useOrgChart() {
  const { data } = useQuery({
    queryKey: ["org-chart"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("org_units")
        .select("id, name, kind, parent_id")
        .is("deleted_at", null)
        .order("name");
      if (error || !rows || rows.length === 0) {
        return { divisions, orgChart };
      }
      const divRows = rows.filter((r) => r.kind === "division");
      if (divRows.length === 0) {
        return { divisions, orgChart };
      }
      const chart: Record<string, string[]> = {};
      for (const div of divRows) {
        const units = rows
          .filter((r) => r.parent_id === div.id)
          .map((r) => r.name)
          .sort((a, b) => a.localeCompare(b, "th"));
        chart[div.name] = units;
      }
      const divNames = divRows
        .map((d) => d.name)
        .sort((a, b) => a.localeCompare(b, "th"));
      return { divisions: divNames, orgChart: chart };
    },
  });

  return data ?? { divisions, orgChart };
}
