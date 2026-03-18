import { supabase } from "@/lib/supabase/client";

export interface DashboardStats {
  tournaments: number;
  teams: number;
  players: number;
  liveMatches: number;
}

export async function getAdminDashboardStats(): Promise<DashboardStats> {
  const [tournamentsRes, teamsRes, playersRes, matchesRes] = await Promise.all([
    supabase
      .from("ls_tournaments")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("teams")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("players")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("ls_matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "live"),
  ]);

  return {
    tournaments: tournamentsRes.count ?? 0,
    teams: teamsRes.count ?? 0,
    players: playersRes.count ?? 0,
    liveMatches: matchesRes.count ?? 0,
  };
}
