// Static course data for the KEY Golf league (Saratoga, NY)

export const HOLE_PARS: Record<number, number> = {
  // Front 9
  1: 4, 2: 3, 3: 5, 4: 4, 5: 4, 6: 5, 7: 4, 8: 3, 9: 4,
  // Back 9
  10: 4, 11: 3, 12: 5, 13: 4, 14: 4, 15: 3, 16: 4, 17: 5, 18: 4,
};

// Par for each 9-hole half (both are 36)
export const FRONT9_PAR = 36;
export const BACK9_PAR  = 36;

/**
 * Get par for a stored hole_number (1–9) given which half is being played.
 * hole_number is always stored as 1–9 in the DB; back-9 holes are offset by 9.
 */
export function holePar(holeNumber: number, courseHalf: string): number {
  const courseHole = holeNumber + (courseHalf === "back9" ? 9 : 0);
  return HOLE_PARS[courseHole] ?? 4;
}

export function halfPar(courseHalf: string): number {
  return courseHalf === "back9" ? BACK9_PAR : FRONT9_PAR;
}

/** Format a score relative to par: -2 → "−2", 0 → "E", +3 → "+3" */
export function fmtVsPar(diff: number): string {
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`;
}
