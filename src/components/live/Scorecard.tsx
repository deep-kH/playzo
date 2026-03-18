import type {
  BattingStats,
  BowlingStats,
  Player,
  Innings,
} from "@/lib/types/database";

interface ScorecardProps {
  innings: Innings;
  battingStats: BattingStats[];
  bowlingStats: BowlingStats[];
  players: Player[];
  battingTeamName: string;
  bowlingTeamName: string;
}

function sr(runs: number, balls: number): string {
  return balls > 0 ? ((runs / balls) * 100).toFixed(1) : "—";
}

function econ(runs: number, overs: number): string {
  return overs > 0 ? (runs / overs).toFixed(2) : "—";
}

function playerName(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? "—";
}

function dismissalText(bs: BattingStats, players: Player[]): string {
  if (!bs.is_out) return "not out";
  const type = bs.dismissal_type ?? "";
  switch (type) {
    case "bowled":
      return `b ${playerName(players, bs.dismissal_bowler_id ?? "")}`;
    case "caught":
      return `c ${playerName(players, bs.dismissal_fielder_id ?? "")} b ${playerName(
        players,
        bs.dismissal_bowler_id ?? ""
      )}`;
    case "lbw":
      return `lbw b ${playerName(players, bs.dismissal_bowler_id ?? "")}`;
    case "run_out":
      return `run out (${playerName(players, bs.dismissal_fielder_id ?? "")})`;
    case "stumped":
      return `st ${playerName(players, bs.dismissal_fielder_id ?? "")} b ${playerName(
        players,
        bs.dismissal_bowler_id ?? ""
      )}`;
    case "hit_wicket":
      return `hit wicket b ${playerName(players, bs.dismissal_bowler_id ?? "")}`;
    case "retired_hurt":
      return "retired hurt";
    default:
      return type;
  }
}

export function Scorecard({
  innings,
  battingStats,
  bowlingStats,
  players,
  battingTeamName,
  bowlingTeamName,
}: ScorecardProps) {
  const sortedBatting = [...battingStats]
    .filter((bs) => bs.balls_faced > 0 || bs.is_out)
    .sort((a, b) => (a.batting_position ?? 99) - (b.batting_position ?? 99));

  const sortedBowling = [...bowlingStats]
    .filter((bs) => parseFloat(String(bs.overs)) > 0)
    .sort(
      (a, b) => parseFloat(String(a.overs)) - parseFloat(String(b.overs))
    );

  return (
    <div className="space-y-4">
      {/* Batting */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-3 py-2.5 bg-surface-alt flex items-center justify-between">
          <h3 className="text-sm font-bold text-text">
            {battingTeamName} — Batting
          </h3>
          <span className="text-sm font-bold text-text">
            {innings.total_runs}/{innings.total_wickets} ({innings.total_overs} ov)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-border-ui/50 text-xs text-text-muted">
                <th className="text-left px-3 py-1.5 font-medium">Batter</th>
                <th className="text-left px-2 py-1.5 font-medium">Dismissal</th>
                <th className="text-right px-2 py-1.5 font-medium">R</th>
                <th className="text-right px-2 py-1.5 font-medium">B</th>
                <th className="text-right px-2 py-1.5 font-medium">4s</th>
                <th className="text-right px-2 py-1.5 font-medium">6s</th>
                <th className="text-right px-3 py-1.5 font-medium">SR</th>
              </tr>
            </thead>
            <tbody>
              {sortedBatting.map((bs) => (
                <tr
                  key={bs.id}
                  className="border-b border-border-ui/30 last:border-0"
                >
                  <td className="px-3 py-2 font-semibold text-text">
                    {playerName(players, bs.player_id)}
                  </td>
                  <td className="px-2 py-2 text-xs text-text-muted max-w-[140px] truncate">
                    {dismissalText(bs, players)}
                  </td>
                  <td className="text-right px-2 py-2 font-bold text-text">
                    {bs.runs}
                  </td>
                  <td className="text-right px-2 py-2 text-text-muted">
                    {bs.balls_faced}
                  </td>
                  <td className="text-right px-2 py-2 text-text-muted">
                    {bs.fours}
                  </td>
                  <td className="text-right px-2 py-2 text-text-muted">
                    {bs.sixes}
                  </td>
                  <td className="text-right px-3 py-2 text-text-muted">
                    {sr(bs.runs, bs.balls_faced)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 bg-surface-alt text-xs text-text-muted">
          Extras: {innings.total_extras}
        </div>
      </div>

      {/* Bowling */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-3 py-2.5 bg-surface-alt">
          <h3 className="text-sm font-bold text-text">
            {bowlingTeamName} — Bowling
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
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
              {sortedBowling.map((bs) => (
                <tr
                  key={bs.id}
                  className="border-b border-border-ui/30 last:border-0"
                >
                  <td className="px-3 py-2 font-semibold text-text">
                    {playerName(players, bs.player_id)}
                  </td>
                  <td className="text-right px-2 py-2 text-text-muted">
                    {bs.overs}
                  </td>
                  <td className="text-right px-2 py-2 text-text-muted">
                    {bs.maidens}
                  </td>
                  <td className="text-right px-2 py-2 font-bold text-text">
                    {bs.runs_conceded}
                  </td>
                  <td className="text-right px-2 py-2 font-bold text-primary">
                    {bs.wickets}
                  </td>
                  <td className="text-right px-3 py-2 text-text-muted">
                    {econ(bs.runs_conceded, parseFloat(String(bs.overs)))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

