import type { Innings, MatchState, BattingStats } from "@/lib/types/database";

interface MatchInsightsProps {
  innings: Innings;
  matchState: MatchState;
  battingStats: BattingStats[];
  maxOvers: number;
}

export function MatchInsights({
  innings,
  matchState,
  battingStats,
  maxOvers,
}: MatchInsightsProps) {
  const oversFloat = parseFloat(String(innings.total_overs));

  // Projected score (only if 1st innings and > 2 overs bowled)
  const projected =
    oversFloat >= 2 ? Math.round((innings.total_runs / oversFloat) * maxOvers) : null;

  // Last wicket
  const outBatters = battingStats
    .filter((bs) => bs.is_out)
    .sort((a, b) => b.batting_position! - a.batting_position!);
  const lastWicket = outBatters[0];

  return (
    <div className="card !p-3">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
        Match Insights
      </h3>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-lg font-bold text-text">
            {matchState.partnership_runs}
            <span className="text-sm text-text-muted font-normal">
              {" "}
              ({matchState.partnership_balls})
            </span>
          </p>
          <p className="text-xs text-text-muted">Partnership</p>
        </div>
        {projected && (
          <div>
            <p className="text-lg font-bold text-primary">{projected}</p>
            <p className="text-xs text-text-muted">Projected</p>
          </div>
        )}
        {lastWicket && (
          <div>
            <p className="text-sm font-bold text-destructive">
              {lastWicket.runs}({lastWicket.balls_faced})
            </p>
            <p className="text-xs text-text-muted">Last Wkt</p>
          </div>
        )}
      </div>
    </div>
  );
}

