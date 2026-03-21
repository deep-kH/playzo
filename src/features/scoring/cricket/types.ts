/* ─────────────────────────────────────────────────
 *  Cricket Scoring — Domain Types
 * ───────────────────────────────────────────────── */

import type {
  WicketType,
  ExtraType,
  Player,
  BattingStats,
  BowlingStats,
  MatchState,
  Innings,
  Ball,
  Match,
  Team,
} from "@/lib/types/database";

/* ── Input sent from the admin scorer UI ──────── */

export interface BallInput {
  /** Runs scored off the bat (0–6) */
  runsBat: number;
  /** Extra runs (e.g. 1 for a wide, or wide + overthrow) */
  runsExtra: number;
  /** Type of extra if any */
  extraType: ExtraType | null;
  /** Is this a wicket delivery? */
  isWicket: boolean;
  /** Wicket type if isWicket */
  wicketType: WicketType | null;
  /** Player who was dismissed (usually striker, but run-out can be non-striker) */
  wicketPlayerId: string | null;
  /** Fielder involved */
  fielderId: string | null;
}

/* ── Snapshot of the live scoring state ────────── */

export interface ScoringState {
  match: Match;
  teamA: Team;
  teamB: Team;
  innings: Innings | null;
  matchState: MatchState | null;
  striker: Player | null;
  nonStriker: Player | null;
  currentBowler: Player | null;
  battingStats: BattingStats[];
  bowlingStats: BowlingStats[];
  recentBalls: Ball[];
  teamAPlayers: Player[];
  teamBPlayers: Player[];
  /** Players from batting team who haven't batted yet */
  availableBatters: Player[];
  /** Players from bowling team eligible to bowl */
  availableBowlers: Player[];
}

/* ── Over summary for timeline ────────────────── */

export interface OverBall {
  ballNumber: number;
  runsBat: number;
  runsExtra: number;
  extraType: ExtraType | null;
  isWicket: boolean;
  isLegal: boolean;
  label: string; // display label: "0", "1", "4", "6", "W", "Wd", "Nb"
}

/* ── Match setup input ────────────────────────── */

export interface MatchSetupInput {
  tossWinnerId: string;
  tossDecision: "bat" | "bowl";
  playingXI_A: string[];
  playingXI_B: string[];
  openingStrikerId: string;
  openingNonStrikerId: string;
  openingBowlerId: string;
}

/* ── Innings end reasons ──────────────────────── */

export type InningsEndReason = "all_out" | "overs_complete" | "target_reached" | "declared";

/* ── Live Match State (stored in ls_match_state.state jsonb) ──── */

export interface CricketMatchState {
  runs: number;
  wickets: number;
  overs: number;
  ballsInOver: number;
  striker: string | null;
  nonStriker: string | null;
  bowler: string | null;
  matchStatus: "scheduled" | "live" | "completed" | "paused";
  inningsStatus: "not_started" | "live" | "ended";
  currentInningsNumber: 1 | 2;
  target?: number | null;
  extras: number;
  lastEvent?: string | null;
}

export const DEFAULT_CRICKET_STATE: CricketMatchState = {
  runs: 0,
  wickets: 0,
  overs: 0,
  ballsInOver: 0,
  striker: null,
  nonStriker: null,
  bowler: null,
  matchStatus: "scheduled",
  inningsStatus: "not_started",
  currentInningsNumber: 1,
  target: null,
  extras: 0,
  lastEvent: null,
};

