export type LearnerStage = "empty" | "waiting" | "checked" | "learning" | "post_pending" | "certified";

export type RoomAttendee = {
  userId: string;
  name: string;
  division: string;
  department: string;
  position?: string;
  simulated?: boolean;
  checkedAt: string | null;
  registeredAt: string;
  preDone?: boolean;
  preScore?: number | null;
  lessonsDone?: number;
  totalLessons?: number;
  postDone?: boolean;
  postPassed?: boolean;
  postScore?: number | null;
  hasCert?: boolean;
};

export type RoomSeat = {
  index: number;
  label: string;
  x: number;
  z: number;
  attendee: RoomAttendee | null;
  zone?: string;
};

export type RoomZone = {
  division: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  total: number;
  checked: number;
};

export type RoomViewMode = "all" | "checked" | "waiting" | "certified" | "post_pending";
export type RoomLayoutMode = "grid" | "zones";
export type RoomQualityTier = "high" | "med" | "low";
export type RoomHudPreset = "hospital" | "jarvis" | "emerald" | "amber";

export type RoomLiveEvent = {
  id: string;
  userId: string;
  name: string;
  division: string;
  seatLabel: string;
  seatIndex: number;
  kind: "check_in" | "pre_done" | "post_passed" | "certified";
  text: string;
  timestamp: number;
};

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
  "องค์กรแพทย์": "--primary",
};

export function getLearnerStage(person: RoomAttendee | null | undefined): LearnerStage {
  if (!person) return "empty";
  if (!person.checkedAt) return "waiting";
  if (person.hasCert || person.postPassed) return "certified";
  const allLessonsDone = !person.totalLessons || (person.lessonsDone ?? 0) >= person.totalLessons;
  if (person.preDone && allLessonsDone && !person.postPassed) return "post_pending";
  if (person.preDone || (person.lessonsDone ?? 0) > 0) return "learning";
  return "checked";
}

export function getStageMeta(stage: LearnerStage): { label: string; shortLabel: string; color: string; badgeClass: string } {
  switch (stage) {
    case "certified":
      return { label: "สอบผ่าน / ได้ใบประกาศ", shortLabel: "🎓 ผ่านเกณฑ์", color: "#10b981", badgeClass: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" };
    case "post_pending":
      return { label: "รอสอบ Post-test", shortLabel: "✍️ รอสอบหลังเรียน", color: "#f59e0b", badgeClass: "bg-amber-500/15 text-amber-500 border-amber-500/30" };
    case "learning":
      return { label: "กำลังเรียน / ทำ Pre-test แล้ว", shortLabel: "💻 กำลังเรียน", color: "#0ea5e9", badgeClass: "bg-sky-500/15 text-sky-500 border-sky-500/30" };
    case "checked":
      return { label: "เช็คชื่อเข้าห้องแล้ว", shortLabel: "✓ เช็คชื่อแล้ว", color: "#2dd4bf", badgeClass: "bg-mint/15 text-mint border-mint/30" };
    case "waiting":
      return { label: "รอเช็คชื่อเข้าห้อง", shortLabel: "⏳ รอเช็คชื่อ", color: "#f97316", badgeClass: "bg-orange-500/15 text-orange-500 border-orange-500/30" };
    default:
      return { label: "ที่นั่งว่าง", shortLabel: "ว่าง", color: "#64748b", badgeClass: "bg-muted text-muted-foreground" };
  }
}

export function roomFirstName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) return "ไม่ระบุชื่อ";

  const posMatch = trimmed.match(/^(พว\.|จพ\.|ทนพ\.)\s*([^\s]+)/i);
  if (posMatch) {
    return `${posMatch[1]}${posMatch[2]}`;
  }

  return trimmed.replace(/^(?:(?:นาย|นางสาว|นาง|น\.ส\.|นพ\.|พญ\.|ดร\.|Mr\.|Mrs\.|Ms\.)\s*)+/i, "").split(/\s+/)[0] || "ไม่ระบุชื่อ";
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

export function roomSeats(
  attendees: RoomAttendee[],
  capacity: number | null,
  page = 0,
  layoutMode: RoomLayoutMode = "grid",
): RoomSeat[] {
  const count = Math.max(attendees.length, capacity ?? attendees.length);
  const columns = count <= 16 ? 4 : 8;
  const start = page * ROOM_PAGE_SIZE;
  const length = Math.min(ROOM_PAGE_SIZE, Math.max(0, count - start));

  if (layoutMode === "grid" || attendees.length === 0) {
    return Array.from({ length }, (_, i) => {
      const index = start + i;
      const column = i % columns;
      const attendee = attendees[index] ?? null;
      return {
        index,
        label: `${String.fromCharCode(65 + Math.floor(index / 8))}${String((index % 8) + 1).padStart(2, "0")}`,
        x: (column - (columns - 1) / 2) * 1.4 + (column < columns / 2 ? -0.6 : 0.6),
        z: Math.floor(i / columns) * 1.8,
        attendee,
        zone: attendee?.division || undefined,
      };
    });
  }

  // Department Zone Auto-Layout: group occupied seats by division into left/right aisle banks
  const pageItems: { originalIndex: number; attendee: RoomAttendee | null }[] = Array.from({ length }, (_, i) => ({
    originalIndex: start + i,
    attendee: attendees[start + i] ?? null,
  }));

  const groups = new Map<string, { originalIndex: number; attendee: RoomAttendee | null }[]>();
  const empties: { originalIndex: number; attendee: RoomAttendee | null }[] = [];

  for (const item of pageItems) {
    if (!item.attendee) {
      empties.push(item);
      continue;
    }
    const div = item.attendee.division?.trim() || "ไม่ระบุฝ่าย";
    const list = groups.get(div) ?? [];
    list.push(item);
    groups.set(div, list);
  }

  const bankCols = 4;
  const SEAT_GAP_X = 1.4;
  const SEAT_GAP_Z = 1.85;
  const ZONE_GAP_Z = 1.15;
  const bankNextZ: [number, number] = [0, 0];
  const result: RoomSeat[] = [];

  const sortedDivisions = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "th"));

  for (const [div, items] of sortedDivisions) {
    const bank: 0 | 1 = bankNextZ[0] <= bankNextZ[1] ? 0 : 1;
    const baseZ = bankNextZ[bank];
    const rows = Math.ceil(items.length / bankCols);

    items.forEach((item, localIdx) => {
      const colInBank = localIdx % bankCols;
      const rowInZone = Math.floor(localIdx / bankCols);
      const globalCol = bank === 0 ? colInBank : colInBank + 4;
      const x = (globalCol - 3.5) * SEAT_GAP_X + (bank === 0 ? -0.65 : 0.65);
      const z = baseZ + rowInZone * SEAT_GAP_Z;
      result.push({
        index: item.originalIndex,
        label: `${String.fromCharCode(65 + Math.floor(item.originalIndex / 8))}${String((item.originalIndex % 8) + 1).padStart(2, "0")}`,
        x: Number(x.toFixed(3)),
        z: Number(z.toFixed(3)),
        attendee: item.attendee,
        zone: div,
      });
    });

    bankNextZ[bank] = baseZ + rows * SEAT_GAP_Z + ZONE_GAP_Z;
  }

  if (empties.length > 0) {
    const startEmptyZ = Math.max(bankNextZ[0], bankNextZ[1]);
    empties.forEach((item, localIdx) => {
      const col = localIdx % 8;
      const row = Math.floor(localIdx / 8);
      const x = (col - 3.5) * SEAT_GAP_X + (col < 4 ? -0.65 : 0.65);
      const z = startEmptyZ + row * SEAT_GAP_Z;
      result.push({
        index: item.originalIndex,
        label: `${String.fromCharCode(65 + Math.floor(item.originalIndex / 8))}${String((item.originalIndex % 8) + 1).padStart(2, "0")}`,
        x: Number(x.toFixed(3)),
        z: Number(z.toFixed(3)),
        attendee: null,
        zone: undefined,
      });
    });
  }

  return result.sort((a, b) => a.index - b.index);
}

export function computeDepartmentZones(seats: RoomSeat[]): RoomZone[] {
  const byZone = new Map<string, RoomSeat[]>();
  for (const s of seats) {
    if (!s.zone || !s.attendee) continue;
    const list = byZone.get(s.zone) ?? [];
    list.push(s);
    byZone.set(s.zone, list);
  }
  const zones: RoomZone[] = [];
  for (const [division, list] of byZone.entries()) {
    const xs = list.map((s) => s.x);
    const zs = list.map((s) => s.z);
    const minX = Math.min(...xs) - 0.72;
    const maxX = Math.max(...xs) + 0.72;
    const minZ = Math.min(...zs) - 0.95;
    const maxZ = Math.max(...zs) + 0.65;
    zones.push({
      division,
      minX,
      maxX,
      minZ,
      maxZ,
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2,
      width: maxX - minX,
      depth: maxZ - minZ,
      total: list.length,
      checked: list.filter((s) => !!s.attendee?.checkedAt).length,
    });
  }
  return zones;
}

export function matchesAttendee(person: RoomAttendee, search: string, status: string, division = "all") {
  const text = [person.name, person.division, person.department].join(" ").toLocaleLowerCase("th");
  const stage = getLearnerStage(person);
  const statusMatch =
    status === "all" ||
    (status === "checked" && !!person.checkedAt) ||
    (status === "waiting" && !person.checkedAt) ||
    (status === "certified" && stage === "certified") ||
    (status === "post_pending" && (stage === "post_pending" || stage === "learning"));
  return (
    text.includes(search.trim().toLocaleLowerCase("th")) &&
    statusMatch &&
    (division === "all" || person.division === division)
  );
}

export function detectRoomProgressEvents(
  seats: RoomSeat[],
  previous: Map<string, { checked: boolean; preDone: boolean; postPassed: boolean; hasCert: boolean }> | null,
  now = Date.now(),
): {
  snapshot: Map<string, { checked: boolean; preDone: boolean; postPassed: boolean; hasCert: boolean }>;
  events: RoomLiveEvent[];
} {
  const snapshot = new Map<string, { checked: boolean; preDone: boolean; postPassed: boolean; hasCert: boolean }>();
  const events: RoomLiveEvent[] = [];

  for (const seat of seats) {
    const p = seat.attendee;
    if (!p) continue;
    const cur = {
      checked: Boolean(p.checkedAt),
      preDone: Boolean(p.preDone),
      postPassed: Boolean(p.postPassed),
      hasCert: Boolean(p.hasCert),
    };
    snapshot.set(p.userId, cur);
    if (!previous) continue;
    const prev = previous.get(p.userId);
    if (!prev) continue;

    if (!prev.hasCert && cur.hasCert) {
      events.push({
        id: `${p.userId}-cert-${now}`,
        userId: p.userId,
        name: p.name,
        division: p.division,
        seatLabel: seat.label,
        seatIndex: seat.index,
        kind: "certified",
        text: `🎓 ได้รับใบประกาศนียบัตรแล้ว (${seat.label})`,
        timestamp: now,
      });
    } else if (!prev.postPassed && cur.postPassed) {
      events.push({
        id: `${p.userId}-post-${now}`,
        userId: p.userId,
        name: p.name,
        division: p.division,
        seatLabel: seat.label,
        seatIndex: seat.index,
        kind: "post_passed",
        text: `✨ สอบผ่าน Post-test ${p.postScore != null ? `${p.postScore}%` : ""} (${seat.label})`,
        timestamp: now,
      });
    } else if (!prev.preDone && cur.preDone) {
      events.push({
        id: `${p.userId}-pre-${now}`,
        userId: p.userId,
        name: p.name,
        division: p.division,
        seatLabel: seat.label,
        seatIndex: seat.index,
        kind: "pre_done",
        text: `📝 ส่งข้อสอบ Pre-test เรียบร้อย (${seat.label})`,
        timestamp: now,
      });
    } else if (!prev.checked && cur.checked && !p.simulated) {
      events.push({
        id: `${p.userId}-checkin-${now}`,
        userId: p.userId,
        name: p.name,
        division: p.division,
        seatLabel: seat.label,
        seatIndex: seat.index,
        kind: "check_in",
        text: `✅ สแกนเช็คชื่อเข้าห้องอบรม (${seat.label})`,
        timestamp: now,
      });
    }
  }

  return { snapshot, events };
}

export type CountdownInfo = {
  nowText: string;
  state: "none" | "upcoming" | "in_progress" | "finished";
  label: string;
  badge: string;
  percent: number;
  remainingText: string;
};

export function getCountdownInfo(startsAt: string | null, endsAt: string | null, now = Date.now()): CountdownInfo {
  const d = new Date(now);
  const nowText = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" }) + " น.";
  if (!startsAt) {
    return { nowText, state: "none", label: "ยังไม่กำหนดเวลาอบรม", badge: "รอเวลา", percent: 0, remainingText: "" };
  }
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : start + 3 * 3600 * 1000;
  if (now < start) {
    const diff = Math.max(0, start - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return {
      nowText,
      state: "upcoming",
      label: `เริ่มอบรมในอีก ${timeStr}`,
      badge: "เร็วๆ นี้",
      percent: 0,
      remainingText: timeStr,
    };
  }
  if (now <= end) {
    const diff = Math.max(0, end - now);
    const total = Math.max(1, end - start);
    const elapsed = now - start;
    const percent = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return {
      nowText,
      state: "in_progress",
      label: `กำลังอบรม (เหลือ ${timeStr})`,
      badge: "กำลังดำเนินอยู่",
      percent,
      remainingText: timeStr,
    };
  }
  return {
    nowText,
    state: "finished",
    label: "สิ้นสุดการอบรมแล้ว",
    badge: "เสร็จสิ้น",
    percent: 100,
    remainingText: "00:00:00",
  };
}