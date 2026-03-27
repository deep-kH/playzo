"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type {
  BattingStats,
  BowlingStats,
  Innings,
  Match,
  Player,
  Team,
} from "@/lib/types/database";
import { toRealOvers, formatOvers } from "@/features/scoring/cricket/oversUtils";

interface CricketMatchResultProps {
  matchId: string;
}

export function CricketMatchResult({ matchId }: CricketMatchResultProps) {
  const [match, setMatch] = useState<Match | null>(null);
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);
  const [innings, setInnings] = useState<Innings[]>([]);
  const [battingStats, setBattingStats] = useState<Map<string, BattingStats[]>>(new Map());
  const [bowlingStats, setBowlingStats] = useState<Map<string, BowlingStats[]>>(new Map());
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const { data: m } = await supabase
        .from("ls_matches")
        .select("*")
        .eq("id", matchId)
        .single();
      if (!m) return;
      setMatch(m as Match);

      const [{ data: tA }, { data: tB }] = await Promise.all([
        supabase.from("teams").select("*").eq("id", (m as any).team_a_id).single(),
        supabase.from("teams").select("*").eq("id", (m as any).team_b_id).single(),
      ]);
      setTeamA((tA as unknown as Team) ?? null);
      setTeamB((tB as unknown as Team) ?? null);

      const { data: innData } = await supabase
        .from("ls_innings")
        .select("*")
        .eq("match_id", matchId)
        .order("innings_number");
      const inns = (innData as Innings[]) ?? [];
      setInnings(inns);

      const batMap = new Map<string, BattingStats[]>();
      const bowlMap = new Map<string, BowlingStats[]>();
      for (const inn of inns) {
        const [{ data: bs }, { data: bws }] = await Promise.all([
          supabase.from("ls_batting_stats").select("*").eq("innings_id", inn.id),
          supabase.from("ls_bowling_stats").select("*").eq("innings_id", inn.id),
        ]);
        batMap.set(inn.id, (bs as BattingStats[]) ?? []);
        bowlMap.set(inn.id, (bws as BowlingStats[]) ?? []);
      }
      setBattingStats(batMap);
      setBowlingStats(bowlMap);

      const { data: plrs } = await supabase
        .from("players")
        .select("*")
        .in("team_id", [(m as any).team_a_id, (m as any).team_b_id]);
      const pMap = new Map<string, Player>();
      ((plrs as Player[]) ?? []).forEach((p) => pMap.set(p.id, p));
      setPlayers(pMap);
    } catch (err) {
      console.error("Match result load error:", err);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-3 border-[var(--primary)] border-t-transparent" />
        <p className="text-[var(--text-muted)] text-xs">Loading result...</p>
      </div>
    );
  }

  if (!match || innings.length === 0) {
    return (
      <div className="card text-center py-8">
        <div className="text-3xl mb-2">🏏</div>
        <p className="text-[var(--text-muted)]">Match data not available.</p>
      </div>
    );
  }

  const pName = (id: string | null) => players.get(id ?? "")?.name ?? "Unknown";
  const teamName = (id: string) =>
    id === match.team_a_id ? teamA?.name ?? "Team A" : teamB?.name ?? "Team B";

  const dismissalText = (s: BattingStats): string => {
    if (!s.is_out) return "not out";
    const dt = s.dismissal_type;
    const bowler = s.dismissal_bowler_id ? pName(s.dismissal_bowler_id) : null;
    const fielder = s.dismissal_fielder_id ? pName(s.dismissal_fielder_id) : null;
    switch (dt) {
      case "bowled": return `b ${bowler}`;
      case "caught": return fielder && bowler ? `c ${fielder} b ${bowler}` : `c & b ${bowler}`;
      case "lbw": return `lbw b ${bowler}`;
      case "stumped": return `st ${fielder} b ${bowler}`;
      case "run_out": return fielder ? `run out (${fielder})` : "run out";
      case "hit_wicket": return `hit wicket b ${bowler}`;
      case "retired_hurt": return "retired hurt";
      default: return dt ?? "out";
    }
  };

  // Determine winner
  const inn1 = innings[0];
  const inn2 = innings.length > 1 ? innings[1] : null;
  let resultText = "";
  if (inn2) {
    if (inn2.total_runs > inn1.total_runs) {
      const wicketsLeft = ((match.settings as Record<string, number>)?.players_per_team ?? 11) - 1 - inn2.total_wickets;
      resultText = `${teamName(inn2.batting_team_id)} won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? "s" : ""}`;
    } else if (inn1.total_runs > inn2.total_runs) {
      const runDiff = inn1.total_runs - inn2.total_runs;
      resultText = `${teamName(inn1.batting_team_id)} won by ${runDiff} run${runDiff !== 1 ? "s" : ""}`;
    } else {
      resultText = "Match Tied";
    }
  } else {
    resultText = "Match Incomplete";
  }

  // Best performers
  const allBatting = Array.from(battingStats.values()).flat();
  const allBowling = Array.from(bowlingStats.values()).flat();
  const topScorer = allBatting.reduce((best, s) => (s.runs > (best?.runs ?? -1) ? s : best), null as BattingStats | null);
  const topBowler = allBowling.reduce((best, s) => {
    if (!best) return s;
    if (s.wickets > best.wickets) return s;
    if (s.wickets === best.wickets) {
      const econBest = toRealOvers(best.overs) > 0 ? best.runs_conceded / toRealOvers(best.overs) : 999;
      const econS = toRealOvers(s.overs) > 0 ? s.runs_conceded / toRealOvers(s.overs) : 999;
      return econS < econBest ? s : best;
    }
    return best;
  }, null as BowlingStats | null);

  // Match stats
  const totalFours = allBatting.reduce((sum, s) => sum + s.fours, 0);
  const totalSixes = allBatting.reduce((sum, s) => sum + s.sixes, 0);
  const totalExtras = innings.reduce((sum, inn) => sum + inn.total_extras, 0);

  return (
    <div className="space-y-4">
      {/* ═══ WINNER BANNER ═══ */}
      <div className="card text-center bg-gradient-to-br from-[var(--surface)] to-[var(--surface-alt)] overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary)]/5 via-[var(--accent)]/5 to-[var(--primary)]/5" />
        <div className="relative z-10 py-4">
          <div className="text-4xl mb-2">🏆</div>
          <h2 className="text-xl md:text-2xl font-black text-[var(--text)]">{resultText}</h2>
          <div className="flex items-center justify-center gap-4 mt-3">
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--text)]">{teamName(inn1.batting_team_id)}</p>
              <p className="text-2xl font-black text-[var(--primary)] tabular-nums">
                {inn1.total_runs}/{inn1.total_wickets}
                <span className="text-sm text-[var(--text-muted)] font-normal ml-1">
                  ({formatOvers(inn1.total_overs)} ov)
                </span>
              </p>
            </div>
            <span className="text-lg text-[var(--text-muted)] font-black">vs</span>
            {inn2 && (
              <div className="text-center">
                <p className="text-sm font-semibold text-[var(--text)]">{teamName(inn2.batting_team_id)}</p>
                <p className="text-2xl font-black text-[var(--primary)] tabular-nums">
                  {inn2.total_runs}/{inn2.total_wickets}
                  <span className="text-sm text-[var(--text-muted)] font-normal ml-1">
                    ({formatOvers(inn2.total_overs)} ov)
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ BEST PERFORMERS ═══ */}
      <div className="grid grid-cols-2 gap-3">
        {topScorer && (
          <div className="card !p-3">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold mb-1">⭐ Top Scorer</p>
            <p className="text-sm font-bold text-[var(--text)]">{pName(topScorer.player_id)}</p>
            <p className="text-lg font-black text-[var(--accent)] tabular-nums">
              {topScorer.runs}<span className="text-xs text-[var(--text-muted)] font-normal ml-0.5">({topScorer.balls_faced}b)</span>
            </p>
            <p className="text-[10px] text-[var(--text-muted)]">
              {topScorer.fours}×4 · {topScorer.sixes}×6 · SR {topScorer.balls_faced > 0 ? ((topScorer.runs / topScorer.balls_faced) * 100).toFixed(1) : "0.0"}
            </p>
          </div>
        )}
        {topBowler && topBowler.wickets > 0 && (
          <div className="card !p-3">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold mb-1">🎯 Best Bowler</p>
            <p className="text-sm font-bold text-[var(--text)]">{pName(topBowler.player_id)}</p>
            <p className="text-lg font-black text-[var(--primary)] tabular-nums">
              {topBowler.wickets}/{topBowler.runs_conceded}
            </p>
            <p className="text-[10px] text-[var(--text-muted)]">
              {formatOvers(topBowler.overs)} ov · Econ {toRealOvers(topBowler.overs) > 0 ? (topBowler.runs_conceded / toRealOvers(topBowler.overs)).toFixed(1) : "0.0"}
            </p>
          </div>
        )}
      </div>

      {/* ═══ MATCH STATS ═══ */}
      <div className="card !p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xl font-black text-[var(--primary)] tabular-nums">{totalFours}</p>
            <p className="text-[10px] text-[var(--text-muted)] uppercase">Fours</p>
          </div>
          <div>
            <p className="text-xl font-black text-[var(--accent)] tabular-nums">{totalSixes}</p>
            <p className="text-[10px] text-[var(--text-muted)] uppercase">Sixes</p>
          </div>
          <div>
            <p className="text-xl font-black text-[var(--text)] tabular-nums">{totalExtras}</p>
            <p className="text-[10px] text-[var(--text-muted)] uppercase">Extras</p>
          </div>
        </div>
      </div>

      {/* ═══ INNINGS SCORECARDS ═══ */}
      {innings.map((inn) => {
        const batStats = battingStats.get(inn.id) ?? [];
        const bowlStats = bowlingStats.get(inn.id) ?? [];
        const innTeamName = teamName(inn.batting_team_id);

        return (
          <div key={inn.id} className="card !p-0 overflow-hidden">
            {/* Innings header */}
            <div className="px-3 py-2.5 bg-[var(--surface-alt)] border-b border-[var(--border-ui)]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--text)]">
                  {innTeamName} — Innings {inn.innings_number}
                </h3>
                <span className="text-sm font-black text-[var(--primary)] tabular-nums">
                  {inn.total_runs}/{inn.total_wickets}
                  <span className="text-xs text-[var(--text-muted)] font-normal ml-1">
                    ({formatOvers(inn.total_overs)} ov)
                  </span>
                </span>
              </div>
            </div>

            {/* Batting table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-ui)] text-[var(--text-muted)] uppercase">
                    <th className="text-left py-1.5 px-3">Batter</th>
                    <th className="text-right py-1.5 px-2">R</th>
                    <th className="text-right py-1.5 px-2">B</th>
                    <th className="text-right py-1.5 px-2">4s</th>
                    <th className="text-right py-1.5 px-2">6s</th>
                    <th className="text-right py-1.5 px-3">SR</th>
                  </tr>
                </thead>
                <tbody>
                  {batStats
                    .filter((s) => s.balls_faced > 0 || s.runs > 0)
                    .sort((a, b) => (a.batting_position ?? 99) - (b.batting_position ?? 99))
                    .map((s) => {
                      const sr = s.balls_faced > 0 ? ((s.runs / s.balls_faced) * 100).toFixed(1) : "0.0";
                      return (
                        <tr key={s.id} className="border-b border-[var(--border-ui)]/30">
                          <td className="py-1.5 px-3">
                            <div>
                              <span className="font-medium text-[var(--text)]">{pName(s.player_id)}</span>
                            </div>
                            <div className={`text-[10px] ${s.is_out ? 'text-[var(--text-muted)]' : 'text-[var(--accent)]'}`}>
                              {dismissalText(s)}
                            </div>
                          </td>
                          <td className="text-right py-1.5 px-2 font-bold text-[var(--text)]">{s.runs}</td>
                          <td className="text-right py-1.5 px-2 text-[var(--text-muted)]">{s.balls_faced}</td>
                          <td className="text-right py-1.5 px-2 text-[var(--text-muted)]">{s.fours}</td>
                          <td className="text-right py-1.5 px-2 text-[var(--text-muted)]">{s.sixes}</td>
                          <td className="text-right py-1.5 px-3 text-[var(--text-muted)]">{sr}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Bowling table */}
            <div className="border-t border-[var(--border-ui)]">
              <div className="px-3 py-1.5 bg-[var(--surface-alt)]">
                <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">Bowling</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-ui)] text-[var(--text-muted)] uppercase">
                      <th className="text-left py-1.5 px-3">Bowler</th>
                      <th className="text-right py-1.5 px-2">O</th>
                      <th className="text-right py-1.5 px-2">M</th>
                      <th className="text-right py-1.5 px-2">R</th>
                      <th className="text-right py-1.5 px-2">W</th>
                      <th className="text-right py-1.5 px-3">Econ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bowlStats
                      .filter((s) => s.overs > 0 || s.wickets > 0)
                      .map((s) => {
                        const real = toRealOvers(s.overs);
                        const econ = real > 0 ? (s.runs_conceded / real).toFixed(1) : "0.0";
                        return (
                          <tr key={s.id} className="border-b border-[var(--border-ui)]/30">
                            <td className="py-1.5 px-3 font-medium text-[var(--text)]">{pName(s.player_id)}</td>
                            <td className="text-right py-1.5 px-2 text-[var(--text)]">{formatOvers(s.overs)}</td>
                            <td className="text-right py-1.5 px-2 text-[var(--text-muted)]">{s.maidens}</td>
                            <td className="text-right py-1.5 px-2 text-[var(--text-muted)]">{s.runs_conceded}</td>
                            <td className="text-right py-1.5 px-2 font-bold text-[var(--text)]">{s.wickets}</td>
                            <td className="text-right py-1.5 px-3 text-[var(--text-muted)]">{econ}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
