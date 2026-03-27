"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  getMatchById,
  getTeamsForMatch,
  getMatchStateByMatchId,
  getInningsByMatchAndNumber,
  listBattingStatsByInningsId,
  listBowlingStatsByInningsId,
  buildCricketState,
} from "@/features/scoring/cricket/api";
import { listPlayersForMatch } from "@/features/scoring/cricket/api";
import {
  processBall,
  undoLastBall,
  setNewBatter,
  setNewBowler,
  startSecondInnings,
} from "@/features/scoring/cricket/engine";
import type {
  Match,
  Team,
  Player,
  MatchState,
  Innings,
  BattingStats,
  BowlingStats,
  ExtraType,
  WicketType,
  Ball,
} from "@/lib/types/database";
import type { BallInput, CricketMatchState } from "@/features/scoring/cricket/types";
import { DEFAULT_CRICKET_STATE } from "@/features/scoring/cricket/types";
import { MatchSetup } from "@/features/scoring/cricket/components/MatchSetup";
import { ScoringHeader } from "@/features/scoring/cricket/components/ScoringHeader";
import { RunPanel } from "@/features/scoring/cricket/components/RunPanel";
import { ExtrasPanel } from "@/features/scoring/cricket/components/ExtrasPanel";
import { WicketPanel } from "@/features/scoring/cricket/components/WicketPanel";
import { BowlerSelector } from "@/features/scoring/cricket/components/BowlerSelector";
import { NewBatterSelector } from "@/features/scoring/cricket/components/NewBatterSelector";
import { supabase } from "@/lib/supabase/client";
import { CricketMatchResult } from "@/features/scoring/cricket/components/CricketMatchResult";

/* ── Phase type ─────────────────────────────────── */
type ScorerPhase =
  | "loading"
  | "setup"     // Match not started
  | "scoring"   // Normal ball-by-ball
  | "wicket"    // Wicket panel open
  | "new_batter"// Select next batter after wicket
  | "new_bowler"// Select bowler for new over
  | "innings_break" // Innings just ended
  | "completed";    // Match over

export default function CricketScorerPage() {
  const params = useParams();
  const matchId = params?.matchId as string;

  /* ── Core data ───── */
  const [match, setMatch] = useState<Match | null>(null);
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [innings, setInnings] = useState<Innings | null>(null);
  const [battingStats, setBattingStats] = useState<BattingStats[]>([]);
  const [bowlingStats, setBowlingStats] = useState<BowlingStats[]>([]);

  /* ── UI state ─────── */
  const [phase, setPhase] = useState<ScorerPhase>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBowlerId, setLastBowlerId] = useState<string | null>(null);

  /* ── Derived helpers ─ */
  const cricketState: CricketMatchState = buildCricketState(match, matchState, innings);

  const battingTeamId =
    innings?.batting_team_id ?? match?.team_a_id ?? "";
  const bowlingTeamId =
    innings?.bowling_team_id ?? match?.team_b_id ?? "";
  const battingTeamName =
    battingTeamId === match?.team_a_id ? teamA?.name ?? "Team A" : teamB?.name ?? "Team B";

  const totalOvers =
    (match?.settings as Record<string, number>)?.overs_per_innings ?? 20;
  const minBowlers =
    (match?.settings as Record<string, number>)?.min_bowlers ?? 5;
  const maxOversPerBowler = Math.ceil(totalOvers / minBowlers);

  const battingTeamPlayers = allPlayers.filter((p) => p.team_id === battingTeamId);
  const bowlingTeamPlayers = allPlayers.filter((p) => p.team_id === bowlingTeamId);

  const striker = allPlayers.find((p) => p.id === cricketState.striker) ?? null;
  const nonStriker = allPlayers.find((p) => p.id === cricketState.nonStriker) ?? null;
  const bowler = allPlayers.find((p) => p.id === cricketState.bowler) ?? null;

  const strikerStats = battingStats.find((s) => s.player_id === cricketState.striker) ?? null;
  const nonStrikerStats = battingStats.find((s) => s.player_id === cricketState.nonStriker) ?? null;
  const bowlerStatsObj = bowlingStats.find((s) => s.player_id === cricketState.bowler) ?? null;

  /* ── Need new bowler? (start of over = ballsInOver === 0 and overs > 0) ── */
  const needsNewBowler =
    phase === "scoring" &&
    cricketState.ballsInOver === 0 &&
    cricketState.overs > 0 &&
    !cricketState.bowler;

  /* ── Bowler Selection Constraints ── */
  // Determine if we MUST select a bowler who hasn't bowled yet to satisfy min_bowlers
  const distinctBowlerIds = new Set(
    bowlingStats
      .filter((s) => s.overs > 0 || s.runs_conceded > 0 || s.wides > 0 || s.no_balls > 0 || s.dot_balls > 0)
      .map((s) => s.player_id)
  );
  const remainingRequired = Math.max(0, minBowlers - distinctBowlerIds.size);
  const remainingOvers = Math.max(0, Math.floor(totalOvers - cricketState.overs));
  const mustUseNewBowler = remainingOvers <= remainingRequired && remainingRequired > 0;

  /* ── Need new batter? ── */
  const needsNewBatter =
    phase === "scoring" &&
    (!cricketState.striker || !cricketState.nonStriker) &&
    cricketState.wickets < 10;

  /* ═══════════════════════════════════════════════════
   *  DATA LOADING
   * ═══════════════════════════════════════════════════ */
  const loadData = useCallback(async () => {
    try {
      let m = match;
      if (!m) {
        m = await getMatchById(matchId);
        if (!m) { setError("Match not found."); return; }
        setMatch(m);
      }

      if (!teamA || !teamB) {
        const { teamA: tA, teamB: tB } = await getTeamsForMatch(m);
        if (tA) setTeamA(tA);
        if (tB) setTeamB(tB);
      }

      if (allPlayers.length === 0) {
        const players = await listPlayersForMatch(m);
        setAllPlayers(players);
      }

      const ms = await getMatchStateByMatchId(matchId);
      setMatchState(ms);

      // Evaluate phase based on relational state
      const initialSt = buildCricketState(m, ms, null);

      if (initialSt.matchStatus === "completed") {
        setPhase("completed");
      } else if (initialSt.matchStatus === "live" && ms?.current_innings_id) {
        // Load innings data
        const { data: innData } = await supabase
          .from("ls_innings")
          .select("*")
          .eq("id", ms.current_innings_id)
          .single();
        const inn = innData as Innings | null;
          
        if (inn) {
          setInnings(inn);
          const [bs, bws] = await Promise.all([
            listBattingStatsByInningsId(inn.id),
            listBowlingStatsByInningsId(inn.id),
          ]);
          setBattingStats(bs);
          setBowlingStats(bws);
        }

        // Re-evaluate state with innings
        const st = buildCricketState(m, ms, inn);

        // Derive lastBowlerId from the last completed over's balls
        if (inn && ms) {
          const { data: lastBallData } = await supabase
            .from("ls_balls")
            .select("bowler_id, over_number")
            .eq("innings_id", inn.id)
            .order("sequence", { ascending: false })
            .limit(1)
            .maybeSingle();
          const lbd = lastBallData as { bowler_id: string; over_number: number } | null;
          if (lbd && ms.current_ball === 0 && ms.current_over > 0) {
            setLastBowlerId(lbd.bowler_id);
          }
        }

        // Check if innings just ended or match completed
        if (st.matchStatus === "completed") {
          setPhase("completed");
        } else if (st.inningsStatus === "ended" && st.currentInningsNumber === 1) {
          setPhase("innings_break");
        } else if (st.inningsStatus === "ended" && st.currentInningsNumber === 2) {
          setPhase("completed");
        } else if (!st.striker || !st.nonStriker) {
          setPhase("new_batter");
        } else if (!st.bowler) {
          setPhase("new_bowler");
        } else {
          setPhase("scoring");
        }
      } else {
        setPhase("setup");
      }
    } catch (err) {
      console.error("Cricket scorer data load error:", err);
      setError((err as Error).message);
    }
  }, [matchId]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ═══════════════════════════════════════════════════
   *  REALTIME SUBSCRIPTION
   * ═══════════════════════════════════════════════════ */
  useEffect(() => {
    if (!matchId) return;
    const channel = supabase
      .channel(`scorer:ls_match_state:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ls_match_state",
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          // Reload all data on any state change — simple and reliable
          loadData();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId, loadData]);

  /* ═══════════════════════════════════════════════════
   *  ACTION HANDLERS
   * ═══════════════════════════════════════════════════ */

  const handleRun = async (runs: number) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const input: BallInput = {
        runsBat: runs,
        runsExtra: 0,
        extraType: null,
        isWicket: false,
        wicketType: null,
        wicketPlayerId: null,
        fielderId: null,
      };
      await processBall(matchId, input);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleExtra = async (extraType: ExtraType, totalExtraRuns: number) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const input: BallInput = {
        runsBat: 0,
        runsExtra: totalExtraRuns,
        extraType,
        isWicket: false,
        wicketType: null,
        wicketPlayerId: null,
        fielderId: null,
      };
      await processBall(matchId, input);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleWicket = async (
    wicketType: WicketType,
    dismissedPlayerId: string,
    fielderId: string | null,
    additionalRuns: number
  ) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const input: BallInput = {
        runsBat: additionalRuns,
        runsExtra: 0,
        extraType: null,
        isWicket: true,
        wicketType,
        wicketPlayerId: dismissedPlayerId,
        fielderId,
      };
      await processBall(matchId, input);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await undoLastBall(matchId);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSelectNewBatter = async (batterId: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const isStriker = !cricketState.striker;
      await setNewBatter(matchId, batterId, isStriker);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSelectNewBowler = async (bowlerId: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setLastBowlerId(cricketState.bowler);
      await setNewBowler(matchId, bowlerId);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleStartSecondInnings = async (
    openingStrikerId: string,
    openingNonStrikerId: string,
    openingBowlerId: string
  ) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await startSecondInnings(matchId, openingStrikerId, openingNonStrikerId, openingBowlerId);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /* ═══════════════════════════════════════════════════
   *  OVER TAPE (recent balls display)
   * ═══════════════════════════════════════════════════ */
  const overBalls: Ball[] = matchState?.balls_this_over ?? [];

  const ballLabel = (b: Ball): string => {
    if (b.is_wicket) return "W";
    if (b.extra_type === "wide") return `Wd${b.runs_extra > 1 ? "+" + (b.runs_extra - 1) : ""}`;
    if (b.extra_type === "no_ball") return `Nb${b.runs_bat > 0 ? "+" + b.runs_bat : ""}`;
    if (b.extra_type === "bye") return `B${b.runs_extra}`;
    if (b.extra_type === "leg_bye") return `Lb${b.runs_extra}`;
    return String(b.runs_bat);
  };

  const ballColor = (b: Ball): string => {
    if (b.is_wicket) return "bg-destructive text-white";
    if (b.runs_bat === 4) return "bg-primary/20 text-primary border-primary";
    if (b.runs_bat === 6) return "bg-accent/20 text-accent border-accent";
    if (b.extra_type) return "bg-warning/20 text-warning border-warning";
    if (b.runs_bat === 0) return "bg-surface-alt text-text-muted border-border-ui";
    return "bg-surface text-text border-border-ui";
  };

  /* ═══════════════════════════════════════════════════
   *  RENDER
   * ═══════════════════════════════════════════════════ */
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-text-muted text-sm">Loading cricket scorer...</p>
      </div>
    );
  }

  /* ── SETUP ───── */
  if (phase === "setup" && match && teamA && teamB) {
    return (
      <div className="container-app py-6">
        <h1 className="text-2xl font-bold text-text text-center mb-6">🏏 Match Setup</h1>
        <MatchSetup
          match={match}
          teamA={teamA}
          teamB={teamB}
          onComplete={() => loadData()}
        />
      </div>
    );
  }

  /* ── COMPLETED ───── */
  if (phase === "completed") {
    return (
      <div className="container-app py-6">
        <div className="max-w-3xl mx-auto">
          <CricketMatchResult matchId={matchId} />
        </div>
      </div>
    );
  }

  /* ── INNINGS BREAK ───── */
  if (phase === "innings_break" && match && teamA && teamB) {
    const inn1BattingTeamId = innings?.batting_team_id;
    const inn2BattingTeamName = inn1BattingTeamId === match.team_a_id
      ? teamB.name
      : teamA.name;
    const inn2BowlingTeamName = inn1BattingTeamId === match.team_a_id
      ? teamA.name
      : teamB.name;
    const inn2BattingPlayers = allPlayers.filter(
      (p) => p.team_id !== inn1BattingTeamId
    );
    const inn2BowlingPlayers = allPlayers.filter(
      (p) => p.team_id === inn1BattingTeamId
    );
    
    return (
      <div className="container-app py-6">
        <div className="max-w-lg mx-auto">
          <div className="card mb-4 text-center">
            <h2 className="text-xl font-bold text-text mb-2">Innings Break</h2>
            <p className="text-3xl font-bold text-primary">
              {battingTeamName}: {innings?.total_runs}/{innings?.total_wickets}
            </p>
            <p className="text-text-muted text-sm mt-1">
              ({innings?.total_overs} overs)
            </p>
            <p className="text-sm font-medium text-accent mt-2">
              Target: {(innings?.total_runs ?? 0) + 1}
            </p>
          </div>
          <InningsBreakSetup
            battingTeamName={inn2BattingTeamName}
            bowlingTeamName={inn2BowlingTeamName}
            battingPlayers={inn2BattingPlayers}
            bowlingPlayers={inn2BowlingPlayers}
            onStart={handleStartSecondInnings}
            busy={busy}
          />
        </div>
      </div>
    );
  }

  /* ── MAIN SCORING VIEW ───── */
  return (
    <div className="container-app py-4 space-y-4">
      {/* Header */}
      {innings && matchState && (
        <ScoringHeader
          innings={innings}
          matchState={matchState}
          striker={striker}
          nonStriker={nonStriker}
          bowler={bowler}
          strikerStats={strikerStats}
          nonStrikerStats={nonStrikerStats}
          bowlerStats={bowlerStatsObj}
          battingTeamName={battingTeamName}
          target={cricketState.target ?? null}
          maxOvers={totalOvers}
        />
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      )}

      {/* Over Tape */}
      {overBalls.length > 0 && (
        <div className="card !p-3">
          <h3 className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">
            This Over
          </h3>
          <div className="flex gap-2 flex-wrap">
            {overBalls.map((b, i) => (
              <div
                key={b.id ?? i}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 ${ballColor(b)}`}
              >
                {ballLabel(b)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase: New Bowler */}
      {(phase === "new_bowler" || needsNewBowler) && (
        <BowlerSelector
          bowlers={bowlingTeamPlayers}
          lastBowlerId={lastBowlerId ?? matchState?.current_bowler_id ?? null}
          maxOvers={maxOversPerBowler}
          bowlingStats={bowlingStats}
          mustUseNewBowler={mustUseNewBowler}
          usedBowlerIds={distinctBowlerIds}
          onSelect={handleSelectNewBowler}
        />
      )}

      {/* Phase: New Batter */}
      {(phase === "new_batter" || needsNewBatter) && (
        <NewBatterSelector
          availableBatters={battingTeamPlayers}
          battingStats={battingStats}
          onSelect={handleSelectNewBatter}
        />
      )}

      {/* Phase: Wicket Panel */}
      {phase === "wicket" && striker && nonStriker && (
        <WicketPanel
          bowlingTeamPlayers={bowlingTeamPlayers}
          strikerId={striker.id}
          nonStrikerId={nonStriker.id}
          strikerName={striker.name}
          nonStrikerName={nonStriker.name}
          onWicket={handleWicket}
          onCancel={() => setPhase("scoring")}
          disabled={busy}
        />
      )}

      {/* Phase: Normal Scoring */}
      {phase === "scoring" && !needsNewBowler && !needsNewBatter && (
        <div className="space-y-4">
          <RunPanel onRun={handleRun} disabled={busy} />
          <ExtrasPanel onExtra={handleExtra} disabled={busy} />

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPhase("wicket")}
              disabled={busy}
              className="btn-danger min-h-[3rem] rounded-xl text-base font-bold"
            >
              🔴 Wicket
            </button>
            <button
              onClick={handleUndo}
              disabled={busy}
              className="btn-secondary min-h-[3rem] rounded-xl text-base font-bold"
            >
              ↩ Undo
            </button>
          </div>
        </div>
      )}

      {/* Match Info Footer */}
      <div className="text-center text-xs text-[var(--text-muted)] pt-4">
        Innings {cricketState.currentInningsNumber} · {totalOvers} overs · Max {maxOversPerBowler} overs/bowler
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 justify-center pt-2">
        <a href={`/admin/tournaments/${match?.tournament_id}`} className="btn-secondary text-sm !h-8 !px-3 no-underline">
          ⬅ Dashboard
        </a>
        <a href={`/live/matches/${matchId}/cricket`} target="_blank" rel="noreferrer" className="btn-secondary text-sm !h-8 !px-3 no-underline">
          🏏 Live View
        </a>
        <a href={`/admin/tournaments/${match?.tournament_id}/cricket/stats`} className="btn-secondary text-sm !h-8 !px-3 no-underline">
          📊 Stats
        </a>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
 *  INNINGS BREAK SETUP (inline sub-component)
 * ═══════════════════════════════════════════════════ */
function InningsBreakSetup({
  battingTeamName,
  bowlingTeamName,
  battingPlayers,
  bowlingPlayers,
  onStart,
  busy,
}: {
  battingTeamName: string;
  bowlingTeamName: string;
  battingPlayers: Player[];
  bowlingPlayers: Player[];
  onStart: (strikerId: string, nonStrikerId: string, bowlerId: string) => void;
  busy: boolean;
}) {
  const [strikerId, setStrikerId] = useState("");
  const [nonStrikerId, setNonStrikerId] = useState("");
  const [bowlerId, setBowlerId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const handleGo = () => {
    if (!strikerId || !nonStrikerId || !bowlerId) {
      setErr("Select all opening players.");
      return;
    }
    if (strikerId === nonStrikerId) {
      setErr("Striker and non-striker must differ.");
      return;
    }
    setErr(null);
    onStart(strikerId, nonStrikerId, bowlerId);
  };

  return (
    <div className="card animate-fade-in space-y-4">
      <h3 className="font-bold text-text">2nd Innings — Opening Players</h3>

      {/* Striker */}
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">
          Striker ({battingTeamName})
        </label>
        <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
          {battingPlayers.map((p) => (
            <button
              key={p.id}
              onClick={() => setStrikerId(p.id)}
              className={`p-3 rounded-lg text-sm font-semibold transition-colors ${
                strikerId === p.id
                  ? "bg-primary text-white"
                  : "bg-surface border border-border-ui text-text hover:bg-surface-alt"
              } ${p.id === nonStrikerId ? "opacity-50 pointer-events-none" : ""}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Non-Striker */}
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">
          Non-Striker ({battingTeamName})
        </label>
        <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
          {battingPlayers.map((p) => (
            <button
              key={p.id}
              onClick={() => setNonStrikerId(p.id)}
              className={`p-3 rounded-lg text-sm font-semibold transition-colors ${
                nonStrikerId === p.id
                  ? "bg-primary text-white"
                  : "bg-surface border border-border-ui text-text hover:bg-surface-alt"
              } ${p.id === strikerId ? "opacity-50 pointer-events-none" : ""}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bowler */}
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">
          Opening Bowler ({bowlingTeamName})
        </label>
        <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
          {bowlingPlayers.map((p) => (
            <button
              key={p.id}
              onClick={() => setBowlerId(p.id)}
              className={`p-3 rounded-lg text-sm font-semibold transition-colors ${
                bowlerId === p.id
                  ? "bg-primary text-white"
                  : "bg-surface border border-border-ui text-text hover:bg-surface-alt"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {err && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
          <p className="text-sm text-destructive font-medium">{err}</p>
        </div>
      )}

      <button onClick={handleGo} disabled={busy} className="btn-primary w-full">
        {busy ? "Starting..." : "🏏 Start 2nd Innings"}
      </button>
    </div>
  );
}
