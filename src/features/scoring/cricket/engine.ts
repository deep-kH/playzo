/* ─────────────────────────────────────────────────
 *  Cricket Scoring Engine (RPC Based)
 *  Purely invokes atomic PostgreSQL operations.
 *  This file replaces the legacy client-side transaction logic.
 * ───────────────────────────────────────────────── */

import { supabase } from "@/lib/supabase/client";
import type { BallInput, MatchSetupInput } from "./types";
import type { PostgrestError } from "@supabase/supabase-js";

/* ═══════════════════════════════════════════════════
 *  OS-LEVEL TIMEOUT PROTECTOR
 *  If a tab is suspended, fetch requests can hang forever.
 *  This prevents the UI from freezing indefinitely.
 * ═══════════════════════════════════════════════════ */
async function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Action timed out. Check your connection.")), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export async function setupMatch(matchId: string, input: MatchSetupInput) {
  const { error } = await withTimeout(
    (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ error: PostgrestError | null }>)("rpc_setup_match", {
      p_match_id: matchId,
      p_toss_winner_id: input.tossWinnerId,
      p_toss_decision: input.tossDecision,
      p_playing_xi_a: input.playingXI_A,
      p_playing_xi_b: input.playingXI_B,
      p_opening_striker_id: input.openingStrikerId,
      p_opening_non_striker_id: input.openingNonStrikerId,
      p_opening_bowler_id: input.openingBowlerId,
    })
  );

  if (error) {
    console.error("rpc_setup_match error:", error);
    throw new Error(error.message);
  }

  // The caller expects some data to return, but realtime should take over.
  // We'll return empty fields if needed, or query basic data.
  return { success: true };
}

/* ═══════════════════════════════════════════════════
 *  PROCESS BALL
 * ═══════════════════════════════════════════════════ */

export async function processBall(
  matchId: string,
  input: BallInput
): Promise<{ inningsEnded: boolean; matchEnded: boolean }> {
  // Translate extraType to string, wicketType to string
  const { error } = await withTimeout(
    (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ error: PostgrestError | null }>)("rpc_process_ball_atomic", {
      p_match_id: matchId,
      p_runs_bat: input.runsBat,
      p_runs_extra: input.runsExtra,
      p_extra_type: input.extraType || null,
      p_is_wicket: input.isWicket,
      p_wicket_type: input.wicketType || null,
      p_wicket_player_id: input.wicketPlayerId || null,
      p_fielder_id: input.fielderId || null,
    })
  );

  if (error) {
    console.error("rpc_process_ball_atomic error:", error);
    throw new Error(error.message);
  }

  // We rely on realtime UI to process inningsEnded/matchEnded via state.
  // Returning false allows the component to just "fire and forget".
  return { inningsEnded: false, matchEnded: false };
}

/* ═══════════════════════════════════════════════════
 *  START SECOND INNINGS
 * ═══════════════════════════════════════════════════ */

export async function startSecondInnings(
  matchId: string,
  openingStrikerId: string,
  openingNonStrikerId: string,
  openingBowlerId: string
) {
  const { error } = await withTimeout(
    (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ error: PostgrestError | null }>)("rpc_start_second_innings", {
      p_match_id: matchId,
      p_opening_striker_id: openingStrikerId,
      p_opening_non_striker_id: openingNonStrikerId,
      p_opening_bowler_id: openingBowlerId,
    })
  );

  if (error) {
    console.error("rpc_start_second_innings error:", error);
    throw new Error(error.message);
  }

  return { success: true };
}

/* ═══════════════════════════════════════════════════
 *  UNDO LAST BALL
 * ═══════════════════════════════════════════════════ */

export async function undoLastBall(matchId: string) {
  const { error } = await withTimeout(
    (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ error: PostgrestError | null }>)("rpc_undo_last_ball_atomic", {
      p_match_id: matchId,
    })
  );

  if (error) {
    console.error("rpc_undo_last_ball_atomic error:", error);
    throw new Error(error.message);
  }
}

/* ═══════════════════════════════════════════════════
 *  SET NEW BATTER (after wicket)
 * ═══════════════════════════════════════════════════ */

export async function setNewBatter(
  matchId: string,
  newBatterId: string,
  isStriker: boolean
) {
  const { error } = await withTimeout(
    (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ error: PostgrestError | null }>)("rpc_set_new_batter_atomic", {
      p_match_id: matchId,
      p_new_player_id: newBatterId,
      p_is_striker: isStriker,
    })
  );

  if (error) {
    console.error("rpc_set_new_batter_atomic error:", error);
    throw new Error(error.message);
  }
}

/* ═══════════════════════════════════════════════════
 *  SET NEW BOWLER (start of over)
 * ═══════════════════════════════════════════════════ */

export async function setNewBowler(matchId: string, bowlerId: string) {
  const { error } = await withTimeout(
    (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ error: PostgrestError | null }>)("rpc_set_new_bowler_atomic", {
      p_match_id: matchId,
      p_new_player_id: bowlerId,
    })
  );

  if (error) {
    console.error("rpc_set_new_bowler_atomic error:", error);
    throw new Error(error.message);
  }
}

