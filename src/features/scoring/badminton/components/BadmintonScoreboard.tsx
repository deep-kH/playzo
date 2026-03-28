// src/features/scoring/badminton/components/BadmintonScoreboard.tsx
"use client";

import React from "react";
import type { BadmintonMatchState } from "../types";
import { getCurrentScore } from "../types";

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

function GameDots({ won, total = 2, color = "primary" }: { won: number; total?: number; color?: string }) {
  return (
    <div className="flex gap-1.5 justify-center mt-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full border transition-all duration-300 ${
            i < won
              ? `bg-[var(--${color})] border-[var(--${color})]`
              : "bg-transparent border-[var(--border)]"
          }`}
        />
      ))}
    </div>
  );
}

export function BadmintonScoreboard({
  state,
  teamAName,
  teamBName,
  teamAPlayers = [],
  teamBPlayers = [],
}: Props) {
  const { current_game, games_won, server, serving_side, status, match_type } = state;
  const currentScore = getCurrentScore(state);
  const isServerA = server === "team_a";
  const isServerB = server === "team_b";
  const isDoubles = match_type === "doubles";

  const getPlayerName = (teamId: "team_a" | "team_b", playerId?: string) => {
    const players = teamId === 'team_a' ? teamAPlayers : teamBPlayers;
    const player = players.find(p => p.id === playerId);
    return player ? player.name : "";
  };

  const posA = state.doubles_positions?.team_a ?? { left: teamAPlayers[0]?.id, right: teamAPlayers[1]?.id };
  const posB = state.doubles_positions?.team_b ?? { left: teamBPlayers[0]?.id, right: teamBPlayers[1]?.id };

  const playerA1 = isDoubles ? getPlayerName('team_a', posA.left) : (teamAPlayers[0]?.name ?? "");
  const playerA2 = isDoubles ? getPlayerName('team_a', posA.right) : (teamAPlayers[1]?.name ?? "");
  const playerB1 = isDoubles ? getPlayerName('team_b', posB.left) : (teamBPlayers[0]?.name ?? "");
  const playerB2 = isDoubles ? getPlayerName('team_b', posB.right) : (teamBPlayers[1]?.name ?? "");

  // For singles, show player name. For doubles, show "Player A & Player B" if no real team name.
  const sideALabel = isDoubles
    ? (teamAName && teamAName !== "Team A" ? teamAName : `${playerA1} & ${playerA2}`)
    : (playerA1 || teamAName);
  const sideBLabel = isDoubles
    ? (teamBName && teamBName !== "Team B" ? teamBName : `${playerB1} & ${playerB2}`)
    : (playerB1 || teamBName);

  // Resolve serving player name
  const getServingPlayerName = (): string => {
    if (!isDoubles) {
      return server === "team_a" ? (teamAPlayers[0]?.name ?? sideALabel) : (teamBPlayers[0]?.name ?? sideBLabel);
    }
    const pos = server === "team_a" ? posA : posB;
    const serverId = serving_side === "right" ? pos.right : pos.left;
    return getPlayerName(server, serverId) || (server === "team_a" ? sideALabel : sideBLabel);
  };
  const serverPlayerName = getServingPlayerName();

  // Configurable
  const setsToWin = state.sets_to_win ?? 2;
  const totalSets = setsToWin * 2 - 1;

  const statusLabel =
    status === "interval" ? "Interval" :
    status === "completed" ? "Final" :
    status === "scheduled" ? "Upcoming" : "Live";

  const statusColor =
    status === "live" ? "bg-[var(--success)]" :
    status === "completed" ? "bg-[var(--text-muted)]" :
    status === "interval" ? "bg-[var(--warning)]" : "bg-[var(--border)]";

  return (
    <div className="space-y-4 w-full max-w-3xl mx-auto">
      {/* Match Type + Status Pill */}
      <div className="flex items-center justify-center gap-3">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)]">
          <div className={`w-2 h-2 rounded-full ${statusColor} ${status === "live" ? "animate-pulse" : ""}`} />
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
            {statusLabel}
          </span>
        </div>
        <div className="px-3 py-1.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)]">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Set {current_game} of {totalSets} · {match_type}
          </span>
        </div>
      </div>

      {/* Main Score Banner */}
      <div className="flex items-stretch bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-[0_8px_24px_var(--shadow)] overflow-hidden">
        {/* Side A */}
        <div
          className={`flex-1 flex flex-col items-center justify-center p-5 transition-colors ${
            isServerA ? "bg-[var(--primary)]/5" : ""
          }`}
        >
          <div className="text-lg font-black uppercase tracking-widest text-[var(--text)] mb-1">
            {sideALabel}
          </div>
          {isDoubles && playerA1 && (
            <div className="text-xs text-[var(--text-muted)] mb-2">
              {playerA1} & {playerA2}
            </div>
          )}
          <div className="text-5xl md:text-7xl font-bold tabular-nums text-[var(--primary)] leading-none">
            {currentScore.team_a}
          </div>
          <GameDots won={games_won.team_a} total={setsToWin} color="primary" />
          {isServerA && status === "live" && (
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-yellow-600 uppercase tracking-wide">
              <div className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(255,200,0,0.6)] animate-pulse" />
              🟡 {serverPlayerName} · {serving_side}
            </div>
          )}
        </div>

        {/* Center */}
        <div className="flex flex-col items-center justify-center px-5 bg-[var(--text)] text-[var(--surface)] min-w-[90px]">
          <div className="text-xs uppercase tracking-widest opacity-60 font-semibold mb-1">
            Set
          </div>
          <div className="text-4xl font-bold">{current_game}</div>
          <div className="text-xs opacity-60 mt-2 uppercase tracking-wide">
            {statusLabel}
          </div>
        </div>

        {/* Side B */}
        <div
          className={`flex-1 flex flex-col items-center justify-center p-5 transition-colors ${
            isServerB ? "bg-[var(--success)]/5" : ""
          }`}
        >
          <div className="text-lg font-black uppercase tracking-widest text-[var(--text)] mb-1">
            {sideBLabel}
          </div>
          {isDoubles && playerB1 && (
            <div className="text-xs text-[var(--text-muted)] mb-2">
              {playerB1} & {playerB2}
            </div>
          )}
          <div className="text-5xl md:text-7xl font-bold tabular-nums text-[var(--success)] leading-none">
            {currentScore.team_b}
          </div>
          <GameDots won={games_won.team_b} total={setsToWin} color="success" />
          {isServerB && status === "live" && (
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-yellow-600 uppercase tracking-wide">
              <div className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(255,200,0,0.6)] animate-pulse" />
              🟡 {serverPlayerName} · {serving_side}
            </div>
          )}
        </div>
      </div>

      {/* Previous Sets */}
      {current_game > 1 && (
        <div className="flex justify-center gap-4">
          {(["g1", "g2", "g3", "g4", "g5"] as const)
            .slice(0, current_game - 1)
            .map((key, i) => (
              <div
                key={key}
                className="text-center bg-[var(--surface-alt)] rounded-xl px-5 py-2 border border-[var(--border)]"
              >
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-0.5">
                  Set {i + 1}
                </div>
                <div className="text-base font-bold tabular-nums text-[var(--text)]">
                  {(state.scores[key] ?? {team_a:0,team_b:0}).team_a} – {(state.scores[key] ?? {team_a:0,team_b:0}).team_b}
                </div>
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
