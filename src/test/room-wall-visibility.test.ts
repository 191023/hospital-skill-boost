import { describe, expect, it } from "vitest";
import { roomWallVisibility } from "@/lib/room-wall-visibility";

describe("camera-facing room walls", () => {
  it("fades front and window walls seen from outside", () => {
    expect(roomWallVisibility(-1)).toBeCloseTo(0.05);
    expect(roomWallVisibility(-Math.SQRT1_2)).toBeCloseTo(0.05);
  });
  it("restores walls behind attendees and in the overhead view", () => {
    expect(roomWallVisibility(1)).toBe(1);
    expect(roomWallVisibility(0)).toBe(1);
  });
  it("transitions continuously without crossing its opacity limits", () => {
    expect(roomWallVisibility(-0.2)).toBeCloseTo(0.525);
    for (let d = -1; d <= 1; d += 0.01) {
      expect(roomWallVisibility(d)).toBeGreaterThanOrEqual(0.049);
      expect(roomWallVisibility(d)).toBeLessThanOrEqual(1);
    }
  });
});