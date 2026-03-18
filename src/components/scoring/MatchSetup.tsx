"use client";

import { useState, useEffect } from "react";
import { setupMatch } from "@/lib/scoring/engine";
import type { Match, Team, Player } from "@/lib/types/database";
import type { MatchSetupInput } from "@/lib/scoring/types";
import { fetchPlayersForTeam } from "@/features/players/api";

interface MatchSetupProps {
  match: Match;
  teamA: Team;
  teamB: Team;
  onComplete: () => void;
}

export function MatchSetup({ match, teamA, teamB, onComplete }: MatchSetupProps) {
  const [step, setStep] = useState<"toss" | "xi" | "openers">("toss");
  const [tossWinnerId, setTossWinnerId] = useState("");
  const [tossDecision, setTossDecision] = useState<"bat" | "bowl">("bat");
  const [teamAPlayers, setTeamAPlayers] = useState<Player[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<Player[]>([]);
  const [selectedA, setSelectedA] = useState<string[]>([]);
  const [selectedB, setSelectedB] = useState<string[]>([]);
  const [strikerId, setStrikerId] = useState("");
  const [nonStrikerId, setNonStrikerId] = useState("");
  const [bowlerId, setBowlerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxPlayers =
    (match.settings as Record<string, number>)?.players_per_team ?? 11;

  useEffect(() => {
    async function fetchPlayers() {
      const [aPlayers, bPlayers] = await Promise.all([
        fetchPlayersForTeam(match.team_a_id),
        fetchPlayersForTeam(match.team_b_id),
      ]);
      setTeamAPlayers(aPlayers);
      setTeamBPlayers(bPlayers);
    }
    fetchPlayers();
  }, [match.team_a_id, match.team_b_id]);

  const togglePlayer = (playerId: string, team: "a" | "b") => {
    const setter = team === "a" ? setSelectedA : setSelectedB;
    const list = team === "a" ? selectedA : selectedB;
    if (list.includes(playerId)) {
      setter(list.filter((id) => id !== playerId));
    } else if (list.length < maxPlayers) {
      setter([...list, playerId]);
    }
  };

  // Determine batting/bowling teams based on toss
  const battingTeamId =
    tossDecision === "bat"
      ? tossWinnerId
      : tossWinnerId === match.team_a_id
        ? match.team_b_id
        : match.team_a_id;
  const battingTeamName = battingTeamId === match.team_a_id ? teamA.name : teamB.name;
  const bowlingTeamName = battingTeamId === match.team_a_id ? teamB.name : teamA.name;
  const battingXI = battingTeamId === match.team_a_id ? selectedA : selectedB;
  const bowlingXI = battingTeamId === match.team_a_id ? selectedB : selectedA;
  const battingPlayers = battingTeamId === match.team_a_id ? teamAPlayers : teamBPlayers;
  const bowlingPlayers = battingTeamId === match.team_a_id ? teamBPlayers : teamAPlayers;

  const handleFinish = async () => {
    if (!strikerId || !nonStrikerId || !bowlerId) {
      setError("Select all opening players.");
      return;
    }
    if (strikerId === nonStrikerId) {
      setError("Striker and non-striker must be different.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input: MatchSetupInput = {
        tossWinnerId,
        tossDecision,
        playingXI_A: selectedA,
        playingXI_B: selectedB,
        openingStrikerId: strikerId,
        openingNonStrikerId: nonStrikerId,
        openingBowlerId: bowlerId,
      };
      await setupMatch(match.id, input);
      onComplete();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {["toss", "xi", "openers"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step === s
                  ? "bg-primary text-white"
                  : "bg-surface-alt text-text-muted"
              }`}
            >
              {i + 1}
            </div>
            {i < 2 && <div className="w-8 h-0.5 bg-surface-alt" />}
          </div>
        ))}
      </div>

      {/* TOSS */}
      {step === "toss" && (
        <div className="card animate-fade-in">
          <h2 className="text-lg font-bold text-text mb-4">🪙 Toss</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Who won the toss?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: match.team_a_id, name: teamA.name },
                  { id: match.team_b_id, name: teamB.name },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTossWinnerId(t.id)}
                    className={`p-4 rounded-lg text-center font-semibold transition-all ${
                      tossWinnerId === t.id
                        ? "bg-primary text-white shadow-lg"
                        : "bg-surface border border-border-ui text-text hover:bg-surface-alt"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            {tossWinnerId && (
              <div className="animate-fade-in">
                <label className="block text-sm font-medium text-text mb-2">
                  Elected to?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(["bat", "bowl"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setTossDecision(d)}
                      className={`p-3 rounded-lg text-center font-semibold capitalize transition-all ${
                        tossDecision === d
                          ? "bg-primary text-white"
                          : "bg-surface border border-border-ui text-text hover:bg-surface-alt"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => setStep("xi")}
              disabled={!tossWinnerId}
              className="btn-primary w-full mt-4"
            >
              Next: Select Playing XI →
            </button>
          </div>
        </div>
      )}

      {/* PLAYING XI */}
      {step === "xi" && (
        <div className="card animate-fade-in">
          <h2 className="text-lg font-bold text-text mb-4">👥 Playing XI</h2>

          {/* Team A */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-text mb-2">
              {teamA.name} ({selectedA.length}/{maxPlayers})
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {teamAPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePlayer(p.id, "a")}
                  className={`w-full flex items-center gap-2 p-2.5 rounded-lg text-left text-sm transition-colors ${
                    selectedA.includes(p.id)
                      ? "bg-primary/10 border border-primary/30 text-text"
                      : "bg-surface border border-border-ui/50 text-text-muted hover:bg-surface-alt"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedA.includes(p.id)
                        ? "border-primary bg-primary"
                        : "border-border-ui"
                    }`}
                  >
                    {selectedA.includes(p.id) && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-text-muted capitalize ml-auto">
                    {p.role}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Team B */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-text mb-2">
              {teamB.name} ({selectedB.length}/{maxPlayers})
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {teamBPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePlayer(p.id, "b")}
                  className={`w-full flex items-center gap-2 p-2.5 rounded-lg text-left text-sm transition-colors ${
                    selectedB.includes(p.id)
                      ? "bg-primary/10 border border-primary/30 text-text"
                      : "bg-surface border border-border-ui/50 text-text-muted hover:bg-surface-alt"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedB.includes(p.id)
                        ? "border-primary bg-primary"
                        : "border-border-ui"
                    }`}
                  >
                    {selectedB.includes(p.id) && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-text-muted capitalize ml-auto">
                    {p.role}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("toss")} className="btn-secondary flex-1">
              ← Back
            </button>
            <button
              onClick={() => setStep("openers")}
              disabled={selectedA.length !== maxPlayers || selectedB.length !== maxPlayers}
              className="btn-primary flex-1"
            >
              Next: Openers →
            </button>
          </div>
        </div>
      )}

      {/* OPENERS */}
      {step === "openers" && (
        <div className="card animate-fade-in">
          <h2 className="text-lg font-bold text-text mb-4">🏏 Opening Players</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                Striker ({battingTeamName})
              </label>
              <div className="grid grid-cols-2 gap-2">
                {battingPlayers
                  .filter((p) => battingXI.includes(p.id))
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setStrikerId(p.id)}
                      className={`p-3 rounded-lg text-left text-sm font-semibold transition-colors ${
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

            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                Non-Striker ({battingTeamName})
              </label>
              <div className="grid grid-cols-2 gap-2">
                {battingPlayers
                  .filter((p) => battingXI.includes(p.id))
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setNonStrikerId(p.id)}
                      className={`p-3 rounded-lg text-left text-sm font-semibold transition-colors ${
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

            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                Opening Bowler ({bowlingTeamName})
              </label>
              <div className="grid grid-cols-2 gap-2">
                {bowlingPlayers
                  .filter((p) => bowlingXI.includes(p.id))
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setBowlerId(p.id)}
                      className={`p-3 rounded-lg text-left text-sm font-semibold transition-colors ${
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

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
                <p className="text-sm text-destructive font-medium">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep("xi")} className="btn-secondary flex-1">
                ← Back
              </button>
              <button onClick={handleFinish} disabled={saving} className="btn-primary flex-1">
                {saving ? "Starting..." : "🏏 Start Match"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

