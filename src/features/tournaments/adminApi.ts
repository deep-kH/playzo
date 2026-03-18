import { supabase } from "@/lib/supabase/client";
import type { SportType, Team, Tournament, TournamentTeam } from "@/lib/types/database";

export async function listTournamentsAdmin(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from("ls_tournaments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Tournament[]) ?? [];
}

export async function createTournamentAdmin(input: {
  name: string;
  sport: SportType;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  settings: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase
    .from("ls_tournaments")
    .insert(input as never);
  if (error) throw new Error(error.message);
}

export async function deleteTournamentAdmin(id: string): Promise<void> {
  const { error } = await supabase.from("ls_tournaments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listTeamsBySportAdmin(sport: SportType): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("sport", sport)
    .order("name");
  if (error) throw new Error(error.message);
  return (data as Team[]) ?? [];
}

export async function listTournamentTeamIdsAdmin(
  tournamentId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("ls_tournament_teams")
    .select("team_id")
    .eq("tournament_id", tournamentId);
  if (error) throw new Error(error.message);
  return ((data as Pick<TournamentTeam, "team_id">[]) ?? []).map((tt) => tt.team_id);
}

export async function addTeamToTournamentAdmin(input: {
  tournament_id: string;
  team_id: string;
}): Promise<void> {
  const { error } = await supabase
    .from("ls_tournament_teams")
    .insert(input as never);
  if (error) throw new Error(error.message);
}

export async function removeTeamFromTournamentAdmin(input: {
  tournament_id: string;
  team_id: string;
}): Promise<void> {
  const { error } = await supabase
    .from("ls_tournament_teams")
    .delete()
    .eq("tournament_id", input.tournament_id)
    .eq("team_id", input.team_id);
  if (error) throw new Error(error.message);
}
