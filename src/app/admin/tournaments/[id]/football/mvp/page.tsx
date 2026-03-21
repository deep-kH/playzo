"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getTournamentFootballMvp, type MvpRanking } from "@/features/scoring/football/mvpApi";

export default function AdminTournamentFootballMvpPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = params?.id as string;
  const [rows, setRows] = useState<MvpRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tournamentId) return;
    const run = async () => {
      try {
        setLoading(true);
        setRows(await getTournamentFootballMvp(tournamentId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load MVP table");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [tournamentId]);

  if (loading) return <div className="p-6 text-sm text-[var(--text-muted)]">Loading tournament MVP...</div>;
  if (error) return <div className="p-6 text-sm text-[var(--danger)]">{error}</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_6px_18px_var(--shadow)]">
        <h1 className="text-xl md:text-2xl font-black text-[var(--text)]">Tournament MVP</h1>
        <p className="text-xs md:text-sm text-[var(--text-muted)] mt-1">
          Rating Formula: Goals×4 + Assists×3 + Saves×2 + Interceptions×1.5 + Blocks×1.5 + Dribbles×1
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="grid grid-cols-[56px_1fr_1fr_80px_90px] gap-2 px-4 py-3 bg-[var(--surface-alt)] border-b border-[var(--border)] text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          <div>#</div><div>Player</div><div>Team</div><div>Matches</div><div>Rating</div>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-[var(--text-muted)] text-center">No football player stats found yet.</div>
        ) : (
          rows.map((row, idx) => (
            <div key={row.player_id} className="grid grid-cols-[56px_1fr_1fr_80px_90px] gap-2 px-4 py-3 border-b border-[var(--border)] last:border-b-0 text-sm">
              <div className="font-bold text-[var(--text-muted)]">{idx + 1}</div>
              <div className="font-semibold text-[var(--text)]">{row.player_name}</div>
              <div className="text-[var(--text-muted)]">{row.team_name}</div>
              <div className="text-[var(--text)]">{row.matches_played}</div>
              <div className="font-bold text-[var(--primary)]">{row.rating_score?.toFixed(1)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
