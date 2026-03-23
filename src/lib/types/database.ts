/* ─────────────────────────────────────────────────
 *  LiveScore Platform — Database Type Definitions
 *  Covers both reused auction tables and new ls_* tables
 * ───────────────────────────────────────────────── */

/* ── Enums ────────────────────────────────────── */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SportType = "cricket" | "football" | "badminton";
export type MatchStatus = "scheduled" | "live" | "completed" | "cancelled";
export type TournamentStatus = "upcoming" | "active" | "completed" | "cancelled";
export type InningsStatus = "not_started" | "in_progress" | "completed";
export type WicketType =
  | "bowled"
  | "caught"
  | "lbw"
  | "run_out"
  | "stumped"
  | "hit_wicket"
  | "obstructing_field"
  | "retired_hurt"
  | "timed_out";
export type PlayerRole = "batter" | "bowler" | "all-rounder" | "wicket-keeper";
export type ExtraType = "wide" | "no_ball" | "bye" | "leg_bye" | "penalty";

/* ── Reused Tables (from auction) ──────────────── */

export interface Profile {
  id: string;
  email: string;
  role: "admin" | "viewer";
  created_at: string;
}

export interface Team {
  id: string;
  auction_id: string | null;
  name: string;
  manager: string | null;
  purse_remaining: number;
  slots_remaining: number;
  captain_id: string | null;
  logo_url: string | null;
  sport: SportType | null;
  created_at: string;
}

export interface Player {
  id: string;
  auction_id: string | null;
  name: string;
  role: string;
  status: string;
  sold_price: number | null;
  team_id: string | null;
  jersey_number: number | null;
  photo_url: string | null;
  is_blind_bid: boolean;
  created_at: string;
}

/* ── New LiveScore Tables ─────────────────────── */

export interface Tournament {
  id: string;
  name: string;
  sport: SportType;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  status: TournamentStatus;
  settings: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TournamentTeam {
  id: string;
  tournament_id: string;
  team_id: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  team_a_id: string;
  team_b_id: string;
  status: MatchStatus;
  start_time: string | null;
  venue: string | null;
  settings: Record<string, unknown>;
  result: MatchResult | null;
  toss: TossResult | null;
  playing_xi: PlayingXI | null;
  created_at: string;
  updated_at: string;
}

export interface MatchResult {
  winner_id: string;
  summary: string;
  margin: string;
}

export interface TossResult {
  winner_id: string;
  decision: "bat" | "bowl";
}

export interface PlayingXI {
  team_a: string[];
  team_b: string[];
}

/* ── Cricket Scoring (Phase 2 — types ready) ──── */

export interface Innings {
  id: string;
  match_id: string;
  innings_number: 1 | 2;
  batting_team_id: string;
  bowling_team_id: string;
  total_runs: number;
  total_wickets: number;
  total_overs: number;
  total_extras: number;
  status: InningsStatus;
  created_at: string;
}

export interface Ball {
  id: string;
  innings_id: string;
  over_number: number;
  ball_number: number;
  sequence: number;
  batter_id: string;
  non_striker_id: string;
  bowler_id: string;
  runs_bat: number;
  runs_extra: number;
  extra_type: ExtraType | null;
  is_wicket: boolean;
  wicket_type: WicketType | null;
  wicket_player_id: string | null;
  fielder_id: string | null;
  is_legal: boolean;
  created_at: string;
}

export interface BattingStats {
  id: string;
  innings_id: string;
  player_id: string;
  runs: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  is_out: boolean;
  dismissal_type: WicketType | null;
  dismissal_bowler_id: string | null;
  dismissal_fielder_id: string | null;
  batting_position: number | null;
}

export interface BowlingStats {
  id: string;
  innings_id: string;
  player_id: string;
  overs: number;
  maidens: number;
  runs_conceded: number;
  wickets: number;
  wides: number;
  no_balls: number;
  dot_balls: number;
}

export interface MatchState {
  id: string;
  match_id: string;
  current_innings_id: string | null;
  striker_id: string | null;
  non_striker_id: string | null;
  current_bowler_id: string | null;
  current_over: number;
  current_ball: number;
  partnership_runs: number;
  partnership_balls: number;
  last_ball_id: string | null;
  updated_at: string;
  score_runs: number;
  score_wickets: number;
  score_overs: number;
  score_extras: number;
  balls_this_over: Ball[];
  striker_snapshot: BattingStats | null;
  non_striker_snapshot: BattingStats | null;
  bowler_snapshot: BowlingStats | null;
  last_event: string | null;
  target_score: number | null;
  state: Record<string, unknown> | null;
  is_paused: boolean;
}

export interface Event {
  id: number;
  match_id: string;
  sport: SportType;
  type: string;
  payload: Json;
  created_at: string;
}

/* ── Helper: allow optional fields on insert and update ── */
type TableDef<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: any[];
};

/* ── Supabase Database type for client generic ── */

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<Profile>;
      teams: TableDef<Team>;
      players: TableDef<Player>;
      ls_tournaments: TableDef<Tournament>;
      ls_tournament_teams: TableDef<TournamentTeam>;
      ls_matches: TableDef<Match>;
      ls_innings: TableDef<Innings>;
      ls_balls: TableDef<Ball>;
      ls_batting_stats: TableDef<BattingStats>;
      ls_bowling_stats: TableDef<BowlingStats>;
      ls_match_state: TableDef<MatchState>;
      ls_events: TableDef<Event>;
    };
    Views: Record<string, never>;
    Functions: {
      rpc_setup_match: {
        Args: {
          p_match_id: string;
          p_toss_winner_id: string;
          p_toss_decision: string;
          p_playing_xi_a: string[];
          p_playing_xi_b: string[];
          p_opening_striker_id: string;
          p_opening_non_striker_id: string;
          p_opening_bowler_id: string;
        };
        Returns: void;
      };
      rpc_process_ball_atomic: {
        Args: {
          p_match_id: string;
          p_runs_bat: number;
          p_runs_extra: number;
          p_extra_type: string | null;
          p_is_wicket: boolean;
          p_wicket_type: string | null;
          p_wicket_player_id: string | null;
          p_fielder_id: string | null;
        };
        Returns: void;
      };
      rpc_start_second_innings: {
        Args: {
          p_match_id: string;
          p_opening_striker_id: string;
          p_opening_non_striker_id: string;
          p_opening_bowler_id: string;
        };
        Returns: void;
      };
      rpc_undo_last_ball_atomic: {
        Args: {
          p_match_id: string;
        };
        Returns: void;
      };
      rpc_set_new_batter_atomic: {
        Args: {
          p_match_id: string;
          p_new_player_id: string;
          p_is_striker: boolean;
        };
        Returns: void;
      };
      rpc_set_new_bowler_atomic: {
        Args: {
          p_match_id: string;
          p_new_player_id: string;
        };
        Returns: void;
      };
      rpc_process_event: {
        Args: {
          p_match_id: string;
          p_type: string;
          p_payload: Json;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

