// ============================================================================
// FootballMatchSummary — Post-match summary component (Rebuilt V5)
// ============================================================================
"use client";

import React from "react";
import type { FootballMatchState, FootballMatchEvent, PenaltyKick } from "../types";
import { getPhaseLabel, getEventIcon, isPrimaryEvent } from "../types";
import { FootballMatchStats } from "./FootballMatchStats";

interface Props {
  state: FootballMatchState;
  teamAName: string;
  teamBName: string;
  teamALogo?: string | null;
  teamBLogo?: string | null;
}

export function FootballMatchSummary({ state, teamAName, teamBName, teamALogo, teamBLogo }: Props) {
  const scoreA = state.team_a_stats?.goals ?? 0;
  const scoreB = state.team_b_stats?.goals ?? 0;

  // Determine winner
  let winnerText = "Draw";
  if (scoreA > scoreB) winnerText = `${teamAName} Wins!`;
  else if (scoreB > scoreA) winnerText = `${teamBName} Wins!`;

  // If penalties decided it
  const penaltiesA = (state.penalties || []).filter(p => p.team === "team_a" && p.scored).length;
  const penaltiesB = (state.penalties || []).filter(p => p.team === "team_b" && p.scored).length;
  if (state.penalties?.length > 0 && scoreA === scoreB) {
    if (penaltiesA > penaltiesB) winnerText = `${teamAName} Wins! (Penalties ${penaltiesA}-${penaltiesB})`;
    else if (penaltiesB > penaltiesA) winnerText = `${teamBName} Wins! (Penalties ${penaltiesB}-${penaltiesA})`;
  }

  // Goal highlights
  const goalEvents = (state.events || []).filter(e =>
    ["goal", "own_goal"].includes(e.type)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Winner Banner */}
      <div className="text-center py-8 rounded-2xl border border-[var(--border)]"
        style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--surface-alt) 100%)" }}>
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Full Time</div>
        <div className="flex items-center justify-center gap-6 mb-4">
          <div className="flex flex-col items-center gap-1">
            {teamALogo ? <img src={teamALogo} className="w-12 h-12 rounded-full object-cover" alt="" /> :
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center font-bold text-xl text-emerald-400">{teamAName.charAt(0)}</div>}
            <span className="text-xs font-bold text-[var(--text)]">{teamAName}</span>
          </div>
          <div className="text-4xl md:text-5xl font-black tabular-nums text-[var(--text)]">{scoreA} – {scoreB}</div>
          <div className="flex flex-col items-center gap-1">
            {teamBLogo ? <img src={teamBLogo} className="w-12 h-12 rounded-full object-cover" alt="" /> :
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-xl text-amber-400">{teamBName.charAt(0)}</div>}
            <span className="text-xs font-bold text-[var(--text)]">{teamBName}</span>
          </div>
        </div>
        <p className="text-lg font-bold text-[var(--primary)]">{winnerText}</p>
      </div>

      {/* Goal Highlights */}
      {goalEvents.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="font-bold text-sm uppercase tracking-widest text-[var(--text)] mb-3">⚽ Goal Highlights</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {goalEvents.map((event, i) => (
              <div key={event.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)]">
                {event.photo_url ? (
                  <img src={event.photo_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--primary)]/20 flex items-center justify-center text-lg">⚽</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-[var(--text)] truncate">{event.player_name}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {Math.floor(event.match_time_seconds / 60)}&apos; · {event.team === "team_a" ? teamAName : teamBName}
                    {event.assist_name && ` · Assist: ${event.assist_name}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Penalties */}
      {state.penalties?.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="font-bold text-sm uppercase tracking-widest text-[var(--text)] mb-3">🥅 Penalty Shootout</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <h4 className="text-xs font-bold text-[var(--text-muted)] mb-2">{teamAName} ({penaltiesA})</h4>
              <div className="flex justify-center gap-2 flex-wrap">
                {state.penalties.filter(p => p.team === "team_a").map((p, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${p.scored ? "bg-emerald-500 text-white" : "bg-red-500/60 text-white/80"}`}>
                    {p.scored ? "✓" : "✕"}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-center">
              <h4 className="text-xs font-bold text-[var(--text-muted)] mb-2">{teamBName} ({penaltiesB})</h4>
              <div className="flex justify-center gap-2 flex-wrap">
                {state.penalties.filter(p => p.team === "team_b").map((p, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${p.scored ? "bg-emerald-500 text-white" : "bg-red-500/60 text-white/80"}`}>
                    {p.scored ? "✓" : "✕"}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Event Timeline */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="font-bold text-sm uppercase tracking-widest text-[var(--text)] mb-3">📋 Full Timeline</h3>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {state.events.filter(e => isPrimaryEvent(e.type)).map((event, i) => (
            <div key={event.id || i} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)]">
              <span className="font-mono text-[var(--text-muted)] w-8 text-right">{Math.floor(event.match_time_seconds / 60)}&apos;</span>
              <span>{getEventIcon(event.type)}</span>
              <span className="font-semibold text-[var(--text)] truncate flex-1">
                {event.player_name || event.type}
                {event.assist_name ? ` (assist: ${event.assist_name})` : ""}
              </span>
              <span className="text-[var(--text-muted)] text-[10px] uppercase">
                {event.team === "team_a" ? teamAName : event.team === "team_b" ? teamBName : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Match Stats */}
      <FootballMatchStats
        teamA={state.team_a_stats}
        teamB={state.team_b_stats}
        teamAName={teamAName}
        teamBName={teamBName}
      />
    </div>
  );
}
