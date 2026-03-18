import type { Player, BowlingStats } from "@/lib/types/database";

interface BowlerPanelProps {
  bowler: Player | null;
  stats: BowlingStats | null;
}

export function BowlerPanel({ bowler, stats }: BowlerPanelProps) {
  if (!bowler) return null;

  const economy =
    stats && parseFloat(String(stats.overs)) > 0
      ? (stats.runs_conceded / parseFloat(String(stats.overs))).toFixed(2)
      : "0.00";

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="px-3 py-2 bg-surface-alt">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
          Bowler
        </h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-ui/50 text-xs text-text-muted">
            <th className="text-left px-3 py-1.5 font-medium">Bowler</th>
            <th className="text-right px-2 py-1.5 font-medium">O</th>
            <th className="text-right px-2 py-1.5 font-medium">M</th>
            <th className="text-right px-2 py-1.5 font-medium">R</th>
            <th className="text-right px-2 py-1.5 font-medium">W</th>
            <th className="text-right px-3 py-1.5 font-medium">Econ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-3 py-2.5 font-semibold text-text">
              {bowler.name}
            </td>
            <td className="text-right px-2 py-2.5 text-text-muted">
              {stats?.overs ?? 0}
            </td>
            <td className="text-right px-2 py-2.5 text-text-muted">
              {stats?.maidens ?? 0}
            </td>
            <td className="text-right px-2 py-2.5 font-bold text-text">
              {stats?.runs_conceded ?? 0}
            </td>
            <td className="text-right px-2 py-2.5 font-bold text-primary">
              {stats?.wickets ?? 0}
            </td>
            <td className="text-right px-3 py-2.5 text-text-muted">
              {economy}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

