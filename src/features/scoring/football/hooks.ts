// ============================================================================
// Football Scoring — Hooks (Rebuilt V5)
// ============================================================================
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { FootballMatchState, FootballPhase } from './types';

// ── Clock Hook ──
// Computes display time from server state.
// Timer counts DOWN from halfDuration, then counts UP for stoppage.
export interface FootballClockDisplay {
  /** Main display string e.g. "32:15" or "45:00 +2:30" */
  display: string;
  /** Minutes remaining (or negative = into stoppage) */
  minutesRemaining: number;
  /** Seconds component */
  secondsRemaining: number;
  /** Whether we are in stoppage time */
  inStoppage: boolean;
  /** Stoppage display e.g. "+2:30" */
  stoppageDisplay: string;
  /** Allotted stoppage display e.g. "2:00" */
  allottedStoppageDisplay: string;
  /** Total allotted stoppage minutes */
  allottedStoppageMinutes: number;
  /** Whether timer has exceeded regular + stoppage — trigger auto-prompt */
  shouldPromptEnd: boolean;
}

export function useFootballClock(
  state: FootballMatchState,
  halfDurationSeconds: number
): FootballClockDisplay {
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.clock_running) {
      intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.clock_running]);

  // Calculate elapsed
  let elapsed = state.elapsed_seconds || 0;
  if (state.clock_running && state.last_clock_start_time) {
    const started = new Date(state.last_clock_start_time).getTime();
    elapsed += Math.floor((now - started) / 1000);
  }

  const remaining = halfDurationSeconds - elapsed;
  const allottedStoppageMinutes = state.added_extra_time_minutes || 0;
  const allottedStoppageSeconds = allottedStoppageMinutes * 60;
  const inStoppage = remaining <= 0;

  // Main display
  let displayMinutes: number;
  let displaySeconds: number;

  if (!inStoppage) {
    displayMinutes = Math.floor(remaining / 60);
    displaySeconds = remaining % 60;
  } else {
    // Show the half duration when in stoppage
    displayMinutes = Math.floor(halfDurationSeconds / 60);
    displaySeconds = 0;
  }

  // Stoppage elapsed display (how much stoppage time has passed)
  const stoppageElapsed = inStoppage ? Math.abs(remaining) : 0;
  const stoppageMin = Math.floor(stoppageElapsed / 60);
  const stoppageSec = stoppageElapsed % 60;
  const stoppageDisplay = inStoppage
    ? `+${String(stoppageMin).padStart(2, '0')}:${String(stoppageSec).padStart(2, '0')}`
    : '';

  // Allotted stoppage display (how much was given)
  const allottedStoppageDisplay = `${allottedStoppageMinutes}:00`;

  // Auto-prompt: fires when elapsed stoppage >= allotted stoppage
  // If allottedStoppageSeconds is 0, prompt as soon as regular time expires
  const shouldPromptEnd = inStoppage && (stoppageElapsed >= allottedStoppageSeconds);

  const display = inStoppage
    ? `${displayMinutes}:00 ${stoppageDisplay}`
    : `${String(displayMinutes).padStart(2, '0')}:${String(displaySeconds).padStart(2, '0')}`;

  return {
    display,
    minutesRemaining: inStoppage ? 0 : displayMinutes,
    secondsRemaining: inStoppage ? 0 : displaySeconds,
    inStoppage,
    stoppageDisplay,
    allottedStoppageDisplay,
    allottedStoppageMinutes,
    shouldPromptEnd,
  };
}

// ── Phase Actions Hook ──
// Returns which control buttons should be available based on match phase
export interface PhaseActions {
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canEndHalf: boolean;
  canStartSecondHalf: boolean;
  canEndFullTime: boolean;
  canStartExtraTime: boolean;
  canStartPenalties: boolean;
  canEndMatch: boolean;
  canAddStoppage: boolean;
  canLogEvents: boolean;
  isShootoutMode: boolean;
}

export function getPhaseActions(state: FootballMatchState): PhaseActions {
  const phase = state.phase;
  const clockRunning = state.clock_running;

  return {
    canStart: phase === 'not_started',
    canPause: clockRunning && ['first_half', 'second_half', 'extra_time_first', 'extra_time_second'].includes(phase),
    canResume: !clockRunning && ['first_half', 'second_half', 'extra_time_first', 'extra_time_second'].includes(phase),
    canEndHalf: ['first_half', 'extra_time_first'].includes(phase),
    canStartSecondHalf: phase === 'half_time',
    canEndFullTime: phase === 'second_half',
    canStartExtraTime: phase === 'full_time',
    canStartPenalties: phase === 'full_time' || phase === 'extra_time_half' || phase === 'extra_time_second',
    canEndMatch: ['full_time', 'penalty_shootout', 'extra_time_second'].includes(phase),
    canAddStoppage: clockRunning && ['first_half', 'second_half', 'extra_time_first', 'extra_time_second'].includes(phase),
    canLogEvents: ['first_half', 'second_half', 'extra_time_first', 'extra_time_second'].includes(phase),
    isShootoutMode: phase === 'penalty_shootout',
  };
}

// ── Sent-off detection ──
// Checks if a player has accumulated 2 yellows or 1 red from the events array
export function isPlayerSentOff(state: FootballMatchState, playerId: string): boolean {
  let yellows = 0;
  let reds = 0;
  for (const event of state.events) {
    if (event.player_id === playerId) {
      if (event.type === 'yellow_card') yellows++;
      if (event.type === 'red_card') reds++;
    }
  }
  return reds > 0 || yellows >= 2;
}
