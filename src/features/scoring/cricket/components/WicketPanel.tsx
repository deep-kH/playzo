"use client";

import { useState } from "react";
import type { WicketType, Player } from "@/lib/types/database";

interface WicketPanelProps {
  bowlingTeamPlayers: Player[];
  strikerId: string;
  nonStrikerId: string;
  strikerName: string;
  nonStrikerName: string;
  onWicket: (
    wicketType: WicketType,
    dismissedPlayerId: string,
    fielderId: string | null,
    additionalRuns: number
  ) => void;
  onCancel: () => void;
  disabled?: boolean;
}

const wicketTypes: { type: WicketType; label: string; needsFielder: boolean }[] =
  [
    { type: "bowled", label: "Bowled", needsFielder: false },
    { type: "caught", label: "Caught", needsFielder: true },
    { type: "lbw", label: "LBW", needsFielder: false },
    { type: "run_out", label: "Run Out", needsFielder: true },
    { type: "stumped", label: "Stumped", needsFielder: true },
    { type: "hit_wicket", label: "Hit Wicket", needsFielder: false },
    { type: "retired_hurt", label: "Retired Hurt", needsFielder: false },
  ];

export function WicketPanel({
  bowlingTeamPlayers,
  strikerId,
  nonStrikerId,
  strikerName,
  nonStrikerName,
  onWicket,
  onCancel,
  disabled,
}: WicketPanelProps) {
  const [wicketType, setWicketType] = useState<WicketType | null>(null);
  const [dismissedId, setDismissedId] = useState<string>(strikerId);
  const [fielderId, setFielderId] = useState("");
  const [runs, setRuns] = useState(0);
  const [step, setStep] = useState<"type" | "details">("type");

  const selectedWicket = wicketTypes.find((w) => w.type === wicketType);
  const needsFielder = selectedWicket?.needsFielder ?? false;
  const canSelectDismissed = wicketType === "run_out"; // only run-out can dismiss non-striker

  const handleConfirm = () => {
    if (!wicketType) return;
    onWicket(wicketType, dismissedId, fielderId || null, runs);
  };

  return (
    <div className="card border-destructive/40 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-destructive">🔴 Wicket</h3>
        <button
          onClick={onCancel}
          className="btn-secondary text-xs !py-1 !px-2"
        >
          Cancel
        </button>
      </div>

      {step === "type" && (
        <div className="space-y-2">
          {wicketTypes.map((w) => (
            <button
              key={w.type}
              onClick={() => {
                setWicketType(w.type);
                setStep("details");
              }}
              disabled={disabled}
              className="w-full p-3 rounded-lg bg-surface border border-border-ui text-left font-medium text-text hover:bg-surface-alt transition-colors"
            >
              {w.label}
            </button>
          ))}
        </div>
      )}

      {step === "details" && wicketType && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-sm font-semibold text-text">{selectedWicket?.label}</p>

          {/* Dismissed player (only for run-out) */}
          {canSelectDismissed && (
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                Who is out?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDismissedId(strikerId)}
                  className={`p-2.5 rounded-lg text-sm font-semibold ${
                    dismissedId === strikerId
                      ? "bg-destructive/15 border-2 border-destructive text-destructive"
                      : "bg-surface border border-border-ui text-text"
                  }`}
                >
                  {strikerName} *
                </button>
                <button
                  onClick={() => setDismissedId(nonStrikerId)}
                  className={`p-2.5 rounded-lg text-sm font-semibold ${
                    dismissedId === nonStrikerId
                      ? "bg-destructive/15 border-2 border-destructive text-destructive"
                      : "bg-surface border border-border-ui text-text"
                  }`}
                >
                  {nonStrikerName}
                </button>
              </div>
            </div>
          )}

          {/* Fielder */}
          {needsFielder && (
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                Fielder
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {bowlingTeamPlayers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFielderId(p.id)}
                    disabled={disabled}
                    className={`p-3 rounded-lg text-left text-sm font-semibold transition-colors ${
                      fielderId === p.id
                        ? "bg-primary text-white"
                        : "bg-surface border border-border-ui text-text hover:bg-surface-alt"
                    } disabled:opacity-40`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Runs on wicket ball */}
          {wicketType === "run_out" && (
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                Runs completed
              </label>
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRuns(r)}
                    className={`w-10 h-10 rounded-md text-sm font-semibold ${
                      runs === r
                        ? "bg-primary text-white"
                        : "bg-surface border border-border-ui text-text"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep("type")}
              className="btn-secondary flex-1 text-sm"
            >
              ← Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={
                disabled || (needsFielder && !fielderId && wicketType !== "run_out")
              }
              className="btn-danger flex-1 text-sm"
            >
              Confirm Wicket
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

