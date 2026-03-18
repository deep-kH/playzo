// src/features/scoring/football/components/FootballScorecard.tsx
import React from "react";
import type { FootballMatchState } from "../types";
import { FootballClock } from "./FootballClock";
import { FootballMatchStats } from "./FootballMatchStats";

interface Props {
  state: FootballMatchState;
  teamAName: string;
  teamBName: string;
  teamALogo?: string | null;
  teamBLogo?: string | null;
}

function TeamLogo({ src }: { src?: string | null }) {
  if (src) return <img src={src} className="w-14 h-14 object-contain" alt="team logo" />;
  return (
    <div className="w-14 h-14 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] skeleton" />
  );
}

export function FootballScorecard({
  state,
  teamAName,
  teamBName,
  teamALogo,
  teamBLogo,
}: Props) {
  const scoreA = state.team_a_stats.goals;
  const scoreB = state.team_b_stats.goals;

  return (
    <div className="space-y-5 max-w-4xl mx-auto w-full">
      {/* ── Score Banner ─────────────────────────── */}
      <div className="flex flex-col md:flex-row items-center bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-[0_8px_24px_var(--shadow)] overflow-hidden">
        {/* Team A */}
        <div className="flex-1 flex items-center justify-end gap-3 p-5 md:p-6">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-[var(--text)]">
            {teamAName}
          </h2>
          <TeamLogo src={teamALogo} />
        </div>

        {/* Score & Clock */}
        <div className="flex flex-col items-center gap-3 px-6 py-5 border-t md:border-t-0 md:border-x border-[var(--border)] bg-[var(--surface-alt)] min-w-[180px]">
          <div className="text-6xl md:text-7xl font-bold font-mono tabular-nums tracking-tighter text-[var(--text)]">
            {scoreA} – {scoreB}
          </div>
          <FootballClock state={state} />
        </div>

        {/* Team B */}
        <div className="flex-1 flex items-center justify-start gap-3 p-5 md:p-6">
          <TeamLogo src={teamBLogo} />
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-[var(--text)]">
            {teamBName}
          </h2>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────── */}
      <FootballMatchStats state={state} />
    </div>
  );
}
