// src/app/admin/score/[matchId]/badminton/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useLiveMatch } from "@/features/realtime/useLiveMatch";
import { BadmintonScorerController } from "@/features/scoring/badminton/components/BadmintonScorerController";
import type { BadmintonMatchState } from "@/features/scoring/badminton/types";
import { INITIAL_BADMINTON_STATE } from "@/features/scoring/badminton/types";

interface PlayerInfo {
  id: string;
  name: string;
}

export default function BadmintonAdminScorerPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params?.matchId as string;

  const { state: lsState, match, teamAName, teamBName, loading, error } =
    useLiveMatch<BadmintonMatchState>({
      matchId,
      initialState: INITIAL_BADMINTON_STATE,
    });

  // Read player info from match.settings.badminton_players (set during match creation)
  const bmPlayers = (match?.settings as any)?.badminton_players;
  const bmMatchType = (match?.settings as any)?.match_type || "singles";
  const bmPointsPerSet = (match?.settings as any)?.points_per_set;
  const bmSetsToWin = (match?.settings as any)?.sets_to_win;
  const bmPointCap = (match?.settings as any)?.point_cap;
  
  // If the DB state is completely uninitialized (no events yet), override defaults
  // with the actual config from the match settings.
  const isUninitialized = !lsState.last_event_text;
  const state = { 
    ...lsState, 
    match_type: isUninitialized ? bmMatchType : lsState.match_type,
    ...(isUninitialized && bmPointsPerSet ? { points_per_set: bmPointsPerSet } : {}),
    ...(isUninitialized && bmSetsToWin ? { sets_to_win: bmSetsToWin } : {}),
    ...(isUninitialized && bmPointCap ? { point_cap: bmPointCap } : {}),
  } as BadmintonMatchState;
  const teamAPlayers: PlayerInfo[] = bmPlayers?.side_a ?? [];
  const teamBPlayers: PlayerInfo[] = bmPlayers?.side_b ?? [];

  if (loading) {
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
        <h2 className="text-xl font-bold text-[var(--text)]">
          Unable to Load Match
        </h2>
        <p className="text-[var(--text-muted)] text-sm max-w-sm text-center">
          {error}
        </p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-8">
        <div className="text-4xl">🏸</div>
        <h2 className="text-xl font-bold text-[var(--text)]">
          Match Not Found
        </h2>
        <p className="text-[var(--text-muted)] text-sm">
          This match does not exist.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-xl mx-auto p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">
            🏸 Badminton Scorer
          </h1>
        </div>

        <BadmintonScorerController
          matchId={matchId}
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
