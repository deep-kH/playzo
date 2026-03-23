// ============================================================================
// FootballScorerController — Complete Rebuild (V5)
// The main admin scoring orchestrator for football matches.
// ============================================================================
"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import type { Player } from "@/lib/types/database";
import type { FootballMatchState, FootballMatchEvent } from "../types";
import {
  isPrimaryEvent,
  getPhaseLabel,
  getEventIcon,
  PRIMARY_EVENT_TYPES,
  MICRO_EVENT_TYPES,
} from "../types";
import { useFootballClock, getPhaseActions, isPlayerSentOff } from "../hooks";
import * as engine from "../engine";

// ── Types ──
interface Props {
  match: any;
  state: FootballMatchState;
  teamAName: string;
  teamBName: string;
  teamAPlayers: Player[];
  teamBPlayers: Player[];
  teamALogo?: string | null;
  teamBLogo?: string | null;
}

type ActionFlow =
  | null
  | { type: "goal"; team: "team_a" | "team_b"; player: Player; step: "select_assist" }
  | { type: "shot_on"; team: "team_a" | "team_b"; player: Player; step: "select_restart" }
  | { type: "shot_off"; team: "team_a" | "team_b"; player: Player; step: "select_restart" }
  | { type: "foul"; team: "team_a" | "team_b"; player: Player; step: "select_restart" | "select_fouled" | "select_card" ; restart?: string; fouledPlayer?: Player }
  | { type: "substitution"; team: "team_a" | "team_b"; benchPlayer: Player; step: "select_field_player" };

// ── Main Component ──
export function FootballScorerController({
  match,
  state,
  teamAName,
  teamBName,
  teamAPlayers,
  teamBPlayers,
  teamALogo,
  teamBLogo,
}: Props) {
  const matchId = match.id;
  const matchDurationMinutes: number = match.settings?.match_duration_minutes ?? (match.settings?.half_duration_minutes ? match.settings.half_duration_minutes * 2 : 0);
  const halfDuration = Math.floor(matchDurationMinutes / 2) * 60;
  const clock = useFootballClock(state, halfDuration);
  const actions = getPhaseActions(state);
  const [actionFlow, setActionFlow] = useState<ActionFlow>(null);
  const [modalPlayer, setModalPlayer] = useState<{ player: Player; team: "team_a" | "team_b" } | null>(null);
  const [loading, setLoading] = useState(false);
  const [endPromptShown, setEndPromptShown] = useState(false);
  const [showDrawOptions, setShowDrawOptions] = useState(false);
  const [extraTimeDuration, setExtraTimeDuration] = useState(15);

  // Lineup config — uses players_per_team from match creation
  const playersPerSide: number = match.settings?.players_per_team ?? match.settings?.players_per_side ?? 11;
  const lineupConfirmed: boolean = !!match.settings?.lineup_confirmed;

  // Get lineup from match settings
  const startingLineupA: string[] = match.settings?.starting_lineup_a || [];
  const startingLineupB: string[] = match.settings?.starting_lineup_b || [];

  // Derive CURRENT lineup by replaying substitution events on top of initial lineup
  const { currentLineupA, currentLineupB } = useMemo(() => {
    const lineupA = new Set(startingLineupA);
    const lineupB = new Set(startingLineupB);
    for (const event of (state.events || [])) {
      if (event.type === 'substitution') {
        const targetSet = event.team === 'team_a' ? lineupA : event.team === 'team_b' ? lineupB : null;
        if (targetSet && event.player_id && event.sub_in_id) {
          targetSet.delete(event.player_id);  // player going OUT
          targetSet.add(event.sub_in_id);     // player coming IN
        }
      }
    }
    return { currentLineupA: lineupA, currentLineupB: lineupB };
  }, [startingLineupA, startingLineupB, state.events]);

  // Separate on-field vs bench using CURRENT lineup (after subs)
  const onFieldA = useMemo(() => teamAPlayers.filter(p => currentLineupA.has(p.id)), [teamAPlayers, currentLineupA]);
  const benchA = useMemo(() => teamAPlayers.filter(p => !currentLineupA.has(p.id)), [teamAPlayers, currentLineupA]);
  const onFieldB = useMemo(() => teamBPlayers.filter(p => currentLineupB.has(p.id)), [teamBPlayers, currentLineupB]);
  const benchB = useMemo(() => teamBPlayers.filter(p => !currentLineupB.has(p.id)), [teamBPlayers, currentLineupB]);

  // Find GK for each team — prefer saved GK from lineup setup, fallback to role-based
  const savedGkAId: string | null = match.settings?.gk_a_id || null;
  const savedGkBId: string | null = match.settings?.gk_b_id || null;
  const gkA = useMemo(() => {
    if (savedGkAId) return onFieldA.find(p => p.id === savedGkAId) || onFieldA[0];
    return onFieldA.find(p => p.role?.toLowerCase() === 'gk' || p.role?.toLowerCase() === 'goalkeeper') || onFieldA[0];
  }, [onFieldA, savedGkAId]);
  const gkB = useMemo(() => {
    if (savedGkBId) return onFieldB.find(p => p.id === savedGkBId) || onFieldB[0];
    return onFieldB.find(p => p.role?.toLowerCase() === 'gk' || p.role?.toLowerCase() === 'goalkeeper') || onFieldB[0];
  }, [onFieldB, savedGkBId]);

  // Auto-prompt when stoppage time is up
  useEffect(() => {
    if (clock.shouldPromptEnd && !endPromptShown) {
      setEndPromptShown(true);
    }
  }, [clock.shouldPromptEnd, endPromptShown]);

  // Reset prompt when phase changes
  useEffect(() => {
    setEndPromptShown(false);
  }, [state.phase]);

  // ── Action Handlers ──
  const wrap = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true);
    try { await fn(); } catch (e: any) { alert(e.message); } finally { setLoading(false); }
  }, []);

  // Safety timeout for local loading state
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setLoading(false);
        console.warn("FootballScorerController: Local loading safety timeout hit.");
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const handlePhaseControl = useCallback((action: string) => {
    wrap(async () => {
      switch (action) {
        case "start": await engine.startMatch(matchId); break;
        case "pause": await engine.pauseMatch(matchId); break;
        case "resume": await engine.resumeMatch(matchId); break;
        case "end_half":
          if (state.phase === 'extra_time_first') await engine.endExtraTimeHalf(matchId);
          else await engine.endHalf(matchId);
          break;
        case "start_second":
          if (state.phase === 'extra_time_half') await engine.startExtraTimeSecond(matchId);
          else await engine.startSecondHalf(matchId);
          break;
        case "full_time": await engine.endFullTime(matchId); break;
        case "extra_time": await engine.startExtraTime(matchId, extraTimeDuration); break;
        case "penalties": await engine.startPenaltyShootout(matchId); break;
        case "end_match": await engine.endMatch(matchId); break;
      }
    });
  }, [matchId, wrap, state.phase, extraTimeDuration]);

  // ── On-field player clicked ──
  const handlePlayerClick = useCallback((player: Player, team: "team_a" | "team_b") => {
    if (!actions.canLogEvents) return;
    if (isPlayerSentOff(state, player.id)) return;

    // If in substitution flow → this is the field player to sub out
    if (actionFlow?.type === "substitution" && actionFlow.step === "select_field_player" && actionFlow.team === team) {
      wrap(async () => {
        await engine.logSubstitution(matchId, {
          team,
          player_id: player.id,
          player_name: player.name,
          sub_in_id: actionFlow.benchPlayer.id,
          sub_in_name: actionFlow.benchPlayer.name,
          sub_out_name: player.name,
        });
        setActionFlow(null);
      });
      return;
    }

    // If in goal flow → this player is the assist
    if (actionFlow?.type === "goal" && actionFlow.step === "select_assist" && actionFlow.team === team) {
      wrap(async () => {
        const opposingGk = team === "team_a" ? gkB : gkA;
        await engine.logGoal(matchId, {
          team,
          player_id: actionFlow.player.id,
          player_name: actionFlow.player.name,
          photo_url: actionFlow.player.photo_url || undefined,
          assist_player_id: player.id,
          assist_player_name: player.name,
          opposing_gk_id: opposingGk?.id,
        });
        setActionFlow(null);
      });
      return;
    }

    // If in foul → select fouled player
    if (actionFlow?.type === "foul" && actionFlow.step === "select_fouled" && actionFlow.team !== team) {
      setActionFlow({ ...actionFlow, step: "select_card", fouledPlayer: player });
      return;
    }

    // Otherwise → open the action modal
    setModalPlayer({ player, team });
  }, [actions.canLogEvents, state, actionFlow, matchId, wrap, gkA, gkB]);

  // ── Bench player clicked → start substitution flow ──
  const handleBenchClick = useCallback((player: Player, team: "team_a" | "team_b") => {
    if (!actions.canLogEvents) return;
    setActionFlow({ type: "substitution", team, benchPlayer: player, step: "select_field_player" });
    setModalPlayer(null);
  }, [actions.canLogEvents]);

  // ── Action modal selection ──
  const handleActionSelect = useCallback((actionType: string) => {
    if (!modalPlayer) return;
    const { player, team } = modalPlayer;
    setModalPlayer(null);

    // MICRO actions → log instantly
    if ((MICRO_EVENT_TYPES as readonly string[]).includes(actionType)) {
      wrap(async () => {
        await engine.logMicroAction(matchId, actionType, team, player.id, player.name);
      });
      return;
    }

    // PRIMARY actions → start cascading flow
    switch (actionType) {
      case "goal":
        setActionFlow({ type: "goal", team, player, step: "select_assist" });
        break;
      case "shot_on_target":
        setActionFlow({ type: "shot_on", team, player, step: "select_restart" });
        break;
      case "shot_off_target":
        setActionFlow({ type: "shot_off", team, player, step: "select_restart" });
        break;
      case "foul":
        setActionFlow({ type: "foul", team, player, step: "select_restart" });
        break;
      case "yellow_card":
        wrap(async () => { await engine.logYellowCard(matchId, team, player.id, player.name); });
        break;
      case "red_card":
        wrap(async () => { await engine.logRedCard(matchId, team, player.id, player.name); });
        break;
    }
  }, [modalPlayer, matchId, wrap]);

  // ── Team actions (corner, goal kick, throw in) ──
  const handleTeamAction = useCallback((team: string, type: string) => {
    if (!actions.canLogEvents) return;
    wrap(async () => {
      switch (type) {
        case "corner": await engine.logCorner(matchId, team); break;
        case "goal_kick": await engine.logGoalKick(matchId, team); break;
        case "throw_in": await engine.logThrowIn(matchId, team); break;
      }
    });
  }, [matchId, wrap, actions.canLogEvents]);

  // ── Stoppage stepper ──
  const handleAddStoppage = useCallback(() => {
    wrap(async () => { await engine.addStoppage(matchId, 1); });
  }, [matchId, wrap]);

  // ── Undo ──
  const handleUndo = useCallback(() => {
    wrap(async () => { await engine.undoLastEvent(matchId); });
  }, [matchId, wrap]);

  // ── Penalty shootout ──
  const handlePenalty = useCallback((team: string, playerId: string, playerName: string, scored: boolean) => {
    wrap(async () => {
      if (scored) await engine.logPenaltyGoal(matchId, team, playerId, playerName);
      else await engine.logPenaltyMiss(matchId, team, playerId, playerName);
    });
  }, [matchId, wrap]);

  // Check if match is drawn at full time
  const isDrawn = state.team_a_stats.goals === state.team_b_stats.goals;

  // ── RENDER ──
  return (
    <div className="space-y-4">
      {/* ═══════════════════ HEADER: Score + Clock + Controls ═══════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)]"
        style={{ background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-alt) 100%)' }}>
        {/* Score */}
        <div className="flex items-center justify-center gap-6 py-6 px-4">
          <div className="flex items-center gap-3">
            {teamALogo ? <img src={teamALogo} className="w-10 h-10 rounded-full object-cover" alt="" /> :
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-400">{teamAName.charAt(0)}</div>}
            <span className="font-bold text-sm uppercase tracking-wider text-[var(--text)]">{teamAName}</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-5xl font-black tabular-nums tracking-tight text-[var(--text)]">
              {state.team_a_stats.goals} – {state.team_b_stats.goals}
            </div>
            <div className="mt-1 text-lg font-mono font-semibold text-[var(--primary)]">
              {clock.display}
            </div>
            {/* Show allotted stoppage when in stoppage */}
            {clock.inStoppage && clock.allottedStoppageMinutes > 0 && (
              <div className={`text-xs font-bold tabular-nums mt-0.5 ${clock.shouldPromptEnd ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                {clock.stoppageDisplay} / {clock.allottedStoppageDisplay} stoppage
              </div>
            )}
            {clock.inStoppage && clock.allottedStoppageMinutes === 0 && (
              <div className="text-xs font-bold text-red-400 animate-pulse mt-0.5">
                ⚠ No stoppage allotted — Add time or end half
              </div>
            )}
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">
              {getPhaseLabel(state.phase)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm uppercase tracking-wider text-[var(--text)]">{teamBName}</span>
            {teamBLogo ? <img src={teamBLogo} className="w-10 h-10 rounded-full object-cover" alt="" /> :
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-amber-400">{teamBName.charAt(0)}</div>}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2 px-4 pb-4">
          {actions.canStart && lineupConfirmed && <ControlBtn label="▶ Start Match" onClick={() => handlePhaseControl("start")} color="emerald" />}
          {actions.canPause && <ControlBtn label="⏸ Pause" onClick={() => handlePhaseControl("pause")} />}
          {actions.canResume && <ControlBtn label="▶ Resume" onClick={() => handlePhaseControl("resume")} color="emerald" />}
          {actions.canEndHalf && <ControlBtn label="⏹ End Half" onClick={() => handlePhaseControl("end_half")} color="amber" />}
          {actions.canStartSecondHalf && <ControlBtn label="▶ Start 2nd Half" onClick={() => handlePhaseControl("start_second")} color="emerald" />}
          {actions.canEndFullTime && <ControlBtn label="⏹ End Full Time" onClick={() => handlePhaseControl("full_time")} color="amber" />}
          {actions.canAddStoppage && <ControlBtn label={`+1 Stoppage (${state.added_extra_time_minutes}m)`} onClick={handleAddStoppage} />}
          {actions.canEndMatch && !isDrawn && <ControlBtn label="🏁 End Match" onClick={() => handlePhaseControl("end_match")} color="red" />}
          {(state.phase === 'full_time' && isDrawn) && (
            <>
              <ControlBtn label="⏱ Extra Time" onClick={() => setShowDrawOptions(true)} color="amber" />
              <ControlBtn label="⚽ Penalties" onClick={() => handlePhaseControl("penalties")} color="red" />
            </>
          )}
          {actions.isShootoutMode && <ControlBtn label="🏁 End Match" onClick={() => handlePhaseControl("end_match")} color="red" />}
        </div>
      </div>

      {/* ═══════════════════ LINEUP SETUP (PRE-MATCH) ═══════════════════ */}
      {actions.canStart && !lineupConfirmed && (
        <LineupSetup
          matchId={matchId}
          teamAName={teamAName}
          teamBName={teamBName}
          teamAPlayers={teamAPlayers}
          teamBPlayers={teamBPlayers}
          playersPerSide={playersPerSide}
          initialLineupA={startingLineupA}
          initialLineupB={startingLineupB}
          loading={loading}
          onConfirm={async (lineupA: string[], lineupB: string[], gkAId: string | null, gkBId: string | null) => {
            setLoading(true);
            try {
              await engine.saveLineup(matchId, lineupA, lineupB, gkAId, gkBId);
              // Force page reload to get updated match settings
              window.location.reload();
            } catch (e: any) {
              alert(e.message);
            } finally {
              setLoading(false);
            }
          }}
        />
      )}

      {/* ═══════════════════ AUTO-PROMPT MODAL ═══════════════════ */}
      {endPromptShown && actions.canEndHalf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--surface)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-[var(--border)] space-y-4 text-center">
            <div className="text-3xl">⏱️</div>
            <h3 className="text-lg font-bold text-[var(--text)]">Stoppage Time Ended</h3>
            <p className="text-sm text-[var(--text-muted)]">The added stoppage time has elapsed. End the half?</p>
            <div className="flex gap-3">
              <button onClick={() => { setEndPromptShown(false); handlePhaseControl("end_half"); }}
                className="flex-1 btn-primary rounded-xl py-3 font-bold">End Half</button>
              <button onClick={() => setEndPromptShown(false)}
                className="flex-1 btn-secondary rounded-xl py-3 font-bold">Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ EXTRA TIME DURATION MODAL ═══════════════════ */}
      {showDrawOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--surface)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-[var(--border)] space-y-4 text-center">
            <h3 className="text-lg font-bold text-[var(--text)]">Extra Time Duration</h3>
            <p className="text-sm text-[var(--text-muted)]">Set the duration per half (minutes)</p>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setExtraTimeDuration(Math.max(5, extraTimeDuration - 5))}
                className="w-10 h-10 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] font-bold text-lg">−</button>
              <span className="text-3xl font-bold tabular-nums text-[var(--text)]">{extraTimeDuration}</span>
              <button onClick={() => setExtraTimeDuration(extraTimeDuration + 5)}
                className="w-10 h-10 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] font-bold text-lg">+</button>
            </div>
            <button onClick={() => { setShowDrawOptions(false); handlePhaseControl("extra_time"); }}
              className="w-full btn-primary rounded-xl py-3 font-bold">Start Extra Time</button>
            <button onClick={() => setShowDrawOptions(false)}
              className="w-full btn-secondary rounded-xl py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* ═══════════════════ ACTION FLOW BANNER ═══════════════════ */}
      {actionFlow && (
        <div className="rounded-xl border-2 border-dashed border-[var(--primary)] bg-[var(--surface-alt)] p-4 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm font-bold text-[var(--primary)] uppercase tracking-wide">
              {actionFlow.type === "goal" && actionFlow.step === "select_assist" && `⚽ ${actionFlow.player.name} scored! Select assist or:`}
              {actionFlow.type === "shot_on" && `🎯 ${actionFlow.player.name} shot on target. Select restart:`}
              {actionFlow.type === "shot_off" && `💨 ${actionFlow.player.name} shot off target. Select restart:`}
              {actionFlow.type === "foul" && actionFlow.step === "select_restart" && `🚨 ${actionFlow.player.name} fouled. Select restart:`}
              {actionFlow.type === "foul" && actionFlow.step === "select_fouled" && `🚨 Select the fouled player from the opponent:`}
              {actionFlow.type === "foul" && actionFlow.step === "select_card" && `🃏 Select card for ${actionFlow.player.name}:`}
              {actionFlow.type === "substitution" && `🔄 ${actionFlow.benchPlayer.name} coming in. Tap the on-field player to sub out:`}
            </span>
            <button onClick={() => setActionFlow(null)} className="text-xs text-[var(--danger)] font-bold hover:underline">✕ Cancel</button>
          </div>

          {/* Flow-specific options */}
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {actionFlow.type === "goal" && actionFlow.step === "select_assist" && (
              <FlowBtn label="No Assist" onClick={() => {
                const team = actionFlow.team;
                const opposingGk = team === "team_a" ? gkB : gkA;
                wrap(async () => {
                  await engine.logGoal(matchId, {
                    team,
                    player_id: actionFlow.player.id,
                    player_name: actionFlow.player.name,
                    photo_url: actionFlow.player.photo_url || undefined,
                    opposing_gk_id: opposingGk?.id,
                  });
                  setActionFlow(null);
                });
              }} />
            )}
            {(actionFlow.type === "shot_on" || actionFlow.type === "shot_off") && actionFlow.step === "select_restart" && (
              <>
                <FlowBtn label="Corner Kick" onClick={() => {
                  const team = actionFlow.team;
                  const opposingGk = team === "team_a" ? gkB : gkA;
                  wrap(async () => {
                    if (actionFlow.type === "shot_on") {
                      await engine.logShotOnTarget(matchId, { team, player_id: actionFlow.player.id, player_name: actionFlow.player.name, restart: "corner_kick", opposing_gk_id: opposingGk?.id });
                    } else {
                      await engine.logShotOffTarget(matchId, { team, player_id: actionFlow.player.id, player_name: actionFlow.player.name, restart: "corner_kick" });
                    }
                    setActionFlow(null);
                  });
                }} />
                <FlowBtn label="Goal Kick" onClick={() => {
                  const team = actionFlow.team;
                  const opposingGk = team === "team_a" ? gkB : gkA;
                  wrap(async () => {
                    if (actionFlow.type === "shot_on") {
                      await engine.logShotOnTarget(matchId, { team, player_id: actionFlow.player.id, player_name: actionFlow.player.name, restart: "goal_kick", opposing_gk_id: opposingGk?.id });
                    } else {
                      await engine.logShotOffTarget(matchId, { team, player_id: actionFlow.player.id, player_name: actionFlow.player.name, restart: "goal_kick" });
                    }
                    setActionFlow(null);
                  });
                }} />
                <FlowBtn label="No Stoppage" onClick={() => {
                  const team = actionFlow.team;
                  const opposingGk = team === "team_a" ? gkB : gkA;
                  wrap(async () => {
                    if (actionFlow.type === "shot_on") {
                      await engine.logShotOnTarget(matchId, { team, player_id: actionFlow.player.id, player_name: actionFlow.player.name, restart: "none", opposing_gk_id: opposingGk?.id });
                    } else {
                      await engine.logShotOffTarget(matchId, { team, player_id: actionFlow.player.id, player_name: actionFlow.player.name, restart: "none" });
                    }
                    setActionFlow(null);
                  });
                }} />
              </>
            )}
            {actionFlow.type === "foul" && actionFlow.step === "select_restart" && (
              <>
                <FlowBtn label="Free Kick" onClick={() => setActionFlow({ ...actionFlow, step: "select_fouled", restart: "free_kick" })} />
                <FlowBtn label="Advantage" onClick={() => setActionFlow({ ...actionFlow, step: "select_fouled", restart: "advantage" })} />
                <FlowBtn label="None" onClick={() => setActionFlow({ ...actionFlow, step: "select_fouled", restart: "none" })} />
              </>
            )}
            {actionFlow.type === "foul" && actionFlow.step === "select_fouled" && (
              <FlowBtn label="Skip (no fouled player)" onClick={() => setActionFlow({ ...actionFlow, step: "select_card" })} />
            )}
            {actionFlow.type === "foul" && actionFlow.step === "select_card" && (
              <>
                <FlowBtn label="No Card" onClick={() => {
                  wrap(async () => {
                    await engine.logFoul(matchId, {
                      team: actionFlow.team, player_id: actionFlow.player.id, player_name: actionFlow.player.name,
                      fouled_player_id: actionFlow.fouledPlayer?.id, fouled_player_name: actionFlow.fouledPlayer?.name,
                      card: "none", restart: actionFlow.restart || "none",
                    });
                    setActionFlow(null);
                  });
                }} />
                <FlowBtn label="🟨 Yellow" color="amber" onClick={() => {
                  wrap(async () => {
                    await engine.logFoul(matchId, {
                      team: actionFlow.team, player_id: actionFlow.player.id, player_name: actionFlow.player.name,
                      fouled_player_id: actionFlow.fouledPlayer?.id, fouled_player_name: actionFlow.fouledPlayer?.name,
                      card: "yellow", restart: actionFlow.restart || "none",
                    });
                    setActionFlow(null);
                  });
                }} />
                <FlowBtn label="🟥 Red" color="red" onClick={() => {
                  wrap(async () => {
                    await engine.logFoul(matchId, {
                      team: actionFlow.team, player_id: actionFlow.player.id, player_name: actionFlow.player.name,
                      fouled_player_id: actionFlow.fouledPlayer?.id, fouled_player_name: actionFlow.fouledPlayer?.name,
                      card: "red", restart: actionFlow.restart || "none",
                    });
                    setActionFlow(null);
                  });
                }} />
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ PENALTY SHOOTOUT MODE ═══════════════════ */}
      {actions.isShootoutMode && (
        <PenaltyPanel
          teamAName={teamAName} teamBName={teamBName}
          onFieldA={onFieldA} onFieldB={onFieldB}
          penalties={state.penalties}
          onPenalty={handlePenalty}
        />
      )}

      {/* ═══════════════════ MAIN SCORING AREA (50/50 SPLIT) ═══════════════════ */}
      {!actions.isShootoutMode && (
        <div className="grid grid-cols-2 gap-3">
          <TeamPanel
            team="team_a"
            teamName={teamAName}
            onFieldPlayers={onFieldA}
            benchPlayers={benchA}
            state={state}
            isActive={actions.canLogEvents}
            onPlayerClick={handlePlayerClick}
            onBenchClick={handleBenchClick}
            onTeamAction={handleTeamAction}
            activeFlow={actionFlow}
            accentColor="emerald"
          />
          <TeamPanel
            team="team_b"
            teamName={teamBName}
            onFieldPlayers={onFieldB}
            benchPlayers={benchB}
            state={state}
            isActive={actions.canLogEvents}
            onPlayerClick={handlePlayerClick}
            onBenchClick={handleBenchClick}
            onTeamAction={handleTeamAction}
            activeFlow={actionFlow}
            accentColor="amber"
          />
        </div>
      )}

      {/* ═══════════════════ LOWER AREA: TIMELINE + STATS ═══════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Timeline */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-[var(--text)]">📋 Timeline</h3>
            {state.events.length > 0 && (
              <button onClick={handleUndo} disabled={loading}
                className="text-xs font-bold text-[var(--danger)] hover:underline disabled:opacity-40">
                ↩ Undo Last
              </button>
            )}
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {state.events.length === 0 && <p className="text-xs text-[var(--text-muted)] italic">No events yet</p>}
            {[...state.events].reverse().map((event, i) => (
              <div key={event.id || i} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)]">
                <span className="font-mono text-[var(--text-muted)] w-8 text-right">{Math.floor(event.match_time_seconds / 60)}&apos;</span>
                <span>{getEventIcon(event.type)}</span>
                <span className="font-semibold text-[var(--text)] truncate flex-1">
                  {event.player_name || event.type}
                  {event.assist_name ? ` (assist: ${event.assist_name})` : ''}
                  {event.details ? ` · ${event.details}` : ''}
                </span>
                <span className="text-[var(--text-muted)] text-[10px] uppercase">{event.team === 'team_a' ? teamAName : event.team === 'team_b' ? teamBName : ''}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Match Stats */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="font-bold text-sm uppercase tracking-wider text-[var(--text)] mb-3">📊 Match Stats</h3>
          <div className="space-y-2">
            <StatBar label="Shots On" a={state.team_a_stats.shots_on_target} b={state.team_b_stats.shots_on_target} />
            <StatBar label="Shots Off" a={state.team_a_stats.shots_off_target} b={state.team_b_stats.shots_off_target} />
            <StatBar label="Corners" a={state.team_a_stats.corners} b={state.team_b_stats.corners} />
            <StatBar label="Fouls" a={state.team_a_stats.fouls} b={state.team_b_stats.fouls} />
            <StatBar label="Yellows" a={state.team_a_stats.yellow_cards} b={state.team_b_stats.yellow_cards} />
            <StatBar label="Reds" a={state.team_a_stats.red_cards} b={state.team_b_stats.red_cards} />
            <StatBar label="Free Kicks" a={state.team_a_stats.free_kicks} b={state.team_b_stats.free_kicks} />
            <StatBar label="Goal Kicks" a={state.team_a_stats.goal_kicks} b={state.team_b_stats.goal_kicks} />
            <StatBar label="Throw Ins" a={state.team_a_stats.throw_ins} b={state.team_b_stats.throw_ins} />
            <StatBar label="Offsides" a={state.team_a_stats.offsides} b={state.team_b_stats.offsides} />
          </div>
        </div>
      </div>

      {/* ═══════════════════ ACTION MODAL ═══════════════════ */}
      {modalPlayer && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setModalPlayer(null)}>
          <div className="bg-[var(--surface)] rounded-t-2xl md:rounded-2xl w-full max-w-md p-5 shadow-2xl border border-[var(--border)] animate-slide-up"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-[var(--text)]">{modalPlayer.player.name}</h3>
                <p className="text-xs text-[var(--text-muted)]">#{modalPlayer.player.jersey_number} · {modalPlayer.team === 'team_a' ? teamAName : teamBName}</p>
              </div>
              <button onClick={() => setModalPlayer(null)} className="text-[var(--text-muted)] text-xl hover:text-[var(--text)]">✕</button>
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Primary</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <ActionBtn label="⚽ Goal" onClick={() => handleActionSelect("goal")} />
              <ActionBtn label="🎯 Shot On" onClick={() => handleActionSelect("shot_on_target")} />
              <ActionBtn label="💨 Shot Off" onClick={() => handleActionSelect("shot_off_target")} />
              <ActionBtn label="🚨 Foul" onClick={() => handleActionSelect("foul")} />
              <ActionBtn label="🟨 Yellow Card" onClick={() => handleActionSelect("yellow_card")} />
              <ActionBtn label="🟥 Red Card" onClick={() => handleActionSelect("red_card")} />
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Micro</p>
            <div className="grid grid-cols-3 gap-2">
              <ActionBtn label="🛡️ Intercept" onClick={() => handleActionSelect("interception")} small />
              <ActionBtn label="🧱 Block" onClick={() => handleActionSelect("block")} small />
              <ActionBtn label="🧹 Clear" onClick={() => handleActionSelect("clearance")} small />
              <ActionBtn label="⚡ Dribble" onClick={() => handleActionSelect("dribble")} small />
              <ActionBtn label="✨ Chance" onClick={() => handleActionSelect("chance_created")} small />
              <ActionBtn label="🧤 Save" onClick={() => handleActionSelect("save")} small />
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 pointer-events-none">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════════════════════

function ControlBtn({ label, onClick, color }: { label: string; onClick: () => void; color?: string }) {
  const colorClasses: Record<string, string> = {
    emerald: "bg-emerald-600 hover:bg-emerald-500 text-white",
    amber: "bg-amber-600 hover:bg-amber-500 text-white",
    red: "bg-red-600 hover:bg-red-500 text-white",
  };
  return (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${color ? colorClasses[color] : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-alt)]"}`}>
      {label}
    </button>
  );
}

function ActionBtn({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return (
    <button onClick={onClick}
      className={`rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] hover:bg-[var(--primary)] hover:text-white font-semibold transition-all active:scale-95 ${small ? "py-2 px-2 text-xs" : "py-3 px-3 text-sm"}`}>
      {label}
    </button>
  );
}

function FlowBtn({ label, onClick, color }: { label: string; onClick: () => void; color?: string }) {
  const colorMap: Record<string, string> = {
    amber: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    red: "bg-red-500/20 text-red-300 border-red-500/40",
  };
  return (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all active:scale-95 ${color ? colorMap[color] : "bg-[var(--surface)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--primary)] hover:text-white"}`}>
      {label}
    </button>
  );
}

// ── Team Panel ──
function TeamPanel({
  team, teamName, onFieldPlayers, benchPlayers, state, isActive,
  onPlayerClick, onBenchClick, onTeamAction, activeFlow, accentColor,
}: {
  team: "team_a" | "team_b";
  teamName: string;
  onFieldPlayers: Player[];
  benchPlayers: Player[];
  state: FootballMatchState;
  isActive: boolean;
  onPlayerClick: (player: Player, team: "team_a" | "team_b") => void;
  onBenchClick: (player: Player, team: "team_a" | "team_b") => void;
  onTeamAction: (team: string, type: string) => void;
  activeFlow: ActionFlow;
  accentColor: string;
}) {
  const borderColor = accentColor === "emerald" ? "border-emerald-500/30" : "border-amber-500/30";

  return (
    <div className={`rounded-2xl border ${borderColor} bg-[var(--surface)] p-3 space-y-3`}>
      {/* Team Name */}
      <h4 className="font-bold text-xs uppercase tracking-widest text-[var(--text-muted)] text-center">{teamName}</h4>

      {/* Team Actions Strip */}
      {isActive && (
        <div className="flex gap-1.5">
          <button onClick={() => onTeamAction(team, "corner")} className="flex-1 text-xs py-1.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] font-semibold hover:bg-[var(--primary)] hover:text-white transition-all active:scale-95">📐 Corner</button>
          <button onClick={() => onTeamAction(team, "goal_kick")} className="flex-1 text-xs py-1.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] font-semibold hover:bg-[var(--primary)] hover:text-white transition-all active:scale-95">🥅 GK</button>
          <button onClick={() => onTeamAction(team, "throw_in")} className="flex-1 text-xs py-1.5 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] font-semibold hover:bg-[var(--primary)] hover:text-white transition-all active:scale-95">↗️ Throw</button>
        </div>
      )}

      {/* On-field Players */}
      <div className="grid grid-cols-2 gap-1.5">
        {onFieldPlayers.map(player => {
          const sentOff = isPlayerSentOff(state, player.id);
          const playerStats = state.player_stats[player.id];
          const isGk = player.role?.toLowerCase() === 'gk' || player.role?.toLowerCase() === 'goalkeeper';
          const isHighlighted = activeFlow?.type === "substitution" && activeFlow.team === team && activeFlow.step === "select_field_player";

          return (
            <button
              key={player.id}
              onClick={() => onPlayerClick(player, team)}
              disabled={sentOff || !isActive}
              className={`relative rounded-xl p-2 text-left border transition-all active:scale-95
                ${sentOff ? "opacity-30 cursor-not-allowed border-red-500/50 bg-red-500/10" :
                  isHighlighted ? "border-[var(--primary)] bg-[var(--primary)]/10 ring-2 ring-[var(--primary)] animate-pulse" :
                    "border-[var(--border)] bg-[var(--surface-alt)] hover:border-[var(--primary)]"}`}
            >
              {isGk && <span className="absolute top-1 right-1 text-[9px] font-bold bg-yellow-400 text-black px-1.5 rounded">GK</span>}
              <div className="font-bold text-xs text-[var(--text)] truncate">
                {player.jersey_number ? `#${player.jersey_number} ` : ''}{player.name}
              </div>
              {playerStats && (playerStats.goals > 0 || playerStats.yellow_cards > 0 || playerStats.red_cards > 0) && (
                <div className="flex gap-1 mt-0.5 text-[10px]">
                  {playerStats.goals > 0 && <span>⚽{playerStats.goals}</span>}
                  {playerStats.yellow_cards > 0 && <span>🟨{playerStats.yellow_cards}</span>}
                  {playerStats.red_cards > 0 && <span>🟥</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bench */}
      {benchPlayers.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Bench</p>
          <div className="flex flex-wrap gap-1">
            {benchPlayers.map(player => (
              <button key={player.id} onClick={() => onBenchClick(player, team)} disabled={!isActive}
                className="text-[10px] px-2 py-1 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] font-semibold hover:border-[var(--primary)] hover:text-[var(--text)] transition-all disabled:opacity-40">
                {player.jersey_number ? `#${player.jersey_number} ` : ''}{player.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Penalty Panel ──
function PenaltyPanel({
  teamAName, teamBName, onFieldA, onFieldB, penalties, onPenalty,
}: {
  teamAName: string;
  teamBName: string;
  onFieldA: Player[];
  onFieldB: Player[];
  penalties: any[];
  onPenalty: (team: string, playerId: string, playerName: string, scored: boolean) => void;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<{ player: Player; team: string } | null>(null);

  const penaltiesA = penalties.filter((p: any) => p.team === 'team_a');
  const penaltiesB = penalties.filter((p: any) => p.team === 'team_b');

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
      <h3 className="font-bold text-center text-sm uppercase tracking-widest text-[var(--text)]">⚽ Penalty Shootout</h3>
      <div className="grid grid-cols-2 gap-4">
        {/* Team A */}
        <div className="text-center space-y-2">
          <h4 className="font-bold text-xs text-[var(--text-muted)]">{teamAName}</h4>
          <div className="flex justify-center gap-2">
            {penaltiesA.map((p: any, i: number) => (
              <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${p.scored ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                {p.scored ? '✓' : '✕'}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 justify-center">
            {onFieldA.map(p => (
              <button key={p.id} onClick={() => setSelectedPlayer({ player: p, team: 'team_a' })}
                className="text-xs px-2 py-1 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] font-semibold hover:border-emerald-500 transition-all">
                {p.name}
              </button>
            ))}
          </div>
        </div>
        {/* Team B */}
        <div className="text-center space-y-2">
          <h4 className="font-bold text-xs text-[var(--text-muted)]">{teamBName}</h4>
          <div className="flex justify-center gap-2">
            {penaltiesB.map((p: any, i: number) => (
              <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${p.scored ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                {p.scored ? '✓' : '✕'}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 justify-center">
            {onFieldB.map(p => (
              <button key={p.id} onClick={() => setSelectedPlayer({ player: p, team: 'team_b' })}
                className="text-xs px-2 py-1 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] font-semibold hover:border-amber-500 transition-all">
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedPlayer && (
        <div className="flex items-center justify-center gap-3 pt-2 border-t border-[var(--border)]">
          <span className="text-sm font-bold text-[var(--text)]">{selectedPlayer.player.name}:</span>
          <button onClick={() => { onPenalty(selectedPlayer.team, selectedPlayer.player.id, selectedPlayer.player.name, true); setSelectedPlayer(null); }}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 active:scale-95 transition-all">✓ Scored</button>
          <button onClick={() => { onPenalty(selectedPlayer.team, selectedPlayer.player.id, selectedPlayer.player.name, false); setSelectedPlayer(null); }}
            className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-500 active:scale-95 transition-all">✕ Missed</button>
        </div>
      )}
    </div>
  );
}

// ── Stat Bar ──
function StatBar({ label, a, b }: { label: string; a: number; b: number }) {
  const total = a + b || 1;
  const pctA = (a / total) * 100;
  const pctB = (b / total) * 100;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-6 text-right font-bold tabular-nums text-[var(--text)]">{a}</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--surface-alt)] overflow-hidden flex">
        <div className="h-full bg-emerald-500 rounded-l-full transition-all duration-500" style={{ width: `${pctA}%` }} />
        <div className="h-full bg-amber-500 rounded-r-full transition-all duration-500 ml-auto" style={{ width: `${pctB}%` }} />
      </div>
      <span className="w-6 text-left font-bold tabular-nums text-[var(--text)]">{b}</span>
      <span className="w-16 text-[var(--text-muted)] text-[10px] uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ── Lineup Setup (Pre-Match) with GK Toggle ──
function LineupSetup({
  matchId, teamAName, teamBName, teamAPlayers, teamBPlayers,
  playersPerSide, initialLineupA, initialLineupB, loading, onConfirm,
}: {
  matchId: string;
  teamAName: string;
  teamBName: string;
  teamAPlayers: Player[];
  teamBPlayers: Player[];
  playersPerSide: number;
  initialLineupA: string[];
  initialLineupB: string[];
  loading: boolean;
  onConfirm: (lineupA: string[], lineupB: string[], gkA: string | null, gkB: string | null) => void;
}) {
  const [selectedA, setSelectedA] = useState<Set<string>>(new Set(initialLineupA));
  const [selectedB, setSelectedB] = useState<Set<string>>(new Set(initialLineupB));
  const [gkA, setGkA] = useState<string | null>(null);
  const [gkB, setGkB] = useState<string | null>(null);

  const togglePlayer = (playerId: string, team: 'a' | 'b') => {
    if (team === 'a') {
      setSelectedA(prev => {
        const next = new Set(prev);
        if (next.has(playerId)) {
          next.delete(playerId);
          if (gkA === playerId) setGkA(null);
        } else if (next.size < playersPerSide) {
          next.add(playerId);
        }
        return next;
      });
    } else {
      setSelectedB(prev => {
        const next = new Set(prev);
        if (next.has(playerId)) {
          next.delete(playerId);
          if (gkB === playerId) setGkB(null);
        } else if (next.size < playersPerSide) {
          next.add(playerId);
        }
        return next;
      });
    }
  };

  const canConfirm = selectedA.size === playersPerSide && selectedB.size === playersPerSide;

  const renderPlayerRow = (player: Player, team: 'a' | 'b') => {
    const selected = team === 'a' ? selectedA : selectedB;
    const currentGk = team === 'a' ? gkA : gkB;
    const setGk = team === 'a' ? setGkA : setGkB;
    const isSelected = selected.has(player.id);
    const isFull = selected.size >= playersPerSide && !isSelected;
    const isGk = currentGk === player.id;
    const accentColor = team === 'a' ? 'emerald' : 'amber';

    return (
      <div key={player.id} className="flex items-center gap-1.5">
        <button
          onClick={() => togglePlayer(player.id, team)}
          disabled={isFull}
          className={`flex-1 flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all active:scale-[0.98]
            ${isSelected
              ? `border-${accentColor}-500 bg-${accentColor}-500/10 ring-1 ring-${accentColor}-500/30`
              : isFull
                ? 'border-[var(--border)] bg-[var(--surface-alt)] opacity-40 cursor-not-allowed'
                : `border-[var(--border)] bg-[var(--surface-alt)] hover:border-${accentColor}-500/50`}`}
        >
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
            ${isSelected ? `bg-${accentColor}-500 border-${accentColor}-500 text-white` : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
            {isSelected ? '✓' : ''}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-xs text-[var(--text)] truncate">
              {player.jersey_number ? `#${player.jersey_number} ` : ''}{player.name}
            </div>
            {player.role && <div className="text-[10px] text-[var(--text-muted)] uppercase">{player.role}</div>}
          </div>
        </button>
        {/* GK Toggle — only shown when player is selected */}
        {isSelected && (
          <button
            onClick={(e) => { e.stopPropagation(); setGk(isGk ? null : player.id); }}
            className={`shrink-0 px-2 py-1.5 rounded-lg text-[10px] font-black border-2 transition-all active:scale-95
              ${isGk
                ? 'bg-yellow-400 border-yellow-400 text-black shadow-md shadow-yellow-400/20'
                : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text-muted)] hover:border-yellow-400/50'}`}
            title={isGk ? 'Remove GK' : 'Set as GK'}
          >
            🧤 GK
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border-2 border-dashed border-[var(--primary)] bg-[var(--surface)] p-5 space-y-5 animate-fade-in">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-black text-[var(--text)]">📋 Set Starting Lineup</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Select <span className="font-bold text-[var(--primary)]">{playersPerSide}</span> players per team · Tap <span className="font-bold text-yellow-500">🧤 GK</span> to designate goalkeeper
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Team A */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-widest text-emerald-500">{teamAName}</h4>
            <span className={`text-xs font-bold tabular-nums ${selectedA.size === playersPerSide ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`}>
              {selectedA.size}/{playersPerSide}
            </span>
          </div>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {teamAPlayers.map(player => renderPlayerRow(player, 'a'))}
          </div>
          {gkA && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-yellow-500">
              🧤 GK: {teamAPlayers.find(p => p.id === gkA)?.name}
            </div>
          )}
        </div>

        {/* Team B */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-widest text-amber-500">{teamBName}</h4>
            <span className={`text-xs font-bold tabular-nums ${selectedB.size === playersPerSide ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}>
              {selectedB.size}/{playersPerSide}
            </span>
          </div>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {teamBPlayers.map(player => renderPlayerRow(player, 'b'))}
          </div>
          {gkB && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-yellow-500">
              🧤 GK: {teamBPlayers.find(p => p.id === gkB)?.name}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <button
          onClick={() => onConfirm(Array.from(selectedA), Array.from(selectedB), gkA, gkB)}
          disabled={!canConfirm || loading}
          className={`px-8 py-3 rounded-xl text-sm font-black transition-all active:scale-95
            ${canConfirm
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : 'bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed'}`}
        >
          {loading ? 'Saving...' : canConfirm ? '✅ Confirm Lineup & Ready to Start' : `Select ${playersPerSide} per team`}
        </button>
      </div>
    </div>
  );
}
