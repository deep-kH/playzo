// ============================================================================
// Football Post-Match Page — Public route (Phase 5)
// Accessible at /sports/football/match/[matchId]
// ============================================================================
"use client";

import { useParams } from "next/navigation";
import { useLiveMatch } from "@/features/realtime/useLiveMatch";
import { useEffect, useState } from "react";
import type { FootballMatchState } from "@/features/scoring/football/types";
import { INITIAL_FOOTBALL_STATE, getEventIcon, isPrimaryEvent } from "@/features/scoring/football/types";
import { FootballMatchSummary } from "@/features/scoring/football/components/FootballMatchSummary";
import { getPlayerMatchStats } from "@/features/scoring/football/engine";

export default function FootballPostMatchPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params?.matchId as string;

  const { state, match, teamAName, teamBName, loading, error } =
    useLiveMatch<FootballMatchState>({
      matchId,
      initialState: INITIAL_FOOTBALL_STATE,
    });

  const teamALogo = (match as any)?.team_a?.logo_url || null;
  const teamBLogo = (match as any)?.team_b?.logo_url || null;

  // Fetch player match stats
  const [playerStats, setPlayerStats] = useState<any[]>([]);
  useEffect(() => {
    if (matchId && state.phase === "ended") {
      getPlayerMatchStats(matchId).then(setPlayerStats).catch(() => {});
    }
  }, [matchId, state.phase]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        <p className="text-[var(--text-muted)] text-sm">Loading match details...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-8">
        <div className="text-4xl">⚽</div>
        <h2 className="text-xl font-bold text-[var(--text)]">Match Not Found</h2>
        <p className="text-[var(--text-muted)] text-sm max-w-sm text-center">{error || "This match does not exist."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        <FootballMatchSummary
          state={state}
          teamAName={teamAName}
          teamBName={teamBName}
          teamALogo={teamALogo}
          teamBLogo={teamBLogo}
        />

        {/* Player Ratings Table */}
        {playerStats.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="font-bold text-sm uppercase tracking-widest text-[var(--text)] mb-4">⭐ Player Ratings</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                    <th className="text-left py-2 px-1 font-semibold">Player</th>
                    <th className="text-center px-1">⚽</th>
                    <th className="text-center px-1">🅰️</th>
                    <th className="text-center px-1">🎯</th>
                    <th className="text-center px-1">🟨</th>
                    <th className="text-center px-1">🛡️</th>
                    <th className="text-center px-1">🧱</th>
                    <th className="text-center px-1">🧤</th>
                  </tr>
                </thead>
                <tbody>
                  {playerStats.map((ps: any) => (
                    <tr key={ps.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--surface-alt)] transition-colors">
                      <td className="py-2 px-1 font-semibold text-[var(--text)]">{ps.player_name}</td>
                      <td className="text-center text-[var(--text-muted)] tabular-nums">{ps.goals || '-'}</td>
                      <td className="text-center text-[var(--text-muted)] tabular-nums">{ps.assists || '-'}</td>
                      <td className="text-center text-[var(--text-muted)] tabular-nums">{ps.shots_on || '-'}</td>
                      <td className="text-center text-[var(--text-muted)] tabular-nums">{ps.yellow_cards || '-'}</td>
                      <td className="text-center text-[var(--text-muted)] tabular-nums">{ps.interceptions || '-'}</td>
                      <td className="text-center text-[var(--text-muted)] tabular-nums">{ps.blocks || '-'}</td>
                      <td className="text-center text-[var(--text-muted)] tabular-nums">{ps.saves || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
