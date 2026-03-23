"use client";

import { useEffect, useState, useCallback } from "react";
import type { Player, Team } from "@/lib/types/database";
import {
  listPlayersAdmin,
  listTeamsForPlayersAdmin,
  createPlayerAdmin,
  updatePlayerAdmin,
  deletePlayerAdmin,
} from "@/features/players/adminApi";

const getRolesForSport = (sport?: string | null) => {
  if (sport === "football") {
    return [
      { value: "goalkeeper", label: "Goalkeeper" },
      { value: "defender", label: "Defender" },
      { value: "midfielder", label: "Midfielder" },
      { value: "forward", label: "Forward" },
    ];
  }
  if (sport === "badminton") {
    return [
      { value: "singles-specialist", label: "Singles Specialist" },
      { value: "doubles-specialist", label: "Doubles Specialist" },
    ];
  }
  return [
    { value: "batsman", label: "Batsman" },
    { value: "bowler", label: "Bowler" },
    { value: "all-rounder", label: "All-rounder" },
    { value: "wicketkeeper", label: "Wicketkeeper" },
  ];
};

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [role, setRole] = useState("batsman");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterTeam, setFilterTeam] = useState("");
  const [selectedSport, setSelectedSport] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const [playersData, teamsData] = await Promise.all([
        listPlayersAdmin(),
        listTeamsForPlayersAdmin(),
      ]);
      setPlayers((playersData as Player[]) ?? []);
      setTeams((teamsData as Team[]) ?? []);
    } catch (err) {
      console.error("Failed to fetch players:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setName("");
    setTeamId("");
    setRole("batsman");
    setJerseyNumber("");
    setSelectedSport("");
    setEditingPlayer(null);
    setShowForm(false);
  };

  const openEdit = (player: Player) => {
    setEditingPlayer(player);
    setName(player.name);
    const playerTeam = teams.find((t) => t.id === (player.team_id ?? ""));
    setSelectedSport(playerTeam?.sport ?? "");
    setTeamId(player.team_id ?? "");
    setRole(player.role ?? "batsman");
    setJerseyNumber(player.jersey_number?.toString() ?? "");
    setShowForm(true);
  };

  const handleSportChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sport = e.target.value;
    setSelectedSport(sport);
    setTeamId("");
    const roles = getRolesForSport(sport);
    setRole(roles[0]?.value ?? "batsman");
  };

  const handleTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTeamId = e.target.value;
    setTeamId(newTeamId);
  };

  const sportFilteredTeams = selectedSport
    ? teams.filter((t) => t.sport === selectedSport)
    : teams;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const selectedTeam = teams.find((t) => t.id === teamId);
      const sport = selectedTeam?.sport || "cricket";
      const allowedRoles = getRolesForSport(sport).map(r => r.value);
      
      if (teamId && !allowedRoles.includes(role)) {
        alert(`Invalid role "${role}" for sport "${sport}". Please update the role.`);
        setSaving(false);
        return;
      }

      const payload = {
        name,
        team_id: teamId || null,
        role,
        jersey_number: jerseyNumber ? parseInt(jerseyNumber) : null,
      };

      if (editingPlayer) {
        await updatePlayerAdmin({ id: editingPlayer.id, ...payload });
      } else {
        await createPlayerAdmin(payload);
      }

      resetForm();
      await fetchData();
    } catch (err: any) {
      console.error("Failed to save player:", err);
      alert(err.message ?? "Failed to save player. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this player?")) return;
    try {
      await deletePlayerAdmin(id);
      await fetchData();
    } catch (err: any) {
      console.error("Failed to delete player:", err);
      alert(err.message ?? "Failed to delete player.");
    }
  };

  const filteredPlayers = filterTeam
    ? filterTeam === "unassigned"
      ? players.filter((p) => !p.team_id)
      : players.filter((p) => p.team_id === filterTeam)
    : players;

  const getTeamName = (tId: string | null) =>
    teams.find((t) => t.id === tId)?.name ?? "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">Players</h1>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary text-sm"
        >
          + New Player
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card mb-6 animate-fade-in">
          <h2 className="text-lg font-semibold text-text mb-4">
            {editingPlayer ? "Edit Player" : "Add Player"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Sport — first field */}
              <div>
                <label htmlFor="player-sport" className="block text-sm font-medium text-text mb-1.5">
                  Sport
                </label>
                <select
                  id="player-sport"
                  value={selectedSport}
                  onChange={handleSportChange}
                  className="input-field"
                  required
                >
                  <option value="">Select sport</option>
                  <option value="cricket">🏏 Cricket</option>
                  <option value="football">⚽ Football</option>
                  <option value="badminton">🏸 Badminton</option>
                </select>
              </div>
              <div>
                <label htmlFor="player-name" className="block text-sm font-medium text-text mb-1.5">
                  Name
                </label>
                <input
                  id="player-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="Player name"
                  required
                />
              </div>
              <div>
                <label htmlFor="player-team" className="block text-sm font-medium text-text mb-1.5">
                  Team
                </label>
                <select
                  id="player-team"
                  value={teamId}
                  onChange={handleTeamChange}
                  className="input-field"
                  required
                  disabled={!selectedSport}
                >
                  <option value="">{selectedSport ? "Select team" : "Select sport first"}</option>
                  {sportFilteredTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="player-role" className="block text-sm font-medium text-text mb-1.5">
                  Role
                </label>
                <select
                  id="player-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="input-field"
                  disabled={!selectedSport}
                >
                  {getRolesForSport(selectedSport).map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="player-jersey" className="block text-sm font-medium text-text mb-1.5">
                  Jersey #
                </label>
                <input
                  id="player-jersey"
                  type="number"
                  value={jerseyNumber}
                  onChange={(e) => setJerseyNumber(e.target.value)}
                  className="input-field"
                  placeholder="Optional"
                  min="0"
                  max="999"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary text-sm">
                {saving ? "Saving..." : editingPlayer ? "Update" : "Add"}
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      {teams.length > 0 && (
        <div className="mb-4">
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="input-field !w-auto text-sm"
          >
            <option value="">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value="unassigned">Unassigned / No Team</option>
          </select>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card flex items-center gap-4">
              <div className="skeleton h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-4">🏏</div>
          <h3 className="text-lg font-semibold text-text mb-2">No Players Yet</h3>
          <p className="text-sm text-text-muted">Add players to your teams.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPlayers.map((player) => (
            <div key={player.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center text-sm font-bold text-text flex-shrink-0">
                  {player.jersey_number ?? player.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-text truncate">{player.name}</p>
                  <p className="text-xs text-text-muted">
                    {getTeamName(player.team_id)} · <span className="capitalize">{player.role}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => openEdit(player)} className="btn-secondary text-xs !py-1.5 !px-2.5">
                  Edit
                </button>
                <button onClick={() => handleDelete(player.id)} className="btn-danger text-xs !py-1.5 !px-2.5">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
