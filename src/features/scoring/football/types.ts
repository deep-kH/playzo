// ============================================================================
// Football Scoring — Type Definitions (Rebuilt V5)
// ============================================================================

// ── Match Phases ──
export type FootballPhase =
  | 'not_started'
  | 'first_half'
  | 'half_time'
  | 'second_half'
  | 'full_time'
  | 'extra_time_first'
  | 'extra_time_half'
  | 'extra_time_second'
  | 'penalty_shootout'
  | 'ended';

export type FootballStatus = 'scheduled' | 'live' | 'halftime' | 'completed';

// ── Event Types ──
export const PRIMARY_EVENT_TYPES = [
  'goal', 'own_goal', 'shot_on_target', 'shot_off_target',
  'foul', 'yellow_card', 'red_card',
  'corner', 'goal_kick', 'throw_in', 'free_kick',
  'offside', 'substitution',
] as const;

export const MICRO_EVENT_TYPES = [
  'interception', 'block', 'clearance', 'dribble',
  'chance_created', 'save', 'tackle', 'possession_won',
] as const;

export const CONTROL_EVENT_TYPES = [
  'match_start', 'match_pause', 'match_resume',
  'half_time', 'second_half_start',
  'full_time', 'match_end',
  'extra_time_start', 'extra_time_half', 'extra_time_second_start',
  'extra_time_added',
  'penalty_shootout_start', 'penalty_goal', 'penalty_miss',
] as const;

export type PrimaryEventType = typeof PRIMARY_EVENT_TYPES[number];
export type MicroEventType = typeof MICRO_EVENT_TYPES[number];
export type ControlEventType = typeof CONTROL_EVENT_TYPES[number];
export type FootballEventType = PrimaryEventType | MicroEventType | ControlEventType;

// ── Team Stats ──
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
  saves: number;
}

export const EMPTY_TEAM_STATS: FootballTeamStats = {
  goals: 0, corners: 0, fouls: 0, yellow_cards: 0, red_cards: 0,
  offsides: 0, shots_on_target: 0, shots_off_target: 0,
  goal_kicks: 0, throw_ins: 0, free_kicks: 0, saves: 0,
};

// ── Player Stats (per-player in JSONB state) ──
export interface PlayerMatchStats {
  goals: number;
  assists: number;
  shots_on: number;
  shots_off: number;
  fouls_committed: number;
  fouls_drawn: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  blocks: number;
  interceptions: number;
  clearances: number;
  dribbles: number;
  chances_created: number;
  team: string;
}

// ── Match Event (timeline item in JSONB state) ──
export interface FootballMatchEvent {
  id: string;
  type: string;
  team: string;
  player_id: string;
  player_name: string;
  photo_url?: string;
  assist_player_id?: string;
  assist_name?: string;
  fouled_player_id?: string;
  fouled_player_name?: string;
  opposing_gk_id?: string;
  sub_in_id?: string;        // substitution: player coming IN
  sub_in_name?: string;
  sub_out_name?: string;
  match_time_seconds: number;
  half: string;
  restart?: string;
  card?: string;
  details: string;
  created_at: string;
}

// ── Penalty Kick ──
export interface PenaltyKick {
  team: string;
  player_id: string;
  player_name: string;
  photo_url?: string;
  scored: boolean;
  order: number;
}

// ── Match State (stored in ls_match_state.state JSONB) ──
export interface FootballMatchState {
  phase: FootballPhase;
  status: FootballStatus;
  clock_running: boolean;
  elapsed_seconds: number;
  last_clock_start_time: string | null;
  added_extra_time_minutes: number;
  extra_time_duration_minutes?: number;
  team_a_stats: FootballTeamStats;
  team_b_stats: FootballTeamStats;
  player_stats: Record<string, PlayerMatchStats>;
  events: FootballMatchEvent[];
  penalties: PenaltyKick[];
  last_event_text?: string;
}

export const INITIAL_FOOTBALL_STATE: FootballMatchState = {
  phase: 'not_started',
  status: 'scheduled',
  clock_running: false,
  elapsed_seconds: 0,
  last_clock_start_time: null,
  added_extra_time_minutes: 0,
  team_a_stats: { ...EMPTY_TEAM_STATS },
  team_b_stats: { ...EMPTY_TEAM_STATS },
  player_stats: {},
  events: [],
  penalties: [],
};

// ── Player Tournament Stats (from fb_player_tournament_stats table) ──
export interface PlayerTournamentStats {
  id: string;
  tournament_id: string;
  player_id: string;
  team_id: string;
  player_name: string;
  matches_played: number;
  goals: number;
  assists: number;
  shots_on: number;
  shots_off: number;
  fouls: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  blocks: number;
  interceptions: number;
  clearances: number;
  dribbles: number;
  chances_created: number;
  clean_sheets: number;
  rating_score: number;
}

// ── Helpers ──
export function isPrimaryEvent(type: string): boolean {
  return (PRIMARY_EVENT_TYPES as readonly string[]).includes(type);
}

export function isMicroEvent(type: string): boolean {
  return (MICRO_EVENT_TYPES as readonly string[]).includes(type);
}

export function getPhaseLabel(phase: FootballPhase): string {
  const labels: Record<FootballPhase, string> = {
    not_started: 'Not Started',
    first_half: '1st Half',
    half_time: 'Half Time',
    second_half: '2nd Half',
    full_time: 'Full Time',
    extra_time_first: 'Extra Time 1st',
    extra_time_half: 'ET Half Time',
    extra_time_second: 'Extra Time 2nd',
    penalty_shootout: 'Penalties',
    ended: 'Ended',
  };
  return labels[phase] || phase;
}

export function getEventIcon(type: string): string {
  const icons: Record<string, string> = {
    goal: '⚽', own_goal: '🔴⚽', shot_on_target: '🎯',
    shot_off_target: '💨', foul: '🚨', yellow_card: '🟨',
    red_card: '🟥', corner: '📐', goal_kick: '🥅',
    throw_in: '↗️', free_kick: '🔵', offside: '🚩',
    substitution: '🔄', interception: '🛡️', block: '🧱',
    clearance: '🧹', dribble: '⚡', chance_created: '✨',
    save: '🧤', tackle: '💪', possession_won: '🏆',
    penalty_goal: '⚽✅', penalty_miss: '❌',
  };
  return icons[type] || '📋';
}

/** Normalize legacy event types to current names */
export function normalizeFootballEventType(type: string): string {
  const map: Record<string, string> = {
    'penalty_goal_shootout': 'penalty_goal',
    'penalty_miss_shootout': 'penalty_miss',
  };
  return map[type] || type;
}
