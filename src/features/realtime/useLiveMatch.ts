/**
 * Unified realtime hook for match state.
 * 
 * - Fetches initial match details and state from ls_match_state
 * - Subscribes to realtime JSONB state updates
 * - Returns consolidated state with match metadata
 * 
 * Used by all sport scorers (cricket, football, badminton).
 */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getMatchDetails, getMatchState } from "@/features/scoring/api";

interface UseLiveMatchOptions<T> {
  matchId: string;
  initialState: T;
}

interface UseLiveMatchReturn<T> {
  state: T;
  match: any;
  teamAName: string;
  teamBName: string;
  loading: boolean;
  error: string | null;
}

export function useLiveMatch<T>({ matchId, initialState }: UseLiveMatchOptions<T>): UseLiveMatchReturn<T> {
  const [state, setState] = useState<T>(initialState);
  const [match, setMatch] = useState<any>(null);
  const [teamAName, setTeamAName] = useState("TEAM A");
  const [teamBName, setTeamBName] = useState("TEAM B");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    if (!matchId || matchId === "undefined") {
      setError("No match ID provided.");
      setLoading(false);
      return;
    }
    async function init() {
      try {
        const m: any = await getMatchDetails(matchId);
        if (!m) {
          if (isMounted) {
            setError("Match not found.");
            setLoading(false);
          }
          return;
        }
        if (isMounted) {
          setMatch(m);
          if (m?.team_a?.name) setTeamAName(m.team_a.name);
          if (m?.team_b?.name) setTeamBName(m.team_b.name);
        }

        const lsState: any = await getMatchState(matchId);
        if (isMounted && lsState?.state) {
          setState(lsState.state as T);
        }
        // If no state row exists, keep initialState — match hasn't started yet
      } catch (err: any) {
        console.error("Match init failed:", err);
        if (isMounted) {
          setError(err?.message ?? "Failed to load match data.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    init();

    return () => {
      isMounted = false;
    };
  }, [matchId]);

  // Realtime subscription
  useEffect(() => {
    if (!matchId || matchId === "undefined") return;
    const channel = supabase
      .channel(`live:ls_match_state:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",  // Listen to INSERT + UPDATE
          schema: "public",
          table: "ls_match_state",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const newRow = payload.new as Record<string, unknown> | undefined;
          if (newRow?.state) {
            setState(newRow.state as T);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  return { state, match, teamAName, teamBName, loading, error };
}
