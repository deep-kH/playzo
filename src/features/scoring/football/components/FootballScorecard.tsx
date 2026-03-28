// ============================================================================
// FootballScorecard — Immersive score display for live view (Rebuilt V5)
// ============================================================================
"use client";

import React from "react";
import type { FootballMatchState, FootballMatchEvent } from "../types";
import { getPhaseLabel } from "../types";
import { FootballClock } from "./FootballClock";

interface Props {
  state: FootballMatchState;
  teamAName: string;
  teamBName: string;
  teamALogo?: string | null;
  teamBLogo?: string | null;
  halfDurationSeconds: number;
}

function TeamCrest({ src, fallback, color }: { src?: string | null; fallback: string; color: string }) {
  if (src) return <img src={src} className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-white/10 shadow-lg" alt="team" />;
  return (
    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl font-black border-2 border-white/10 shadow-lg ${color}`}>
      {fallback.charAt(0)}
    </div>
  );
}

export function FootballScorecard({
  state, teamAName, teamBName, teamALogo, teamBLogo, halfDurationSeconds,
}: Props) {
  const scoreA = state.team_a_stats?.goals ?? 0;
  const scoreB = state.team_b_stats?.goals ?? 0;

  // Get goal scorers for each team (last 3)
  const goalEvents = (state.events || []).filter((e: FootballMatchEvent) =>
    ["goal", "own_goal", "penalty_goal"].includes(e.type)
  );
  const scorersA = goalEvents.filter((e: FootballMatchEvent) => e.team === "team_a").slice(-3);
  const scorersB = goalEvents.filter((e: FootballMatchEvent) => e.team === "team_b").slice(-3);

  const isLive = state.phase !== "not_started" && state.phase !== "ended";

  return (
    <div className="space-y-0">
      {/* Main Score Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] shadow-[0_8px_32px_var(--shadow)]"
        style={{ background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-alt) 100%)' }}>

        {/* Live badge */}
        {isLive && (
          <div className="absolute top-3 left-3">
            <span className="badge-live flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          </div>
        )}

        {/* Phase badge */}
        <div className="absolute top-3 right-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            {getPhaseLabel(state.phase)}
          </span>
        </div>

        <div className="flex items-center py-8 px-4">
          {/* Team A */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <TeamCrest src={teamALogo} fallback={teamAName} color="bg-emerald-500/20 text-emerald-400" />
            <h2 className="text-sm md:text-base font-black uppercase tracking-wider text-[var(--text)] text-center">
              {teamAName}
            </h2>
          </div>

          {/* Score + Clock */}
          <div className="flex flex-col items-center gap-2 px-6 min-w-[140px]">
            <div className="text-5xl md:text-6xl lg:text-7xl font-black tabular-nums tracking-tighter text-[var(--text)]"
              style={{ textShadow: '0 4px 12px var(--shadow)' }}>
              {scoreA} – {scoreB}
            </div>
            <FootballClock state={state} halfDurationSeconds={halfDurationSeconds} size="lg" />
          </div>

          {/* Team B */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <TeamCrest src={teamBLogo} fallback={teamBName} color="bg-amber-500/20 text-amber-400" />
            <h2 className="text-sm md:text-base font-black uppercase tracking-wider text-[var(--text)] text-center">
              {teamBName}
            </h2>
          </div>
        </div>
      </div>

      {/* Scorer Strip */}
      {(scorersA.length > 0 || scorersB.length > 0) && (
        <div className="flex bg-[var(--surface-alt)] border-x border-b border-[var(--border)] rounded-b-2xl px-4 py-2.5 mt-[-1px] text-xs">
          <div className="flex-1 flex flex-col gap-1 items-end pr-4">
            {scorersA.map((s, i) => {
              const min = Math.floor(s.match_time_seconds / 60);
              return (
                <span key={i} className="font-semibold text-[var(--text-muted)] flex items-center gap-1 animate-fade-in">
                  ⚽ {s.player_name || "Player"} <span className="opacity-60">({min}&apos;)</span>
                </span>
              );
            })}
          </div>
          <div className="w-px bg-[var(--border)]" />
          <div className="flex-1 flex flex-col gap-1 items-start pl-4">
            {scorersB.map((s, i) => {
              const min = Math.floor(s.match_time_seconds / 60);
              return (
                <span key={i} className="font-semibold text-[var(--text-muted)] flex items-center gap-1 animate-fade-in">
                  ⚽ {s.player_name || "Player"} <span className="opacity-60">({min}&apos;)</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
