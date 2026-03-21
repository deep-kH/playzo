// ============================================================================
// FootballClock — Countdown timer display component (Rebuilt V5)
// ============================================================================
"use client";

import React from "react";
import type { FootballMatchState } from "../types";
import { useFootballClock } from "../hooks";

interface Props {
  state: FootballMatchState;
  halfDurationSeconds: number;
  size?: "sm" | "lg";
}

export function FootballClock({ state, halfDurationSeconds, size = "sm" }: Props) {
  const clock = useFootballClock(state, halfDurationSeconds);

  if (state.phase === "not_started" || state.phase === "ended") {
    return null;
  }

  const isLarge = size === "lg";

  return (
    <div className="flex items-center gap-2">
      <div className={`font-mono font-bold tabular-nums ${isLarge ? "text-2xl" : "text-sm"} text-[var(--primary)]`}>
        {clock.display}
      </div>
      {clock.inStoppage && state.clock_running && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold animate-pulse">
          ⏱ STOPPAGE
        </span>
      )}
    </div>
  );
}
