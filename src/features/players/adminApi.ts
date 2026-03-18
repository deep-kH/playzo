import { supabase } from "@/lib/supabase/client";
import type { Player, Team } from "@/lib/types/database";

export async function listPlayersAdmin(): Promise<Player[]> {
  const { data, error } = await supabase.from("players").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data as Player[]) ?? [];
}

export async function listTeamsForPlayersAdmin(): Promise<Team[]> {
  const { data, error } = await supabase.from("teams").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data as Team[]) ?? [];
}

export async function createPlayerAdmin(payload: {
  name: string;
  team_id: string | null;
  role: string;
  jersey_number: number | null;
}): Promise<void> {
  const { error } = await supabase.from("players").insert({
    name: payload.name,
    team_id: payload.team_id,
    role: payload.role,
    jersey_number: payload.jersey_number,
    status: "upcoming",
  } as never);
  if (error) throw new Error(error.message);
}

export async function updatePlayerAdmin(payload: {
  id: string;
  name: string;
  team_id: string | null;
  role: string;
  jersey_number: number | null;
}): Promise<void> {
  const { error } = await supabase
    .from("players")
    .update({
      name: payload.name,
      team_id: payload.team_id,
      role: payload.role,
      jersey_number: payload.jersey_number,
      status: "upcoming",
    } as never)
    .eq("id", payload.id);
  if (error) throw new Error(error.message);
}

export async function deletePlayerAdmin(id: string): Promise<void> {
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
