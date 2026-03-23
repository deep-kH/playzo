"use client";

import { useEffect, useState, useCallback } from "react";
import type { Tournament, Team, SportType } from "@/lib/types/database";
import Link from "next/link";
import {
  addTeamToTournamentAdmin,
  createTournamentAdmin,
  deleteTournamentAdmin,
  listTeamsBySportAdmin,
  listTournamentTeamIdsAdmin,
  listTournamentsAdmin,
  removeTeamFromTournamentAdmin,
} from "@/features/tournaments/adminApi";

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [sport, setSport] = useState<SportType>("cricket");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [overs, setOvers] = useState("20");
  const [playersPerTeam, setPlayersPerTeam] = useState("11");
  const [maxOversPerBowler, setMaxOversPerBowler] = useState("4");
  const [saving, setSaving] = useState(false);

  // Team assignment state
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [tournamentTeamIds, setTournamentTeamIds] = useState<string[]>([]);
  const [showTeamSelector, setShowTeamSelector] = useState(false);

  const fetchTournaments = useCallback(async () => {
    try {
      const data = await listTournamentsAdmin();
      setTournaments((data as Tournament[]) ?? []);
    } catch (err) {
      console.error("Failed to fetch tournaments:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTournaments();
  }, [fetchTournaments]);

  const resetForm = () => {
    setName("");
    setSport("cricket");
    setLocation("");
    setStartDate("");
    setEndDate("");
    setOvers("20");
    setPlayersPerTeam("11");
    setMaxOversPerBowler("4");
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const settings: Record<string, unknown> = {};
      if (sport === "cricket") {
        settings.overs = parseInt(overs);
        settings.players_per_team = parseInt(playersPerTeam);
        settings.max_overs_per_bowler = parseInt(maxOversPerBowler);
      }

      await createTournamentAdmin({
        name,
        sport,
        location: location || null,
        start_date: startDate || null,
        end_date: endDate || null,
        settings,
      });

      resetForm();
      await fetchTournaments();
    } catch (err: any) {
      console.error("Failed to create tournament:", err);
      alert(err.message ?? "Failed to create tournament.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tournament and all its matches?")) return;
    try {
      await deleteTournamentAdmin(id);
      await fetchTournaments();
    } catch (err: any) {
      console.error("Failed to delete tournament:", err);
      alert(err.message ?? "Failed to delete tournament.");
    }
  };

  const openTeamSelector = async (tournament: Tournament) => {
    setSelectedTournament(tournament);

    try {
      const [teamsData, teamIds] = await Promise.all([
        listTeamsBySportAdmin(tournament.sport),
        listTournamentTeamIdsAdmin(tournament.id),
      ]);

      setAllTeams((teamsData as Team[]) ?? []);
      setTournamentTeamIds(teamIds);
      setShowTeamSelector(true);
    } catch (err: any) {
      console.error("Failed to load teams:", err);
      alert("Failed to load teams for selection.");
    }
  };

  const toggleTeam = async (teamId: string) => {
    if (!selectedTournament) return;

    try {
      if (tournamentTeamIds.includes(teamId)) {
        await removeTeamFromTournamentAdmin({
          tournament_id: selectedTournament.id,
          team_id: teamId,
        });
        setTournamentTeamIds((prev) => prev.filter((id) => id !== teamId));
      } else {
        await addTeamToTournamentAdmin({
          tournament_id: selectedTournament.id,
          team_id: teamId,
        });
        setTournamentTeamIds((prev) => [...prev, teamId]);
      }
    } catch (err: any) {
      console.error("Failed to toggle team:", err);
      alert("Failed to update team assignment.");
    }
  };

  const statusColors: Record<string, string> = {
    upcoming: "badge-scheduled",
    active: "badge-live",
    completed: "badge-completed",
    cancelled: "badge-cancelled",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">Tournaments</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm">
          + New Tournament
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card mb-6 animate-fade-in">
          <h2 className="text-lg font-semibold text-text mb-4">Create Tournament</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="t-name" className="block text-sm font-medium text-text mb-1.5">Name</label>
                <input id="t-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" required />
              </div>
              <div>
                <label htmlFor="t-sport" className="block text-sm font-medium text-text mb-1.5">Sport</label>
                <select id="t-sport" value={sport} onChange={(e) => setSport(e.target.value as SportType)} className="input-field">
                  <option value="cricket">🏏 Cricket</option>
                  <option value="football">⚽ Football</option>
                  <option value="badminton">🏸 Badminton</option>
                </select>
              </div>
              <div>
                <label htmlFor="t-location" className="block text-sm font-medium text-text mb-1.5">Location</label>
                <input id="t-location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="input-field" />
              </div>
              <div>
                <label htmlFor="t-start" className="block text-sm font-medium text-text mb-1.5">Start Date</label>
                <input id="t-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
              </div>
              <div>
                <label htmlFor="t-end" className="block text-sm font-medium text-text mb-1.5">End Date</label>
                <input id="t-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" />
              </div>
              {sport === "cricket" && (
                <>
                  <div>
                    <label htmlFor="t-overs" className="block text-sm font-medium text-text mb-1.5">Overs per Innings</label>
                    <input id="t-overs" type="number" value={overs} onChange={(e) => setOvers(e.target.value)} className="input-field" min="1" max="50" />
                  </div>
                  <div>
                    <label htmlFor="t-players" className="block text-sm font-medium text-text mb-1.5">Players per Team</label>
                    <input id="t-players" type="number" value={playersPerTeam} onChange={(e) => setPlayersPerTeam(e.target.value)} className="input-field" min="2" max="15" />
                  </div>
                  <div>
                    <label htmlFor="t-maxOvers" className="block text-sm font-medium text-text mb-1.5">Max Overs / Bowler</label>
                    <input id="t-maxOvers" type="number" value={maxOversPerBowler} onChange={(e) => setMaxOversPerBowler(e.target.value)} className="input-field" min="1" max="50" />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? "Saving..." : "Create"}</button>
              <button type="button" onClick={resetForm} className="btn-secondary text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Team Selector Modal */}
      {showTeamSelector && selectedTournament && (
        <div className="card mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text">
              Teams in: {selectedTournament.name}
            </h2>
            <button onClick={() => setShowTeamSelector(false)} className="btn-secondary text-xs !py-1.5 !px-2.5">
              Done
            </button>
          </div>
          {allTeams.length === 0 ? (
            <p className="text-sm text-text-muted">No {selectedTournament.sport} teams found. Create teams first.</p>
          ) : (
            <div className="space-y-2">
              {allTeams.map((team) => {
                const isIn = tournamentTeamIds.includes(team.id);
                return (
                  <button
                    key={team.id}
                    onClick={() => toggleTeam(team.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                      isIn
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-surface border border-border-ui/50 hover:bg-surface-alt"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isIn ? "border-primary bg-primary" : "border-border-ui"
                    }`}>
                      {isIn && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <span className="font-medium text-text">{team.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tournament List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="card space-y-3">
              <div className="skeleton h-5 w-48" />
              <div className="skeleton h-4 w-32" />
            </div>
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-4">🏆</div>
          <h3 className="text-lg font-semibold text-text mb-2">No Tournaments</h3>
          <p className="text-sm text-text-muted">Create your first tournament.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <div key={t.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-text">{t.name}</h3>
                    <span className={statusColors[t.status] ?? "badge-scheduled"}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted capitalize">{t.sport}{t.location ? ` · ${t.location}` : ""}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openTeamSelector(t)} className="btn-secondary text-xs !py-1.5 !px-2.5">
                    Teams
                  </button>
                  <Link href={`/admin/tournaments/${t.id}/matches`} className="btn-secondary text-xs !py-1.5 !px-2.5 no-underline">
                    Matches
                  </Link>
                  <button onClick={() => handleDelete(t.id)} className="btn-danger text-xs !py-1.5 !px-2.5">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
