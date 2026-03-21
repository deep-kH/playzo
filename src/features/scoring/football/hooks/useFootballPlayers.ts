// src/features/scoring/football/hooks/useFootballPlayers.ts
import { useState, useEffect } from "react";
import type { Player } from "@/lib/types/database";
import { fetchPlayersForTeam } from "@/features/players/api";

export function useFootballPlayers(teamAId?: string, teamBId?: string) {
  const [teamAPlayers, setTeamAPlayers] = useState<Player[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const [a, b] = await Promise.all([
          teamAId ? fetchPlayersForTeam(teamAId) : Promise.resolve([]),
          teamBId ? fetchPlayersForTeam(teamBId) : Promise.resolve([]),
        ]);
        if (isMounted) {
          setTeamAPlayers(a);
          setTeamBPlayers(b);
        }
      } catch (err) {
        console.error("Failed to fetch football players:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    
    if (teamAId || teamBId) {
      load();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [teamAId, teamBId]);

  return { teamAPlayers, teamBPlayers, loading };
}
