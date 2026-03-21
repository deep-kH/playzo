// ============================================================================
// Football Scoring — Client-side API Engine
// Wraps Supabase RPCs for the admin scorer and other clients.
// ============================================================================

import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/types/database';
import { normalizeFootballEventType } from './types';

// ── Generic event dispatcher (goes through rpc_process_event → rpc_process_football) ──
async function dispatchEvent(matchId: string, type: string, payload: object = {}): Promise<void> {
  if (!matchId || matchId === 'undefined') throw new Error('Missing matchId');
  const normalizedType = normalizeFootballEventType(type) ?? type;
  const { error } = await supabase.rpc('rpc_process_event', {
    p_match_id: matchId,
    p_type: normalizedType,
    p_payload: { ...payload } as Json,
  } as never);
  if (error) throw new Error(error.message);
}

// ── Lineup Management ──
export async function saveLineup(
  matchId: string,
  startingLineupA: string[],
  startingLineupB: string[],
  gkAId?: string | null,
  gkBId?: string | null,
): Promise<void> {
  // First read current settings
  const { data: match, error: readErr } = await supabase
    .from('ls_matches')
    .select('settings')
    .eq('id', matchId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const currentSettings = ((match as any)?.settings as Record<string, unknown>) || {};
  const updatedSettings = {
    ...currentSettings,
    starting_lineup_a: startingLineupA,
    starting_lineup_b: startingLineupB,
    gk_a_id: gkAId || null,
    gk_b_id: gkBId || null,
    lineup_confirmed: true,
  };

  const { error } = await supabase
    .from('ls_matches')
    .update({ settings: updatedSettings } as never)
    .eq('id', matchId);
  if (error) throw new Error(error.message);
}

// ── Phase Control ──
export const startMatch = (matchId: string) =>
  dispatchEvent(matchId, 'match_start');

export const pauseMatch = (matchId: string) =>
  dispatchEvent(matchId, 'match_pause');

export const resumeMatch = (matchId: string) =>
  dispatchEvent(matchId, 'match_resume');

export const endHalf = (matchId: string) =>
  dispatchEvent(matchId, 'half_time');

export const startSecondHalf = (matchId: string) =>
  dispatchEvent(matchId, 'second_half_start');

export const endFullTime = (matchId: string) =>
  dispatchEvent(matchId, 'full_time');

export const startExtraTime = (matchId: string, extraTimeDuration: number) =>
  dispatchEvent(matchId, 'extra_time_start', { extra_time_duration: extraTimeDuration });

export const endExtraTimeHalf = (matchId: string) =>
  dispatchEvent(matchId, 'extra_time_half');

export const startExtraTimeSecond = (matchId: string) =>
  dispatchEvent(matchId, 'extra_time_second_start');

export const startPenaltyShootout = (matchId: string) =>
  dispatchEvent(matchId, 'penalty_shootout_start');

export const endMatch = (matchId: string) =>
  dispatchEvent(matchId, 'match_end');

export const addStoppage = (matchId: string, extraMinutes: number = 1) =>
  dispatchEvent(matchId, 'extra_time_added', { extra_minutes: extraMinutes });

// ── In-game Events ──
export interface GoalPayload {
  team: 'team_a' | 'team_b';
  player_id: string;
  player_name: string;
  photo_url?: string;
  assist_player_id?: string;
  assist_player_name?: string;
  opposing_gk_id?: string;
}

export const logGoal = (matchId: string, payload: GoalPayload) =>
  dispatchEvent(matchId, 'goal', payload);

export interface ShotPayload {
  team: 'team_a' | 'team_b';
  player_id: string;
  player_name: string;
  photo_url?: string;
  restart?: string; // 'corner_kick' | 'goal_kick' | 'none'
  opposing_gk_id?: string;
}

export const logShotOnTarget = (matchId: string, payload: ShotPayload) =>
  dispatchEvent(matchId, 'shot_on_target', payload);

export const logShotOffTarget = (matchId: string, payload: ShotPayload) =>
  dispatchEvent(matchId, 'shot_off_target', payload);

export interface FoulPayload {
  team: 'team_a' | 'team_b';
  player_id: string;
  player_name: string;
  photo_url?: string;
  fouled_player_id?: string;
  fouled_player_name?: string;
  card?: 'none' | 'yellow' | 'red';
  restart?: string; // 'free_kick' | 'advantage' | 'none'
}

export const logFoul = (matchId: string, payload: FoulPayload) => {
  const events: Promise<void>[] = [];
  // Log the foul itself
  events.push(dispatchEvent(matchId, 'foul', payload));
  // If a card is given, log it as a separate event too
  if (payload.card === 'yellow') {
    events.push(dispatchEvent(matchId, 'yellow_card', {
      team: payload.team,
      player_id: payload.player_id,
      player_name: payload.player_name,
    }));
  } else if (payload.card === 'red') {
    events.push(dispatchEvent(matchId, 'red_card', {
      team: payload.team,
      player_id: payload.player_id,
      player_name: payload.player_name,
    }));
  }
  return Promise.all(events);
};

export const logYellowCard = (matchId: string, team: string, playerId: string, playerName: string) =>
  dispatchEvent(matchId, 'yellow_card', { team, player_id: playerId, player_name: playerName });

export const logRedCard = (matchId: string, team: string, playerId: string, playerName: string) =>
  dispatchEvent(matchId, 'red_card', { team, player_id: playerId, player_name: playerName });

// ── Team Actions (no player) ──
export const logCorner = (matchId: string, team: string) =>
  dispatchEvent(matchId, 'corner', { team });

export const logGoalKick = (matchId: string, team: string) =>
  dispatchEvent(matchId, 'goal_kick', { team });

export const logThrowIn = (matchId: string, team: string) =>
  dispatchEvent(matchId, 'throw_in', { team });

export const logFreeKick = (matchId: string, team: string) =>
  dispatchEvent(matchId, 'free_kick', { team });

export const logOffside = (matchId: string, team: string) =>
  dispatchEvent(matchId, 'offside', { team });

// ── Micro Actions ──
export const logMicroAction = (matchId: string, type: string, team: string, playerId: string, playerName: string) =>
  dispatchEvent(matchId, type, { team, player_id: playerId, player_name: playerName });

// ── Substitution ──
export interface SubstitutionPayload {
  team: 'team_a' | 'team_b';
  player_id: string;       // player going OUT
  player_name?: string;
  sub_in_id: string;       // player coming IN
  sub_in_name?: string;
  sub_out_name?: string;
}

export const logSubstitution = (matchId: string, payload: SubstitutionPayload) =>
  dispatchEvent(matchId, 'substitution', {
    team: payload.team,
    player_id: payload.player_id,
    sub_in_id: payload.sub_in_id,
    sub_in_name: payload.sub_in_name || '',
    sub_out_name: payload.sub_out_name || '',
  });

// ── Penalty Shootout ──
export const logPenaltyGoal = (matchId: string, team: string, playerId: string, playerName: string, photoUrl?: string) =>
  dispatchEvent(matchId, 'penalty_goal', { team, player_id: playerId, player_name: playerName, photo_url: photoUrl });

export const logPenaltyMiss = (matchId: string, team: string, playerId: string, playerName: string, photoUrl?: string) =>
  dispatchEvent(matchId, 'penalty_miss', { team, player_id: playerId, player_name: playerName, photo_url: photoUrl });

// ── Undo ──
export async function undoLastEvent(matchId: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_football_undo_last_event', {
    p_match_id: matchId,
  } as never);
  if (error) throw new Error(error.message);
}

// ── Fetch Stats ──
export async function getPlayerMatchStats(matchId: string) {
  const { data, error } = await supabase
    .from('fb_player_match_stats')
    .select('*')
    .eq('match_id', matchId)
    .order('goals', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getTournamentMvpStats(tournamentId: string) {
  const { data, error } = await supabase
    .from('fb_player_tournament_stats')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('rating_score', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}
