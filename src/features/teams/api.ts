import { supabase } from "@/lib/supabase/client";
import type { Team } from "@/lib/types/database";

export async function getTeamsByIds(ids: string[]): Promise<Team[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("teams").select("*").in("id", ids);
  if (error) throw new Error(error.message);
  return (data as Team[]) ?? [];
}

