import { describe, expect, it } from "vitest";
import { arrivalPath, detectRoomArrivals, attendeeSymbol, roomDate, matchesAttendee, roomSeats, type RoomAttendee } from "@/lib/training-room";
const person: RoomAttendee = { userId: "1", name: "สมชาย", division: "ฝ่ายการพยาบาล", department: "หอผู้ป่วย", registeredAt: "2026-10-08", checkedAt: null };
describe("training room", () => {
  it("animates first check-ins but not initial load, demos or repeat polls", () => {
    const real = { user_id: "1", session_id: "s", checked_at: "2026-10-09", is_demo: false };
    const initial = detectRoomArrivals([], null, 1);
    expect(detectRoomArrivals([real], null, 1).arrivals).toEqual({});
    const next = detectRoomArrivals([real], initial.snapshot, 2);
    expect(next.arrivals).toEqual({ "1:s": 2 });
    expect(detectRoomArrivals([real], next.snapshot, 3).arrivals).toEqual({});
    expect(detectRoomArrivals([{ ...real, is_demo: true }], initial.snapshot, 3).arrivals).toEqual({});
    expect(detectRoomArrivals([{ ...real, session_id: "other" }], next.snapshot, 4).arrivals).toEqual({ "1:other": 4 });
  });
  it("routes arrivals through the center aisle and row gap", () => {
    expect(arrivalPath({ x: -5.5, z: 3.6 }, 9)).toEqual([[0, 10.8], [0, 2.7], [-5.5, 2.7], [-5.5, 3.38]]);
  });
  it("never hides overflow registrations", () => { expect(roomSeats(Array(12).fill(person), 10)).toHaveLength(12); });
  it("shows empty slots and paginates without duplicates", () => { expect(roomSeats([person], 60)).toHaveLength(48); expect(roomSeats([person], 60, 1)[0]?.index).toBe(48); expect(roomSeats([person], 60, 1)).toHaveLength(12); });
  it("filters names and attendance without changing seat indexes", () => { expect(matchesAttendee(person, "พยาบาล", "waiting")).toBe(true); expect(matchesAttendee(person, "", "checked")).toBe(false); expect(roomSeats([person], null)[0]?.label).toBe("A01"); });
  it("filters by division when provided", () => { expect(matchesAttendee(person, "", "all", "ฝ่ายการพยาบาล")).toBe(true); expect(matchesAttendee(person, "", "all", "ฝ่ายการแพทย์")).toBe(false); expect(matchesAttendee(person, "", "all")).toBe(true); });
  it("uses neutral profession emojis and technical exceptions", () => {
    expect(attendeeSymbol(person).emoji).toBe("🧑‍⚕️");
    expect(attendeeSymbol({ division: "", department: "หน่วยเทคนิคเครื่องมือแพทย์" }).emoji).toBe("🧑‍🔧");
    expect(attendeeSymbol({ division: "", department: "" }).emoji).toBe("🧑");
  });
  it("formats actual session times in Bangkok", () => {
    expect(roomDate("2026-10-17T02:00:00Z", "2026-10-17T05:00:00Z")).toContain("09:00–12:00");
    expect(roomDate(null, null)).toBe("ยังไม่กำหนดวันอบรม");
  });
});