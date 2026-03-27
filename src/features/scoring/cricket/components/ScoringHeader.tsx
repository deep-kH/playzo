"use client";

import type {
  Innings,
  MatchState,
  Player,
  BattingStats,
  BowlingStats,
} from "@/lib/types/database";
import { toRealOvers, formatOvers } from "@/features/scoring/cricket/oversUtils";

interface ScoringHeaderProps {
  innings: Innings;
  matchState: MatchState;
  striker: Player | null;
  nonStriker: Player | null;
  bowler: Player | null;
  strikerStats: BattingStats | null;
  nonStrikerStats: BattingStats | null;
  bowlerStats: BowlingStats | null;
  battingTeamName: string;
  target: number | null;
  maxOvers?: number;
}

export function ScoringHeader({
  innings,
  matchState,
  striker,
  nonStriker,
  bowler,
  strikerStats,
  nonStrikerStats,
  bowlerStats,
  battingTeamName,
  target,
  maxOvers = 20,
}: ScoringHeaderProps) {
  const realOvers = toRealOvers(innings.total_overs);
  const crr = realOvers > 0 ? (innings.total_runs / realOvers).toFixed(2) : "0.00";

  const rrr =
    target && realOvers > 0
      ? (() => {
          const remainingOvers = toRealOvers(maxOvers) - realOvers;
          const needed = target - innings.total_runs;
          return remainingOvers > 0 ? (needed / remainingOvers).toFixed(2) : "—";
        })()
      : null;

  return (
    <div className="card !p-3 space-y-3">
      {/* Score */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">
            {battingTeamName}{" "}
            <span className="text-2xl">
              {innings.total_runs}/{innings.total_wickets}
            </span>
          </h2>
          <p className="text-sm text-text-muted">
            ({innings.total_overs} ov) · CRR: {crr}
            {target && (
              <span className="ml-2">
                Target: {target}
                {rrr && ` · RRR: ${rrr}`}
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <span className="badge-live">LIVE</span>
        </div>
      </div>

      {/* Batters + Bowler */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-surface-alt rounded-lg p-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-text">
              {striker?.name ?? "—"}*
            </span>
            <span className="text-text-muted">
              {strikerStats?.runs ?? 0}({strikerStats?.balls_faced ?? 0})
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-text-muted">{nonStriker?.name ?? "—"}</span>
            <span className="text-text-muted text-xs">
              {nonStrikerStats?.runs ?? 0}({nonStrikerStats?.balls_faced ?? 0})
            </span>
          </div>
        </div>
        <div className="bg-surface-alt rounded-lg p-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-text">{bowler?.name ?? "—"}</span>
          </div>
          <span className="text-text-muted text-xs">
            {bowlerStats?.overs ?? 0}-{bowlerStats?.maidens ?? 0}-
            {bowlerStats?.runs_conceded ?? 0}-{bowlerStats?.wickets ?? 0}
          </span>
        </div>
      </div>

      {/* Partnership */}
      <div className="text-xs text-text-muted text-center">
        Partnership: {matchState.partnership_runs} ({matchState.partnership_balls})
      </div>
    </div>
  );
}

