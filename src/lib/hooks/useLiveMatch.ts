// Canonical useLiveMatch hook — single source of truth
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { MatchState } from "@/lib/types/database";

export function useLiveMatch(matchId: string | undefined, initialState: MatchState | null) {
  const [matchState, setMatchState] = useState<MatchState | null>(initialState);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;

    // Fetch current state first
    supabase
      .from("ls_match_state")
      .select("*")
      .eq("match_id", matchId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) {
          console.error("Failed to fetch match state:", err);
          setError(err.message);
        } else if (data) {
          setMatchState(data as MatchState);
        }
      });

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`live-match-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ls_match_state",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          if (payload.new) {
            setMatchState(payload.new as MatchState);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  return { matchState, setMatchState, isConnected, error };
}
