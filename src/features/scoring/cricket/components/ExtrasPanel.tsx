"use client";

import { useState } from "react";
import type { ExtraType } from "@/lib/types/database";

interface ExtrasPanelProps {
  onExtra: (extraType: ExtraType, additionalRuns: number) => void;
  disabled?: boolean;
}

export function ExtrasPanel({ onExtra, disabled }: ExtrasPanelProps) {
  const [selected, setSelected] = useState<ExtraType | null>(null);
  const [additionalRuns, setAdditionalRuns] = useState(0);

  const extras: { type: ExtraType; label: string; short: string }[] = [
    { type: "wide", label: "Wide", short: "Wd" },
    { type: "no_ball", label: "No Ball", short: "Nb" },
    { type: "bye", label: "Bye", short: "B" },
    { type: "leg_bye", label: "Leg Bye", short: "Lb" },
  ];

  const handleSubmit = () => {
    if (!selected) return;
    const baseExtra = selected === "wide" || selected === "no_ball" ? 1 : 0;
    onExtra(selected, baseExtra + additionalRuns);
    setSelected(null);
    setAdditionalRuns(0);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-muted mb-2 uppercase tracking-wide">
        Extras
      </h3>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {extras.map((e) => (
          <button
            key={e.type}
            onClick={() => setSelected(selected === e.type ? null : e.type)}
            disabled={disabled}
            className={`min-h-[2.75rem] rounded-lg text-sm font-semibold transition-all ${
              selected === e.type
                ? "bg-warning/20 border-2 border-warning text-warning"
                : "bg-surface border border-border-ui text-text-muted hover:bg-surface-alt"
            } disabled:opacity-40`}
          >
            {e.short}
          </button>
        ))}
      </div>

      {selected && (
        <div className="bg-surface-alt rounded-lg p-3 animate-fade-in">
          <p className="text-sm text-text mb-2">
            {extras.find((e) => e.type === selected)?.label} +
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted">Additional runs:</span>
            <div className="flex flex-wrap gap-1">
              {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                <button
                  key={r}
                  onClick={() => setAdditionalRuns(r)}
                  className={`w-9 h-9 rounded-md text-sm font-semibold ${
                    additionalRuns === r
                      ? "bg-primary text-white"
                      : "bg-surface border border-border-ui text-text"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleSubmit} className="btn-primary w-full mt-3 text-sm">
            Record {extras.find((e) => e.type === selected)?.label}
            {additionalRuns > 0 ? ` + ${additionalRuns}` : ""}
          </button>
        </div>
      )}
    </div>
  );
}

