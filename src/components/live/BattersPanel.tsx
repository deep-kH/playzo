import type { Player, BattingStats } from "@/lib/types/database";

interface BattersPanelProps {
  striker: Player | null;
  nonStriker: Player | null;
  strikerStats: BattingStats | null;
  nonStrikerStats: BattingStats | null;
}

function sr(runs: number, balls: number): string {
  return balls > 0 ? ((runs / balls) * 100).toFixed(1) : "0.0";
}

export function BattersPanel({
  striker,
  nonStriker,
  strikerStats,
  nonStrikerStats,
}: BattersPanelProps) {
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="px-3 py-2 bg-surface-alt">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
          Batters
        </h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-ui/50 text-xs text-text-muted">
            <th className="text-left px-3 py-1.5 font-medium">Batter</th>
            <th className="text-right px-2 py-1.5 font-medium">R</th>
            <th className="text-right px-2 py-1.5 font-medium">B</th>
            <th className="text-right px-2 py-1.5 font-medium">4s</th>
            <th className="text-right px-2 py-1.5 font-medium">6s</th>
            <th className="text-right px-3 py-1.5 font-medium">SR</th>
          </tr>
        </thead>
        <tbody>
          {[
            { player: striker, stats: strikerStats, isStriker: true },
            { player: nonStriker, stats: nonStrikerStats, isStriker: false },
          ].map(({ player, stats, isStriker }) =>
            player ? (
              <tr
                key={`${player.id}-${isStriker ? "striker" : "nonstriker"}`}
                className="border-b border-border-ui/30 last:border-0"
              >
                <td className="px-3 py-2.5 font-semibold text-text">
                  {player.name}
                  {isStriker && <span className="text-primary ml-0.5">*</span>}
                </td>
                <td className="text-right px-2 py-2.5 font-bold text-text">
                  {stats?.runs ?? 0}
                </td>
                <td className="text-right px-2 py-2.5 text-text-muted">
                  {stats?.balls_faced ?? 0}
                </td>
                <td className="text-right px-2 py-2.5 text-text-muted">
                  {stats?.fours ?? 0}
                </td>
                <td className="text-right px-2 py-2.5 text-text-muted">
                  {stats?.sixes ?? 0}
                </td>
                <td className="text-right px-3 py-2.5 text-text-muted">
                  {sr(stats?.runs ?? 0, stats?.balls_faced ?? 0)}
                </td>
              </tr>
            ) : null
          )}
        </tbody>
      </table>
    </div>
  );
}

