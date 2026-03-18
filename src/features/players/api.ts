import { supabase } from "@/lib/supabase/client";
import type { Player } from "@/lib/types/database";

export async function fetchPlayersForTeam(teamId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .or(`team_id.eq.${teamId},sold_team_id.eq.${teamId}`)
    .order("name");

  if (error) throw new Error(error.message);
  return (data as Player[]) ?? [];
}

