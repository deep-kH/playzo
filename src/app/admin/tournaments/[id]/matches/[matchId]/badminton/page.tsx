// src/app/admin/tournaments/[id]/matches/[matchId]/badminton/page.tsx
"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useLiveState } from "@/features/scoring/core/useLiveState";
import { BadmintonScoreboard } from "@/features/scoring/badminton/components/BadmintonScoreboard";
import { BadmintonScorerController } from "@/features/scoring/badminton/components/BadmintonScorerController";
import { INITIAL_BADMINTON_STATE } from "@/features/scoring/badminton/types";
import type { BadmintonMatchState } from "@/features/scoring/badminton/types";

export default function BadmintonScorerPage() {
  const params = useParams<{ id: string; matchId: string }>();
  const matchId = params.matchId;

  const { state, match, teamAName, teamBName, loading } = useLiveState<BadmintonMatchState>({
    matchId,
    initialState: INITIAL_BADMINTON_STATE,
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4">
        <div className="w-[80%] h-40 bg-surface-alt animate-pulse rounded-2xl" />
        <div className="w-[80%] h-72 bg-surface-alt animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-text">Badminton Scorer</h1>
        <p className="text-text-muted mt-1">
          {teamAName} vs {teamBName} &bull; Best of 3
        </p>
      </div>

      {/* Mini live scoreboard at top */}
      <BadmintonScoreboard state={state} teamAName={teamAName} teamBName={teamBName} />

      {/* Admin controller */}
      <div className="border border-border-ui rounded-2xl p-6 bg-surface shadow-sm">
        <BadmintonScorerController
          matchId={matchId}
          state={state}
          teamAName={teamAName}
          teamBName={teamBName}
        />
      </div>
    </div>
  );
}
