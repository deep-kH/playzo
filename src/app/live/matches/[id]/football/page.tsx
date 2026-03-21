// ============================================================================
// Football Live View — Public page (Rebuilt V5)
// Ultra-modern real-time match display (PRIMARY events only)
// ============================================================================
"use client";

import { useParams } from "next/navigation";
import { useLiveMatch } from "@/features/realtime/useLiveMatch";
import type { FootballMatchState } from "@/features/scoring/football/types";
import { INITIAL_FOOTBALL_STATE, isPrimaryEvent, getEventIcon, getPhaseLabel } from "@/features/scoring/football/types";
import { FootballScorecard } from "@/features/scoring/football/components/FootballScorecard";
import { FootballMatchStats } from "@/features/scoring/football/components/FootballMatchStats";
import { FootballOverlayManager } from "@/features/scoring/football/components/FootballOverlayManager";
import { FootballMatchSummary } from "@/features/scoring/football/components/FootballMatchSummary";

export default function FootballLiveViewPage() {
  const params = useParams<{ id: string }>();
  const matchId = params?.id as string;

  const { state, match, teamAName, teamBName, loading, error } =
    useLiveMatch<FootballMatchState>({
      matchId,
      initialState: INITIAL_FOOTBALL_STATE,
    });

  const halfDuration = ((match as any)?.settings?.half_duration_minutes ?? (match as any)?.settings?.half_duration ?? 0) * 60;
  const teamALogo = (match as any)?.team_a?.logo_url || null;
  const teamBLogo = (match as any)?.team_b?.logo_url || null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        <p className="text-[var(--text-muted)] text-sm">Loading match...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-8">
        <div className="text-4xl">⚽</div>
        <h2 className="text-xl font-bold text-[var(--text)]">Match Not Found</h2>
        <p className="text-[var(--text-muted)] text-sm max-w-sm text-center">{error || "This match does not exist."}</p>
      </div>
    );
  }

  // Show post-match summary if ended
  if (state.phase === "ended") {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <div className="max-w-2xl mx-auto p-4 md:p-6">
          <FootballMatchSummary
            state={state}
            teamAName={teamAName}
            teamBName={teamBName}
            teamALogo={teamALogo}
            teamBLogo={teamBLogo}
          />
        </div>
      </div>
    );
  }

  // Primary events only for the public timeline
  const primaryEvents = (state.events || []).filter(e => isPrimaryEvent(e.type));

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Goal/Card Overlay */}
      <FootballOverlayManager state={state} teamAName={teamAName} teamBName={teamBName} />

      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">
        {/* Scorecard */}
        <FootballScorecard
          state={state}
          teamAName={teamAName}
          teamBName={teamBName}
          teamALogo={teamALogo}
          teamBLogo={teamBLogo}
          halfDurationSeconds={halfDuration}
        />

        {/* Live Timeline (PRIMARY events only) */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="font-bold text-sm uppercase tracking-widest text-[var(--text)] mb-3">📋 Match Events</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {primaryEvents.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] italic text-center py-4">
                {state.phase === "not_started" ? "Match hasn't started yet" : "No events yet"}
              </p>
            )}
            {[...primaryEvents].reverse().map((event, i) => {
              const min = Math.floor(event.match_time_seconds / 60);
              return (
                <div key={event.id || i} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-[var(--surface-alt)] border border-[var(--border)] animate-fade-in">
                  <span className="font-mono text-[var(--text-muted)] text-xs w-8 text-right">{min}&apos;</span>
                  <span className="text-lg">{getEventIcon(event.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-[var(--text)] truncate">
                      {event.player_name || event.type}
                    </div>
                    {event.assist_name && (
                      <div className="text-xs text-[var(--text-muted)]">Assist: {event.assist_name}</div>
                    )}
                    {event.details && event.details !== '' && (
                      <div className="text-xs text-[var(--text-muted)]">{event.details}</div>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
                    {event.team === "team_a" ? teamAName : event.team === "team_b" ? teamBName : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Penalty Shootout */}
        {state.penalties?.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="font-bold text-sm uppercase tracking-widest text-[var(--text)] mb-3">🥅 Penalty Shootout</h3>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <h4 className="text-xs font-bold text-[var(--text-muted)] mb-2">{teamAName}</h4>
                <div className="flex justify-center gap-2">
                  {state.penalties.filter(p => p.team === "team_a").map((p, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${p.scored ? "bg-emerald-500 text-white" : "bg-red-500/60 text-white/80"}`}>
                      {p.scored ? "✓" : "✕"}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-[var(--text-muted)] mb-2">{teamBName}</h4>
                <div className="flex justify-center gap-2">
                  {state.penalties.filter(p => p.team === "team_b").map((p, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${p.scored ? "bg-emerald-500 text-white" : "bg-red-500/60 text-white/80"}`}>
                      {p.scored ? "✓" : "✕"}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Match Stats */}
        <FootballMatchStats
          teamA={state.team_a_stats}
          teamB={state.team_b_stats}
          teamAName={teamAName}
          teamBName={teamBName}
        />
      </div>
    </div>
  );
}
