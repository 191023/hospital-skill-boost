export type RoomAttendee = {
  userId: string;
  name: string;
  division: string;
  department: string;
  checkedAt: string | null;
  registeredAt: string;
};

export type RoomSeat = { index: number; label: string; x: number; z: number; attendee: RoomAttendee | null };
export const ROOM_PAGE_SIZE = 48;

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