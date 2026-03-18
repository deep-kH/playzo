// src/app/admin/tournaments/[id]/matches/[matchId]/football/page.tsx
"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useLiveState } from "@/features/scoring/core/useLiveState";
import { FootballScorerController } from "@/features/scoring/football/components/FootballScorerController";
import { FootballClock } from "@/features/scoring/football/components/FootballClock";
import { INITIAL_FOOTBALL_STATE } from "@/features/scoring/football/types";
import type { FootballMatchState } from "@/features/scoring/football/types";

export default function FootballScorerPage() {
  const params = useParams<{ id: string; matchId: string }>();
  const matchId = params.matchId;

  const { state, match, teamAName, teamBName, loading } = useLiveState<FootballMatchState>({
    matchId,
    initialState: INITIAL_FOOTBALL_STATE,
  });

  if (loading || !match) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-[80%] h-32 bg-surface-alt animate-pulse rounded-xl" />
        <div className="w-[80%] h-64 bg-surface-alt animate-pulse rounded-xl" />
      </div>
    );
  }

  const scoreA = state.team_a_stats.goals;
  const scoreB = state.team_b_stats.goals;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-text">Football Scorer</h1>
        <p className="text-text-muted mt-2">
          {teamAName} vs {teamBName}
        </p>
      </div>

      {/* Mini Scoreboard Head */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-surface p-6 rounded-xl shadow-lg border border-border-ui">
         <div className="flex-1 text-right text-2xl font-black text-text">{teamAName}</div>
         <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="text-4xl font-bold font-mono tracking-tighter mb-2 text-text">
              {scoreA} - {scoreB}
            </div>
            <FootballClock state={state} />
         </div>
         <div className="flex-1 text-left text-2xl font-black text-text">{teamBName}</div>
      </div>

      {/* Controller Actions Panel */}
      <FootballScorerController matchId={matchId} state={state} teamAName={teamAName} teamBName={teamBName} />
    </div>
  );
}
