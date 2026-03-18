// src/features/scoring/football/components/FootballMatchStats.tsx
import React from "react";
import type { FootballMatchState } from "../types";

export function FootballMatchStats({ state }: { state: FootballMatchState }) {
  const { team_a_stats: a, team_b_stats: b } = state;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_4px_12px_var(--shadow)] w-full overflow-hidden">
      <div className="bg-[var(--surface-alt)] border-b border-[var(--border)] px-4 py-3">
        <h3 className="text-center text-base font-bold text-[var(--text)] uppercase tracking-wide">
          Match Stats
        </h3>
      </div>
      <div className="p-4 md:p-6">
        <div className="flex flex-col gap-5">
          <StatRow label="Shots on Target"  valA={a.shots_on_target}  valB={b.shots_on_target} />
          <StatRow label="Shots off Target" valA={a.shots_off_target} valB={b.shots_off_target} />
          <StatRow label="Corners"          valA={a.corners}          valB={b.corners} />
          <StatRow label="Fouls"            valA={a.fouls}            valB={b.fouls} />
          <StatRow label="Offsides"         valA={a.offsides}         valB={b.offsides} />
          <StatRow label="Yellow Cards"     valA={a.yellow_cards}     valB={b.yellow_cards} type="warning" />
          <StatRow label="Red Cards"        valA={a.red_cards}        valB={b.red_cards}    type="danger" />
        </div>
      </div>
    </div>
  );
}

function StatRow({
  label,
  valA,
  valB,
  type = "primary",
}: {
  label: string;
  valA: number;
  valB: number;
  type?: "primary" | "warning" | "danger";
}) {
  const total = valA + valB;
  const percentA = total === 0 ? 50 : (valA / total) * 100;
  const percentB = total === 0 ? 50 : (valB / total) * 100;

  const barColorA = type === "warning"
    ? "bg-[var(--warning)]"
    : type === "danger"
    ? "bg-[var(--danger)]"
    : "bg-[var(--primary)]";

  const barColorB = type === "warning"
    ? "bg-[var(--warning)]/60"
    : type === "danger"
    ? "bg-[var(--danger)]/60"
    : "bg-[var(--success)]";

  return (
    <div>
      <div className="flex justify-between items-center text-sm font-semibold mb-2">
        <span className="w-8 text-left text-[var(--text)]">{valA}</span>
        <span className="text-[var(--text-muted)]">{label}</span>
        <span className="w-8 text-right text-[var(--text)]">{valB}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-[var(--border)]">
        <div
          className={`${barColorA} transition-all duration-500`}
          style={{ width: `${percentA}%` }}
        />
        <div
          className={`${barColorB} transition-all duration-500`}
          style={{ width: `${percentB}%` }}
        />
      </div>
    </div>
  );
}
