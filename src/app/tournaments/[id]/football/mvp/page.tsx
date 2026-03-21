"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getTournamentFootballMvp, type MvpRanking } from "@/features/scoring/football/mvpApi";

export default function TournamentFootballMvpPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = params?.id as string;
  const [rows, setRows] = useState<MvpRanking[]>([]);

  useEffect(() => {
    if (!tournamentId) return;
    void getTournamentFootballMvp(tournamentId).then(setRows).catch(() => setRows([]));
  }, [tournamentId]);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="text-center space-y-1">
        <h1 className="text-2xl md:text-3xl font-black text-[var(--text)]">🏆 Football Tournament MVP</h1>
        <p className="text-sm text-[var(--text-muted)]">Player rankings based on performance across all matches.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.slice(0, 10).map((row, i) => (
          <div key={row.player_id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_4px_12px_var(--shadow)]">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-[var(--text-muted)]">#{i + 1}</div>
              <div className="text-sm font-black text-[var(--primary)]">{row.rating_score?.toFixed(1)}</div>
            </div>
            <div className="mt-1 text-base font-bold text-[var(--text)]">{row.player_name}</div>
            <div className="text-xs text-[var(--text-muted)]">{row.team_name} · {row.matches_played} matches</div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="md:col-span-2 text-center text-sm text-[var(--text-muted)] py-8 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            No MVP data available yet.
          </div>
        )}
      </div>
    </div>
  );
}
