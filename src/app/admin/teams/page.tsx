"use client";

import { useEffect, useState, useCallback } from "react";
import type { Team, SportType, Player } from "@/lib/types/database";
import { listTeamsAdmin, createTeamAdmin, updateTeamAdmin, deleteTeamAdmin } from "@/features/teams/adminApi";
import { listPlayersAdmin } from "@/features/players/adminApi";

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [name, setName] = useState("");
  const [sport, setSport] = useState<SportType>("cricket");
  const [saving, setSaving] = useState(false);

  const fetchTeams = useCallback(async () => {
    const [teamsRes, playersRes] = await Promise.all([
      listTeamsAdmin(),
      listPlayersAdmin(),
    ]);
    setTeams((teamsRes as Team[]) ?? []);
    setPlayers((playersRes as Player[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTeams();
  }, [fetchTeams]);

  const resetForm = () => {
    setName("");
    setSport("cricket");
    setEditingTeam(null);
    setShowForm(false);
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setName(team.name);
    setSport((team.sport as SportType) ?? "cricket");
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (editingTeam) {
      await updateTeamAdmin({ id: editingTeam.id, name, sport });
    } else {
      await createTeamAdmin({ name, sport });
    }

    setSaving(false);
    resetForm();
    fetchTeams();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this team? This will also remove all associated players.")) return;
    await deleteTeamAdmin(id);
    fetchTeams();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">Teams</h1>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary text-sm"
        >
          + New Team
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card mb-6 animate-fade-in">
          <h2 className="text-lg font-semibold text-text mb-4">
            {editingTeam ? "Edit Team" : "Create Team"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="team-name" className="block text-sm font-medium text-text mb-1.5">
                Team Name
              </label>
              <input
                id="team-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="e.g. Mechanical Warriors"
                required
              />
            </div>
            <div>
              <label htmlFor="team-sport" className="block text-sm font-medium text-text mb-1.5">
                Sport
              </label>
              <select
                id="team-sport"
                value={sport}
                onChange={(e) => setSport(e.target.value as SportType)}
                className="input-field"
              >
                <option value="cricket">🏏 Cricket</option>
                <option value="football">⚽ Football</option>
                <option value="badminton">🏸 Badminton</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary text-sm">
                {saving ? "Saving..." : editingTeam ? "Update" : "Create"}
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card flex items-center gap-4">
              <div className="skeleton h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-4">👥</div>
          <h3 className="text-lg font-semibold text-text mb-2">No Teams Yet</h3>
          <p className="text-sm text-text-muted">Create your first team to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => {
            const teamPlayers = players.filter((p) => (p.team_id || p.sold_team_id) === team.id);
            const isExpanded = expandedTeamId === team.id;
            return (
            <div key={team.id} className="card flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                    {team.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-text truncate">{team.name}</p>
                    <p className="text-xs text-text-muted capitalize">{team.sport ?? "—"} · {teamPlayers.length} Player{teamPlayers.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button 
                    onClick={() => setExpandedTeamId(isExpanded ? null : team.id)} 
                    className="btn-secondary text-xs !py-1.5 !px-2.5"
                  >
                    {isExpanded ? "Hide Roster" : "View Roster"}
                  </button>
                  <button onClick={() => openEdit(team)} className="btn-secondary text-xs !py-1.5 !px-2.5">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(team.id)} className="btn-danger text-xs !py-1.5 !px-2.5">
                    Delete
                  </button>
                </div>
              </div>
              
              {isExpanded && (
                <div className="mt-2 pt-4 border-t border-border-ui space-y-2 animate-fade-in">
                  <h4 className="text-sm font-semibold text-text mb-3">Team Roster</h4>
                  {teamPlayers.length === 0 ? (
                    <p className="text-sm text-text-muted">No players assigned to this team.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {teamPlayers.map(player => (
                        <div key={player.id} className="flex items-center gap-3 p-2.5 rounded-md bg-surface border border-border-ui/50 text-sm">
                          <div className="w-7 h-7 rounded-full bg-surface-alt flex items-center justify-center text-xs font-bold text-text flex-shrink-0">
                            {player.jersey_number ?? player.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-text truncate">{player.name}</p>
                          </div>
                          <span className="text-xs text-text-muted capitalize flex-shrink-0 px-2 py-0.5 bg-surface-alt rounded-sm">
                            {player.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
