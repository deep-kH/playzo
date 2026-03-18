import { supabase } from "@/lib/supabase/client";
import type { Tournament } from "@/lib/types/database";

export async function listTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from("ls_tournaments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as Tournament[]) ?? [];
}

export async function listActiveOrUpcomingTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from("ls_tournaments")
    .select("*")
    .in("status", ["active", "upcoming"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as Tournament[]) ?? [];
}

export async function getTournamentById(id: string): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from("ls_tournaments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as Tournament | null) ?? null;
}

export async function getTournamentTeams(tournamentId: string): Promise<{ team_id: string }[]> {
  const { data, error } = await supabase
    .from("ls_tournament_teams")
    .select("team_id")
    .eq("tournament_id", tournamentId);

  if (error) throw new Error(error.message);
  return data ?? [];
}

