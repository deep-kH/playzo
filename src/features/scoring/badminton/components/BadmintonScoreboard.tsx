// src/features/scoring/badminton/components/BadmintonScoreboard.tsx
import React from "react";
import type { BadmintonMatchState, GameScore } from "../types";
import { getCurrentScore } from "../types";

interface Props {
  state: BadmintonMatchState;
  teamAName: string;
  teamBName: string;
}

function GameDots({ won, total = 2 }: { won: number; total?: number }) {
  return (
    <div className="flex gap-1.5 justify-center mt-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full border ${
            i < won
              ? "bg-[var(--primary)] border-[var(--primary)]"
              : "bg-transparent border-[var(--border)]"
          }`}
        />
      ))}
    </div>
  );
}

export function BadmintonScoreboard({ state, teamAName, teamBName }: Props) {
  const { current_game, games_won, server, serving_side, status } = state;
  const currentScore = getCurrentScore(state);
  const isServerA = server === "team_a";
  const isServerB = server === "team_b";

  const statusLabel =
    status === "interval"  ? "Interval" :
    status === "completed" ? "Final"    : "Live";

  return (
    <div className="space-y-4 w-full max-w-3xl mx-auto">
      {/* Main Score Banner */}
      <div className="flex items-stretch bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-[0_8px_24px_var(--shadow)] overflow-hidden">
        {/* Team A */}
        <div className={`flex-1 flex flex-col items-center justify-center p-5 transition-colors ${isServerA ? "bg-[var(--primary)]/5" : ""}`}>
          <div className="text-lg font-black uppercase tracking-widest text-[var(--text)] mb-1">{teamAName}</div>
          <div className="text-7xl font-bold tabular-nums text-[var(--text)] leading-none">{currentScore.team_a}</div>
          <GameDots won={games_won.team_a} />
          {isServerA && (
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] uppercase tracking-wide">
              <div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
              Serving · {serving_side}
            </div>
          )}
        </div>

        {/* Center */}
        <div className="flex flex-col items-center justify-center px-5 bg-[var(--text)] text-[var(--surface)] min-w-[90px]">
          <div className="text-xs uppercase tracking-widest opacity-60 font-semibold mb-1">Game</div>
          <div className="text-4xl font-bold">{current_game}</div>
          <div className="text-xs opacity-60 mt-2 uppercase tracking-wide">{statusLabel}</div>
        </div>

        {/* Team B */}
        <div className={`flex-1 flex flex-col items-center justify-center p-5 transition-colors ${isServerB ? "bg-[var(--primary)]/5" : ""}`}>
          <div className="text-lg font-black uppercase tracking-widest text-[var(--text)] mb-1">{teamBName}</div>
          <div className="text-7xl font-bold tabular-nums text-[var(--primary)] leading-none">{currentScore.team_b}</div>
          <GameDots won={games_won.team_b} />
          {isServerB && (
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] uppercase tracking-wide">
              <div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
              Serving · {serving_side}
            </div>
          )}
        </div>
      </div>

      {/* Previous Games */}
      {current_game > 1 && (
        <div className="flex justify-center gap-4">
          {(["g1", "g2", "g3"] as const).slice(0, current_game - 1).map((key, i) => (
            <div key={key} className="text-center bg-[var(--surface-alt)] rounded-xl px-5 py-2 border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">Game {i + 1}</div>
              <div className="text-base font-bold tabular-nums text-[var(--text)]">{state.scores[key].team_a} – {state.scores[key].team_b}</div>
            </div>
          ))}
        </div>
      )}

      {/* Event ticker */}
      {state.last_event_text && state.last_event_text !== "point" && (
        <div className="text-center text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] animate-pulse">
          {state.last_event_text.replace(/_/g, " ")}
        </div>
      )}
    </div>
  );
}
