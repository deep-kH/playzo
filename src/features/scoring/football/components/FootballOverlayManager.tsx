// ============================================================================
// FootballOverlayManager — Animated overlays for live view (Rebuilt V5)
// Goal celebration flash, red card flash, etc.
// ============================================================================
"use client";

import React, { useEffect, useState, useRef } from "react";
import type { FootballMatchState } from "../types";

interface Props {
  state: FootballMatchState;
  teamAName: string;
  teamBName: string;
}

type OverlayType = "goal" | "red_card" | "yellow_card" | null;

export function FootballOverlayManager({ state, teamAName, teamBName }: Props) {
  const [overlay, setOverlay] = useState<OverlayType>(null);
  const [overlayData, setOverlayData] = useState<{ playerName: string; teamName: string; assistName?: string } | null>(null);
  const prevEventCountRef = useRef(state.events.length);

  useEffect(() => {
    const currentCount = state.events.length;
    if (currentCount > prevEventCountRef.current && currentCount > 0) {
      const lastEvent = state.events[currentCount - 1];
      const teamName = lastEvent.team === "team_a" ? teamAName : teamBName;

      if (lastEvent.type === "goal" || lastEvent.type === "own_goal") {
        setOverlayData({ playerName: lastEvent.player_name, teamName, assistName: lastEvent.assist_name });
        setOverlay("goal");
      } else if (lastEvent.type === "red_card") {
        setOverlayData({ playerName: lastEvent.player_name, teamName });
        setOverlay("red_card");
      } else if (lastEvent.type === "yellow_card") {
        setOverlayData({ playerName: lastEvent.player_name, teamName });
        setOverlay("yellow_card");
      }
    }
    prevEventCountRef.current = currentCount;
  }, [state.events.length, state.events, teamAName, teamBName]);

  // Auto-dismiss overlay
  useEffect(() => {
    if (overlay) {
      const timer = setTimeout(() => {
        setOverlay(null);
        setOverlayData(null);
      }, overlay === "goal" ? 4000 : 2500);
      return () => clearTimeout(timer);
    }
  }, [overlay]);

  if (!overlay || !overlayData) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
      {overlay === "goal" && (
        <div className="animate-fade-in text-center space-y-2 p-8 rounded-3xl"
          style={{
            background: "radial-gradient(ellipse at center, rgba(16, 185, 129, 0.2) 0%, transparent 70%)",
          }}>
          <div className="text-8xl animate-bounce">⚽</div>
          <div className="text-4xl md:text-6xl font-black text-white tracking-tight" style={{ textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
            GOAL!
          </div>
          <div className="text-xl md:text-2xl font-bold text-emerald-400">{overlayData.playerName}</div>
          {overlayData.assistName && (
            <div className="text-sm text-white/60">Assist: {overlayData.assistName}</div>
          )}
          <div className="text-xs text-white/40 uppercase tracking-widest">{overlayData.teamName}</div>
        </div>
      )}
      {overlay === "red_card" && (
        <div className="animate-fade-in text-center space-y-2 p-6 rounded-2xl"
          style={{
            background: "radial-gradient(ellipse at center, rgba(239, 68, 68, 0.25) 0%, transparent 70%)",
          }}>
          <div className="text-7xl">🟥</div>
          <div className="text-2xl font-black text-red-400">RED CARD</div>
          <div className="text-lg font-bold text-white">{overlayData.playerName}</div>
          <div className="text-xs text-white/40 uppercase tracking-widest">{overlayData.teamName}</div>
        </div>
      )}
      {overlay === "yellow_card" && (
        <div className="animate-fade-in text-center space-y-2 p-6 rounded-2xl"
          style={{
            background: "radial-gradient(ellipse at center, rgba(245, 158, 11, 0.2) 0%, transparent 70%)",
          }}>
          <div className="text-6xl">🟨</div>
          <div className="text-xl font-bold text-amber-400">{overlayData.playerName}</div>
          <div className="text-xs text-white/40 uppercase tracking-widest">{overlayData.teamName}</div>
        </div>
      )}
    </div>
  );
}
