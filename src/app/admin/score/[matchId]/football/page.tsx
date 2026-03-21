// src/app/admin/score/[matchId]/football/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useLiveMatch } from "@/features/realtime/useLiveMatch";
import { FootballScorerController } from "@/features/scoring/football/components/FootballScorerController";
import type { FootballMatchState } from "@/features/scoring/football/types";
import { INITIAL_FOOTBALL_STATE } from "@/features/scoring/football/types";
import { useFootballPlayers } from "@/features/scoring/football/hooks/useFootballPlayers";

export default function FootballAdminScorerPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params?.matchId as string;

  const { state, match, teamAName, teamBName, loading, error } =
    useLiveMatch<FootballMatchState>({
      matchId,
      initialState: INITIAL_FOOTBALL_STATE,
    });

  const { teamAPlayers, teamBPlayers, loading: playersLoading } = useFootballPlayers(
    match?.team_a_id ?? undefined,
    match?.team_b_id ?? undefined
  );

  if (loading || playersLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        <p className="text-[var(--text-muted)] text-sm">Loading match...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-8">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-bold text-[var(--text)]">Unable to Load Match</h2>
        <p className="text-[var(--text-muted)] text-sm max-w-sm text-center">{error}</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-8">
        <div className="text-4xl">⚽</div>
        <h2 className="text-xl font-bold text-[var(--text)]">Match Not Found</h2>
        <p className="text-[var(--text-muted)] text-sm">This match does not exist.</p>
      </div>
    );
  }

  // Team logos from joined data
  const teamALogo = (match as any)?.team_a?.logo_url || null;
  const teamBLogo = (match as any)?.team_b?.logo_url || null;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        {/* Copy Live Link */}
        <div className="flex justify-end">
          <button
            onClick={() => {
              const url = `${window.location.origin}/live/matches/${matchId}/football`;
              navigator.clipboard.writeText(url);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-alt)] active:scale-95 transition-all"
          >
            🔗 Copy Live Link
          </button>
        </div>

        <FootballScorerController
          match={match}
          state={state}
          teamAName={teamAName}
          teamBName={teamBName}
          teamAPlayers={teamAPlayers}
          teamBPlayers={teamBPlayers}
          teamALogo={teamALogo}
          teamBLogo={teamBLogo}
        />
      </div>
    </div>
  );
}
