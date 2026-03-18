/* Scoring core — constants shared across all sport modules */

export const SPORTS = ["cricket", "football", "badminton"] as const;

/** Default match settings per sport */
export const DEFAULT_SETTINGS: Record<string, Record<string, unknown>> = {
  cricket: {
    overs: 20,
    players_per_team: 11,
    max_overs_per_bowler: 4,
  },
  football: {
    period_duration_minutes: 45,
    periods: 2,
    extra_time_enabled: true,
  },
  badminton: {
    games_to_win: 2,
    points_per_game: 21,
    deuce_enabled: true,
    max_points: 30,
  },
};
