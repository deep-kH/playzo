// src/features/scoring/badminton/components/BadmintonMatchSummary.tsx
"use client";

import React from "react";
import type { BadmintonMatchState } from "../types";

interface PlayerInfo {
  id: string;
  name: string;
}

interface Props {
  state: BadmintonMatchState;
  teamAName: string;
  teamBName: string;
  teamAPlayers?: PlayerInfo[];
  teamBPlayers?: PlayerInfo[];
}

export function BadmintonMatchSummary({
  state,
  teamAName,
  teamBName,
  teamAPlayers = [],
  teamBPlayers = [],
}: Props) {
  const { games_won, scores, match_type } = state;
  const isDoubles = match_type === "doubles";

  const playerA1 = teamAPlayers[0]?.name ?? "";
  const playerA2 = teamAPlayers[1]?.name ?? "";
  const playerB1 = teamBPlayers[0]?.name ?? "";
  const playerB2 = teamBPlayers[1]?.name ?? "";

  const sideALabel = isDoubles ? teamAName : (playerA1 || teamAName);
  const sideBLabel = isDoubles ? teamBName : (playerB1 || teamBName);

  const isIncomplete = state.status === "incomplete";
  const winnerIsA = games_won.team_a > games_won.team_b;
  const winnerLabel = winnerIsA ? sideALabel : sideBLabel;
  const isDraw = games_won.team_a === games_won.team_b;

  // Determine how many games were played
  const gamesPlayed = Math.max(games_won.team_a + games_won.team_b, state.current_game || 1);
  const gameKeys = (["g1", "g2", "g3", "g4", "g5"] as const).slice(0, gamesPlayed);

  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto">
      {/* Winner Announcement */}
      <div className="text-center py-8 space-y-4">
        <div className="text-4xl md:text-6xl">{isIncomplete ? "⚠️" : "🏆"}</div>
        <div className="text-2xl md:text-3xl font-black text-[var(--text)]">
          {isIncomplete ? "Match Stopped Early" : "Match Complete"}
        </div>
        {!isDraw && (
          <div
            className="text-2xl font-black"
            style={{ color: winnerIsA ? "var(--primary)" : "var(--success)" }}
          >
            {winnerLabel} {isIncomplete ? "Leading" : "Wins!"}
          </div>
        )}
        {isDraw && isIncomplete && (
          <div className="text-xl font-bold text-[var(--text-muted)]">Match tied when stopped</div>
        )}
        {isDoubles && !isDraw && (
          <div className="text-sm text-[var(--text-muted)]">
            {winnerIsA
              ? `${playerA1} & ${playerA2}`
              : `${playerB1} & ${playerB2}`}
          </div>
        )}
      </div>

      {/* Final Score Bar */}
      <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-[0_8px_24px_var(--shadow)] overflow-hidden">
        <div
          className={`flex-1 flex flex-col items-center p-5 ${
            winnerIsA && !isDraw ? "bg-[var(--primary)]/5" : ""
          }`}
        >
          <div className="text-sm font-bold uppercase tracking-widest text-[var(--text)] mb-1">
            {sideALabel}
          </div>
          {isDoubles && playerA1 && (
            <div className="text-xs text-[var(--text-muted)] mb-1">
              {playerA1} & {playerA2}
            </div>
          )}
          <div
            className="text-4xl md:text-5xl font-bold tabular-nums leading-none"
            style={{ color: (winnerIsA && !isDraw) ? "var(--primary)" : "var(--text-muted)" }}
          >
            {games_won.team_a}
          </div>
          {winnerIsA && !isDraw && (
            <div className="mt-2 text-xs font-bold text-[var(--primary)] uppercase tracking-widest">
              {isIncomplete ? "Leading" : "Winner"}
            </div>
          )}
        </div>
        <div className="flex flex-col items-center justify-center px-5 bg-[var(--text)] text-[var(--surface)] min-w-[80px] self-stretch">
          <div className="text-xs uppercase tracking-widest opacity-60 font-semibold mb-1">
            Games
          </div>
          <div className="text-lg font-bold">
            {games_won.team_a} – {games_won.team_b}
          </div>
          <div className="text-xs opacity-50 mt-1 uppercase">
            {match_type}
          </div>
        </div>
        <div
          className={`flex-1 flex flex-col items-center p-5 ${
            !winnerIsA && !isDraw ? "bg-[var(--success)]/5" : ""
          }`}
        >
          <div className="text-sm font-bold uppercase tracking-widest text-[var(--text)] mb-1">
            {sideBLabel}
          </div>
          {isDoubles && playerB1 && (
            <div className="text-xs text-[var(--text-muted)] mb-1">
              {playerB1} & {playerB2}
            </div>
          )}
          <div
            className="text-4xl md:text-5xl font-bold tabular-nums leading-none"
            style={{ color: (!winnerIsA && !isDraw) ? "var(--success)" : "var(--text-muted)" }}
          >
            {games_won.team_b}
          </div>
          {!winnerIsA && !isDraw && (
            <div className="mt-2 text-xs font-bold text-[var(--success)] uppercase tracking-widest">
              {isIncomplete ? "Leading" : "Winner"}
            </div>
          )}
        </div>
      </div>

      {/* Individual Game Scores */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)] text-center">
          Game Breakdown
        </h3>
        <div className="space-y-2">
          {gameKeys.map((key, i) => {
            const aScore = scores[key]?.team_a ?? 0;
            const bScore = scores[key]?.team_b ?? 0;
            const aWon = aScore > bScore;
            
            // If the game has no score, don't show it if it's not the first game
            if (aScore === 0 && bScore === 0 && i !== 0 && !isIncomplete) return null;

            return (
              <div
                key={key}
                className="flex items-center bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden"
              >
                <div
                  className={`flex-1 flex items-center justify-between px-4 py-3 ${
                    aWon ? "bg-[var(--primary)]/5" : ""
                  }`}
                >
                  <span
                    className={`text-sm font-semibold ${
                      aWon ? "text-[var(--primary)]" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {sideALabel}
                  </span>
                  <span
                    className={`text-xl font-bold tabular-nums ${
                      aWon ? "text-[var(--primary)]" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {aScore}
                  </span>
                </div>
                <div className="px-3 py-3 bg-[var(--surface-alt)] text-center min-w-[60px]">
                  <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
                    G{i + 1}
                  </span>
                </div>
                <div
                  className={`flex-1 flex items-center justify-between px-4 py-3 ${
                    !aWon ? "bg-[var(--success)]/5" : ""
                  }`}
                >
                  <span
                    className={`text-xl font-bold tabular-nums ${
                      !aWon ? "text-[var(--success)]" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {bScore}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      !aWon ? "text-[var(--success)]" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {sideBLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
