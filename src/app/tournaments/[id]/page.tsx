"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import type { Tournament, Match, Team } from "@/lib/types/database";
import { MatchCard } from "@/components/common/MatchCard";
import { getTournamentById } from "@/features/tournaments/api";
import { listMatchesByTournamentId } from "@/features/matches/api";
import { getTeamsByIds } from "@/features/teams/api";
import { useTournamentMatchRealtime } from "@/features/matches/hooks";

export default function TournamentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const [t, matchData] = await Promise.all([
        getTournamentById(id),
        listMatchesByTournamentId(id),
      ]);

      setTournament(t as Tournament | null);
      setMatches(matchData);

      // Fetch all teams referenced in matches
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
    }
    fetch();
  }, [id]);

  // Realtime: subscribe to tournament match updates
  const handleMatchUpdate = useCallback((payload: Record<string, any>) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.id === payload.id ? { ...m, ...payload } : m
      )
    );
  }, []);
  useTournamentMatchRealtime(id, handleMatchUpdate);

  const live = matches.filter((m) => m.status === "live");
  const upcoming = matches.filter((m) => m.status === "scheduled");
  const completed = matches.filter((m) => m.status === "completed");

  if (loading) {
    return (
      <div className="container-app py-8">
        <div className="skeleton h-8 w-48 mb-2" />
        <div className="skeleton h-4 w-32 mb-8" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="card space-y-3">
              <div className="skeleton h-5 w-full" />
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="container-app py-16 text-center">
        <h1 className="text-2xl font-bold text-text">Tournament Not Found</h1>
      </div>
    );
  }

  const sportEmoji = tournament.sport === "cricket" ? "🏏" : tournament.sport === "football" ? "⚽" : "🏸";

  return (
    <div className="container-app py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-text flex items-center gap-2">
          {sportEmoji} {tournament.name}
        </h1>
        <p className="text-text-muted mt-1 capitalize">
          {tournament.sport}
          {tournament.location ? ` · ${tournament.location}` : ""}
        </p>
      </div>

      {matches.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📅</div>
          <h2 className="text-xl font-semibold text-text mb-2">No Matches Yet</h2>
          <p className="text-text-muted">Matches will appear here once scheduled.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {live.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-accent mb-4 flex items-center gap-2">
                🔴 Live Matches
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {live.map((m) => (
                  <MatchCard key={m.id} match={m} teamA={teams[m.team_a_id]} teamB={teams[m.team_b_id]} />
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-primary mb-4">Upcoming</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((m) => (
                  <MatchCard key={m.id} match={m} teamA={teams[m.team_a_id]} teamB={teams[m.team_b_id]} />
                ))}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-success mb-4">Completed</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completed.map((m) => (
                  <MatchCard key={m.id} match={m} teamA={teams[m.team_a_id]} teamB={teams[m.team_b_id]} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
