import { supabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/types/database";

export async function processGenericEvent(
  matchId: string,
  type: string,
  payload: Json
): Promise<void> {
  if (!matchId || matchId === "undefined") {
    throw new Error("processGenericEvent: missing matchId");
  }
  const { error } = await supabase.rpc("rpc_process_event", {
    p_match_id: matchId,
    p_type: type,
    p_payload: payload,
  } as never);

  if (error) {
    throw new Error(error.message);
  }
}
export async function getMatchDetails(matchId: string) {
  if (!matchId || matchId === "undefined") return null;
  const { data, error } = await supabase
    .from("ls_matches")
    .select(
      `
      *,
      team_a:teams!team_a_id(id, name, logo_url),
      team_b:teams!team_b_id(id, name, logo_url)
    `
    )
    .eq("id", matchId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getMatchState(matchId: string) {
  const { data, error } = await supabase
    .from("ls_match_state")
    .select("*")
    .eq("match_id", matchId)
    .single();

  if (error && error.code !== "PGRST116") {
    // Ignore no rows
    throw new Error(error.message);
  }
  return data;
}

export * from "./football/types";
export * from "./badminton/types";
