// src/features/scoring/football/hooks.ts
"use client";

import { useEffect, useState } from "react";
import type { FootballMatchState, MatchPhase } from "./types";

export function useFootballClock(state: FootballMatchState) {
  const [displaySeconds, setDisplaySeconds] = useState(state.elapsed_seconds);

  useEffect(() => {
    if (!state.clock_running || !state.last_clock_start_time) {
      setDisplaySeconds(state.elapsed_seconds);
      return;
    }

    const updateTime = () => {
      const now = new Date().getTime();
      const started = new Date(state.last_clock_start_time!).getTime();
      const diffSeconds = Math.floor((now - started) / 1000);
      setDisplaySeconds(state.elapsed_seconds + diffSeconds);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [state.clock_running, state.last_clock_start_time, state.elapsed_seconds]);

  // Format into MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Format display with stoppage: "45:00 +02:30" or "90:00 +03:10"
  const formatWithStoppage = () => {
    const base = formatTime(displaySeconds);
    if (state.added_extra_time_minutes > 0) {
      const addedSecs = state.added_extra_time_minutes * 60;
      return `${base} +${formatTime(addedSecs)}`;
    }
    return base;
  };

  return {
    displaySeconds,
    displayTimeStr: formatTime(displaySeconds),
    displayWithStoppage: formatWithStoppage(),
    addedTime: state.added_extra_time_minutes,
  };
}

/** Returns the allowed actions for the current match phase */
export function getPhaseActions(phase: MatchPhase, clockRunning: boolean) {
  const actions: { label: string; event: string; variant: "primary" | "secondary" | "danger" }[] = [];

  switch (phase) {
    case "not_started":
      actions.push({ label: "▶ Start Match", event: "match_start", variant: "primary" });
      break;
    case "first_half":
      if (clockRunning) {
        actions.push({ label: "⏸ Pause", event: "match_pause", variant: "secondary" });
        actions.push({ label: "⏱ End 1st Half", event: "half_time", variant: "danger" });
      } else {
        actions.push({ label: "▶ Resume", event: "match_resume", variant: "primary" });
      }
      actions.push({ label: "+⏱ Stoppage", event: "extra_time_added", variant: "secondary" });
      break;
    case "half_time":
      actions.push({ label: "▶ Start 2nd Half", event: "second_half_start", variant: "primary" });
      break;
    case "second_half":
      if (clockRunning) {
        actions.push({ label: "⏸ Pause", event: "match_pause", variant: "secondary" });
        actions.push({ label: "⏱ Full Time", event: "full_time", variant: "danger" });
      } else {
        actions.push({ label: "▶ Resume", event: "match_resume", variant: "primary" });
      }
      actions.push({ label: "+⏱ Stoppage", event: "extra_time_added", variant: "secondary" });
      break;
    case "full_time":
      actions.push({ label: "▶ Start Extra Time", event: "extra_time_start", variant: "primary" });
      actions.push({ label: "🥅 Penalty Shootout", event: "penalty_shootout_start", variant: "secondary" });
      actions.push({ label: "🏁 End Match", event: "match_end", variant: "danger" });
      break;
    case "extra_time_first":
      if (clockRunning) {
        actions.push({ label: "⏸ Pause", event: "match_pause", variant: "secondary" });
        actions.push({ label: "⏱ ET Half Time", event: "extra_time_half", variant: "danger" });
      } else {
        actions.push({ label: "▶ Resume", event: "match_resume", variant: "primary" });
      }
      break;
    case "extra_time_half":
      actions.push({ label: "▶ Start ET 2nd", event: "extra_time_second_start", variant: "primary" });
      break;
    case "extra_time_second":
      if (clockRunning) {
        actions.push({ label: "⏸ Pause", event: "match_pause", variant: "secondary" });
        actions.push({ label: "🏁 End Extra Time", event: "full_time", variant: "danger" });
      } else {
        actions.push({ label: "▶ Resume", event: "match_resume", variant: "primary" });
      }
      break;
    case "penalty_shootout":
      actions.push({ label: "🏁 End Match", event: "match_end", variant: "danger" });
      break;
  }

  return actions;
}
