"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import type { Match, Team, Tournament } from "@/lib/types/database";
import { StatusBadge } from "@/components/common/StatusBadge";
import Link from "next/link";
import { getTournamentById, getTournamentTeams } from "@/features/tournaments/api";
import {
  listMatchesByTournamentId,
  createMatch,
  updateMatchStatus,
  deleteMatch,
} from "@/features/matches/api";
import { getTeamsByIds } from "@/features/teams/api";
import {
  addTeamToTournamentAdmin,
  listTeamsBySportAdmin,
  removeTeamFromTournamentAdmin,
} from "@/features/tournaments/adminApi";

type Tab = "teams" | "matches";

export default function MatchesPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab state — default to "teams" if no teams finalized yet, otherwise "matches"
  const [activeTab, setActiveTab] = useState<Tab>("teams");
  const [teamsFinalized, setTeamsFinalized] = useState(false);

  // Match form
  const [showForm, setShowForm] = useState(false);
  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [venue, setVenue] = useState("");
  const [saving, setSaving] = useState(false);

  // Team selector
  const [allSportTeams, setAllSportTeams] = useState<Team[]>([]);
  const [tournamentTeamIds, setTournamentTeamIds] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    const [t, matchData, ttRes] = await Promise.all([
      getTournamentById(tournamentId),
      listMatchesByTournamentId(tournamentId),
      getTournamentTeams(tournamentId),
    ]);

    setTournament(t as Tournament | null);
    setMatches(matchData);

    const teamIds = ttRes.map((tt) => tt.team_id);
    setTournamentTeamIds(teamIds);

    const teamsData = teamIds.length > 0 ? await getTeamsByIds(teamIds) : [];
    setTeams(teamsData);

    // If teams already exist and matches have been created, consider teams finalized
    const isFinalized = teamIds.length >= 2;
    setTeamsFinalized(isFinalized);

    // Auto-switch to matches tab if teams are finalized and matches exist
    if (isFinalized && matchData.length > 0) {
      setActiveTab("matches");
    }

    // Load all sport teams for the selector
    if (t) {
      const sportTeams = await listTeamsBySportAdmin(t.sport);
      setAllSportTeams((sportTeams as Team[]) ?? []);
    }

    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleTeam = async (teamId: string) => {
    if (tournamentTeamIds.includes(teamId)) {
      await removeTeamFromTournamentAdmin({
        tournament_id: tournamentId,
        team_id: teamId,
      });
      setTournamentTeamIds((prev) => prev.filter((id) => id !== teamId));
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
    } else {
      await addTeamToTournamentAdmin({
        tournament_id: tournamentId,
        team_id: teamId,
      });
      setTournamentTeamIds((prev) => [...prev, teamId]);
      const team = allSportTeams.find((t) => t.id === teamId);
      if (team) setTeams((prev) => [...prev, team]);
    }
  };

  const handleFinalizeTeams = () => {
    if (tournamentTeamIds.length < 2) {
      alert("Add at least 2 teams before proceeding.");
      return;
    }
    setTeamsFinalized(true);
    setActiveTab("matches");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (teamAId === teamBId) {
      alert("Team A and Team B must be different.");
      return;
    }
    setSaving(true);

    await createMatch({
      tournament_id: tournamentId,
      team_a_id: teamAId,
      team_b_id: teamBId,
      start_time: startTime || null,
      venue: venue || null,
      settings: tournament?.settings ?? {},
    });

    setSaving(false);
    setShowForm(false);
    setTeamAId("");
    setTeamBId("");
    setStartTime("");
    setVenue("");
    fetchData();
  };

  const updateStatus = async (matchId: string, status: string) => {
    await updateMatchStatus(matchId, status);
    fetchData();
  };

  const handleDelete = async (matchId: string) => {
    if (!confirm("Delete this match?")) return;
    await deleteMatch(matchId);
    fetchData();
  };

  const getTeam = (id: string) => teams.find((t) => t.id === id);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-4 w-32" />
        <div className="space-y-3 mt-6">
          {[1, 2].map((i) => (
            <div key={i} className="card space-y-3">
              <div className="skeleton h-5 w-full" />
              <div className="skeleton h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)]">
          {tournament?.name ?? "Tournament"}
        </h1>
        <p className="text-sm text-[var(--text-muted)] capitalize mt-1">
          {tournament?.sport} · Tournament Setup
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-6">
        <StepIndicator
          step={1}
          label="Select Teams"
          active={activeTab === "teams"}
          done={teamsFinalized}
          onClick={() => setActiveTab("teams")}
        />
        <div className="h-0.5 flex-1 bg-[var(--border)]" />
        <StepIndicator
          step={2}
          label="Create Matches"
          active={activeTab === "matches"}
          done={matches.length > 0}
          disabled={!teamsFinalized}
          onClick={() => teamsFinalized && setActiveTab("matches")}
        />
      </div>

      {/* ═══ Tab: Teams ═══════════════════════════ */}
      {activeTab === "teams" && (
        <div className="animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text)]">
              Tournament Teams ({tournamentTeamIds.length})
            </h2>
            {tournamentTeamIds.length >= 2 && (
              <button onClick={handleFinalizeTeams} className="btn-primary text-sm">
                Finalize Teams →
              </button>
            )}
          </div>

          {allSportTeams.length === 0 ? (
            <div className="card text-center py-10">
              <div className="text-3xl mb-3">🏃</div>
              <h3 className="text-base font-semibold text-[var(--text)] mb-1">
                No {tournament?.sport} teams
              </h3>
              <p className="text-sm text-[var(--text-muted)]">
                Create teams first in the Teams section.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {allSportTeams.map((team) => {
                const isIn = tournamentTeamIds.includes(team.id);
                return (
                  <button
                    key={team.id}
                    onClick={() => toggleTeam(team.id)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all active:scale-[0.98] touch-manipulation ${
                      isIn
                        ? "bg-[var(--primary)]/10 border border-[var(--primary)]/30"
                        : "bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-alt)]"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isIn
                          ? "border-[var(--primary)] bg-[var(--primary)]"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {isIn && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <span className="font-medium text-[var(--text)]">{team.name}</span>
                    {isIn && (
                      <span className="ml-auto text-xs font-semibold text-[var(--primary)]">
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {tournamentTeamIds.length < 2 && tournamentTeamIds.length > 0 && (
            <p className="text-sm text-[var(--warning)] font-medium text-center mt-3">
              Select at least 2 teams to proceed
            </p>
          )}
        </div>
      )}

      {/* ═══ Tab: Matches ═════════════════════════ */}
      {activeTab === "matches" && (
        <div className="animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text)]">
              Matches ({matches.length})
            </h2>
            <button
              onClick={() => setShowForm(true)}
              disabled={teams.length < 2}
              className="btn-primary text-sm"
            >
              + New Match
            </button>
          </div>

          {/* Finalized teams summary */}
          <div className="flex flex-wrap gap-2 mb-2">
            {teams.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20"
              >
                {t.name}
              </span>
            ))}
            <button
              onClick={() => setActiveTab("teams")}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] underline transition-colors"
            >
              Edit teams
            </button>
          </div>

          {/* Create Form */}
          {showForm && (
            <div className="card animate-fade-in">
              <h3 className="text-lg font-semibold text-[var(--text)] mb-4">
                Schedule Match
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="m-teamA"
                      className="block text-sm font-medium text-[var(--text)] mb-1.5"
                    >
                      Team A
                    </label>
                    <select
                      id="m-teamA"
                      value={teamAId}
                      onChange={(e) => setTeamAId(e.target.value)}
                      className="input-field"
                      required
                    >
                      <option value="">Select team</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="m-teamB"
                      className="block text-sm font-medium text-[var(--text)] mb-1.5"
                    >
                      Team B
                    </label>
                    <select
                      id="m-teamB"
                      value={teamBId}
                      onChange={(e) => setTeamBId(e.target.value)}
                      className="input-field"
                      required
                    >
                      <option value="">Select team</option>
                      {teams
                        .filter((t) => t.id !== teamAId)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="m-time"
                      className="block text-sm font-medium text-[var(--text)] mb-1.5"
                    >
                      Start Time
                    </label>
                    <input
                      id="m-time"
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="m-venue"
                      className="block text-sm font-medium text-[var(--text)] mb-1.5"
                    >
                      Venue
                    </label>
                    <input
                      id="m-venue"
                      type="text"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary text-sm"
                  >
                    {saving ? "Saving..." : "Schedule"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Match List */}
          {matches.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-4xl mb-4">📅</div>
              <h3 className="text-lg font-semibold text-[var(--text)] mb-2">
                No Matches Scheduled
              </h3>
              <p className="text-sm text-[var(--text-muted)]">
                Create matches between your finalized teams.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((match) => {
                const tA = getTeam(match.team_a_id);
                const tB = getTeam(match.team_b_id);
                return (
                  <div key={match.id} className="card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <StatusBadge status={match.status} />
                          {match.venue && (
                            <span className="text-xs text-[var(--text-muted)]">
                              {match.venue}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-[var(--text)]">
                          {tA?.name ?? "?"} vs {tB?.name ?? "?"}
                        </p>
                        {match.start_time && (
                          <p className="text-xs text-[var(--text-muted)] mt-1">
                            {new Date(match.start_time).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
                        {match.status === "scheduled" && (
                          <Link
                            href={`/admin/score/${match.id}`}
                            className="btn-primary text-xs !py-1 !px-2 no-underline"
                          >
                            ▶ Start Match
                          </Link>
                        )}
                        {match.status === "live" && (
                          <>
                            <Link
                              href={`/admin/score/${match.id}`}
                              className="btn-primary text-xs !py-1 !px-2 no-underline"
                            >
                              ▶ Score
                            </Link>
                            <Link
                              href={`/live/${match.id}`}
                              target="_blank"
                              className="btn-accent text-xs !py-1 !px-2 no-underline"
                            >
                              👀 Live URL
                            </Link>
                            <button
                              onClick={() => updateStatus(match.id, "completed")}
                              className="btn-secondary text-xs !py-1 !px-2"
                            >
                              End
                            </button>
                          </>
                        )}
                        {match.status !== "live" && (
                          <button
                            onClick={() => handleDelete(match.id)}
                            className="btn-danger text-xs !py-1 !px-2"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Step indicator pill ─────────────────── */
function StepIndicator({
  step,
  label,
  active,
  done,
  disabled,
  onClick,
}: {
  step: number;
  label: string;
  active: boolean;
  done: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const bg = active
    ? "bg-[var(--primary)] text-white"
    : done
    ? "bg-[var(--success)] text-white"
    : "bg-[var(--surface-alt)] text-[var(--text-muted)]";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all
        ${bg}
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:brightness-110 active:scale-95"}
      `}
    >
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
          active
            ? "border-white/40"
            : done
            ? "border-white/40"
            : "border-[var(--border)]"
        }`}
      >
        {done && !active ? "✓" : step}
      </span>
      {label}
    </button>
  );
}
