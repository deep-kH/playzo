import type { Innings, MatchState, BattingStats } from "@/lib/types/database";

interface MatchInsightsProps {
  innings: Innings;
  matchState: MatchState;
  battingStats: BattingStats[];
  maxOvers: number;
  stats?: Record<string, any>;
}

export function MatchInsights({
  innings,
  matchState,
  battingStats,
  maxOvers,
  stats,
}: MatchInsightsProps) {
  // ✅ Read projected score from stats (computed by backend)
  const projected = stats?.projected_score ?? null;

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

