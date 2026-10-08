export type RoomAttendee = {
  userId: string;
  name: string;
  division: string;
  department: string;
  position?: string;
  simulated?: boolean;
  checkedAt: string | null;
  registeredAt: string;
};

export type RoomSeat = { index: number; label: string; x: number; z: number; attendee: RoomAttendee | null };
export const ROOM_PAGE_SIZE = 48;

export function attendeeSymbol(person: Pick<RoomAttendee, "division" | "department" | "position">) {
  const role = [person.position, person.department, person.division].join(" ");
  if (/แพทย์|พยาบาล|ผู้ป่วย|ICU|OPD/i.test(role) && !/เครื่องมือ/.test(role)) return { emoji: "🧑‍⚕️", label: "บุคลากรทางการแพทย์" };
  if (/เภสัช|ห้องปฏิบัติการ|ชันสูตร|เคมี/.test(role)) return { emoji: "🧑‍🔬", label: "เภสัชกรรมและห้องปฏิบัติการ" };
  if (/เทคนิค|เครื่องมือ|ช่าง|ซ่อม|วิศว/.test(role)) return { emoji: "🧑‍🔧", label: "งานเทคนิคและบำรุงรักษา" };
  if (/สารสนเทศ|คอมพิวเตอร์|ดิจิทัล/.test(role)) return { emoji: "🧑‍💻", label: "เทคโนโลยีสารสนเทศ" };
  if (/ครัว|อาหาร|โภชน/.test(role)) return { emoji: "🧑‍🍳", label: "โภชนาการ" };
  if (/รักษาความปลอดภัย/.test(role)) return { emoji: "🛡️", label: "รักษาความปลอดภัย" };
  if (/การเงิน|บัญชี|บริหาร|บุคคล|ธุรการ|จัดซื้อ/.test(role)) return { emoji: "🧑‍💼", label: "งานบริหารและสนับสนุน" };
  return { emoji: "🧑", label: "บุคลากรโรงพยาบาล" };
}

export function roomDate(startsAt: string | null, endsAt: string | null) {
  if (!startsAt) return "ยังไม่กำหนดวันอบรม";
  const start = new Date(startsAt);
  const date = start.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
  const time = (value: Date) => value.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
  return `${date} · ${time(start)}${endsAt ? `–${time(new Date(endsAt))}` : ""} น.`;
}

export function roomSeats(attendees: RoomAttendee[], capacity: number | null, page = 0): RoomSeat[] {
  const count = Math.max(attendees.length, capacity ?? attendees.length);
  const start = page * ROOM_PAGE_SIZE;
  return Array.from({ length: Math.min(ROOM_PAGE_SIZE, Math.max(0, count - start)) }, (_, i) => {
    const index = start + i;
    const column = i % 8;
    return {
      index,
      label: `${String.fromCharCode(65 + Math.floor(index / 8))}${String(index % 8 + 1).padStart(2, "0")}`,
      x: (column - 3.5) * 1.2 + (column < 4 ? -0.45 : 0.45),
      z: Math.floor(i / 8) * 1.5,
      attendee: attendees[index] ?? null,
    };
  });
}

export function matchesAttendee(person: RoomAttendee, search: string, status: string) {
  const text = [person.name, person.division, person.department].join(" ").toLocaleLowerCase("th");
  return text.includes(search.trim().toLocaleLowerCase("th")) &&
    (status === "all" || (status === "checked" ? !!person.checkedAt : !person.checkedAt));
}