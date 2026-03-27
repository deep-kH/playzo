import { supabase } from "@/lib/supabase/client";
import type {
  BattingStats,
  BowlingStats,
  Innings,
  Match,
  MatchState,
  Player,
  Team,
} from "@/lib/types/database";
import { CricketMatchState, DEFAULT_CRICKET_STATE } from "./types";

export function buildCricketState(m: Match | null, ms: MatchState | null, inn: Innings | null): CricketMatchState {
  return {
    ...DEFAULT_CRICKET_STATE,
    matchStatus: (m?.status as "scheduled" | "live" | "completed" | "paused") ?? "scheduled",
    inningsStatus: inn?.status === "completed" ? "ended" : (inn?.status === "in_progress" ? "live" : "not_started"),
    currentInningsNumber: (inn?.innings_number as 1 | 2) ?? 1,
    target: ms?.target_score ?? undefined,
    striker: ms?.striker_id ?? null,
    nonStriker: ms?.non_striker_id ?? null,
    bowler: ms?.current_bowler_id ?? null,
    runs: ms?.score_runs ?? 0,
    wickets: ms?.score_wickets ?? 0,
    overs: ms?.score_overs ?? 0,
    extras: ms?.score_extras ?? 0,
    ballsInOver: ms?.current_ball ?? 0,
    lastEvent: ms?.last_event ?? undefined,
  };
}

export async function getMatchById(matchId: string): Promise<Match | null> {
  const { data, error } = await supabase
    .from("ls_matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Match | null) ?? null;
}

export async function getTeamsForMatch(match: Match): Promise<{
  teamA: Team | null;
  teamB: Team | null;
}> {
  const [aR, bR] = await Promise.all([
    supabase.from("teams").select("*").eq("id", match.team_a_id).maybeSingle(),
    supabase.from("teams").select("*").eq("id", match.team_b_id).maybeSingle(),
  ]);
  if (aR.error) throw new Error(aR.error.message);
  if (bR.error) throw new Error(bR.error.message);
  return {
    teamA: (aR.data as Team | null) ?? null,
    teamB: (bR.data as Team | null) ?? null,
  };
}

export async function listPlayersForMatch(match: Match): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .in("team_id", [match.team_a_id, match.team_b_id]);
  if (error) throw new Error(error.message);
  return (data as Player[]) ?? [];
}

export async function getMatchStateByMatchId(
  matchId: string
): Promise<MatchState | null> {
  const { data, error } = await supabase
    .from("ls_match_state")
    .select("*")
    .eq("match_id", matchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MatchState | null) ?? null;
}

export async function getInningsById(inningsId: string): Promise<Innings | null> {
  const { data, error } = await supabase
    .from("ls_innings")
    .select("*")
    .eq("id", inningsId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Innings | null) ?? null;
}

export async function listInningsByMatchId(matchId: string): Promise<Innings[]> {
  const { data, error } = await supabase
    .from("ls_innings")
    .select("*")
    .eq("match_id", matchId)
    .order("innings_number");
  if (error) throw new Error(error.message);
  return (data as Innings[]) ?? [];
}

export async function getInningsByMatchAndNumber(
  matchId: string,
  inningsNumber: 1 | 2
): Promise<Innings | null> {
  const { data, error } = await supabase
    .from("ls_innings")
    .select("*")
    .eq("match_id", matchId)
    .eq("innings_number", inningsNumber)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Innings | null) ?? null;
}

export async function listBattingStatsByInningsId(
  inningsId: string
): Promise<BattingStats[]> {
  const { data, error } = await supabase
    .from("ls_batting_stats")
    .select("*")
    .eq("innings_id", inningsId);
  if (error) throw new Error(error.message);
  return (data as BattingStats[]) ?? [];
}

export async function listBowlingStatsByInningsId(
  inningsId: string
): Promise<BowlingStats[]> {
  const { data, error } = await supabase
    .from("ls_bowling_stats")
    .select("*")
    .eq("innings_id", inningsId);
  if (error) throw new Error(error.message);
  return (data as BowlingStats[]) ?? [];
}

