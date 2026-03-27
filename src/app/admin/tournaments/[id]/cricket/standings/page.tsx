"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { Match, Team, Tournament, Innings } from "@/lib/types/database";
import { getTeamColor } from "@/lib/teamColors";
import { toRealOvers } from "@/features/scoring/cricket/oversUtils";

/* ── Standings row ── */
interface StandingsRow {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  teamColor: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  nrr: number;
  runsFor: number;
  oversFor: number;
  runsAgainst: number;
  oversAgainst: number;
}

export default function TournamentStandingsPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = params?.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStandings = useCallback(async () => {
    try {
      const { data: tData } = await supabase
        .from("ls_tournaments").select("*").eq("id", tournamentId).maybeSingle();
      setTournament(tData as Tournament | null);

      const { data: ttData } = await supabase
        .from("ls_tournament_teams").select("team_id").eq("tournament_id", tournamentId);
      const teamIds = (ttData ?? []).map((t: any) => t.team_id);
      if (teamIds.length === 0) { setStandings([]); setLoading(false); return; }

      const { data: teamsData } = await supabase
        .from("teams").select("*").in("id", teamIds);
      const teams = (teamsData as Team[]) ?? [];

      // Fetch ALL matches (completed) for this tournament
      const { data: matchesData } = await supabase
        .from("ls_matches").select("*")
        .eq("tournament_id", tournamentId)
        .eq("status", "completed");
      const completedMatches = (matchesData as Match[]) ?? [];

      // Fetch all innings for NRR calculation
      const matchIds = completedMatches.map((m) => m.id);
      let allInnings: Innings[] = [];
      if (matchIds.length > 0) {
        const { data: innData } = await supabase
          .from("ls_innings").select("*").in("match_id", matchIds);
        allInnings = (innData as Innings[]) ?? [];
      }

      // Build standings map
      const map = new Map<string, StandingsRow>();
      teams.forEach((t) => {
        map.set(t.id, {
          teamId: t.id,
          teamName: t.name,
          logoUrl: t.logo_url,
          teamColor: getTeamColor(t.name).primary,
          played: 0,
          won: 0,
          lost: 0,
          tied: 0,
          noResult: 0,
          points: 0,
          nrr: 0,
          runsFor: 0,
          oversFor: 0,
          runsAgainst: 0,
          oversAgainst: 0,
        });
      });

      completedMatches.forEach((m) => {
        const result = m.result as any;
        const aRow = map.get(m.team_a_id);
        const bRow = map.get(m.team_b_id);
        if (!aRow || !bRow) return;

        aRow.played++;
        bRow.played++;

        // Get the innings for this match
        const matchInnings = allInnings.filter((inn) => inn.match_id === m.id);

        // Determine winner
        let winnerId: string | null = null;
        let isTie = false;
        
        if (result?.winner_id) {
          winnerId = result.winner_id;
        } else {
          const inn1 = matchInnings.find((inn) => inn.innings_number === 1);
          const inn2 = matchInnings.find((inn) => inn.innings_number === 2);
          if (inn1 && inn2) {
            if (inn1.total_runs > inn2.total_runs) winnerId = inn1.batting_team_id;
            else if (inn2.total_runs > inn1.total_runs) winnerId = inn2.batting_team_id;
            else if (inn1.total_runs === inn2.total_runs) isTie = true;
          }
        }

        if (winnerId) {
          if (winnerId === m.team_a_id) {
            aRow.won++;
            aRow.points += 3; // Win = 3 points
            bRow.lost++;
          } else if (winnerId === m.team_b_id) {
            bRow.won++;
            bRow.points += 3; // Win = 3 points
            aRow.lost++;
          }
        } else if (isTie) {
          aRow.tied++;
          bRow.tied++;
          aRow.points += 1; // Tie = 1 point each
          bRow.points += 1;
        } else {
          // No result (match completed but no winner or innings missing)
          aRow.noResult++;
          bRow.noResult++;
          aRow.points += 1; // No result = 1 point each
          bRow.points += 1;
        }

        // NRR: runs for/against from innings
        matchInnings.forEach((inn) => {
          const battingRow = map.get(inn.batting_team_id);
          const bowlingRow = map.get(inn.bowling_team_id);
          const realOvers = toRealOvers(inn.total_overs);
          if (battingRow) {
            battingRow.runsFor += inn.total_runs ?? 0;
            battingRow.oversFor += realOvers;
          }
          if (bowlingRow) {
            bowlingRow.runsAgainst += inn.total_runs ?? 0;
            bowlingRow.oversAgainst += realOvers;
          }
        });
      });

      // Calculate NRR
      map.forEach((row) => {
        const rrFor = row.oversFor > 0 ? row.runsFor / row.oversFor : 0;
        const rrAgainst = row.oversAgainst > 0 ? row.runsAgainst / row.oversAgainst : 0;
        row.nrr = rrFor - rrAgainst;
      });

      // Sort: Points desc, then NRR desc
      const sorted = Array.from(map.values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.nrr - a.nrr;
      });

      setStandings(sorted);
    } catch (err) {
      console.error("Standings load error:", err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { loadStandings(); }, [loadStandings]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        <p className="text-sm text-[var(--text-muted)]" style={{ fontFamily: "var(--font-oswald)" }}>
          LOADING STANDINGS...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-8">
        <div className="text-4xl">⚠️</div>
        <p className="text-[var(--text-muted)] text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-3 md:px-6 pb-8 space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="pt-4">
        <h1
          className="text-2xl md:text-3xl font-bold uppercase tracking-wider"
          style={{ fontFamily: "var(--font-oswald)", color: "var(--text)" }}
        >
          {tournament?.name ?? "Tournament"}
        </h1>
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mt-1">
          Cricket · Points Table
        </p>
      </div>

      {/* ═══ POINTS TABLE ═══ */}
      {standings.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">🏆</div>
          <h3 className="text-lg font-semibold text-[var(--text)] mb-1" style={{ fontFamily: "var(--font-oswald)" }}>
            NO DATA YET
          </h3>
          <p className="text-sm text-[var(--text-muted)]">Complete matches to see the standings.</p>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#16a34a" }}>
                  <th
                    className="text-center py-3 px-2 text-white text-xs uppercase font-bold w-10"
                    style={{ fontFamily: "var(--font-oswald)" }}
                  >
                    #
                  </th>
                  <th
                    className="text-left py-3 px-3 text-white text-xs uppercase font-bold"
                    style={{ fontFamily: "var(--font-oswald)" }}
                  >
                    TEAM
                  </th>
                  <th className="text-center py-3 px-2 text-white/90 text-[10px] uppercase font-semibold" style={{ fontFamily: "var(--font-oswald)" }}>M</th>
                  <th className="text-center py-3 px-2 text-white/90 text-[10px] uppercase font-semibold" style={{ fontFamily: "var(--font-oswald)" }}>W</th>
                  <th className="text-center py-3 px-2 text-white/90 text-[10px] uppercase font-semibold" style={{ fontFamily: "var(--font-oswald)" }}>L</th>
                  <th className="text-center py-3 px-2 text-white/90 text-[10px] uppercase font-semibold" style={{ fontFamily: "var(--font-oswald)" }}>NR</th>
                  <th className="text-center py-3 px-2 text-white/90 text-[10px] uppercase font-semibold hidden md:table-cell" style={{ fontFamily: "var(--font-oswald)" }}>T</th>
                  <th className="text-center py-3 px-2 text-xs uppercase font-bold" style={{ fontFamily: "var(--font-oswald)", color: "#fde68a" }}>PTS</th>
                  <th className="text-right py-3 px-3 text-white/90 text-[10px] uppercase font-semibold" style={{ fontFamily: "var(--font-oswald)" }}>NRR</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, idx) => (
                  <tr
                    key={row.teamId}
                    className="border-b border-[var(--border)]/50 transition-colors hover:bg-[var(--surface-alt)]"
                    style={{
                      animation: `fade-in 0.3s ease-out ${idx * 0.05}s both`,
                    }}
                  >
                    {/* Position */}
                    <td className="text-center py-3 px-2">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                        style={{
                          fontFamily: "var(--font-oswald)",
                          ...(idx < 2
                            ? { background: "#16a34a", color: "#fff" }
                            : { color: "var(--text-muted)" }),
                        }}
                      >
                        {idx + 1}
                      </span>
                    </td>

                    {/* Team */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        {/* Team color bar */}
                        <div
                          className="w-1 h-10 rounded-full flex-shrink-0"
                          style={{ background: row.teamColor }}
                        />
                        {row.logoUrl ? (
                          <img
                            src={row.logoUrl}
                            alt={row.teamName}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            style={{ border: `2px solid ${row.teamColor}` }}
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                            style={{ background: row.teamColor, fontFamily: "var(--font-oswald)" }}
                          >
                            {row.teamName.charAt(0)}
                          </div>
                        )}
                        <span
                          className="font-semibold text-[var(--text)] truncate max-w-[100px] md:max-w-none"
                          style={{ fontFamily: "var(--font-oswald)" }}
                        >
                          {row.teamName}
                        </span>
                      </div>
                    </td>

                    {/* Stats */}
                    <td className="text-center py-3 px-2 text-[var(--text)] text-sm tabular-nums" style={{ fontFamily: "var(--font-oswald)" }}>
                      {row.played}
                    </td>
                    <td className="text-center py-3 px-2 text-sm font-semibold tabular-nums" style={{ color: "#16a34a", fontFamily: "var(--font-oswald)" }}>
                      {row.won}
                    </td>
                    <td className="text-center py-3 px-2 text-sm tabular-nums" style={{ color: "#ef4444", fontFamily: "var(--font-oswald)" }}>
                      {row.lost}
                    </td>
                    <td className="text-center py-3 px-2 text-[var(--text-muted)] text-sm tabular-nums" style={{ fontFamily: "var(--font-oswald)" }}>
                      {row.noResult}
                    </td>
                    <td className="text-center py-3 px-2 text-[var(--text-muted)] text-sm tabular-nums hidden md:table-cell" style={{ fontFamily: "var(--font-oswald)" }}>
                      {row.tied}
                    </td>
                    <td className="text-center py-3 px-2">
                      <span
                        className="text-lg font-black tabular-nums"
                        style={{ fontFamily: "var(--font-oswald)", color: "#f59e0b" }}
                      >
                        {row.points}
                      </span>
                    </td>
                    <td className="text-right py-3 px-3">
                      <span
                        className="text-sm font-semibold tabular-nums"
                        style={{
                          fontFamily: "var(--font-oswald)",
                          color: row.nrr > 0 ? "#16a34a" : row.nrr < 0 ? "#ef4444" : "var(--text-muted)",
                        }}
                      >
                        {row.nrr > 0 ? "+" : ""}{row.nrr.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-2.5 border-t border-[var(--border)]/50 bg-[var(--surface-alt)]">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
              W = 3pts · NR = 1pt · L = 0pts · NRR = Net Run Rate
            </p>
          </div>
        </div>
      )}

      {/* ═══ FOOTER ═══ */}
      <div className="text-center py-4">
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
          {tournament?.name ?? "Tournament"} · Powered by Playzo
        </p>
      </div>
    </div>
  );
}
