// ============================================================================
// Football MVP & Tournament Awards Page (Phase 6)
// Route: /sports/football/tournament/[tournamentId]/mvp
// ============================================================================
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getTournamentFootballMvp,
  getGoldenBoot,
  getGoldenGloves,
  getBestDefender,
  type MvpRanking,
} from "@/features/scoring/football/mvpApi";

export default function FootballMvpPage() {
  const params = useParams<{ tournamentId: string }>();
  const tournamentId = params?.tournamentId as string;

  const [rankings, setRankings] = useState<MvpRanking[]>([]);
  const [goldenBoot, setGoldenBoot] = useState<any>(null);
  const [goldenGloves, setGoldenGloves] = useState<any>(null);
  const [bestDefender, setBestDefender] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId) return;
    Promise.all([
      getTournamentFootballMvp(tournamentId),
      getGoldenBoot(tournamentId),
      getGoldenGloves(tournamentId),
      getBestDefender(tournamentId),
    ])
      .then(([r, gb, gg, bd]) => {
        setRankings(r);
        setGoldenBoot(gb);
        setGoldenGloves(gg);
        setBestDefender(bd);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        <p className="text-[var(--text-muted)] text-sm">Loading MVP data...</p>
      </div>
    );
  }

  const top3 = rankings.slice(0, 3);
  const rest = rankings.slice(3);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">

        {/* Page Header */}
        <div className="text-center py-6">
          <h1 className="text-3xl md:text-4xl font-black text-[var(--text)] tracking-tight">🏆 Tournament MVP</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Player rankings based on performance</p>
        </div>

        {/* Awards Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {goldenBoot && (
            <AwardCard
              title="Golden Boot"
              emoji="🥇⚽"
              playerName={goldenBoot.player_name}
              teamName={goldenBoot.team?.name || ""}
              stat={`${goldenBoot.goals} Goals`}
              gradient="from-yellow-500/20 to-amber-500/10"
            />
          )}
          {goldenGloves && (
            <AwardCard
              title="Golden Gloves"
              emoji="🧤"
              playerName={goldenGloves.player_name}
              teamName={goldenGloves.team?.name || ""}
              stat={`${goldenGloves.saves} Saves · ${goldenGloves.clean_sheets} CS`}
              gradient="from-blue-500/20 to-cyan-500/10"
            />
          )}
          {bestDefender && (
            <AwardCard
              title="Best Defender"
              emoji="🛡️"
              playerName={bestDefender.player_name}
              teamName={bestDefender.team?.name || ""}
              stat={`${bestDefender.blocks} Blocks · ${bestDefender.interceptions} Int`}
              gradient="from-emerald-500/20 to-green-500/10"
            />
          )}
        </div>

        {/* Top 3 Podium */}
        {top3.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h3 className="font-bold text-sm uppercase tracking-widest text-[var(--text)] mb-5 text-center">Top Players</h3>
            <div className="flex items-end justify-center gap-4">
              {/* 2nd Place */}
              {top3[1] && (
                <div className="flex flex-col items-center gap-2 w-24">
                  <div className="w-14 h-14 rounded-full bg-gray-300/20 flex items-center justify-center text-2xl border-2 border-gray-400/30">🥈</div>
                  <div className="text-xs font-bold text-[var(--text)] text-center truncate w-full">{top3[1].player_name}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{top3[1].rating_score?.toFixed(1)} pts</div>
                </div>
              )}
              {/* 1st (MVP) */}
              {top3[0] && (
                <div className="flex flex-col items-center gap-2 w-28 -mt-4">
                  <div className="w-18 h-18 rounded-full bg-yellow-400/20 flex items-center justify-center text-3xl border-2 border-yellow-400/40 shadow-lg shadow-yellow-400/10"
                    style={{ width: '4.5rem', height: '4.5rem' }}>🏆</div>
                  <div className="text-sm font-black text-[var(--text)] text-center">{top3[0].player_name}</div>
                  <div className="text-xs text-[var(--primary)] font-bold">{top3[0].rating_score?.toFixed(1)} pts</div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-600 font-bold">MVP</span>
                </div>
              )}
              {/* 3rd Place */}
              {top3[2] && (
                <div className="flex flex-col items-center gap-2 w-24">
                  <div className="w-14 h-14 rounded-full bg-amber-600/20 flex items-center justify-center text-2xl border-2 border-amber-600/30">🥉</div>
                  <div className="text-xs font-bold text-[var(--text)] text-center truncate w-full">{top3[2].player_name}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{top3[2].rating_score?.toFixed(1)} pts</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Full Rankings Table */}
        {rankings.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="font-bold text-sm uppercase tracking-widest text-[var(--text)] mb-4">📊 Full Rankings</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                    <th className="text-left py-2 px-1 font-semibold">#</th>
                    <th className="text-left py-2 px-1 font-semibold">Player</th>
                    <th className="text-left py-2 px-1 font-semibold">Team</th>
                    <th className="text-center px-1">MP</th>
                    <th className="text-center px-1">⚽</th>
                    <th className="text-center px-1">🅰️</th>
                    <th className="text-center px-1">🧤</th>
                    <th className="text-center px-1">🛡️</th>
                    <th className="text-center px-1">🧱</th>
                    <th className="text-center px-1">⚡</th>
                    <th className="text-center px-1 font-bold">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((r, i) => (
                    <tr key={r.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--surface-alt)] transition-colors">
                      <td className="py-2 px-1 font-bold text-[var(--text-muted)]">{i + 1}</td>
                      <td className="py-2 px-1 font-semibold text-[var(--text)]">{r.player_name}</td>
                      <td className="py-2 px-1 text-[var(--text-muted)]">{r.team_name}</td>
                      <td className="text-center text-[var(--text-muted)] tabular-nums">{r.matches_played}</td>
                      <td className="text-center text-[var(--text-muted)] tabular-nums">{r.goals}</td>
                      <td className="text-center text-[var(--text-muted)] tabular-nums">{r.assists}</td>
                      <td className="text-center text-[var(--text-muted)] tabular-nums">{r.saves}</td>
                      <td className="text-center text-[var(--text-muted)] tabular-nums">{r.interceptions}</td>
                      <td className="text-center text-[var(--text-muted)] tabular-nums">{r.blocks}</td>
                      <td className="text-center text-[var(--text-muted)] tabular-nums">{r.dribbles}</td>
                      <td className="text-center font-bold text-[var(--primary)] tabular-nums">{r.rating_score?.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rankings.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📊</div>
            <h2 className="text-lg font-bold text-[var(--text)]">No Data Yet</h2>
            <p className="text-sm text-[var(--text-muted)]">Complete some matches to see tournament rankings.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Award Card Component ──
function AwardCard({
  title, emoji, playerName, teamName, stat, gradient,
}: {
  title: string; emoji: string; playerName: string; teamName: string; stat: string; gradient: string;
}) {
  return (
    <div className={`rounded-2xl border border-[var(--border)] p-5 text-center bg-gradient-to-br ${gradient}`}>
      <div className="text-3xl mb-2">{emoji}</div>
      <h4 className="font-bold text-xs uppercase tracking-widest text-[var(--text-muted)]">{title}</h4>
      <p className="font-black text-sm text-[var(--text)] mt-1">{playerName}</p>
      <p className="text-[10px] text-[var(--text-muted)]">{teamName}</p>
      <p className="text-xs font-bold text-[var(--primary)] mt-1">{stat}</p>
    </div>
  );
}
