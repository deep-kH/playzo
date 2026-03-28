"use client";

import { useState } from "react";
import type { Player } from "@/lib/types/database";

interface InningsBreakSetupProps {
  battingTeamName: string;
  bowlingTeamName: string;
  battingPlayers: Player[];
  bowlingPlayers: Player[];
  onStart: (strikerId: string, nonStrikerId: string, bowlerId: string) => void;
  busy: boolean;
}

export function InningsBreakSetup({
  battingTeamName,
  bowlingTeamName,
  battingPlayers,
  bowlingPlayers,
  onStart,
  busy,
}: InningsBreakSetupProps) {
  const [strikerId, setStrikerId] = useState("");
  const [nonStrikerId, setNonStrikerId] = useState("");
  const [bowlerId, setBowlerId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const handleGo = () => {
    if (!strikerId || !nonStrikerId || !bowlerId) {
      setErr("Select all opening players.");
      return;
    }
    if (strikerId === nonStrikerId) {
      setErr("Striker and non-striker must differ.");
      return;
    }
    setErr(null);
    onStart(strikerId, nonStrikerId, bowlerId);
  };

  return (
    <div className="card animate-fade-in space-y-4">
      <h3 className="font-bold text-text">2nd Innings — Opening Players</h3>

      {/* Striker */}
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">
          Striker ({battingTeamName})
        </label>
        <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
          {battingPlayers.map((p) => (
            <button
              key={p.id}
              onClick={() => setStrikerId(p.id)}
              className={`p-3 rounded-lg text-sm font-semibold transition-colors ${
                strikerId === p.id
                  ? "bg-primary text-white"
                  : "bg-surface border border-border-ui text-text hover:bg-surface-alt"
              } ${p.id === nonStrikerId ? "opacity-50 pointer-events-none" : ""}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Non-Striker */}
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">
          Non-Striker ({battingTeamName})
        </label>
        <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
          {battingPlayers.map((p) => (
            <button
              key={p.id}
              onClick={() => setNonStrikerId(p.id)}
              className={`p-3 rounded-lg text-sm font-semibold transition-colors ${
                nonStrikerId === p.id
                  ? "bg-primary text-white"
                  : "bg-surface border border-border-ui text-text hover:bg-surface-alt"
              } ${p.id === strikerId ? "opacity-50 pointer-events-none" : ""}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bowler */}
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">
          Opening Bowler ({bowlingTeamName})
        </label>
        <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
          {bowlingPlayers.map((p) => (
            <button
              key={p.id}
              onClick={() => setBowlerId(p.id)}
              className={`p-3 rounded-lg text-sm font-semibold transition-colors ${
                bowlerId === p.id
                  ? "bg-primary text-white"
                  : "bg-surface border border-border-ui text-text hover:bg-surface-alt"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {err && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
          <p className="text-sm text-destructive font-medium">{err}</p>
        </div>
      )}

      <button onClick={handleGo} disabled={busy} className="btn-primary w-full">
        {busy ? "Starting..." : "🏏 Start 2nd Innings"}
      </button>
    </div>
  );
}
