/**
 * Scoring Core — Generic sport dispatcher
 *
 * Per docs/supabase.md, all scoring flows through:
 *   UI → processEvent() → supabase.rpc("rpc_process_event") → sport-specific RPC
 *
 * This module provides the single entry-point and sport-agnostic utilities.
 */

import { processGenericEvent } from "@/features/scoring/api";
import type { Json } from "@/lib/types/database";

export type SportType = "cricket" | "football" | "badminton";

/**
 * Generic event processor — routes to the correct sport engine via the DB RPC.
 * The RPC determines sport from the match's tournament and dispatches accordingly.
 */
export async function processEvent(
  matchId: string,
  type: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  await processGenericEvent(matchId, type, payload as Json);
}

/**
 * Sport-specific module loaders (lazy).
 * UI pages should use these to load the correct scoring components.
 */
export function getScoringModulePath(sport: SportType): string {
  switch (sport) {
    case "cricket":
      return "@/features/scoring/cricket";
    case "football":
      return "@/features/scoring/football";
    case "badminton":
      return "@/features/scoring/badminton";
  }
}
