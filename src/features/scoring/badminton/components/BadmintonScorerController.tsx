// src/features/scoring/badminton/components/BadmintonScorerController.tsx
"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { processGenericEvent } from "../../api";
import type {
  BadmintonEventType,
  BadmintonMatchState,
  BadmintonTeam,
} from "../types";
import { getCurrentScore, getScoresArray } from "../types";

interface PlayerInfo {
  id: string;
  name: string;
}

interface Props {
  matchId: string;
  state: BadmintonMatchState;
  teamAName: string;
  teamBName: string;
  teamAPlayers: PlayerInfo[];
  teamBPlayers: PlayerInfo[];
}

// ─── Keyframes via inline style tag (injected once) ──────────────────────
const ANIMATIONS_CSS = `
@keyframes bm-flash {
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
}
@keyframes bm-shuttle-jump {
  0% { transform: translateY(0); }
  40% { transform: translateY(-12px) scale(1.2); }
  100% { transform: translateY(0) scale(1); }
}
@keyframes bm-swap-lr {
  0% { transform: translateX(0); }
  50% { transform: translateX(20px); }
  100% { transform: translateX(0); }
}
@keyframes bm-glow-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(250, 204, 21, 0.4); }
  50% { box-shadow: 0 0 20px rgba(250, 204, 21, 0.8); }
}
.bm-flash { animation: bm-flash 0.4s ease-out; }
.bm-shuttle-jump { animation: bm-shuttle-jump 0.5s ease-out; }
.bm-glow-pulse { animation: bm-glow-pulse 1.5s ease-in-out infinite; }
`;

export function BadmintonScorerController({
  matchId,
  state,
  teamAName,
  teamBName,
  teamAPlayers,
  teamBPlayers,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [flashSide, setFlashSide] = useState<BadmintonTeam | null>(null);
  const [tossWinner, setTossWinner] = useState<BadmintonTeam | null>(null);
  const [setupPositions, setSetupPositions] = useState<{ team_a: {left:string, right:string}, team_b: {left:string, right:string} } | null>(null);
  const lastTapRef = useRef(0);
  const router = useRouter();

  // Derived from configurable state
  const setsToWin  = state.sets_to_win  ?? 2;
  const totalSets  = setsToWin * 2 - 1;
  const pointsPerSet = state.points_per_set ?? 21;
  const pointCap  = state.point_cap ?? 30;

  const isDoubles = state.match_type === "doubles";

  React.useEffect(() => {
    // Initialize setup positions when players load
    if (isDoubles && teamAPlayers.length >= 2 && teamBPlayers.length >= 2 && !setupPositions) {
      setSetupPositions({
        team_a: { left: teamAPlayers[0].id, right: teamAPlayers[1].id },
        team_b: { left: teamBPlayers[0].id, right: teamBPlayers[1].id },
      });
    }
  }, [isDoubles, teamAPlayers, teamBPlayers]);

  const dispatch = useCallback(
    async (type: BadmintonEventType, extra?: Record<string, unknown>) => {
      const now = Date.now();
      if (now - lastTapRef.current < 300) return;
      lastTapRef.current = now;
      if (type === "match_end") {
        const msg = (state.games_won.team_a >= setsToWin || state.games_won.team_b >= setsToWin)
          ? "End and finalize this match?"
          : "End match early? It will be marked as INCOMPLETE and can be resumed later.";
        if (!confirm(msg)) return;
      }
      try {
        setLoading(true);
        await processGenericEvent(matchId, type, (extra ?? {}) as any);
        const labels: Record<string, string> = { point: "Point!", deuce: "Deuce!", golden_point: "Golden Point!", set_won: "Set Won!" };
        showToast(labels[type] ?? type.replace(/_/g, " "));
      } catch (err: any) {
        alert("Action failed: " + err.message);
      } finally {
        setLoading(false);
      }
    },
    [matchId, state.games_won, setsToWin]
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const awardPoint = (team: BadmintonTeam) => {
    setFlashSide(team);
    setTimeout(() => setFlashSide(null), 400);
    dispatch("point", { team });
  };

  const isLive = state.status === "live";
  const isScheduled = state.status === "scheduled";
  const isInterval = state.status === "interval";
  const isCompleted = state.status === "completed";
  const isIncomplete = state.status === "incomplete";
  const currentScore = getCurrentScore(state);
  const isServerA = state.server === "team_a";

  // Auto-prompt when match just completed
  useEffect(() => {
    if (isCompleted && state.last_event_text === "match_end") {
      setTimeout(() => {
        if (confirm("Match complete! Go to post-match summary?")) {
          router.push(`/live/matches/${matchId}/badminton`);
        }
      }, 600);
    }
  }, [isCompleted, state.last_event_text]);

  const getPlayerName = (teamId: BadmintonTeam, playerId?: string) => {
    const players = teamId === 'team_a' ? teamAPlayers : teamBPlayers;
    const player = players.find(p => p.id === playerId);
    return player ? player.name : "Unknown Player";
  };

  const posA = state.doubles_positions?.team_a ?? { left: teamAPlayers[0]?.id, right: teamAPlayers[1]?.id };
  const posB = state.doubles_positions?.team_b ?? { left: teamBPlayers[0]?.id, right: teamBPlayers[1]?.id };

  const playerA1 = isDoubles ? getPlayerName('team_a', posA.left) : (teamAPlayers[0]?.name ?? "Player A1");
  const playerA2 = isDoubles ? getPlayerName('team_a', posA.right) : (teamAPlayers[1]?.name ?? "Player A2");
  const playerB1 = isDoubles ? getPlayerName('team_b', posB.left) : (teamBPlayers[0]?.name ?? "Player B1");
  const playerB2 = isDoubles ? getPlayerName('team_b', posB.right) : (teamBPlayers[1]?.name ?? "Player B2");

  // For singles, show player name. For doubles, show "Player A & Player B" if no real team name.
  const sideALabel = isDoubles
    ? (teamAName && teamAName !== "Team A" ? teamAName : `${playerA1} & ${playerA2}`)
    : playerA1;
  const sideBLabel = isDoubles
    ? (teamBName && teamBName !== "Team B" ? teamBName : `${playerB1} & ${playerB2}`)
    : playerB1;

  // Resolve who exactly is serving (by name)
  const getServingPlayerName = (): string => {
    const serverTeam = state.server;
    if (!isDoubles) {
      // Singles: the serving team IS the serving player
      return serverTeam === "team_a" ? playerA1 : playerB1;
    }
    // Doubles: the player on the serving_side court of the serving team is the server
    const pos = serverTeam === "team_a" ? posA : posB;
    const serverId = state.serving_side === "right" ? pos.right : pos.left;
    return getPlayerName(serverTeam, serverId);
  };
  const serverPlayerName = getServingPlayerName();
  const serverLabel = serverPlayerName;

  return (
    <div className="space-y-5">
      <style dangerouslySetInnerHTML={{ __html: ANIMATIONS_CSS }} />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--text)] text-[var(--surface)] px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-fade-in">
          {toast}
        </div>
      )}

      {/* Status Bar */}
      <div className="flex items-center justify-between bg-[var(--text)] text-[var(--surface)] px-5 py-3 rounded-xl">
        <span className="text-sm font-semibold uppercase tracking-wide opacity-70">
          Set {state.current_game} of {totalSets} · {state.match_type}
        </span>
        <div className="flex items-center gap-4 text-sm">
          {!isScheduled && (
            <button
              onClick={() => {
                const url = `${window.location.origin}/live/matches/${matchId}/badminton`;
                navigator.clipboard.writeText(url);
                showToast("Live link copied!");
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold tracking-wide transition-all active:scale-95"
            >
              <span>🔗 Link</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isLive
                  ? "bg-[var(--success)] animate-pulse"
                  : "opacity-40 bg-current"
              }`}
            />
            <span className="font-semibold capitalize">{state.status}</span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          SCHEDULED — Match Setup
         ════════════════════════════════════════════════════ */}
      {isScheduled && !tossWinner && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Who Serves First?
            </h3>
            <div className="flex gap-3">
              <button
                disabled={loading}
                onClick={() => {
                  if (isDoubles) {
                    setTossWinner("team_a");
                  } else {
                    dispatch("match_start", { first_server: "team_a", match_type: state.match_type, points_per_set: pointsPerSet, sets_to_win: setsToWin, point_cap: pointCap });
                  }
                }}
                className="flex-1 py-4 rounded-xl font-bold text-white bg-[var(--primary)] hover:brightness-110 active:scale-95 touch-manipulation disabled:opacity-50 transition-all"
              >
                🏸 {sideALabel}
              </button>
              <button
                disabled={loading}
                onClick={() => {
                  if (isDoubles) {
                    setTossWinner("team_b");
                  } else {
                    dispatch("match_start", { first_server: "team_b", match_type: state.match_type, points_per_set: pointsPerSet, sets_to_win: setsToWin, point_cap: pointCap });
                  }
                }}
                className="flex-1 py-4 rounded-xl font-bold text-white bg-[var(--success)] hover:brightness-110 active:scale-95 touch-manipulation disabled:opacity-50 transition-all"
              >
                🏸 {sideBLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {isScheduled && tossWinner && isDoubles && setupPositions && (
        <div className="space-y-6 animate-fade-in">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Confirm Formation
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Set starting positions. The player on the <b>Right</b> for {tossWinner === "team_a" ? sideALabel : sideBLabel} will serve first.
            </p>
            <div className="space-y-4 text-sm font-medium">
              <div className="p-3 bg-[var(--surface-alt)] rounded-lg flex items-center justify-between border border-[var(--border)]">
                <div>
                  <div className="text-[var(--primary)] text-xs uppercase tracking-wider mb-1 font-bold">{sideALabel}</div>
                  <div className="text-[var(--text)]">Left: <span className="text-[var(--text-muted)] font-normal">{getPlayerName('team_a', setupPositions.team_a.left)}</span></div>
                  <div className="text-[var(--text)]">Right: <span className="text-[var(--text-muted)] font-normal">{getPlayerName('team_a', setupPositions.team_a.right)}</span></div>
                </div>
                <button 
                  onClick={() => setSetupPositions({
                    ...setupPositions, 
                    team_a: {left: setupPositions.team_a.right, right: setupPositions.team_a.left}
                  })}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold hover:bg-[var(--border)] active:scale-95 transition-all text-[var(--text)]"
                >Swap L/R</button>
              </div>

              <div className="p-3 bg-[var(--surface-alt)] rounded-lg flex items-center justify-between border border-[var(--border)]">
                <div>
                  <div className="text-[var(--success)] text-xs uppercase tracking-wider mb-1 font-bold">{sideBLabel}</div>
                  <div className="text-[var(--text)]">Left: <span className="text-[var(--text-muted)] font-normal">{getPlayerName('team_b', setupPositions.team_b.left)}</span></div>
                  <div className="text-[var(--text)]">Right: <span className="text-[var(--text-muted)] font-normal">{getPlayerName('team_b', setupPositions.team_b.right)}</span></div>
                </div>
                <button 
                  onClick={() => setSetupPositions({
                    ...setupPositions, 
                    team_b: {left: setupPositions.team_b.right, right: setupPositions.team_b.left}
                  })}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold hover:bg-[var(--border)] active:scale-95 transition-all text-[var(--text)]"
                >Swap L/R</button>
              </div>
            </div>

            <button
              disabled={loading}
              onClick={() => {
                dispatch("match_start", {
                  first_server: tossWinner,
                  match_type: state.match_type,
                  doubles_positions: setupPositions,
                  points_per_set: pointsPerSet,
                  sets_to_win: setsToWin,
                  point_cap: pointCap,
                });
              }}
              className="w-full mt-2 py-4 rounded-xl font-bold text-[var(--surface)] bg-[var(--text)] hover:brightness-110 active:scale-95 transition-all text-sm"
            >
              🚀 Start Match
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          LIVE — Court View (Singles or Doubles)
         ════════════════════════════════════════════════════ */}
      {isLive && (
        <>
          {/* Serving Info */}
          <div className="text-center text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
            <span className="bm-shuttle-jump inline-block mr-1">🟡</span>
            {serverLabel} Serving ({state.serving_side} court)
          </div>

          {isDoubles ? (
            /* ─── DOUBLES: Quad System (2×2 Court Grid) ─── */
            <div className="space-y-1">
              {/* Team A Zone (Top) */}
              <button
                disabled={loading}
                onClick={() => awardPoint("team_a")}
                className={`w-full rounded-t-2xl border-2 transition-all duration-200 active:scale-[0.98] touch-manipulation disabled:opacity-50 relative overflow-hidden ${
                  flashSide === "team_a"
                    ? "bm-flash border-[var(--primary)] bg-[var(--primary)]/10"
                    : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-alt)]"
                }`}
              >
                {/* Team A Label */}
                <div className="text-center py-2 border-b border-[var(--border)]">
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    {sideALabel}
                  </span>
                  {isServerA && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 bm-glow-pulse inline-block" />
                      <span className="text-[10px] font-bold text-yellow-600 uppercase">
                        Serving
                      </span>
                    </span>
                  )}
                </div>
                {/* A1 | A2 grid */}
                <div className="flex">
                  <div
                    className={`flex-1 flex flex-col items-center justify-center py-6 border-r border-[var(--border)] transition-all ${
                      isServerA && state.serving_side === "left"
                        ? "bg-yellow-400/15 bm-glow-pulse"
                        : ""
                    }`}
                  >
                    <div className="text-sm font-bold text-[var(--text)] mb-1">
                      {playerA1}
                    </div>
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">
                      Left
                    </div>
                  </div>
                  <div
                    className={`flex-1 flex flex-col items-center justify-center py-6 transition-all ${
                      isServerA && state.serving_side === "right"
                        ? "bg-yellow-400/15 bm-glow-pulse"
                        : ""
                    }`}
                  >
                    <div className="text-sm font-bold text-[var(--text)] mb-1">
                      {playerA2}
                    </div>
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">
                      Right
                    </div>
                  </div>
                </div>
              </button>

              {/* Score Display (Net Line) */}
              <div className="flex items-center justify-center gap-6 py-3 bg-[var(--text)] rounded-lg">
                <div className="text-4xl font-bold tabular-nums text-[var(--primary)]">
                  {currentScore.team_a}
                </div>
                <div className="text-sm font-bold text-[var(--surface)] opacity-60">
                  —
                </div>
                <div className="text-4xl font-bold tabular-nums text-[var(--success)]">
                  {currentScore.team_b}
                </div>
              </div>

              {/* Team B Zone (Bottom) */}
              <button
                disabled={loading}
                onClick={() => awardPoint("team_b")}
                className={`w-full rounded-b-2xl border-2 transition-all duration-200 active:scale-[0.98] touch-manipulation disabled:opacity-50 relative overflow-hidden ${
                  flashSide === "team_b"
                    ? "bm-flash border-[var(--success)] bg-[var(--success)]/10"
                    : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-alt)]"
                }`}
              >
                {/* B1 | B2 grid */}
                <div className="flex">
                  <div
                    className={`flex-1 flex flex-col items-center justify-center py-6 border-r border-[var(--border)] transition-all ${
                      !isServerA && state.serving_side === "left"
                        ? "bg-yellow-400/15 bm-glow-pulse"
                        : ""
                    }`}
                  >
                    <div className="text-sm font-bold text-[var(--text)] mb-1">
                      {playerB1}
                    </div>
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">
                      Left
                    </div>
                  </div>
                  <div
                    className={`flex-1 flex flex-col items-center justify-center py-6 transition-all ${
                      !isServerA && state.serving_side === "right"
                        ? "bg-yellow-400/15 bm-glow-pulse"
                        : ""
                    }`}
                  >
                    <div className="text-sm font-bold text-[var(--text)] mb-1">
                      {playerB2}
                    </div>
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">
                      Right
                    </div>
                  </div>
                </div>
                {/* Team B Label */}
                <div className="text-center py-2 border-t border-[var(--border)]">
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    {sideBLabel}
                  </span>
                  {!isServerA && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 bm-glow-pulse inline-block" />
                      <span className="text-[10px] font-bold text-yellow-600 uppercase">
                        Serving
                      </span>
                    </span>
                  )}
                </div>
              </button>

              {/* Flip Partners Buttons */}
              <div className="flex gap-3 mt-2">
                <button
                  disabled={loading}
                  onClick={() =>
                    dispatch("flip_positions", { team: "team_a" })
                  }
                  className="flex-1 h-10 rounded-xl text-sm font-semibold border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-alt)] active:scale-95 touch-manipulation disabled:opacity-50 transition-all"
                >
                  🔄 Flip {sideALabel}
                </button>
                <button
                  disabled={loading}
                  onClick={() =>
                    dispatch("flip_positions", { team: "team_b" })
                  }
                  className="flex-1 h-10 rounded-xl text-sm font-semibold border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-alt)] active:scale-95 touch-manipulation disabled:opacity-50 transition-all"
                >
                  🔄 Flip {sideBLabel}
                </button>
              </div>
            </div>
          ) : (
            /* ─── SINGLES: Split-screen Tap Zones ─── */
            <div className="flex gap-1 rounded-2xl overflow-hidden border-2 border-[var(--border)] shadow-[0_4px_20px_var(--shadow)]">
              {/* Player A Side */}
              <button
                disabled={loading}
                onClick={() => awardPoint("team_a")}
                className={`flex-1 flex flex-col items-center justify-center py-12 md:py-16 transition-all duration-200 active:scale-[0.98] touch-manipulation disabled:opacity-50 relative ${
                  flashSide === "team_a"
                    ? "bm-flash bg-[var(--primary)]/20"
                    : "bg-[var(--surface)] hover:bg-[var(--surface-alt)]"
                }`}
              >
                {isServerA && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-yellow-400 bm-glow-pulse" />
                    <span className="text-[10px] font-bold uppercase text-yellow-600 tracking-wide">
                      Serving
                    </span>
                  </div>
                )}
                {/* Court Boxes */}
                <div className="flex gap-0.5 mb-4">
                  <div
                    className={`w-10 h-10 rounded border transition-all ${
                      isServerA && state.serving_side === "left"
                        ? "border-yellow-400 bg-yellow-400/20 bm-glow-pulse"
                        : "border-[var(--border)] bg-[var(--surface-alt)]"
                    }`}
                  />
                  <div
                    className={`w-10 h-10 rounded border transition-all ${
                      isServerA && state.serving_side === "right"
                        ? "border-yellow-400 bg-yellow-400/20 bm-glow-pulse"
                        : "border-[var(--border)] bg-[var(--surface-alt)]"
                    }`}
                  />
                </div>
                <div className="text-lg font-black uppercase tracking-wider text-[var(--text)]">
                  {playerA1}
                </div>
                <div className="text-6xl font-bold tabular-nums text-[var(--primary)] leading-none mt-2">
                  {currentScore.team_a}
                </div>
              </button>

              <div className="w-1 bg-[var(--border)] self-stretch" />

              {/* Player B Side */}
              <button
                disabled={loading}
                onClick={() => awardPoint("team_b")}
                className={`flex-1 flex flex-col items-center justify-center py-12 md:py-16 transition-all duration-200 active:scale-[0.98] touch-manipulation disabled:opacity-50 relative ${
                  flashSide === "team_b"
                    ? "bm-flash bg-[var(--success)]/20"
                    : "bg-[var(--surface)] hover:bg-[var(--surface-alt)]"
                }`}
              >
                {!isServerA && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-yellow-400 bm-glow-pulse" />
                    <span className="text-[10px] font-bold uppercase text-yellow-600 tracking-wide">
                      Serving
                    </span>
                  </div>
                )}
                {/* Court Boxes */}
                <div className="flex gap-0.5 mb-4">
                  <div
                    className={`w-10 h-10 rounded border transition-all ${
                      !isServerA && state.serving_side === "left"
                        ? "border-yellow-400 bg-yellow-400/20 bm-glow-pulse"
                        : "border-[var(--border)] bg-[var(--surface-alt)]"
                    }`}
                  />
                  <div
                    className={`w-10 h-10 rounded border transition-all ${
                      !isServerA && state.serving_side === "right"
                        ? "border-yellow-400 bg-yellow-400/20 bm-glow-pulse"
                        : "border-[var(--border)] bg-[var(--surface-alt)]"
                    }`}
                  />
                </div>
                <div className="text-lg font-black uppercase tracking-wider text-[var(--text)]">
                  {playerB1}
                </div>
                <div className="text-6xl font-bold tabular-nums text-[var(--success)] leading-none mt-2">
                  {currentScore.team_b}
                </div>
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <div className="flex gap-3">
              <button
                disabled={loading}
                onClick={() => dispatch("service_fault")}
                className="flex-1 h-14 rounded-xl font-semibold border border-[var(--warning)] bg-[var(--surface)] text-[var(--warning)] hover:bg-[var(--surface-alt)] active:scale-95 touch-manipulation disabled:opacity-50 transition-all"
              >
                ⚠ Service Fault
              </button>
              <button
                disabled={loading}
                onClick={() => dispatch("undo")}
                className="flex-1 h-14 rounded-xl font-semibold border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-alt)] active:scale-95 touch-manipulation disabled:opacity-50 transition-all"
              >
                ↩ Undo Last Rally
              </button>
            </div>
            <button
              disabled={loading}
              onClick={() => dispatch("match_end")}
              className="w-full py-2.5 text-sm text-[var(--danger)] border border-[var(--border)] rounded-xl hover:bg-[var(--surface-alt)] transition-colors disabled:opacity-50"
            >
              End Match
            </button>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════
          INTERVAL — Between Games
         ════════════════════════════════════════════════════ */}
      {isInterval && (
        <div className="text-center space-y-4 py-4">
          <div className="text-lg font-bold text-[var(--text)]">
           ⏸ Set Complete
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Players resting — confirm when ready to start next set.
          </p>
          <button
            disabled={loading}
            onClick={() => dispatch("game_start")}
            className="w-full py-4 rounded-xl font-bold text-[var(--surface)] bg-[var(--text)] hover:opacity-90 active:scale-95 touch-manipulation disabled:opacity-50 transition-all"
          >
            ▶ Start Next Set
          </button>
        </div>
      )}

      {/* INCOMPLETE */}
      {isIncomplete && (
        <div className="text-center py-6 space-y-3 rounded-xl border-2 border-[var(--warning)]/40 bg-[var(--warning)]/5 p-5">
          <div className="text-4xl mb-1">⚠️</div>
          <div className="text-lg font-black text-[var(--text)]">Match Stopped Early</div>
          <p className="text-sm text-[var(--text-muted)] max-w-xs mx-auto">
            Ended before a winner was decided. Resume to continue.
          </p>
          <button
            disabled={loading}
            onClick={() => dispatch("match_resume" as any)}
            className="w-full py-3 rounded-xl font-bold text-[var(--surface)] bg-[var(--warning)] hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
          >
            ▶ Resume Match
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          COMPLETED
         ════════════════════════════════════════════════════ */}
      {isCompleted && (
        <div className="text-center py-8 space-y-3">
          <div className="text-5xl mb-2">🏆</div>
          <div className="text-2xl font-black text-[var(--text)]">
            Match Complete
          </div>
          <div className="text-lg font-bold tabular-nums text-[var(--text-muted)]">
            {sideALabel} {state.games_won.team_a} — {state.games_won.team_b}{" "}
            {sideBLabel}
          </div>
        </div>
      )}

      {/* Games Won Bar */}
      <div className="flex items-center justify-between bg-[var(--surface-alt)] rounded-xl px-5 py-3 border border-[var(--border)]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[var(--text)]">
            {sideALabel}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: setsToWin }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 ${
                  i < state.games_won.team_a
                    ? "bg-[var(--primary)] border-[var(--primary)]"
                    : "bg-transparent border-[var(--border)]"
                }`}
              />
            ))}
          </div>
        </div>
        <span className="text-xs font-bold text-[var(--text-muted)] uppercase">
          Sets
        </span>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {Array.from({ length: setsToWin }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 ${
                  i < state.games_won.team_b
                    ? "bg-[var(--success)] border-[var(--success)]"
                    : "bg-transparent border-[var(--border)]"
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-bold text-[var(--text)]">
            {sideBLabel}
          </span>
        </div>
      </div>

      {/* Previous Sets */}
      {state.current_game > 1 && (
        <div className="flex justify-center gap-3 flex-wrap">
          {(["g1", "g2", "g3", "g4", "g5"] as const)
            .slice(0, state.current_game - 1)
            .map((key, i) => (
              <div
                key={key}
                className="text-center bg-[var(--surface-alt)] rounded-xl px-5 py-2 border border-[var(--border)]"
              >
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">
                  Set {i + 1}
                </div>
                <div className="text-base font-bold tabular-nums text-[var(--text)]">
                  {(state.scores[key] ?? {team_a:0,team_b:0}).team_a} – {(state.scores[key] ?? {team_a:0,team_b:0}).team_b}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
