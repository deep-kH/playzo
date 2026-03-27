"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import type { Match, Team, Tournament, Player } from "@/lib/types/database";
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
import { fetchPlayersForTeam } from "@/features/players/api";
import {
  addTeamToTournamentAdmin,
  listTeamsBySportAdmin,
  removeTeamFromTournamentAdmin,
} from "@/features/tournaments/adminApi";

type BadmintonMatchType = "singles" | "doubles";

type Tab = "teams" | "matches";

export default function MatchesPage() {
  const params = useParams();
  const tournamentId = params?.id as string;

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
  const [saving, setSaving] = useState(false);

  // Team selector
  const [allSportTeams, setAllSportTeams] = useState<Team[]>([]);
  const [tournamentTeamIds, setTournamentTeamIds] = useState<string[]>([]);

  // Badminton-specific
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [bmMatchType, setBmMatchType] = useState<BadmintonMatchType>("singles");
  const [bmSideA, setBmSideA] = useState<string[]>([]);  // player IDs for singles side A
  const [bmSideB, setBmSideB] = useState<string[]>([]);  // player IDs for singles side B
  const [bmTeamAId, setBmTeamAId] = useState("");  // team ID for doubles side A
  const [bmTeamBId, setBmTeamBId] = useState("");  // team ID for doubles side B
  const [bmPointsPerSet, setBmPointsPerSet] = useState(21);
  const [bmSetsToWin, setBmSetsToWin] = useState(2);
  const [bmPointCap, setBmPointCap] = useState(30);

  // Football-specific
  const [fbPlayersPerTeam, setFbPlayersPerTeam] = useState(11);
  const [fbMatchDuration, setFbMatchDuration] = useState(90);

  // Cricket-specific
  const [crOvers, setCrOvers] = useState(20);
  const [crPlayersPerTeam, setCrPlayersPerTeam] = useState(11);
  const [crMinBowlers, setCrMinBowlers] = useState(5);

  const fetchData = useCallback(async () => {
    try {
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

        // For badminton: also load all players from tournament teams
        if (t.sport === "badminton" && teamIds.length > 0) {
          const playerPromises = teamIds.map((tid) => fetchPlayersForTeam(tid));
          const playerArrays = await Promise.all(playerPromises);
          setAllPlayers(playerArrays.flat());
        }
      }
    } catch (err) {
      console.error("Failed to fetch match data:", err);
    } finally {
      setLoading(false);
    }
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

  const isBadminton = tournament?.sport === "badminton";
  const hasScorer = tournament?.sport === "badminton" || tournament?.sport === "cricket";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (isBadminton) {
      if (bmMatchType === "singles") {
        // ── SINGLES: player-only, no teams ──
        if (bmSideA.length !== 1 || bmSideB.length !== 1) {
          alert("Select 1 player per side.");
          setSaving(false);
          return;
        }
        if (bmSideA[0] === bmSideB[0]) {
          alert("A player cannot play against themselves.");
          setSaving(false);
          return;
        }
        const pA = allPlayers.find((p) => p.id === bmSideA[0]);
        const pB = allPlayers.find((p) => p.id === bmSideB[0]);
        const bmPlayers = {
          side_a: [{ id: bmSideA[0], name: pA?.name ?? "Unknown" }],
          side_b: [{ id: bmSideB[0], name: pB?.name ?? "Unknown" }],
        };
        await createMatch({
          tournament_id: tournamentId,
          team_a_id: null,
          team_b_id: null,
          start_time: null,
          venue: null,
          settings: {
            ...(tournament?.settings ?? {}),
            match_type: "singles",
            badminton_players: bmPlayers,
            points_per_set: bmPointsPerSet,
            sets_to_win: bmSetsToWin,
            point_cap: bmPointCap,
          },
        });
      } else {
        // ── DOUBLES: team-based, players auto-derived ──
        if (!bmTeamAId || !bmTeamBId) {
          alert("Select both teams.");
          setSaving(false);
          return;
        }
        if (bmTeamAId === bmTeamBId) {
          alert("Team A and Team B must be different.");
          setSaving(false);
          return;
        }
        // Derive players from each team
        const teamAPlayersForMatch = allPlayers.filter(
          (p) => (p.team_id === bmTeamAId)
        ).slice(0, 2);
        const teamBPlayersForMatch = allPlayers.filter(
          (p) => (p.team_id === bmTeamBId)
        ).slice(0, 2);
        if (teamAPlayersForMatch.length < 2 || teamBPlayersForMatch.length < 2) {
          alert("Each team must have at least 2 players for doubles.");
          setSaving(false);
          return;
        }
        const bmPlayers = {
          side_a: teamAPlayersForMatch.map((p) => ({ id: p.id, name: p.name })),
          side_b: teamBPlayersForMatch.map((p) => ({ id: p.id, name: p.name })),
        };
        await createMatch({
          tournament_id: tournamentId,
          team_a_id: bmTeamAId,
          team_b_id: bmTeamBId,
          start_time: null,
          venue: null,
          settings: {
            ...(tournament?.settings ?? {}),
            match_type: "doubles",
            badminton_players: bmPlayers,
            points_per_set: bmPointsPerSet,
            sets_to_win: bmSetsToWin,
            point_cap: bmPointCap,
          },
        });
      }
    } else {
      // Non-badminton: team-based
      if (teamAId === teamBId) {
        alert("Team A and Team B must be different.");
        setSaving(false);
        return;
      }
      
      const extraSettings = tournament?.sport === "football" 
        ? { sport: "football", match_duration_minutes: fbMatchDuration, players_per_team: fbPlayersPerTeam } 
        : tournament?.sport === "cricket"
        ? { sport: "cricket", overs_per_innings: crOvers, players_per_team: crPlayersPerTeam, min_bowlers: crMinBowlers }
        : { sport: tournament?.sport };

      await createMatch({
        tournament_id: tournamentId,
        team_a_id: teamAId,
        team_b_id: teamBId,
        start_time: null,
        venue: null,
        settings: { ...(tournament?.settings ?? {}), ...extraSettings },
      });
    }

    setSaving(false);
    setShowForm(false);
    setTeamAId("");
    setTeamBId("");
    setBmSideA([]);
    setBmSideB([]);
    setBmTeamAId("");
    setBmTeamBId("");
    setBmMatchType("singles");
    setBmPointsPerSet(21);
    setBmSetsToWin(2);
    setBmPointCap(30);
    setFbPlayersPerTeam(11);
    setFbMatchDuration(90);
    setCrOvers(20);
    setCrPlayersPerTeam(11);
    setCrMinBowlers(5);
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
              disabled={isBadminton ? allPlayers.length < 2 : teams.length < 2}
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
                {isBadminton ? (
                  /* ── Badminton: Player-centric form ── */
                  <>
                    {/* Singles / Doubles toggle */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--text)] mb-2">
                        Match Type
                      </label>
                      <div className="flex gap-2">
                        {(["singles", "doubles"] as BadmintonMatchType[]).map((mt) => (
                          <button
                            key={mt}
                            type="button"
                            onClick={() => {
                              setBmMatchType(mt);
                              setBmSideA([]);
                              setBmSideB([]);
                            }}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                              bmMatchType === mt
                                ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-alt)]"
                            }`}
                          >
                            {mt === "singles" ? "👤 Singles" : "👥 Doubles"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {bmMatchType === "singles" ? (
                      /* ── Singles: Player picker (no teams) ── */
                      <>
                        <BadmintonPlayerPicker
                          label="Player A — Select 1 player"
                          players={allPlayers}
                          selected={bmSideA}
                          max={1}
                          excluded={bmSideB}
                          onChange={setBmSideA}
                        />
                        <BadmintonPlayerPicker
                          label="Player B — Select 1 player"
                          players={allPlayers}
                          selected={bmSideB}
                          max={1}
                          excluded={bmSideA}
                          onChange={setBmSideB}
                        />
                      </>
                    ) : (
                      /* ── Doubles: Team selectors (players auto-derived) ── */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Team A</label>
                          <select
                            value={bmTeamAId}
                            onChange={(e) => setBmTeamAId(e.target.value)}
                            className="input-field"
                            required
                          >
                            <option value="">Select team</option>
                            {teams.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          {bmTeamAId && (
                            <div className="mt-1 text-xs text-[var(--text-muted)]">
                              Players: {allPlayers
                                .filter((p) => p.team_id === bmTeamAId)
                                .slice(0, 2)
                                .map((p) => p.name)
                                .join(" & ") || "No players"}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Team B</label>
                          <select
                            value={bmTeamBId}
                            onChange={(e) => setBmTeamBId(e.target.value)}
                            className="input-field"
                            required
                          >
                            <option value="">Select team</option>
                            {teams.filter((t) => t.id !== bmTeamAId).map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          {bmTeamBId && (
                            <div className="mt-1 text-xs text-[var(--text-muted)]">
                              Players: {allPlayers
                                .filter((p) => p.team_id === bmTeamBId)
                                .slice(0, 2)
                                .map((p) => p.name)
                                .join(" & ") || "No players"}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Scoring Config */}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4 space-y-3">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        ⚙️ Scoring Rules
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Points per Set</label>
                          <input
                            type="number"
                            min={5}
                            max={50}
                            value={bmPointsPerSet}
                            onChange={(e) => setBmPointsPerSet(parseInt(e.target.value) || 21)}
                            className="input-field text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Sets to Win</label>
                          <select
                            value={bmSetsToWin}
                            onChange={(e) => setBmSetsToWin(parseInt(e.target.value))}
                            className="input-field text-center"
                          >
                            <option value={1}>1 (Best of 1)</option>
                            <option value={2}>2 (Best of 3)</option>
                            <option value={3}>3 (Best of 5)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Point Cap</label>
                          <input
                            type="number"
                            min={bmPointsPerSet}
                            max={99}
                            value={bmPointCap}
                            onChange={(e) => setBmPointCap(parseInt(e.target.value) || 30)}
                            className="input-field text-center"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Deuce at {bmPointsPerSet - 1}-{bmPointsPerSet - 1}: win by 2 until cap of {bmPointCap}. Golden point at {bmPointCap - 1}-{bmPointCap - 1}.
                      </p>
                    </div>
                  </>
                ) : (
                  /* ── Standard: Team-based form ── */
                  <div className="space-y-4">
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
                    </div>
                    {tournament?.sport === "football" && (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4 space-y-3">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          ⚙️ Match Settings
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                              Players on Field (per team)
                            </label>
                            <input
                              type="number"
                              min={5}
                              max={11}
                              value={fbPlayersPerTeam}
                              onChange={(e) => setFbPlayersPerTeam(parseInt(e.target.value) || 11)}
                              className="input-field max-w-[120px]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                              Match Duration (minutes)
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={fbMatchDuration}
                              onChange={(e) => setFbMatchDuration(Math.max(1, parseInt(e.target.value) || 1))}
                              className="input-field max-w-[120px]"
                            />
                            <p className="text-[10px] text-[var(--text-muted)] mt-1">Half = {Math.floor(fbMatchDuration / 2)} min</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {tournament?.sport === "cricket" && (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4 space-y-3">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          ⚙️ Match Settings
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                              Players per Team
                            </label>
                            <input
                              type="number"
                              min={2}
                              max={15}
                              value={crPlayersPerTeam}
                              onChange={(e) => setCrPlayersPerTeam(parseInt(e.target.value) || 11)}
                              className="input-field"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                              Overs per Innings
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={50}
                              value={crOvers}
                              onChange={(e) => setCrOvers(parseInt(e.target.value) || 20)}
                              className="input-field"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                              Min Bowlers
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={11}
                              value={crMinBowlers}
                              onChange={(e) => setCrMinBowlers(parseInt(e.target.value) || 5)}
                              className="input-field"
                            />
                            <p className="text-[10px] text-[var(--text-muted)] mt-1">Max {Math.ceil(crOvers / (crMinBowlers || 1))} ov/bowler</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                const bmSettings = (match.settings as any);
                const bmPlayers = bmSettings?.badminton_players;
                const bmType = bmSettings?.match_type;
                // For badminton, show player names; otherwise team names
                const sideALabel = bmPlayers
                  ? bmPlayers.side_a.map((p: any) => p.name).join(" & ")
                  : tA?.name ?? "?";
                const sideBLabel = bmPlayers
                  ? bmPlayers.side_b.map((p: any) => p.name).join(" & ")
                  : tB?.name ?? "?";
                return (
                  <div key={match.id} className="card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <StatusBadge status={match.status} />
                          {bmType && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-muted)] border border-[var(--border)] capitalize">
                              🏸 {bmType}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-[var(--text)]">
                          {sideALabel} vs {sideBLabel}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
                        {hasScorer && match.status === "scheduled" && (
                          <Link
                            href={`/admin/score/${match.id}`}
                            className="btn-primary text-xs !py-1 !px-2 no-underline"
                          >
                            ▶ Start Match
                          </Link>
                        )}
                        {match.status === "live" && (
                          <>
                            {hasScorer && (
                              <Link
                                href={`/admin/score/${match.id}`}
                                className="btn-primary text-xs !py-1 !px-2 no-underline"
                              >
                                ▶ Score
                              </Link>
                            )}
                            {hasScorer && (
                              <Link
                                href={`/live/matches/${match.id}/${tournament?.sport}`}
                                target="_blank"
                                className="btn-accent text-xs !py-1 !px-2 no-underline"
                              >
                                👀 Live URL
                              </Link>
                            )}
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

/* ── Badminton Player Picker ─────────────────── */
function BadmintonPlayerPicker({
  label,
  players,
  selected,
  max,
  excluded,
  onChange,
}: {
  label: string;
  players: Player[];
  selected: string[];
  max: number;
  excluded: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (selected.length < max) {
      onChange([...selected, id]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text)] mb-2">
        {label}
      </label>
      <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
        {players
          .filter((p) => !excluded.includes(p.id))
          .map((p) => {
            const isSelected = selected.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                disabled={!isSelected && selected.length >= max}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all active:scale-[0.98] touch-manipulation ${
                  isSelected
                    ? "bg-[var(--primary)]/10 border border-[var(--primary)]/30"
                    : "bg-[var(--surface)] border border-transparent hover:bg-[var(--surface-alt)] disabled:opacity-40"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected
                      ? "border-[var(--primary)] bg-[var(--primary)]"
                      : "border-[var(--border)]"
                  }`}
                >
                  {isSelected && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="10"
                      height="10"
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
                <span className="font-medium text-sm text-[var(--text)]">
                  {p.name}
                </span>
                <span className="text-xs text-[var(--text-muted)] ml-auto">
                  {p.role}
                </span>
              </button>
            );
          })}
        {players.filter((p) => !excluded.includes(p.id)).length === 0 && (
          <p className="text-xs text-[var(--text-muted)] text-center py-3">
            No players available
          </p>
        )}
      </div>
    </div>
  );
}
