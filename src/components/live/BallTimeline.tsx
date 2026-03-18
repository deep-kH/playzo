import type { Ball } from "@/lib/types/database";

interface BallTimelineProps {
  balls: Ball[];
  currentOver: number;
}

function ballLabel(b: Ball): string {
  if (b.is_wicket) return "W";
  if (!b.is_legal) return b.extra_type === "wide" ? "Wd" : "Nb";
  return (b.runs_bat + b.runs_extra).toString();
}

function ballColor(b: Ball): string {
  if (b.is_wicket) return "bg-destructive text-white";
  if (b.runs_bat === 6) return "bg-accent/20 text-accent border-2 border-accent";
  if (b.runs_bat === 4)
    return "bg-primary/20 text-primary border-2 border-primary";
  if (!b.is_legal) return "bg-warning/20 text-warning border border-warning";
  if (b.runs_bat === 0 && b.runs_extra === 0)
    return "bg-surface-alt text-text-muted";
  return "bg-surface border border-border-ui text-text";
}

export function BallTimeline({ balls, currentOver }: BallTimelineProps) {
  const overBalls = balls.filter((b) => b.over_number === currentOver).reverse();

  return (
    <div className="card !p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
          This Over
        </h3>
        <span className="text-xs text-text-muted">Over {currentOver + 1}</span>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {overBalls.length === 0 ? (
          <p className="text-xs text-text-muted">No balls yet</p>
        ) : (
          overBalls.map((b, i) => (
            <div
              key={i}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${ballColor(
                b
              )}`}
            >
              {ballLabel(b)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

