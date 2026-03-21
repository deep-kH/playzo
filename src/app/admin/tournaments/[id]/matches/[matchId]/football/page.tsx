"use client";

import { useParams } from "next/navigation";
import { useLiveMatch } from "@/features/realtime/useLiveMatch";
import { INITIAL_FOOTBALL_STATE } from "@/features/scoring/football/types";
import type { FootballMatchState } from "@/features/scoring/football/types";
import { useFootballPlayers } from "@/features/scoring/football/hooks/useFootballPlayers";
import { FootballScorerController } from "@/features/scoring/football/components/FootballScorerController";

export default function AdminTournamentFootballPage() {
  const params = useParams<{ id: string; matchId: string }>();
  const matchId = params?.matchId as string;

  const { state, match, teamAName, teamBName, loading, error } = useLiveMatch<FootballMatchState>({
    matchId,
    initialState: INITIAL_FOOTBALL_STATE,
  });

  const { teamAPlayers, teamBPlayers, loading: playersLoading } = useFootballPlayers(
    match?.team_a_id ?? undefined,
    match?.team_b_id ?? undefined
  );

  if (loading || playersLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--text-muted)]">
        Loading football scorer...
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--danger)]">
        {error ?? "Match not found"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <FootballScorerController
          match={match}
          state={state}
          teamAName={teamAName}
          teamBName={teamBName}
          teamAPlayers={teamAPlayers}
          teamBPlayers={teamBPlayers}
        />
      </div>
    </div>
  );
}
