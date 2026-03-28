"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type { BattingStats, BowlingStats, Player, Innings, Match, MatchState, Team, Ball } from "@/lib/types/database";
import { buildCricketState } from "@/features/scoring/cricket/api";
import type { CricketMatchState } from "@/features/scoring/cricket/types";
import { DEFAULT_CRICKET_STATE } from "@/features/scoring/cricket/types";
import { toRealOvers, formatOvers } from "@/features/scoring/cricket/oversUtils";
import { CricketMatchResult } from "@/features/scoring/cricket/components/CricketMatchResult";
import { useLiveMatch } from "@/features/realtime/useLiveMatch";

/* ═══════════════════════════════════════════════════
 *  OVERLAY TYPES
 * ═══════════════════════════════════════════════════ */
type OverlayEvent =
  | { type: "SIX" }
  | { type: "FOUR" }
  | { type: "WICKET" }
  | { type: "WIDE" }
  | { type: "NO BALL" }
  | { type: "RUNS"; value: number };

const overlayAnimCSS = `
@keyframes overlayZoomIn {
  0% { transform: scale(0.3) rotate(-5deg); opacity: 0; }
  50% { transform: scale(1.15) rotate(2deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes overlaySlideIn {
  0% { transform: translateX(-100%) skewX(-5deg); opacity: 0; }
  60% { transform: translateX(5%) skewX(0deg); opacity: 1; }
  100% { transform: translateX(0%); opacity: 1; }
}
@keyframes overlayShake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
  20%, 40%, 60%, 80% { transform: translateX(8px); }
}
@keyframes overlayFadeOut {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.8) translateY(-20px); }
}
@keyframes overlayPop {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 30px rgba(var(--glow-rgb), 0.4); }
  50% { box-shadow: 0 0 60px rgba(var(--glow-rgb), 0.8); }
}
.overlay-six { animation: overlayZoomIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; --glow-rgb:255,187,0; }
.overlay-four { animation: overlaySlideIn 0.4s cubic-bezier(0.25,0.8,0.25,1) forwards; }
.overlay-wicket { animation: overlayShake 0.6s ease-in-out; }
.overlay-extra { animation: overlayPop 0.3s ease-out forwards; }
.overlay-runs { animation: overlayPop 0.25s ease-out forwards; }
.overlay-exit { animation: overlayFadeOut 0.4s ease-in forwards; }
.striker-glow {
  box-shadow: 0 0 0 2px var(--primary), 0 0 12px rgba(var(--primary-rgb, 59,130,246),0.3);
}
`;

export default function CricketLiveViewer() {
  const params = useParams<{ id: string }>();
  const matchId = params?.id as string;

  const [match, setMatch] = useState<Match | null>(null);
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);
  const [innings, setInnings] = useState<Innings | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [cricketState, setCricketState] = useState<CricketMatchState>(DEFAULT_CRICKET_STATE);
  const [battingStats, setBattingStats] = useState<BattingStats[]>([]);
  const [bowlingStats, setBowlingStats] = useState<BowlingStats[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  /* ── Overlay state ── */
  const [overlay, setOverlay] = useState<OverlayEvent | null>(null);
  const [overlayExiting, setOverlayExiting] = useState(false);
  const prevStateRef = useRef<CricketMatchState>(DEFAULT_CRICKET_STATE);
  const overlayTimer = useRef<NodeJS.Timeout | null>(null);

  // Refs to cache static data (match, teams, players) — only fetched once
  const matchRef = useRef<Match | null>(null);
  const teamARef = useRef<Team | null>(null);
  const teamBRef = useRef<Team | null>(null);
  const playersRef = useRef<Player[]>([]);

  const loadData = useCallback(async (): Promise<boolean> => {
    try {
      // 1. Static data — cached after first load
      let m = matchRef.current;
      if (!m) {
        const { data } = await supabase.from("ls_matches").select("*").eq("id", matchId).maybeSingle();
        if (!data) return false;
        m = data as Match;
        matchRef.current = m;
        setMatch(m);
      }
      if (!teamARef.current || !teamBRef.current || playersRef.current.length === 0) {
        const [{ data: tA }, { data: tB }, { data: plrs }] = await Promise.all([
          supabase.from("teams").select("*").eq("id", m.team_a_id).maybeSingle(),
          supabase.from("teams").select("*").eq("id", m.team_b_id).maybeSingle(),
          supabase.from("players").select("*").in("team_id", [m.team_a_id, m.team_b_id]),
        ]);
        if (tA) { teamARef.current = tA as unknown as Team; setTeamA(teamARef.current); }
        if (tB) { teamBRef.current = tB as unknown as Team; setTeamB(teamBRef.current); }
        playersRef.current = (plrs as Player[]) ?? [];
        setPlayers(playersRef.current);
      }

      // 2. Dynamic data — ALWAYS refresh, PARALLELIZED
      const { data: msData } = await supabase.from("ls_match_state").select("*")
        .eq("match_id", matchId).maybeSingle();
      setMatchState((msData as unknown as MatchState) ?? null);

      let inn: Innings | null = null;
      if (msData && (msData as any).current_innings_id) {
        // Fetch innings + stats in parallel
        const [innResult, bsResult, bwsResult] = await Promise.all([
          supabase.from("ls_innings").select("*").eq("id", (msData as any).current_innings_id).maybeSingle(),
          supabase.from("ls_batting_stats").select("*").eq("innings_id", (msData as any).current_innings_id),
          supabase.from("ls_bowling_stats").select("*").eq("innings_id", (msData as any).current_innings_id),
        ]);
        inn = (innResult.data as unknown as Innings) ?? null;
        setBattingStats((bsResult.data as BattingStats[]) ?? []);
        setBowlingStats((bwsResult.data as BowlingStats[]) ?? []);
      }
      if (!inn) {
        const { data: innData } = await supabase.from("ls_innings").select("*")
          .eq("match_id", matchId).order("innings_number", { ascending: false }).limit(1).maybeSingle();
        inn = (innData as unknown as Innings) ?? null;
      }
      setInnings(inn);

      const cs = buildCricketState(m, (msData as unknown as MatchState) ?? null, inn);
      setCricketState(cs);
      return true;
    } catch (err) {
      console.error("[CricketLive] loadData ERROR:", err);
      return false;
    }
  }, [matchId]);

  /* ── Centralized resilient data layer ──
   * Uses useLiveMatch with custom fetcher for auto-reconnect,
   * tab visibility refresh, polling fallback, and race prevention.
   */
  const { loading, error, connectionStatus } = useLiveMatch<CricketMatchState>({
    matchId,
    initialState: DEFAULT_CRICKET_STATE,
    fetcher: loadData,
  });



  /* ── Overlay detection ── */
  useEffect(() => {
    const prev = prevStateRef.current;
    const curr = cricketState;
    if (prev === curr) return;

    let event: OverlayEvent | null = null;
    if (curr.lastEvent) {
      const le = curr.lastEvent.toLowerCase();
      if (curr.runs > prev.runs && (curr.runs - prev.runs) >= 6 && !le.includes("wicket")) {
        event = { type: "SIX" };
      } else if (curr.runs > prev.runs && (curr.runs - prev.runs) === 4 && !le.includes("extra")) {
        event = { type: "FOUR" };
      } else if (le.includes("wicket") || curr.wickets > prev.wickets) {
        event = { type: "WICKET" };
      } else if (le.includes("extra") && le.includes("wide")) {
        event = { type: "WIDE" };
      } else if (le.includes("extra") && le.includes("no")) {
        event = { type: "NO BALL" };
      } else if (curr.runs > prev.runs) {
        event = { type: "RUNS", value: curr.runs - prev.runs };
      }
    }

    if (event) {
      if (overlayTimer.current) clearTimeout(overlayTimer.current);
      setOverlayExiting(false);
      setOverlay(event);
      overlayTimer.current = setTimeout(() => {
        setOverlayExiting(true);
        setTimeout(() => { setOverlay(null); setOverlayExiting(false); }, 400);
      }, 1500);
    }
    prevStateRef.current = curr;
  }, [cricketState]);

  const pName = (id: string | null) => {
    if (!id) return "—";
    return players.find((p) => p.id === id)?.name ?? "Unknown";
  };

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

  const topScorer = battingStats.reduce(
    (best, s) => (s.runs > (best?.runs ?? -1) ? s : best), null as BattingStats | null
  );

  const totalOvers = (match?.settings as Record<string, number>)?.overs_per_innings
    ?? (match?.settings as Record<string, number>)?.overs ?? 20;

  const realOvers = toRealOvers(cricketState.overs);
  const crr = realOvers > 0 ? (cricketState.runs / realOvers).toFixed(2) : "0.00";
  const isSecondInnings = cricketState.currentInningsNumber === 2;
  const rrr = isSecondInnings && cricketState.target && realOvers > 0
    ? (() => {
        const remaining = toRealOvers(totalOvers) - realOvers;
        const needed = cricketState.target - cricketState.runs;
        return remaining > 0 ? (needed / remaining).toFixed(2) : "—";
      })()
    : null;

  /* ── Overlay config ── */
  const overlayConfig = overlay
    ? (() => {
        switch (overlay.type) {
          case "SIX": return { text: "SIX!", className: "overlay-six", bg: "bg-gradient-to-br from-amber-500/95 to-orange-600/95", textColor: "text-white", icon: "🔥" };
          case "FOUR": return { text: "FOUR!", className: "overlay-four", bg: "bg-gradient-to-br from-blue-500/95 to-cyan-600/95", textColor: "text-white", icon: "💥" };
          case "WICKET": return { text: "OUT!", className: "overlay-wicket", bg: "bg-gradient-to-br from-red-600/95 to-rose-700/95", textColor: "text-white", icon: "🔴" };
          case "WIDE": return { text: "WIDE", className: "overlay-extra", bg: "bg-yellow-500/90", textColor: "text-black", icon: "" };
          case "NO BALL": return { text: "NO BALL", className: "overlay-extra", bg: "bg-yellow-500/90", textColor: "text-black", icon: "" };
          case "RUNS": return { text: `+${overlay.value}`, className: "overlay-runs", bg: "bg-[var(--surface)]/90", textColor: "text-[var(--text)]", icon: "" };
        }
      })()
    : null;

  /* ═══ RENDER ═══ */
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
      </div>
    );
  }

  // Show post-match result if completed
  if (cricketState.matchStatus === "completed") {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <CricketMatchResult matchId={matchId} />
      </div>
    );
  }

  const battingTeamId = innings?.batting_team_id ?? match.team_a_id;
  const battingTeamName = battingTeamId === match.team_a_id
    ? (teamA?.name ?? "Team A")
    : (teamB?.name ?? "Team B");
  const bowlingTeamName = battingTeamId === match.team_a_id
    ? (teamB?.name ?? "Team B")
    : (teamA?.name ?? "Team A");

  const overBalls: Ball[] = matchState?.balls_this_over ?? [];
  const ballLabel = (b: Ball): string => {
    if (b.is_wicket) return "W";
    if (b.extra_type === "wide") return "Wd";
    if (b.extra_type === "no_ball") return "Nb";
    if (b.extra_type === "bye") return `B${b.runs_extra}`;
    if (b.extra_type === "leg_bye") return `Lb${b.runs_extra}`;
    return String(b.runs_bat);
  };
  const ballColor = (b: Ball): string => {
    if (b.is_wicket) return "bg-red-500/20 text-red-400 border-red-500";
    if (b.runs_bat === 4) return "bg-[var(--primary)]/20 text-[var(--primary)] border-[var(--primary)]";
    if (b.runs_bat === 6) return "bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]";
    if (b.extra_type) return "bg-yellow-500/20 text-yellow-400 border-yellow-500";
    if (b.runs_bat === 0) return "bg-[var(--surface-alt)] text-[var(--text-muted)] border-[var(--border-ui)]";
    return "bg-[var(--surface)] text-[var(--text)] border-[var(--border-ui)]";
  };

  // Not started yet
  if (cricketState.matchStatus === "scheduled") {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">🏏</div>
          <h2 className="text-xl font-bold text-[var(--text)] mb-2">Match Not Started</h2>
          <p className="text-[var(--text-muted)] text-sm">
            {teamA?.name ?? "Team A"} vs {teamB?.name ?? "Team B"}
          </p>
          <p className="text-[var(--text-muted)] text-xs mt-1">Waiting for the scorer to begin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] relative overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: overlayAnimCSS }} />

      {/* ═══ OVERLAY ═══ */}
      {overlay && overlayConfig && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none ${overlayExiting ? "overlay-exit" : ""}`}>
          <div className={`${overlayConfig.bg} ${overlayConfig.className} rounded-3xl px-12 py-8 flex flex-col items-center gap-2 shadow-2xl`}>
            {overlayConfig.icon && <span className="text-5xl">{overlayConfig.icon}</span>}
            <span className={`text-6xl md:text-8xl font-black tracking-tight ${overlayConfig.textColor}`}>
              {overlayConfig.text}
            </span>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        {/* ═══ SCORE HEADER ═══ */}
        <div className="card !p-4 bg-gradient-to-r from-[var(--surface)] to-[var(--surface-alt)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-red-500/20 text-red-400 badge-live">
              LIVE
            </span>
            <span className="text-xs text-[var(--text-muted)]">Innings {cricketState.currentInningsNumber}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-base font-semibold text-[var(--text)]">{battingTeamName}</h2>
            </div>
            <div className="text-center px-4">
              <p className="text-4xl font-black text-[var(--primary)] tabular-nums">
                {cricketState.runs}<span className="text-[var(--text-muted)] text-2xl">/{cricketState.wickets}</span>
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                ({formatOvers(cricketState.overs)} ov) · CRR: {crr}
              </p>
              {cricketState.target && isSecondInnings && (
                <p className="text-xs text-[var(--accent)] font-medium mt-1">
                  Target: {cricketState.target} {rrr && `· RRR: ${rrr}`}
                </p>
              )}
            </div>
            <div className="flex-1 text-right">
              <h2 className="text-base font-semibold text-[var(--text)]">{bowlingTeamName}</h2>
            </div>
          </div>

          {/* Active Players */}
          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div className={`rounded-lg p-2.5 ${cricketState.striker ? 'striker-glow bg-[var(--surface)]' : 'bg-[var(--surface-alt)]'}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--text)]">
                  {pName(cricketState.striker)}*
                </span>
                <span className="text-[var(--text-muted)] text-xs">
                  {battingStats.find(s => s.player_id === cricketState.striker)?.runs ?? 0}
                  ({battingStats.find(s => s.player_id === cricketState.striker)?.balls_faced ?? 0})
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[var(--text-muted)] text-xs">{pName(cricketState.nonStriker)}</span>
                <span className="text-[var(--text-muted)] text-xs">
                  {battingStats.find(s => s.player_id === cricketState.nonStriker)?.runs ?? 0}
                  ({battingStats.find(s => s.player_id === cricketState.nonStriker)?.balls_faced ?? 0})
                </span>
              </div>
            </div>
            <div className="bg-[var(--surface-alt)] rounded-lg p-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--text)]">🎯 {pName(cricketState.bowler)}</span>
              </div>
              <span className="text-[var(--text-muted)] text-xs">
                {formatOvers(bowlingStats.find(s => s.player_id === cricketState.bowler)?.overs ?? 0)}-
                {bowlingStats.find(s => s.player_id === cricketState.bowler)?.maidens ?? 0}-
                {bowlingStats.find(s => s.player_id === cricketState.bowler)?.runs_conceded ?? 0}-
                {bowlingStats.find(s => s.player_id === cricketState.bowler)?.wickets ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ OVER TAPE ═══ */}
        {overBalls.length > 0 && (
          <div className="card !p-3">
            <h3 className="text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wide">This Over</h3>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {overBalls.map((b, i) => (
                <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 transition-all ${ballColor(b)}`}>
                  {ballLabel(b)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ BATTING TABLE ═══ */}
        <div className="card !p-0 overflow-hidden">
          <h3 className="text-sm font-semibold text-[var(--text)] p-3 pb-2 uppercase tracking-wide">📊 Batting</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-ui)] text-[var(--text-muted)] text-xs uppercase">
                  <th className="text-left py-2 px-3">Player</th>
                  <th className="text-right py-2 px-2">R</th>
                  <th className="text-right py-2 px-2">B</th>
                  <th className="text-right py-2 px-2">4s</th>
                  <th className="text-right py-2 px-2">6s</th>
                  <th className="text-right py-2 px-3">SR</th>
                </tr>
              </thead>
              <tbody>
                {battingStats
                  .filter((s) => s.balls_faced > 0 || s.runs > 0)
                  .sort((a, b) => (a.batting_position ?? 99) - (b.batting_position ?? 99))
                  .map((s) => {
                    const isStriker = s.player_id === cricketState.striker;
                    const isTop = topScorer?.player_id === s.player_id && s.runs > 0;
                    const sr = s.balls_faced > 0 ? ((s.runs / s.balls_faced) * 100).toFixed(1) : "0.0";
                    return (
                      <tr key={s.id} className={`border-b border-[var(--border-ui)]/50 ${isStriker ? "bg-[var(--primary)]/5" : ""}`}>
                        <td className="py-2 px-3">
                          <span className={`font-medium ${isTop ? "text-[var(--accent)] font-bold" : "text-[var(--text)]"}`}>
                            {pName(s.player_id)}{isStriker && " *"}
                          </span>
                          {s.is_out && <div className="text-[var(--text-muted)] text-[10px]">{dismissalText(s)}</div>}
                          {!s.is_out && !isStriker && <div className="text-[var(--accent)] text-[10px]">not out</div>}
                        </td>
                        <td className={`text-right py-2 px-2 font-bold ${isTop ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>{s.runs}</td>
                        <td className="text-right py-2 px-2 text-[var(--text-muted)]">{s.balls_faced}</td>
                        <td className="text-right py-2 px-2 text-[var(--text-muted)]">{s.fours}</td>
                        <td className="text-right py-2 px-2 text-[var(--text-muted)]">{s.sixes}</td>
                        <td className="text-right py-2 px-3 text-[var(--text-muted)]">{sr}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ BOWLING TABLE ═══ */}
        <div className="card !p-0 overflow-hidden">
          <h3 className="text-sm font-semibold text-[var(--text)] p-3 pb-2 uppercase tracking-wide">🎯 Bowling</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-ui)] text-[var(--text-muted)] text-xs uppercase">
                  <th className="text-left py-2 px-3">Player</th>
                  <th className="text-right py-2 px-2">O</th>
                  <th className="text-right py-2 px-2">M</th>
                  <th className="text-right py-2 px-2">R</th>
                  <th className="text-right py-2 px-2">W</th>
                  <th className="text-right py-2 px-3">Econ</th>
                </tr>
              </thead>
              <tbody>
                {bowlingStats
                  .filter((s) => s.overs > 0 || s.wickets > 0)
                  .map((s) => {
                    const isCurrent = s.player_id === cricketState.bowler;
                    const real = toRealOvers(s.overs);
                    const econ = real > 0 ? (s.runs_conceded / real).toFixed(1) : "0.0";
                    return (
                      <tr key={s.id} className={`border-b border-[var(--border-ui)]/50 ${isCurrent ? "bg-[var(--primary)]/5" : ""}`}>
                        <td className="py-2 px-3">
                          <span className={`font-medium ${isCurrent ? "text-[var(--primary)]" : "text-[var(--text)]"}`}>
                            {pName(s.player_id)}{isCurrent && " •"}
                          </span>
                        </td>
                        <td className="text-right py-2 px-2 font-bold text-[var(--text)]">{formatOvers(s.overs)}</td>
                        <td className="text-right py-2 px-2 text-[var(--text-muted)]">{s.maidens}</td>
                        <td className="text-right py-2 px-2 text-[var(--text-muted)]">{s.runs_conceded}</td>
                        <td className="text-right py-2 px-2 font-bold text-[var(--text)]">{s.wickets}</td>
                        <td className="text-right py-2 px-3 text-[var(--text-muted)]">{econ}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
