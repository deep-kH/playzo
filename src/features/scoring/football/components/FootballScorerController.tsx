// src/features/scoring/football/components/FootballScorerController.tsx
"use client";

import React, { useState } from "react";
import { processGenericEvent } from "../../api";
import type { FootballEventType, FootballMatchState, FootballTeam, MatchPhase, FootballMatchEvent, PenaltyKick } from "../types";
import { phaseLabel } from "../types";
import { getPhaseActions, useFootballClock } from "../hooks";

// ─── Shared styles ──────────────────────────────────────────────────────
const btn = {
  primary:
    "flex items-center justify-center gap-2 h-14 px-5 rounded-xl font-semibold text-white bg-[var(--success)] hover:brightness-110 active:scale-95 touch-manipulation disabled:opacity-50 transition-all",
  secondary:
    "flex items-center justify-center gap-2 h-14 px-5 rounded-xl font-semibold border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-alt)] active:scale-95 touch-manipulation disabled:opacity-50 transition-all",
  danger:
    "flex items-center justify-center gap-2 h-14 px-5 rounded-xl font-semibold text-white bg-[var(--danger)] hover:brightness-110 active:scale-95 touch-manipulation disabled:opacity-50 transition-all",
  quickAction: (color: string) =>
    `flex flex-col items-center justify-center gap-1 h-20 rounded-xl font-semibold border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-alt)] hover:border-[var(--${color})] active:scale-95 touch-manipulation disabled:opacity-50 transition-all`,
  teamEvent:
    "flex items-center justify-center gap-2 h-12 rounded-xl font-medium bg-[var(--surface-alt)] text-[var(--text)] border border-[var(--border)] hover:brightness-95 active:scale-95 touch-manipulation disabled:opacity-50 transition-all",
};

// ─── Section wrapper ────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-[0_2px_8px_var(--shadow)]">
      <div className="px-4 py-3 bg-[var(--surface-alt)] border-b border-[var(--border)]">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)]">
          {title}
        </h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Main Controller ────────────────────────────────────────────────────
export function FootballScorerController({
  matchId,
  state,
  teamAName,
  teamBName,
}: {
  matchId: string;
  state: FootballMatchState;
  teamAName?: string;
  teamBName?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<null | "goal" | "foul" | "sub" | "stoppage">(null);
  const [modalTeam, setModalTeam] = useState<FootballTeam>("team_a");
  const [toast, setToast] = useState<string | null>(null);

  const tA = teamAName ?? "Team A";
  const tB = teamBName ?? "Team B";

  const dispatch = async (type: FootballEventType, payload: Record<string, unknown> = {}) => {
    // Confirm critical actions
    const needsConfirm = ["match_end", "red_card", "full_time", "half_time"].includes(type);
    if (needsConfirm && !confirm(`Confirm: ${type.replace(/_/g, " ").toUpperCase()}?`)) return;

    try {
      setLoading(true);
      await processGenericEvent(matchId, type, payload as any);
      showToast(`${type.replace(/_/g, " ")} recorded`);
    } catch (err: any) {
      alert("Action Failed: " + err.message);
    } finally {
      setLoading(false);
      setActiveModal(null);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const isLive = ["first_half", "second_half", "extra_time_first", "extra_time_second"].includes(state.phase);
  const isPenalties = state.phase === "penalty_shootout";

  return (
    <div className="space-y-5">
      {/* ── Toast ──────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--text)] text-[var(--surface)] px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-[fadeIn_0.2s_ease]">
          {toast}
        </div>
      )}

      {/* ── §3  Match Control Panel ──────────────────── */}
      <Section title="Match Controls">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Phase
          </span>
          <span className="text-xs font-mono font-bold text-[var(--primary)] uppercase">
            {phaseLabel(state.phase)}
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          {getPhaseActions(state.phase, state.clock_running).map((a) => (
            <button
              key={a.event}
              disabled={loading}
              onClick={() => {
                if (a.event === "extra_time_added") {
                  setActiveModal("stoppage");
                } else {
                  dispatch(a.event as FootballEventType);
                }
              }}
              className={`flex-1 min-w-[140px] ${btn[a.variant]}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </Section>

      {/* ── §5  Quick Actions Panel ──────────────────── */}
      {isLive && (
        <Section title="Quick Actions">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <button disabled={loading} onClick={() => { setModalTeam("team_a"); setActiveModal("goal"); }} className={btn.quickAction("success")}>
              <span className="text-xl">⚽</span><span className="text-xs">Goal</span>
            </button>
            <button disabled={loading} onClick={() => dispatch("yellow_card", { team: "team_a" })} className={btn.quickAction("warning")}>
              <span className="text-xl">🟨</span><span className="text-xs">Yellow</span>
            </button>
            <button disabled={loading} onClick={() => dispatch("red_card", { team: "team_a" })} className={btn.quickAction("danger")}>
              <span className="text-xl">🟥</span><span className="text-xs">Red</span>
            </button>
            <button disabled={loading} onClick={() => { setModalTeam("team_a"); setActiveModal("foul"); }} className={btn.quickAction("warning")}>
              <span className="text-xl">⚠</span><span className="text-xs">Foul</span>
            </button>
            <button disabled={loading} onClick={() => dispatch("offside", { team: "team_a" })} className={btn.quickAction("danger")}>
              <span className="text-xl">🚫</span><span className="text-xs">Offside</span>
            </button>
            <button disabled={loading} onClick={() => { setModalTeam("team_a"); setActiveModal("sub"); }} className={btn.quickAction("primary")}>
              <span className="text-xl">🔄</span><span className="text-xs">Sub</span>
            </button>
          </div>
        </Section>
      )}

      {/* ── §6  Player-Level Actions (Team A / Team B) ── */}
      {isLive && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TeamActionPanel
            title={tA}
            teamId="team_a"
            loading={loading}
            onGoal={() => { setModalTeam("team_a"); setActiveModal("goal"); }}
            onFoul={() => { setModalTeam("team_a"); setActiveModal("foul"); }}
            onSub={() => { setModalTeam("team_a"); setActiveModal("sub"); }}
            dispatch={dispatch}
          />
          <TeamActionPanel
            title={tB}
            teamId="team_b"
            loading={loading}
            onGoal={() => { setModalTeam("team_b"); setActiveModal("goal"); }}
            onFoul={() => { setModalTeam("team_b"); setActiveModal("foul"); }}
            onSub={() => { setModalTeam("team_b"); setActiveModal("sub"); }}
            dispatch={dispatch}
          />
        </div>
      )}

      {/* ── §10  Team Events Panel ───────────────────── */}
      {isLive && (
        <Section title="Team Events">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(["team_a", "team_b"] as const).map((t) => (
              <React.Fragment key={t}>
                <button disabled={loading} onClick={() => dispatch("corner", { team: t })} className={btn.teamEvent}>
                  🚩 Corner ({t === "team_a" ? tA : tB})
                </button>
              </React.Fragment>
            ))}
            {(["team_a", "team_b"] as const).map((t) => (
              <React.Fragment key={`gk-${t}`}>
                <button disabled={loading} onClick={() => dispatch("goal_kick", { team: t })} className={btn.teamEvent}>
                  🥅 Goal Kick ({t === "team_a" ? tA : tB})
                </button>
              </React.Fragment>
            ))}
            {(["team_a", "team_b"] as const).map((t) => (
              <React.Fragment key={`ti-${t}`}>
                <button disabled={loading} onClick={() => dispatch("throw_in", { team: t })} className={btn.teamEvent}>
                  🤾 Throw-in ({t === "team_a" ? tA : tB})
                </button>
              </React.Fragment>
            ))}
          </div>
        </Section>
      )}

      {/* ── §14  Penalty Shootout ─────────────────────── */}
      {isPenalties && (
        <PenaltyShootoutPanel
          teamAName={tA}
          teamBName={tB}
          penalties={state.penalties ?? []}
          loading={loading}
          dispatch={dispatch}
        />
      )}

      {/* ── §11  Timeline Panel ──────────────────────── */}
      {(state.events?.length ?? 0) > 0 && (
        <Section title="Timeline">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {[...(state.events ?? [])].reverse().map((evt, i) => (
              <TimelineRow key={evt.id ?? i} evt={evt} teamAName={tA} teamBName={tB} />
            ))}
          </div>
        </Section>
      )}

      {/* ── §15  Quick Stats ─────────────────────────── */}
      <QuickStats state={state} teamAName={tA} teamBName={tB} />

      {/* ── Modals ──────────────────────────────────── */}
      {activeModal === "goal" && (
        <GoalModal
          team={modalTeam}
          teamName={modalTeam === "team_a" ? tA : tB}
          loading={loading}
          onSubmit={(payload) => dispatch("goal", { team: modalTeam, ...payload })}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "foul" && (
        <FoulModal
          team={modalTeam}
          teamName={modalTeam === "team_a" ? tA : tB}
          opponentName={modalTeam === "team_a" ? tB : tA}
          loading={loading}
          onSubmit={(type, payload) => dispatch(type, { team: modalTeam, ...payload })}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "sub" && (
        <SubModal
          team={modalTeam}
          teamName={modalTeam === "team_a" ? tA : tB}
          loading={loading}
          onSubmit={(payload) => dispatch("substitution", { team: modalTeam, ...payload })}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "stoppage" && (
        <StoppageModal
          loading={loading}
          onSubmit={(mins) => dispatch("extra_time_added", { extra_minutes: mins })}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}

// ─── Team Action Panel ──────────────────────────────────────────────────
function TeamActionPanel({
  title, teamId, loading, onGoal, onFoul, onSub, dispatch,
}: {
  title: string;
  teamId: FootballTeam;
  loading: boolean;
  onGoal: () => void;
  onFoul: () => void;
  onSub: () => void;
  dispatch: (type: FootballEventType, payload?: Record<string, unknown>) => void;
}) {
  return (
    <Section title={title}>
      <div className="grid grid-cols-2 gap-2">
        <button disabled={loading} onClick={onGoal} className="col-span-2 flex items-center justify-center gap-2 h-16 rounded-xl font-bold text-white text-lg bg-[var(--success)] hover:brightness-110 active:scale-95 touch-manipulation disabled:opacity-50 transition-all">
          ⚽ Goal
        </button>
        <button disabled={loading} onClick={() => dispatch("shot_on_target", { team: teamId })} className={btn.secondary + " text-sm"}>Shot On</button>
        <button disabled={loading} onClick={() => dispatch("shot_off_target", { team: teamId })} className={btn.secondary + " text-sm"}>Shot Off</button>
        <button disabled={loading} onClick={() => dispatch("corner", { team: teamId })} className={btn.teamEvent}>🚩 Corner</button>
        <button disabled={loading} onClick={() => dispatch("offside", { team: teamId })} className={btn.teamEvent}>🚫 Offside</button>
        <button disabled={loading} onClick={onFoul} className="h-12 rounded-xl font-semibold border border-[var(--warning)] bg-[var(--surface)] text-[var(--warning)] hover:bg-[var(--surface-alt)] active:scale-95 touch-manipulation disabled:opacity-50 transition-all">⚠ Foul</button>
        <button disabled={loading} onClick={onSub} className="h-12 rounded-xl font-semibold border border-[var(--primary)] bg-[var(--surface)] text-[var(--primary)] hover:bg-[var(--surface-alt)] active:scale-95 touch-manipulation disabled:opacity-50 transition-all">🔄 Sub</button>
        <button disabled={loading} onClick={() => dispatch("yellow_card", { team: teamId })} className="h-12 rounded-xl font-semibold border border-[var(--warning)] bg-[var(--surface)] text-[var(--warning)] hover:bg-[var(--surface-alt)] active:scale-95 touch-manipulation disabled:opacity-50 transition-all">🟨 Yellow</button>
        <button disabled={loading} onClick={() => dispatch("red_card", { team: teamId })} className="h-12 rounded-xl font-semibold border border-[var(--danger)] bg-[var(--surface)] text-[var(--danger)] hover:bg-[var(--surface-alt)] active:scale-95 touch-manipulation disabled:opacity-50 transition-all">🟥 Red</button>
      </div>
    </Section>
  );
}

// ─── Timeline Row ───────────────────────────────────────────────────────
function TimelineRow({ evt, teamAName, teamBName }: { evt: FootballMatchEvent; teamAName: string; teamBName: string }) {
  const mins = Math.floor(evt.match_time_seconds / 60);
  const stoppage = evt.stoppage_time_seconds ? `+${Math.floor(evt.stoppage_time_seconds / 60)}` : "";
  const teamName = evt.team === "team_a" ? teamAName : evt.team === "team_b" ? teamBName : "";

  const icons: Record<string, string> = {
    goal: "⚽", own_goal: "⚽🔴", penalty_goal: "⚽(P)", penalty_miss: "❌(P)",
    yellow_card: "🟨", red_card: "🟥", substitution: "🔄",
    foul: "⚠", corner: "🚩", offside: "🚫", free_kick: "🎯",
    shot_on_target: "🎯", shot_off_target: "💨",
  };
  const icon = icons[evt.type] ?? "📝";

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] text-sm">
      <span className="font-mono font-bold text-[var(--text-muted)] w-14 text-right shrink-0">
        {mins}&apos;{stoppage}
      </span>
      <span className="text-base">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-[var(--text)]">{teamName}</span>
        {evt.player_name && <span className="text-[var(--text-muted)]"> — {evt.player_name}</span>}
        {evt.assist_name && <span className="text-[var(--text-muted)]"> (Assist: {evt.assist_name})</span>}
        {evt.details && <span className="text-[var(--text-muted)]"> · {evt.details}</span>}
      </div>
    </div>
  );
}

// ─── Penalty Shootout Panel ─────────────────────────────────────────────
function PenaltyShootoutPanel({
  teamAName, teamBName, penalties, loading, dispatch,
}: {
  teamAName: string;
  teamBName: string;
  penalties: PenaltyKick[];
  loading: boolean;
  dispatch: (type: FootballEventType, payload?: Record<string, unknown>) => void;
}) {
  const aKicks = penalties.filter((p) => p.team === "team_a");
  const bKicks = penalties.filter((p) => p.team === "team_b");

  return (
    <Section title="Penalty Shootout">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-bold text-[var(--text)] mb-3">{teamAName}</h4>
          <div className="flex gap-2 flex-wrap mb-3">
            {aKicks.map((k, i) => (
              <span key={i} className={`text-2xl ${k.scored ? "" : "opacity-50"}`}>
                {k.scored ? "⚽" : "❌"}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <button disabled={loading} onClick={() => dispatch("penalty_goal", { team: "team_a" })} className={btn.primary + " flex-1 text-sm"}>⚽ Scored</button>
            <button disabled={loading} onClick={() => dispatch("penalty_miss", { team: "team_a" })} className={btn.danger + " flex-1 text-sm"}>❌ Missed</button>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-bold text-[var(--text)] mb-3">{teamBName}</h4>
          <div className="flex gap-2 flex-wrap mb-3">
            {bKicks.map((k, i) => (
              <span key={i} className={`text-2xl ${k.scored ? "" : "opacity-50"}`}>
                {k.scored ? "⚽" : "❌"}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <button disabled={loading} onClick={() => dispatch("penalty_goal", { team: "team_b" })} className={btn.primary + " flex-1 text-sm"}>⚽ Scored</button>
            <button disabled={loading} onClick={() => dispatch("penalty_miss", { team: "team_b" })} className={btn.danger + " flex-1 text-sm"}>❌ Missed</button>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Quick Stats ────────────────────────────────────────────────────────
function QuickStats({ state, teamAName, teamBName }: { state: FootballMatchState; teamAName: string; teamBName: string }) {
  const { team_a_stats: a, team_b_stats: b } = state;
  const rows = [
    { label: "Shots On", a: a.shots_on_target, b: b.shots_on_target },
    { label: "Shots Off", a: a.shots_off_target, b: b.shots_off_target },
    { label: "Corners", a: a.corners, b: b.corners },
    { label: "Fouls", a: a.fouls, b: b.fouls },
    { label: "Offsides", a: a.offsides, b: b.offsides },
    { label: "Yellow", a: a.yellow_cards, b: b.yellow_cards },
    { label: "Red", a: a.red_cards, b: b.red_cards },
  ];

  return (
    <Section title="Match Stats">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-x-4 gap-y-2 text-sm">
        <div className="text-center font-bold text-[var(--text)]">{teamAName}</div>
        <div />
        <div className="text-center font-bold text-[var(--text)]">{teamBName}</div>
        {rows.map((r) => (
          <React.Fragment key={r.label}>
            <div className="text-center font-semibold tabular-nums text-[var(--text)]">{r.a}</div>
            <div className="text-center text-[var(--text-muted)] text-xs">{r.label}</div>
            <div className="text-center font-semibold tabular-nums text-[var(--text)]">{r.b}</div>
          </React.Fragment>
        ))}
      </div>
    </Section>
  );
}

// ─── MODAL: Goal ────────────────────────────────────────────────────────
function GoalModal({
  team, teamName, loading, onSubmit, onClose,
}: {
  team: FootballTeam;
  teamName: string;
  loading: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [playerName, setPlayerName] = useState("");
  const [assistName, setAssistName] = useState("");

  return (
    <ModalShell title={`⚽ Goal — ${teamName}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">Scorer</label>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Player name (optional)"
            className="w-full h-12 px-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">Assist</label>
          <input
            value={assistName}
            onChange={(e) => setAssistName(e.target.value)}
            placeholder="Assist player (optional)"
            className="w-full h-12 px-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
          />
        </div>
        <button
          disabled={loading}
          onClick={() => onSubmit({ player_name: playerName || undefined, assist_player_name: assistName || undefined })}
          className={btn.primary + " w-full"}
        >
          {loading ? "Saving..." : "Save Goal"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── MODAL: Foul ────────────────────────────────────────────────────────
function FoulModal({
  team, teamName, opponentName, loading, onSubmit, onClose,
}: {
  team: FootballTeam;
  teamName: string;
  opponentName: string;
  loading: boolean;
  onSubmit: (type: FootballEventType, payload: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [card, setCard] = useState<"none" | "yellow" | "red">("none");
  const [outcome, setOutcome] = useState<"free_kick" | "penalty" | "advantage">("free_kick");

  const submit = () => {
    const eventType: FootballEventType = card === "yellow" ? "yellow_card" : card === "red" ? "red_card" : "foul";
    onSubmit(eventType, { card, foul_outcome: outcome });
  };

  return (
    <ModalShell title={`⚠ Foul — ${teamName}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-2">Card Decision</label>
          <div className="flex gap-2">
            {(["none", "yellow", "red"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCard(c)}
                className={`flex-1 h-12 rounded-xl font-semibold capitalize transition-all active:scale-95 ${
                  card === c
                    ? c === "yellow" ? "bg-[var(--warning)] text-white"
                    : c === "red" ? "bg-[var(--danger)] text-white"
                    : "bg-[var(--primary)] text-white"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                }`}
              >
                {c === "none" ? "No Card" : c === "yellow" ? "🟨 Yellow" : "🟥 Red"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-2">Outcome</label>
          <div className="flex gap-2">
            {(["free_kick", "penalty", "advantage"] as const).map((o) => (
              <button
                key={o}
                onClick={() => setOutcome(o)}
                className={`flex-1 h-12 rounded-xl font-semibold capitalize transition-all active:scale-95 ${
                  outcome === o
                    ? "bg-[var(--primary)] text-white"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                }`}
              >
                {o.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
        <button disabled={loading} onClick={submit} className={btn.primary + " w-full"}>
          {loading ? "Saving..." : "Record Foul"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── MODAL: Substitution ────────────────────────────────────────────────
function SubModal({
  team, teamName, loading, onSubmit, onClose,
}: {
  team: FootballTeam;
  teamName: string;
  loading: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [outName, setOutName] = useState("");
  const [inName, setInName] = useState("");

  return (
    <ModalShell title={`🔄 Substitution — ${teamName}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">Player OUT</label>
          <input
            value={outName}
            onChange={(e) => setOutName(e.target.value)}
            placeholder="Player going off"
            className="w-full h-12 px-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--danger)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">Player IN</label>
          <input
            value={inName}
            onChange={(e) => setInName(e.target.value)}
            placeholder="Player coming on"
            className="w-full h-12 px-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--success)]"
          />
        </div>
        <button
          disabled={loading || (!outName && !inName)}
          onClick={() => onSubmit({ sub_out_name: outName || undefined, sub_in_name: inName || undefined })}
          className={btn.primary + " w-full"}
        >
          {loading ? "Saving..." : "Confirm Sub"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── MODAL: Stoppage Time ───────────────────────────────────────────────
function StoppageModal({
  loading, onSubmit, onClose,
}: {
  loading: boolean;
  onSubmit: (mins: number) => void;
  onClose: () => void;
}) {
  const [mins, setMins] = useState(3);

  return (
    <ModalShell title="⏱ Add Stoppage Time" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setMins(Math.max(1, mins - 1))} className={btn.secondary + " w-14"}>−</button>
          <span className="text-4xl font-bold tabular-nums text-[var(--text)] min-w-[60px] text-center">{mins}</span>
          <button onClick={() => setMins(mins + 1)} className={btn.secondary + " w-14"}>+</button>
        </div>
        <p className="text-center text-sm text-[var(--text-muted)]">minutes of stoppage time</p>
        <button disabled={loading} onClick={() => { onSubmit(mins); onClose(); }} className={btn.primary + " w-full"}>
          {loading ? "Adding..." : `Add +${mins} min`}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Modal Shell ────────────────────────────────────────────────────────
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/50 animate-[fadeIn_0.15s_ease]" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[var(--surface)] rounded-t-2xl md:rounded-2xl p-6 shadow-2xl border border-[var(--border)] animate-[slideUp_0.2s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[var(--text)]">{title}</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
