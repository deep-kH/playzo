// src/features/scoring/football/types.ts

export type FootballTeam = "team_a" | "team_b";

// --- Match Phases (from docs/football.md) ---
export type MatchPhase =
  | "not_started"
  | "first_half"
  | "half_time"
  | "second_half"
  | "full_time"
  | "extra_time_first"
  | "extra_time_half"
  | "extra_time_second"
  | "penalty_shootout"
  | "ended";

// --- Events ---
export type FootballEventType =
  | "match_start"
  | "match_pause"
  | "match_resume"
  | "half_time"
  | "second_half_start"
  | "full_time"
  | "extra_time_start"
  | "extra_time_half"
  | "extra_time_second_start"
  | "penalty_shootout_start"
  | "match_end"
  | "extra_time_added"
  | "goal"
  | "penalty_goal"
  | "penalty_miss"
  | "own_goal"
  | "yellow_card"
  | "red_card"
  | "substitution"
  | "foul"
  | "corner"
  | "goal_kick"
  | "throw_in"
  | "offside"
  | "shot_on_target"
  | "shot_off_target"
  | "free_kick";

export interface FootballEventPayload {
  team?: FootballTeam;
  player_id?: string;
  player_name?: string;
  assist_player_id?: string;
  assist_player_name?: string;
  sub_out_player_id?: string;
  sub_in_player_id?: string;
  sub_out_name?: string;
  sub_in_name?: string;
  fouled_player_id?: string;
  fouled_player_name?: string;
  card?: "none" | "yellow" | "red";
  foul_outcome?: "free_kick" | "penalty" | "advantage";
  extra_minutes?: number;
  match_time_seconds?: number;
  notes?: string;
}

// --- Snapshot State ---

export interface FootballTeamStats {
  goals: number;
  corners: number;
  fouls: number;
  yellow_cards: number;
  red_cards: number;
  offsides: number;
  shots_on_target: number;
  shots_off_target: number;
  goal_kicks: number;
  throw_ins: number;
  free_kicks: number;
  possession_percentage?: number;
}

export interface FootballMatchEvent {
  id: string;
  type: FootballEventType;
  team?: FootballTeam;
  player_name?: string;
  assist_name?: string;
  match_time_seconds: number;
  stoppage_time_seconds?: number;
  details?: string;
  created_at: string;
}

export interface PenaltyKick {
  team: FootballTeam;
  player_id?: string;
  player_name?: string;
  scored: boolean;
  order: number;
}

export interface FootballMatchState {
  phase: MatchPhase;
  status: "scheduled" | "live" | "paused" | "completed";

  // Clock
  clock_running: boolean;
  elapsed_seconds: number;
  last_clock_start_time: string | null;
  added_extra_time_minutes: number;

  // Stats
  team_a_stats: FootballTeamStats;
  team_b_stats: FootballTeamStats;

  // Events timeline
  events: FootballMatchEvent[];

  // Penalty shootout
  penalties: PenaltyKick[];

  // UI tracking
  last_event_text?: string;
}

export const INITIAL_TEAM_STATS: FootballTeamStats = {
  goals: 0,
  corners: 0,
  fouls: 0,
  yellow_cards: 0,
  red_cards: 0,
  offsides: 0,
  shots_on_target: 0,
  shots_off_target: 0,
  goal_kicks: 0,
  throw_ins: 0,
  free_kicks: 0,
};

export const INITIAL_FOOTBALL_STATE: FootballMatchState = {
  phase: "not_started",
  status: "scheduled",
  clock_running: false,
  elapsed_seconds: 0,
  last_clock_start_time: null,
  added_extra_time_minutes: 0,
  team_a_stats: { ...INITIAL_TEAM_STATS },
  team_b_stats: { ...INITIAL_TEAM_STATS },
  events: [],
  penalties: [],
};

/** Map phase to human-readable label */
export function phaseLabel(phase: MatchPhase): string {
  switch (phase) {
    case "not_started":         return "NOT STARTED";
    case "first_half":          return "1ST HALF";
    case "half_time":           return "HALF TIME";
    case "second_half":         return "2ND HALF";
    case "full_time":           return "FULL TIME";
    case "extra_time_first":    return "EXTRA TIME (1ST)";
    case "extra_time_half":     return "ET HALF TIME";
    case "extra_time_second":   return "EXTRA TIME (2ND)";
    case "penalty_shootout":    return "PENALTY SHOOTOUT";
    case "ended":               return "MATCH ENDED";
  }
}
