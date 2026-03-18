/**
 * Realtime hook for subscribing to match list updates.
 * Used by the public /live page and tournament detail page.
 * Encapsulates the supabase realtime subscription so it doesn't leak into app/ pages.
 */
"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

type MatchUpdateCallback = (payload: Record<string, any>) => void;

/**
 * Subscribe to all ls_matches changes (for the live page).
 */
export function useMatchListRealtime(onUpdate: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel("live-matches-list")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ls_matches",
        },
        () => {
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}

/**
 * Subscribe to ls_matches changes for a specific tournament.
 */
export function useTournamentMatchRealtime(
  tournamentId: string,
  onMatchUpdate: MatchUpdateCallback
) {
  useEffect(() => {
    if (!tournamentId) return;
    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ls_matches",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          onMatchUpdate(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, onMatchUpdate]);
}
