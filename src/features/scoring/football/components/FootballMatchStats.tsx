// ============================================================================
// FootballMatchStats — Animated bar-chart stat comparison (Rebuilt V5)
// ============================================================================
"use client";

import React from "react";
import type { FootballTeamStats } from "../types";

interface Props {
  teamA: FootballTeamStats;
  teamB: FootballTeamStats;
  teamAName: string;
  teamBName: string;
}

function StatBar({ label, a, b }: { label: string; a: number; b: number }) {
  const total = a + b || 1;
  const pctA = (a / total) * 100;
  const pctB = (b / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold tabular-nums text-[var(--text)]">{a}</span>
        <span className="text-[var(--text-muted)] uppercase tracking-wider text-[10px] font-semibold">{label}</span>
        <span className="font-bold tabular-nums text-[var(--text)]">{b}</span>
      </div>
      <div className="flex h-2 gap-0.5 rounded-full overflow-hidden">
        <div className="bg-emerald-500 rounded-l-full transition-all duration-700 ease-out"
          style={{ width: `${pctA}%` }} />
        <div className="bg-amber-500 rounded-r-full transition-all duration-700 ease-out ml-auto"
          style={{ width: `${pctB}%` }} />
      </div>
    </div>
  );
}

export function FootballMatchStats({ teamA, teamB, teamAName, teamBName }: Props) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-500">{teamAName}</span>
        <h3 className="font-bold text-sm uppercase tracking-widest text-[var(--text)]">Match Stats</h3>
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">{teamBName}</span>
      </div>
      <div className="space-y-3">
        <StatBar label="Shots on Target" a={teamA.shots_on_target} b={teamB.shots_on_target} />
        <StatBar label="Shots off Target" a={teamA.shots_off_target} b={teamB.shots_off_target} />
        <StatBar label="Corners" a={teamA.corners} b={teamB.corners} />
        <StatBar label="Fouls" a={teamA.fouls} b={teamB.fouls} />
        <StatBar label="Yellow Cards" a={teamA.yellow_cards} b={teamB.yellow_cards} />
        <StatBar label="Red Cards" a={teamA.red_cards} b={teamB.red_cards} />
        <StatBar label="Free Kicks" a={teamA.free_kicks} b={teamB.free_kicks} />
        <StatBar label="Offsides" a={teamA.offsides} b={teamB.offsides} />
      </div>
    </div>
  );
}
