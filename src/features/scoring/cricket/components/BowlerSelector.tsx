"use client";

import type { Player, BowlingStats } from "@/lib/types/database";

interface BowlerSelectorProps {
  bowlers: Player[];
  lastBowlerId: string | null;
  maxOvers?: number;
  bowlingStats?: BowlingStats[];
  mustUseNewBowler?: boolean;
  usedBowlerIds?: Set<string>;
  onSelect: (bowlerId: string) => void;
}

export function BowlerSelector({
  bowlers,
  lastBowlerId,
  maxOvers,
  bowlingStats = [],
  mustUseNewBowler = false,
  usedBowlerIds = new Set(),
  onSelect,
}: BowlerSelectorProps) {
  // Filter out the bowler who just bowled (can't bowl consecutive overs)
  // Filter out bowlers who have reached their max overs
  // Filter out already used bowlers if we must use a new one to meet min_bowlers
  const eligible = bowlers.filter((b) => {
    if (b.id === lastBowlerId) return false;

    if (maxOvers) {
      const stat = bowlingStats.find((s) => s.player_id === b.id);
      if (stat && Math.floor(stat.overs) >= maxOvers) return false;
    }

    if (mustUseNewBowler && usedBowlerIds.has(b.id)) {
      return false; // Force selection of a player who hasn't bowled
    }

    return true;
  });

  return (
    <div className="card border-primary/40 animate-fade-in">
      <h3 className="text-lg font-bold text-text mb-3">🏏 Select New Bowler</h3>
      <p className="text-sm text-text-muted mb-4">
        Choose the bowler for the next over.
      </p>
      <div className="space-y-2">
        {eligible.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface border border-border-ui text-left hover:bg-surface-alt hover:border-primary/30 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
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
    </div>
  );
}

