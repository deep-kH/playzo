"use client";

import { useParams } from "next/navigation";
import { useLiveMatch } from "@/features/realtime/useLiveMatch";
import type { CricketMatchState } from "@/features/scoring/cricket/types";
import { DEFAULT_CRICKET_STATE } from "@/features/scoring/cricket/types";

export default function CricketLiveViewer() {
  const params = useParams<{ id: string }>();
  const matchId = params?.id as string;

  const { state, match, teamAName, teamBName, loading, error } = useLiveMatch<CricketMatchState>({
    matchId,
    initialState: DEFAULT_CRICKET_STATE,
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
        <div className="text-4xl">🏏</div>
        <h2 className="text-xl font-bold text-[var(--text)]">Match Not Found</h2>
        <p className="text-[var(--text-muted)] text-sm">This match does not exist.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Main Live Score */}
        <div className="card">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-[var(--text)]">{teamAName}</h2>
              <p className="text-3xl font-bold text-[var(--primary)]">{state.runs}/{state.wickets}</p>
              <p className="text-sm text-[var(--text-muted)]">{state.overs} overs</p>
            </div>
            <div className="my-4 md:my-0 text-center">
              <p className="text-sm text-[var(--text-muted)]">vs</p>
            </div>
            <div className="flex-1 text-right">
              <h2 className="text-lg font-semibold text-[var(--text)]">{teamBName}</h2>
              <p className={`text-2xl font-bold ${state.inningsStatus === 'live' ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
                {state.matchStatus === 'scheduled' ? '-' : 'TBD'}
              </p>
              <p className="text-sm text-[var(--text-muted)]">Standing by</p>
            </div>
          </div>
        </div>

        {/* Match Status */}
        <div className="card">
          <h3 className="font-semibold text-[var(--text)] mb-3">Match Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase">Status</p>
              <p className="font-semibold text-[var(--text)]">{state.matchStatus}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase">Innings</p>
              <p className="font-semibold text-[var(--text)]">{state.currentInningsNumber}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase">Striker</p>
              <p className="font-semibold text-[var(--text)]">{state.striker ? '🏏' : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase">Bowler</p>
              <p className="font-semibold text-[var(--text)]">{state.bowler ? '🎯' : '-'}</p>
            </div>
          </div>
        </div>

        {/* Event Display */}
        {state.lastEvent && (
          <div className="card bg-[var(--surface-alt)]">
            <p className="text-sm text-[var(--text-muted)] uppercase">Last Event</p>
            <p className="text-lg font-semibold text-[var(--text)]">{state.lastEvent}</p>
          </div>
        )}
      </div>
    </div>
  );
}
