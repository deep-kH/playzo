// ============================================================================
// MVP API — Rewritten to query fb_player_tournament_stats directly (V5)
// ============================================================================

import { supabase } from "@/lib/supabase/client";
import type { PlayerTournamentStats } from "./types";

export interface MvpRanking extends PlayerTournamentStats {
  team_name?: string;
}

// ── Get full MVP leaderboard ──
export async function getTournamentFootballMvp(tournamentId: string): Promise<MvpRanking[]> {
  const { data, error } = await supabase
    .from("fb_player_tournament_stats")
    .select(`
      *,
      team:teams!team_id(name)
    `)
    .eq("tournament_id", tournamentId)
    .order("rating_score", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    ...row,
    team_name: row.team?.name || "",
  }));
}

// ── Get Golden Boot (most goals) ──
export async function getGoldenBoot(tournamentId: string) {
  const { data, error } = await supabase
    .from("fb_player_tournament_stats")
    .select("*, team:teams!team_id(name)")
    .eq("tournament_id", tournamentId)
    .order("goals", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] || null;
}

// ── Get Golden Gloves (most saves + clean sheets) ──
export async function getGoldenGloves(tournamentId: string) {
  const { data, error } = await supabase
    .from("fb_player_tournament_stats")
    .select("*, team:teams!team_id(name)")
    .eq("tournament_id", tournamentId)
    .order("saves", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  // Re-rank by saves + clean_sheets
  const ranked = (data || []).sort((a: any, b: any) =>
    (b.saves + b.clean_sheets) - (a.saves + a.clean_sheets)
  );
  return ranked[0] || null;
}

// ── Get Best Defender (most blocks + interceptions) ──
export async function getBestDefender(tournamentId: string) {
  const { data, error } = await supabase
    .from("fb_player_tournament_stats")
    .select("*, team:teams!team_id(name)")
    .eq("tournament_id", tournamentId)
    .order("blocks", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  const ranked = (data || []).sort((a: any, b: any) =>
    (b.blocks + b.interceptions) - (a.blocks + a.interceptions)
  );
  return ranked[0] || null;
}
