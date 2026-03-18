/**
 * Generic realtime hook for sport-specific JSONB state.
 *
 * Subscribes to `ls_match_state` updates and extracts the `state` JSONB column.
 * Each sport scorer page can use this instead of importing supabase directly.
 */
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getMatchDetails, getMatchState } from "@/features/scoring/api";

interface UseLiveStateOptions<T> {
  matchId: string;
  initialState: T;
}

interface UseLiveStateReturn<T> {
  state: T;
  match: any;
  teamAName: string;
  teamBName: string;
  loading: boolean;
  error: string | null;
}

export function useLiveState<T>({ matchId, initialState }: UseLiveStateOptions<T>): UseLiveStateReturn<T> {
  const [state, setState] = useState<T>(initialState);
  const [match, setMatch] = useState<any>(null);
  const [teamAName, setTeamAName] = useState("TEAM A");
  const [teamBName, setTeamBName] = useState("TEAM B");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    if (!matchId || matchId === "undefined") {
      setError("No match ID provided.");
      setLoading(false);
      return;
    }
    async function init() {
      try {
        const m: any = await getMatchDetails(matchId);
        if (!m) {
          setError("Match not found.");
          setLoading(false);
          return;
        }
        setMatch(m);
        if (m?.team_a?.name) setTeamAName(m.team_a.name);
        if (m?.team_b?.name) setTeamBName(m.team_b.name);

        const lsState: any = await getMatchState(matchId);
        if (lsState?.state) {
          setState(lsState.state as T);
        }
        // If no state row exists, keep initialState — match hasn't started yet
      } catch (err: any) {
        console.error("Match init failed:", err);
        setError(err?.message ?? "Failed to load match data.");
      } finally {
        setLoading(false);
      }
    }
    init();
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
