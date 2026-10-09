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

// Keep division colors stable across rounds, pagination, and filtering.
export const roomDivisionTokens: Record<string, string> = {
  "ฝ่ายการเงิน": "--room-shirt-finance",
  "ฝ่ายการพยาบาล": "--room-shirt-nursing",
  "ฝ่ายเทคโนโลยีสารสนเทศ": "--room-shirt-it",
  "ฝ่ายบัญชี": "--room-shirt-accounting",
  "ฝ่ายพัฒนาคุณภาพ": "--room-shirt-quality",
  "ฝ่ายลูกค้าสัมพันธ์": "--room-shirt-relations",
  "ฝ่ายวิศวกรรมและสิ่งแวดล้อม": "--room-shirt-engineering",
  "ฝ่ายศาสนกิจ": "--room-shirt-chaplaincy",
  "ฝ่ายสนับสนุนการแพทย์": "--room-shirt-medical",
  "ฝ่ายสำนักงาน": "--room-shirt-office",
};

export function roomFirstName(fullName: string) {
  return fullName.trim().replace(/^(?:(?:นาย|นางสาว|นาง|น\.ส\.|นพ\.|พญ\.|ดร\.|Mr\.|Mrs\.|Ms\.)\s*)+/i, "").split(/\s+/)[0] || "ไม่ระบุชื่อ";
}

export type RoomAttendanceSnapshot = { user_id: string; session_id: string | null; checked_at: string | null; is_demo: boolean };
export const attendanceKey = (userId: string, sessionId: string | null) => `${userId}:${sessionId ?? "none"}`;

export function detectRoomArrivals(rows: RoomAttendanceSnapshot[], previous: Map<string, string> | null, now: number) {
  const snapshot = new Map<string, string>();
  const arrivals: Record<string, number> = {};
  for (const row of rows) {
    if (!row.checked_at) continue;
    const key = attendanceKey(row.user_id, row.session_id);
    snapshot.set(key, row.checked_at);
    if (previous && !row.is_demo && previous.get(key) !== row.checked_at) arrivals[key] = now;
  }
  return { snapshot, arrivals };
}

// Travel down the center aisle, across the gap in front of the row, then back to the chair.
export function arrivalPath(seat: Pick<RoomSeat, "x" | "z">, back: number): [number, number][] {
  return [[0, back + 1.8], [0, seat.z - 0.9], [seat.x, seat.z - 0.9], [seat.x, seat.z - 0.22]];
}

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
  const columns = count <= 16 ? 4 : 8;
  const start = page * ROOM_PAGE_SIZE;
  return Array.from({ length: Math.min(ROOM_PAGE_SIZE, Math.max(0, count - start)) }, (_, i) => {
    const index = start + i;
    const column = i % columns;
    return {
      index,
      label: `${String.fromCharCode(65 + Math.floor(index / 8))}${String(index % 8 + 1).padStart(2, "0")}`,
      x: (column - (columns - 1) / 2) * 1.4 + (column < columns / 2 ? -0.6 : 0.6),
      z: Math.floor(i / columns) * 1.8,
      attendee: attendees[index] ?? null,
    };
  });
}

export function matchesAttendee(person: RoomAttendee, search: string, status: string, division = "all") {
  const text = [person.name, person.division, person.department].join(" ").toLocaleLowerCase("th");
  return text.includes(search.trim().toLocaleLowerCase("th")) &&
    (status === "all" || (status === "checked" ? !!person.checkedAt : !person.checkedAt)) &&
    (division === "all" || person.division === division);
}