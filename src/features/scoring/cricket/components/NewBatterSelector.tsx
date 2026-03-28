"use client";

import type { Player, BattingStats } from "@/lib/types/database";

interface NewBatterSelectorProps {
  availableBatters: Player[];
  battingStats: BattingStats[];
  /** IDs of batters currently at the crease (striker + non-striker) */
  currentBatterIds?: string[];
  onSelect: (batterId: string) => void;
}

export function NewBatterSelector({
  availableBatters,
  battingStats,
  currentBatterIds = [],
  onSelect,
}: NewBatterSelectorProps) {
  // Dismissed players: only those explicitly marked as out
  const dismissedIds = new Set(
    battingStats.filter((bs) => bs.is_out).map((bs) => bs.player_id)
  );
  // Also exclude anyone currently at the crease
  const currentIds = new Set(currentBatterIds);

  // Available = in batting team, not dismissed, not currently batting
  const yetToBat = availableBatters.filter(
    (p) => !dismissedIds.has(p.id) && !currentIds.has(p.id)
  );

  return (
    <div className="card border-warning/40 animate-fade-in">
      <h3 className="text-lg font-bold text-text mb-3">🏏 Select New Batter</h3>
      <p className="text-sm text-text-muted mb-4">
        Choose the next batter to come in.
      </p>

      {yetToBat.length === 0 ? (
        <p className="text-sm text-destructive font-medium">
          No batters available — innings should end.
        </p>
      ) : (
        <div className="space-y-2">
          {yetToBat.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface border border-border-ui text-left hover:bg-surface-alt hover:border-warning/30 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-warning/15 flex items-center justify-center text-xs font-bold text-warning">
                {p.jersey_number ?? p.name.charAt(0)}
              </div>
              <div>
                <span className="font-semibold text-text text-sm">{p.name}</span>
                <span className="text-xs text-text-muted capitalize ml-2">
                  {p.role}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

