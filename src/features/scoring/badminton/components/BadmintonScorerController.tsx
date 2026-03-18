// src/features/scoring/badminton/components/BadmintonScorerController.tsx
"use client";

import React, { useState, useRef, useCallback } from "react";
import { processGenericEvent } from "../../api";
import type {
  BadmintonEventType,
  BadmintonMatchState,
  BadmintonTeam,
  MatchType,
} from "../types";
import { getCurrentScore, getScoresArray } from "../types";

interface Props {
  matchId: string;
  state: BadmintonMatchState;
  teamAName: string;
  teamBName: string;
}

// ─── Shared Styles ──────────────────────────────────────────────────────
const btn = {
  primary:
    "flex items-center justify-center gap-2 h-14 px-5 rounded-xl font-semibold text-white bg-[var(--success)] hover:brightness-110 active:scale-95 touch-manipulation disabled:opacity-50 transition-all",
  secondary:
    "flex items-center justify-center gap-2 h-14 px-5 rounded-xl font-semibold border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-alt)] active:scale-95 touch-manipulation disabled:opacity-50 transition-all",
};

export function BadmintonScorerController({ matchId, state, teamAName, teamBName }: Props) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [flashSide, setFlashSide] = useState<BadmintonTeam | null>(null);
  const lastTapRef = useRef(0);

  const dispatch = useCallback(
    async (type: BadmintonEventType, extra?: Record<string, unknown>) => {
      const now = Date.now();
      if (now - lastTapRef.current < 300) return;
      lastTapRef.current = now;
      if (type === "match_end" && !confirm("End this match now?")) return;
      try {
        setLoading(true);
        await processGenericEvent(matchId, type, (extra ?? {}) as any);
        showToast(type.replace(/_/g, " "));
      } catch (err: any) {
        alert("Action failed: " + err.message);
      } finally {
        setLoading(false);
      }
    },
    [matchId]
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
  const currentScore = getCurrentScore(state);
  const serverName = state.server === "team_a" ? teamAName : teamBName;
  const isDoubles = state.match_type === "doubles";
  const isServerA = state.server === "team_a";

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--text)] text-[var(--surface)] px-5 py-3 rounded-xl text-sm font-semibold shadow-xl">
          {toast}
        </div>
      )}

      {/* Status Bar */}
      <div className="flex items-center justify-between bg-[var(--text)] text-[var(--surface)] px-5 py-3 rounded-xl">
        <span className="text-sm font-semibold uppercase tracking-wide opacity-70">
          Game {state.current_game} of 3 · {state.match_type}
        </span>
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${isLive ? "bg-[var(--success)] animate-pulse" : "opacity-40 bg-current"}`} />
          <span className="font-semibold capitalize">{state.status}</span>
        </div>
      </div>

      {/* Match Setup (Scheduled) */}
      {isScheduled && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Who Serves First?
            </h3>
            <div className="flex gap-3">
              <button disabled={loading} onClick={() => dispatch("match_start", { first_server: "team_a", match_type: state.match_type })}
                className="flex-1 py-4 rounded-xl font-bold text-white bg-[var(--primary)] hover:brightness-110 active:scale-95 touch-manipulation disabled:opacity-50 transition-all">
                🏸 {teamAName}
              </button>
              <button disabled={loading} onClick={() => dispatch("match_start", { first_server: "team_b", match_type: state.match_type })}
                className="flex-1 py-4 rounded-xl font-bold text-white bg-[var(--success)] hover:brightness-110 active:scale-95 touch-manipulation disabled:opacity-50 transition-all">
                🏸 {teamBName}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Court View (Live) */}
      {isLive && (
        <>
          {/* Serving Info */}
          <div className="text-center text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Tap to Score — {serverName} Serving ({state.serving_side} court)
          </div>

          {/* Court: Split-screen tap zones */}
          <div className="flex gap-1 rounded-2xl overflow-hidden border-2 border-[var(--border)] shadow-[0_4px_20px_var(--shadow)]">
            {/* Team A Side */}
            <button disabled={loading} onClick={() => awardPoint("team_a")}
              className={`flex-1 flex flex-col items-center justify-center py-12 md:py-16 transition-all duration-200 active:scale-[0.98] touch-manipulation disabled:opacity-50 relative ${
                flashSide === "team_a" ? "bg-[var(--primary)]/20" : "bg-[var(--surface)] hover:bg-[var(--surface-alt)]"
              }`}>
              {isServerA && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(255,200,0,0.6)] animate-pulse" />
                  <span className="text-[10px] font-bold uppercase text-yellow-600 tracking-wide">Serving</span>
                </div>
              )}
              <div className="flex gap-0.5 mb-4">
                <div className={`w-10 h-10 rounded border ${isServerA && state.serving_side === "left" ? "border-yellow-400 bg-yellow-400/20" : "border-[var(--border)] bg-[var(--surface-alt)]"}`} />
                <div className={`w-10 h-10 rounded border ${isServerA && state.serving_side === "right" ? "border-yellow-400 bg-yellow-400/20" : "border-[var(--border)] bg-[var(--surface-alt)]"}`} />
              </div>
              <div className="text-lg font-black uppercase tracking-wider text-[var(--text)]">{teamAName}</div>
              <div className="text-6xl font-bold tabular-nums text-[var(--primary)] leading-none mt-2">{currentScore.team_a}</div>
            </button>

            <div className="w-1 bg-[var(--border)] self-stretch" />

            {/* Team B Side */}
            <button disabled={loading} onClick={() => awardPoint("team_b")}
              className={`flex-1 flex flex-col items-center justify-center py-12 md:py-16 transition-all duration-200 active:scale-[0.98] touch-manipulation disabled:opacity-50 relative ${
                flashSide === "team_b" ? "bg-[var(--success)]/20" : "bg-[var(--surface)] hover:bg-[var(--surface-alt)]"
              }`}>
              {!isServerA && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(255,200,0,0.6)] animate-pulse" />
                  <span className="text-[10px] font-bold uppercase text-yellow-600 tracking-wide">Serving</span>
                </div>
              )}
              <div className="flex gap-0.5 mb-4">
                <div className={`w-10 h-10 rounded border ${!isServerA && state.serving_side === "left" ? "border-yellow-400 bg-yellow-400/20" : "border-[var(--border)] bg-[var(--surface-alt)]"}`} />
                <div className={`w-10 h-10 rounded border ${!isServerA && state.serving_side === "right" ? "border-yellow-400 bg-yellow-400/20" : "border-[var(--border)] bg-[var(--surface-alt)]"}`} />
              </div>
              <div className="text-lg font-black uppercase tracking-wider text-[var(--text)]">{teamBName}</div>
              <div className="text-6xl font-bold tabular-nums text-[var(--success)] leading-none mt-2">{currentScore.team_b}</div>
            </button>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <div className="flex gap-3">
              <button disabled={loading} onClick={() => dispatch("service_fault")}
                className="flex-1 h-14 rounded-xl font-semibold border border-[var(--warning)] bg-[var(--surface)] text-[var(--warning)] hover:bg-[var(--surface-alt)] active:scale-95 touch-manipulation disabled:opacity-50 transition-all">
                ⚠ Service Fault
              </button>
              <button disabled={loading} onClick={() => dispatch("let")} className={btn.secondary + " flex-1"}>
                🔁 Let
              </button>
            </div>
            <div className="flex gap-3">
              <button disabled={loading} onClick={() => dispatch("match_end")}
                className="flex-1 py-2.5 text-sm text-[var(--danger)] border border-[var(--border)] rounded-xl hover:bg-[var(--surface-alt)] transition-colors disabled:opacity-50">
                End Match
              </button>
            </div>
          </div>
        </>
      )}

      {/* Interval */}
      {isInterval && (
        <div className="text-center space-y-4 py-4">
          <div className="text-lg font-bold text-[var(--text)]">⏸ Interval</div>
          <p className="text-sm text-[var(--text-muted)]">Players resting — confirm when ready</p>
          <button disabled={loading} onClick={() => dispatch("game_start")}
            className="w-full py-4 rounded-xl font-bold text-[var(--surface)] bg-[var(--text)] hover:opacity-90 active:scale-95 touch-manipulation disabled:opacity-50 transition-all">
            ▶ Resume Play
          </button>
        </div>
      )}

      {/* Completed */}
      {isCompleted && (
        <div className="text-center py-8 space-y-3">
          <div className="text-5xl mb-2">🏆</div>
          <div className="text-2xl font-black text-[var(--text)]">Match Complete</div>
          <div className="text-lg font-bold tabular-nums text-[var(--text-muted)]">
            {teamAName} {state.games_won.team_a} — {state.games_won.team_b} {teamBName}
          </div>
        </div>
      )}

      {/* Games Won Bar */}
      <div className="flex items-center justify-between bg-[var(--surface-alt)] rounded-xl px-5 py-3 border border-[var(--border)]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[var(--text)]">{teamAName}</span>
          <div className="flex gap-1">
            {[0, 1].map((i) => (
              <div key={i} className={`w-4 h-4 rounded-full border-2 ${i < state.games_won.team_a ? "bg-[var(--primary)] border-[var(--primary)]" : "bg-transparent border-[var(--border)]"}`} />
            ))}
          </div>
        </div>
        <span className="text-xs font-bold text-[var(--text-muted)] uppercase">Games</span>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[0, 1].map((i) => (
              <div key={i} className={`w-4 h-4 rounded-full border-2 ${i < state.games_won.team_b ? "bg-[var(--success)] border-[var(--success)]" : "bg-transparent border-[var(--border)]"}`} />
            ))}
          </div>
          <span className="text-sm font-bold text-[var(--text)]">{teamBName}</span>
        </div>
      </div>

      {/* Previous Games */}
      {state.current_game > 1 && (
        <div className="flex justify-center gap-3 flex-wrap">
          {(["g1", "g2", "g3"] as const).slice(0, state.current_game - 1).map((key, i) => (
            <div key={key} className="text-center bg-[var(--surface-alt)] rounded-xl px-5 py-2 border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">Game {i + 1}</div>
              <div className="text-base font-bold tabular-nums text-[var(--text)]">{state.scores[key].team_a} – {state.scores[key].team_b}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
