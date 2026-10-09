/** View direction dotted with the wall's outward normal. */
export function roomWallVisibility(directionDot: number): number {
  const t = Math.max(0, Math.min(1, (-directionDot - 0.05) / 0.3));
  return 1 - t * t * (3 - 2 * t) * 0.95;
}