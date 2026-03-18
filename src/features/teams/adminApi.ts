import { supabase } from "@/lib/supabase/client";
import type { SportType, Team } from "@/lib/types/database";

export async function listTeamsAdmin(): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Team[]) ?? [];
}

export async function createTeamAdmin(input: {
  name: string;
  sport: SportType;
}): Promise<void> {
  const { error } = await supabase.from("teams").insert({
    name: input.name,
    sport: input.sport,
    auction_id: null,
    manager: "",
    purse_remaining: 0,
    slots_remaining: 0,
  } as never);
  if (error) throw new Error(error.message);
}

export async function updateTeamAdmin(input: {
  id: string;
  name: string;
  sport: SportType;
}): Promise<void> {
  const { error } = await supabase
    .from("teams")
    .update({ name: input.name, sport: input.sport } as never)
    .eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function deleteTeamAdmin(id: string): Promise<void> {
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
