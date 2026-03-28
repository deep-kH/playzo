"use client";

import { useParams } from "next/navigation";
import { useCricketState } from "@/features/scoring/cricket/hooks/useCricketState";
import { MatchSetup } from "@/features/scoring/cricket/components/MatchSetup";
import { ScoringHeader } from "@/features/scoring/cricket/components/ScoringHeader";
import { RunPanel } from "@/features/scoring/cricket/components/RunPanel";
import { ExtrasPanel } from "@/features/scoring/cricket/components/ExtrasPanel";
import { WicketPanel } from "@/features/scoring/cricket/components/WicketPanel";
import { BowlerSelector } from "@/features/scoring/cricket/components/BowlerSelector";
import { NewBatterSelector } from "@/features/scoring/cricket/components/NewBatterSelector";
import { InningsBreakSetup } from "@/features/scoring/cricket/components/InningsBreakSetup";
import { CricketMatchResult } from "@/features/scoring/cricket/components/CricketMatchResult";

/**
 * CricketScorerPage — Pure presentation component.
 *
 * ALL state, data fetching, and action handling lives in useCricketState.
 * This component ONLY renders UI based on the hook's return values.
 * No useEffect, no useState, no async logic here.
 */
export default function CricketScorerPage() {
  const params = useParams();
  const matchId = params?.matchId as string;

  const s = useCricketState(matchId);

  /* ── Loading ───── */
  if (s.loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-text-muted text-sm">Loading cricket scorer...</p>
      </div>
    );
  }

  /* ── Error ───── */
  if (s.error && !s.match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-8">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-bold text-text">Unable to Load Match</h2>
        <p className="text-text-muted text-sm max-w-sm text-center">{s.error}</p>
      </div>
    );
  }

  /* ── Setup ───── */
  if (s.phase === "setup" && s.match && s.teamA && s.teamB) {
    return (
      <div className="container-app py-6">
        <h1 className="text-2xl font-bold text-text text-center mb-6">🏏 Match Setup</h1>
        <MatchSetup
          match={s.match}
          teamA={s.teamA}
          teamB={s.teamB}
          onComplete={() => s.loadData()}
        />
      </div>
    );
  }

  /* ── Completed ───── */
  if (s.phase === "completed") {
    return (
      <div className="container-app py-6">
        <div className="max-w-3xl mx-auto">
          <CricketMatchResult matchId={matchId} />
        </div>
      </div>
    );
  }

  /* ── Innings Break ───── */
  if (s.phase === "innings_break" && s.match && s.teamA && s.teamB) {
    const inn1BattingTeamId = s.innings?.batting_team_id;
    const inn2BattingTeamName =
      inn1BattingTeamId === s.match.team_a_id ? s.teamB.name : s.teamA.name;
    const inn2BowlingTeamName =
      inn1BattingTeamId === s.match.team_a_id ? s.teamA.name : s.teamB.name;
    const inn2BattingPlayers = s.allPlayers.filter(
      (p) => p.team_id !== inn1BattingTeamId
    );
    const inn2BowlingPlayers = s.allPlayers.filter(
      (p) => p.team_id === inn1BattingTeamId
    );

    return (
      <div className="container-app py-6">
        <div className="max-w-lg mx-auto">
          <div className="card mb-4 text-center">
            <h2 className="text-xl font-bold text-text mb-2">Innings Break</h2>
            <p className="text-3xl font-bold text-primary">
              {s.battingTeamName}: {s.innings?.total_runs}/{s.innings?.total_wickets}
            </p>
            <p className="text-text-muted text-sm mt-1">
              ({s.innings?.total_overs} overs)
            </p>
            <p className="text-sm font-medium text-accent mt-2">
              Target: {(s.innings?.total_runs ?? 0) + 1}
            </p>
          </div>
          <InningsBreakSetup
            battingTeamName={inn2BattingTeamName}
            bowlingTeamName={inn2BowlingTeamName}
            battingPlayers={inn2BattingPlayers}
            bowlingPlayers={inn2BowlingPlayers}
            onStart={s.handleStartSecondInnings}
            busy={s.busy}
          />
        </div>
      </div>
    );
  }

  /* ── Main Scoring View ───── */
  return (
    <div className="container-app py-4 space-y-4">
      {/* Header */}
      {s.innings && s.matchState && (
        <ScoringHeader
          innings={s.innings}
          matchState={s.matchState}
          striker={s.striker}
          nonStriker={s.nonStriker}
          bowler={s.bowler}
          strikerStats={s.strikerStats}
          nonStrikerStats={s.nonStrikerStats}
          bowlerStats={s.bowlerStats}
          battingTeamName={s.battingTeamName}
          target={s.cricketState.target ?? null}
          maxOvers={s.totalOvers}
        />
      )}

      {/* Error banner */}
      {s.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
          <p className="text-sm text-destructive font-medium">{s.error}</p>
        </div>
      )}

      {/* Over Tape */}
      {s.overBalls.length > 0 && (
        <div className="card !p-3">
          <h3 className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">
            This Over
          </h3>
          <div className="flex gap-2 flex-wrap">
            {s.overBalls.map((b, i) => (
              <div
                key={b.id ?? i}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 ${s.ballColor(b)}`}
              >
                {s.ballLabel(b)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase: New Bowler */}
      {(s.phase === "new_bowler" || s.needsNewBowler) && (
        <BowlerSelector
          bowlers={s.bowlingTeamPlayers}
          lastBowlerId={s.lastBowlerId ?? s.matchState?.current_bowler_id ?? null}
          maxOvers={s.maxOversPerBowler}
          bowlingStats={s.bowlingStats}
          mustUseNewBowler={s.mustUseNewBowler}
          usedBowlerIds={s.distinctBowlerIds}
          onSelect={s.handleSelectNewBowler}
        />
      )}

      {/* Phase: New Batter */}
      {(s.phase === "new_batter" || s.needsNewBatter) && (
        <NewBatterSelector
          availableBatters={s.battingTeamPlayers}
          battingStats={s.battingStats}
          currentBatterIds={[s.cricketState.striker, s.cricketState.nonStriker].filter(Boolean) as string[]}
          onSelect={s.handleSelectNewBatter}
        />
      )}

      {/* Phase: Wicket Panel */}
      {s.phase === "wicket" && s.striker && s.nonStriker && (
        <WicketPanel
          bowlingTeamPlayers={s.bowlingTeamPlayers}
          strikerId={s.striker.id}
          nonStrikerId={s.nonStriker.id}
          strikerName={s.striker.name}
          nonStrikerName={s.nonStriker.name}
          onWicket={s.handleWicket}
          onCancel={() => s.setPhase("scoring")}
          disabled={s.busy}
        />
      )}

      {/* Phase: Normal Scoring */}
      {s.phase === "scoring" && !s.needsNewBowler && !s.needsNewBatter && (
        <div className="space-y-4">
          <RunPanel onRun={s.handleRun} disabled={s.busy} />
          <ExtrasPanel onExtra={s.handleExtra} disabled={s.busy} />

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => s.setPhase("wicket")}
              disabled={s.busy}
              className="btn-danger min-h-[3rem] rounded-xl text-base font-bold"
            >
              🔴 Wicket
            </button>
            <button
              onClick={s.handleUndo}
              disabled={s.busy}
              className="btn-secondary min-h-[3rem] rounded-xl text-base font-bold"
            >
              ↩ Undo
            </button>
          </div>
        </div>
      )}

      {/* Match Info Footer */}
      <div className="text-center text-xs text-[var(--text-muted)] pt-4">
        Innings {s.cricketState.currentInningsNumber} · {s.totalOvers} overs · Max {s.maxOversPerBowler} overs/bowler
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 justify-center pt-2">
        <a href={`/admin/tournaments/${s.match?.tournament_id}`} className="btn-secondary text-sm !h-8 !px-3 no-underline">
          ⬅ Dashboard
        </a>
        <a href={`/live/matches/${matchId}/cricket`} target="_blank" rel="noreferrer" className="btn-secondary text-sm !h-8 !px-3 no-underline">
          🏏 Live View
        </a>
        <a href={`/admin/tournaments/${s.match?.tournament_id}/cricket/stats`} className="btn-secondary text-sm !h-8 !px-3 no-underline">
          📊 Stats
        </a>
      </div>
    </div>
  );
}
