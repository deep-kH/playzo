"use client";

import { useEffect, useState, useCallback } from "react";
import type { Match, Team } from "@/lib/types/database";
import { MatchCard } from "@/components/common/MatchCard";
import { listLiveMatches } from "@/features/matches/api";
import { getTeamsByIds } from "@/features/teams/api";
import { useMatchListRealtime } from "@/features/matches/hooks";

export default function LivePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const matchData = await listLiveMatches();
    setMatches(matchData);

    const teamIds = new Set<string>();
    matchData.forEach((m) => {
      teamIds.add(m.team_a_id);
      teamIds.add(m.team_b_id);
    });

    if (teamIds.size > 0) {
      const teamsData = await getTeamsByIds(Array.from(teamIds));
      const map: Record<string, Team> = {};
      ((teamsData as Team[]) ?? []).forEach((t) => {
        map[t.id] = t;
      });
      setTeams(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime: re-fetch on any match change
  useMatchListRealtime(fetchData);

  return (
    <div className="container-app py-8 md:py-12">
      <h1 className="text-2xl md:text-3xl font-bold text-text mb-2 flex items-center gap-2">
        🔴 Live Matches
      </h1>
      <p className="text-text-muted mb-8">
        Watch matches happening right now. Updates appear in real time.
      </p>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map((i) => (
            <div key={i} className="card space-y-3">
              <div className="skeleton h-5 w-full" />
              <div className="skeleton h-12 w-full" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📺</div>
          <h2 className="text-xl font-semibold text-text mb-2">
            No Live Matches
          </h2>
          <p className="text-text-muted max-w-sm mx-auto">
            There are no matches happening right now. Check back when a match is
            in progress.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              teamA={teams[m.team_a_id]}
              teamB={teams[m.team_b_id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
