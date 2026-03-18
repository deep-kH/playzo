// src/app/live/matches/[id]/badminton/page.tsx
"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useLiveState } from "@/features/scoring/core/useLiveState";
import { BadmintonScoreboard } from "@/features/scoring/badminton/components/BadmintonScoreboard";
import { INITIAL_BADMINTON_STATE } from "@/features/scoring/badminton/types";
import type { BadmintonMatchState } from "@/features/scoring/badminton/types";

export default function BadmintonLiveViewer() {
  const params = useParams<{ id: string }>();
  const matchId = params.id;

  const { state, match, teamAName, teamBName, loading, error } = useLiveState<BadmintonMatchState>({
    matchId,
    initialState: INITIAL_BADMINTON_STATE,
  });

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
        <h2 className="text-xl font-bold text-[var(--text)]">Unable to Load Match</h2>
        <p className="text-[var(--text-muted)] text-sm max-w-sm text-center">{error}</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-8">
        <div className="text-4xl">🏸</div>
        <h2 className="text-xl font-bold text-[var(--text)]">Match Not Found</h2>
        <p className="text-[var(--text-muted)] text-sm">This match does not exist or has been removed.</p>
      </div>
    );
  }

  // Match exists but not started
  if (state.status === "scheduled") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-5xl">🏸</div>
          <h2 className="text-2xl font-bold text-[var(--text)]">{teamAName} vs {teamBName}</h2>
          <p className="text-[var(--text-muted)]">Match has not started yet. Please check back soon.</p>
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
            <div className="w-2 h-2 rounded-full bg-[var(--warning)] animate-pulse" />
            Waiting for first serve...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-start justify-center p-4 pt-10">
      <div className="w-full max-w-3xl">
        <BadmintonScoreboard
          state={state}
          teamAName={teamAName}
          teamBName={teamBName}
        />
      </div>
    </div>
  );
}
