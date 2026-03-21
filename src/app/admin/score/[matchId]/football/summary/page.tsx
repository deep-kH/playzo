"use client";

import { useParams } from "next/navigation";
import { useLiveMatch } from "@/features/realtime/useLiveMatch";
import { INITIAL_FOOTBALL_STATE } from "@/features/scoring/football/types";
import type { FootballMatchState } from "@/features/scoring/football/types";
import { FootballMatchSummary } from "@/features/scoring/football/components/FootballMatchSummary";

export default function FootballAdminSummaryPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params?.matchId as string;

  const { state, teamAName, teamBName, loading, error } = useLiveMatch<FootballMatchState>({
    matchId,
    initialState: INITIAL_FOOTBALL_STATE,
  });

  if (loading) return <div className="p-6 text-sm text-[var(--text-muted)]">Loading summary...</div>;
  if (error) return <div className="p-6 text-sm text-[var(--danger)]">{error}</div>;

  return (
    <div className="min-h-screen bg-[var(--bg)] p-4 md:p-6">
      <FootballMatchSummary state={state} teamAName={teamAName} teamBName={teamBName} />
    </div>
  );
}

