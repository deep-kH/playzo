// src/features/scoring/football/components/FootballClock.tsx
"use client";

import React from "react";
import { useFootballClock } from "../hooks";
import type { FootballMatchState } from "../types";
import { phaseLabel } from "../types";

export function FootballClock({ state }: { state: FootballMatchState }) {
  const { displayTimeStr, displayWithStoppage, addedTime } = useFootballClock(state);

  return (
    <div className="flex flex-col items-center justify-center p-4 min-w-[120px] rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] shadow-[0_4px_12px_var(--shadow)]">
      {/* Phase badge */}
      <div className="mb-2 px-3 py-1 text-xs font-semibold rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] uppercase tracking-wider">
        {phaseLabel(state.phase)}
      </div>
      {/* Clock digits */}
      <div className="text-3xl font-bold tracking-tighter tabular-nums text-[var(--text)]">
        {displayTimeStr}
        {addedTime > 0 && (
          <span className="text-[var(--danger)] text-lg ml-1">+{String(addedTime).padStart(2, "0")}:00</span>
        )}
      </div>
      {/* Live indicator */}
      {state.clock_running && (
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-2 h-2 rounded-full bg-[var(--danger)] animate-pulse" />
          <span className="text-xs font-semibold text-[var(--danger)] uppercase">Live</span>
        </div>
      )}
      {/* Last event ticker */}
      {lastEventLabel(state.last_event_text)}
    </div>
  );
}

function lastEventLabel(evt?: string) {
  if (!evt) return null;
  return (
    <div className="text-xs text-[var(--text-muted)] mt-2 uppercase tracking-wide font-semibold animate-pulse">
      {evt.replace(/_/g, " ")}
    </div>
  );
}
