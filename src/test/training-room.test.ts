import { describe, expect, it } from "vitest";
import { matchesAttendee, roomSeats, type RoomAttendee } from "@/lib/training-room";
const person: RoomAttendee = { userId: "1", name: "สมชาย", division: "ฝ่ายการพยาบาล", department: "หอผู้ป่วย", registeredAt: "2026-10-08", checkedAt: null };
describe("training room", () => {
  it("never hides overflow registrations", () => { expect(roomSeats(Array(12).fill(person), 10)).toHaveLength(12); });
  it("shows empty slots and paginates without duplicates", () => { expect(roomSeats([person], 60)).toHaveLength(48); expect(roomSeats([person], 60, 1)[0]?.index).toBe(48); expect(roomSeats([person], 60, 1)).toHaveLength(12); });
  it("filters names and attendance without changing seat indexes", () => { expect(matchesAttendee(person, "พยาบาล", "waiting")).toBe(true); expect(matchesAttendee(person, "", "checked")).toBe(false); expect(roomSeats([person], null)[0]?.label).toBe("A01"); });
});