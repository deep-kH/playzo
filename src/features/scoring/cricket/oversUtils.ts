/**
 * Cricket Overs Utility
 *
 * In cricket, overs are stored in "display" format: 4.3 = 4 overs and 3 balls.
 * For rate calculations (CRR, RRR, Economy), we need "real" overs: 4.3 → 4.5.
 */

/**
 * Convert display overs (e.g. 4.3) to real decimal overs (e.g. 4.5).
 * Display format: the integer part is complete overs, the decimal part is balls (0-5).
 * Real format: each ball is 1/6 of an over.
 */
export function toRealOvers(displayOvers: number): number {
  const completeOvers = Math.floor(displayOvers);
  const balls = Math.round((displayOvers - completeOvers) * 10);
  return completeOvers + balls / 6;
}

/**
 * Format overs for display: ensures we show e.g. "4.3" not "4.300000001"
 */
export function formatOvers(displayOvers: number): string {
  const completeOvers = Math.floor(displayOvers);
  const balls = Math.round((displayOvers - completeOvers) * 10);
  return `${completeOvers}.${balls}`;
}

/**
 * Calculate remaining real overs from display overs
 */
export function remainingRealOvers(displayOvers: number, maxOvers: number): number {
  return toRealOvers(maxOvers) - toRealOvers(displayOvers);
}
