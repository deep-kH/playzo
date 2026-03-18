// src/features/scoring/badminton/types.ts

export type BadmintonTeam = "team_a" | "team_b";
export type MatchType = "singles" | "doubles";
export type ServingSide = "right" | "left";

// --- Events ---
export type BadmintonEventType =
  | "match_start"
  | "point"           // Rally won by payload.team
  | "service_fault"   // Fault → point to opponent
  | "let"             // Rally replayed, no score change
  | "undo"            // Revert last rally (future)
  | "flip_positions"  // Manual swap doubles partners
  | "interval"        // Mid-game interval
  | "game_start"      // Signals start of next game
  | "match_end";      // Admin forcefully ends match

export interface BadmintonEventPayload {
  team?: BadmintonTeam;
  player_id?: string;
  match_type?: MatchType;
  first_server?: BadmintonTeam;
  games_to_win?: number;
  points_per_game?: number;
  note?: string;
}

// --- Per-game score ---
export interface GameScore {
  team_a: number;
  team_b: number;
}

// --- Doubles player positions ---
export interface DoublesPositions {
  team_a: { left: string; right: string };
  team_b: { left: string; right: string };
}

// --- Full Snapshot (matches DB format from rpc_process_badminton) ---
export interface BadmintonMatchState {
  match_type: MatchType;
  status: "scheduled" | "live" | "interval" | "completed";

  current_game: 1 | 2 | 3;

  // DB uses g1/g2/g3 object format
  scores: {
    g1: GameScore;
    g2: GameScore;
    g3: GameScore;
  };

  games_won: {
    team_a: number;
    team_b: number;
  };

  server: BadmintonTeam;
  server_player_id: string | null;
  serving_side: ServingSide;

  // Doubles positions (only for doubles)
  doubles_positions?: DoublesPositions | null;

  // Rally history for undo (client-side only for now)
  rally_history?: RallyEntry[];

  // UI helpers
  last_event_text?: string;
  last_point_flash?: BadmintonTeam | null;
}

export interface RallyEntry {
  winner: BadmintonTeam;
  score_before: GameScore;
  server_before: BadmintonTeam;
  serving_side_before: ServingSide;
  positions_before: DoublesPositions | null;
}

// --- Helpers ---
export function getServingSide(serverScore: number): ServingSide {
  return serverScore % 2 === 0 ? "right" : "left";
}

/** Get current game score */
export function getCurrentScore(state: BadmintonMatchState): GameScore {
  const key = `g${state.current_game}` as "g1" | "g2" | "g3";
  return state.scores[key] ?? { team_a: 0, team_b: 0 };
}

/** Get scores as array for iteration */
export function getScoresArray(state: BadmintonMatchState): GameScore[] {
  return [state.scores.g1, state.scores.g2, state.scores.g3];
}

// --- Constants ---
export const INITIAL_GAME_SCORE: GameScore = { team_a: 0, team_b: 0 };

export const INITIAL_BADMINTON_STATE: BadmintonMatchState = {
  match_type: "singles",
  status: "scheduled",
  current_game: 1,
  scores: {
    g1: { ...INITIAL_GAME_SCORE },
    g2: { ...INITIAL_GAME_SCORE },
    g3: { ...INITIAL_GAME_SCORE },
  },
  games_won: { team_a: 0, team_b: 0 },
  server: "team_a",
  server_player_id: null,
  serving_side: "right",
};
