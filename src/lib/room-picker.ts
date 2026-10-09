// Presentation-only random picker: never writes scores or attendance.
export type PickCandidate = { userId: string; division: string; checkedAt: string | null; simulated?: boolean };

export function pickPool<T extends PickCandidate>(people: T[], division: string, drawn: Set<string>): T[] {
  return people.filter((p) => p.checkedAt && !p.simulated && (division === "all" || p.division === division) && !drawn.has(p.userId));
}

export function pickOne<T>(pool: T[], random: () => number = Math.random): T | null {
  return pool[Math.floor(random() * pool.length) % Math.max(1, pool.length)] ?? null;
}
