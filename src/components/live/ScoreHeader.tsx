import type { Innings } from "@/lib/types/database";

interface ScoreHeaderProps {
  innings: Innings;
  battingTeamName: string;
  target: number | null;
  maxOvers: number;
}

export function ScoreHeader({
  innings,
  battingTeamName,
  target,
  maxOvers,
}: ScoreHeaderProps) {
  const oversFloat = parseFloat(String(innings.total_overs));
  const crr =
    oversFloat > 0 ? (innings.total_runs / oversFloat).toFixed(2) : "0.00";

  let rrr: string | null = null;
  if (target && oversFloat > 0) {
    const remaining = maxOvers - oversFloat;
    const needed = target - innings.total_runs;
    rrr = remaining > 0 ? (needed / remaining).toFixed(2) : "—";
  }

  return (
    <div className="card !p-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-text-muted font-medium">{battingTeamName}</p>
          <h2 className="text-3xl md:text-4xl font-black text-text tracking-tight">
            {innings.total_runs}
            <span className="text-text-muted">/{innings.total_wickets}</span>
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            ({innings.total_overs} ov) · CRR: {crr}
          </p>
        </div>
        <div className="text-right">
          {target && (
            <div>
              <p className="text-sm text-text-muted">
                Target: <span className="font-bold text-text">{target}</span>
              </p>
              <p className="text-sm text-text-muted">
                Need{" "}
                <span className="font-bold text-primary">
                  {Math.max(0, target - innings.total_runs)}
                </span>{" "}
                from{" "}
                <span className="font-bold">
                  {(maxOvers - oversFloat).toFixed(1)}
                </span>{" "}
                ov
              </p>
              {rrr && <p className="text-xs text-text-muted">RRR: {rrr}</p>}
            </div>
          )}
          <span className="badge-live mt-1">LIVE</span>
        </div>
      </div>
    </div>
  );
}

