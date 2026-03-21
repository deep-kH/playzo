import { supabase } from "@/lib/supabase/client";
import type { Match } from "@/lib/types/database";

export async function listMatchesByTournamentId(
  tournamentId: string
): Promise<Match[]> {
  const { data, error } = await supabase
    .from("ls_matches")
    .select("*, ls_tournaments ( sport )")
    .eq("tournament_id", tournamentId)
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as Match[]) ?? [];
}

export async function listLiveMatches(): Promise<Match[]> {
  const { data, error } = await supabase
    .from("ls_matches")
    .select("*, ls_tournaments ( sport )")
    .eq("status", "live")
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as Match[]) ?? [];
}

export async function createMatch(input: {
  tournament_id: string;
  team_a_id?: string | null;
  team_b_id?: string | null;
  start_time: string | null;
  venue: string | null;
  settings: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase
    .from("ls_matches")
    .insert(input as never);
  if (error) throw new Error(error.message);
}

export async function updateMatchStatus(
  matchId: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from("ls_matches")
    .update({ status } as never)
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

export async function deleteMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from("ls_matches").delete().eq("id", matchId);
  if (error) throw new Error(error.message);
}
