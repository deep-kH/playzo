// src/app/admin/score/[matchId]/badminton/page.tsx
"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useLiveState } from "@/features/scoring/core/useLiveState";
import { BadmintonScorerController } from "@/features/scoring/badminton/components/BadmintonScorerController";
import { INITIAL_BADMINTON_STATE } from "@/features/scoring/badminton/types";
import type { BadmintonMatchState } from "@/features/scoring/badminton/types";

export default function BadmintonAdminScorer() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.matchId as string;

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
        <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl font-medium hover:bg-[var(--surface-alt)]">
          Retry
        </button>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-8">
        <div className="text-4xl">🏸</div>
        <h2 className="text-xl font-bold text-[var(--text)]">Match Not Found</h2>
        <p className="text-[var(--text-muted)] text-sm">This match does not exist.</p>
        <button onClick={() => router.push("/admin/tournaments")} className="mt-4 px-6 py-2 text-[var(--primary)] bg-[var(--primary)]/10 rounded-xl font-medium hover:bg-[var(--primary)]/20">
          Back to Tournaments
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-start justify-center p-4">
      <div className="w-full max-w-3xl pt-4">
        <div className="mb-6 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-sm font-semibold text-[var(--primary)] hover:underline">
            &larr; Back
          </button>
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Badminton Scorer Panel
          </div>
        </div>
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
