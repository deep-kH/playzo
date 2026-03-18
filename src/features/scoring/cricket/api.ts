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
    .or(
      `team_id.in.(${match.team_a_id},${match.team_b_id}),sold_team_id.in.(${match.team_a_id},${match.team_b_id})`
    );
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

