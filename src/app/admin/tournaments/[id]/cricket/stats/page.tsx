"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { Player, Team, BattingStats, BowlingStats } from "@/lib/types/database";
import { getTeamColor } from "@/lib/teamColors";
import { toRealOvers, formatOvers } from "@/features/scoring/cricket/oversUtils";

/* ── Types ── */
interface PlayerAgg {
  playerId: string;
  playerName: string;
  playerPhoto: string | null;
  teamName: string;
  teamLogo: string | null;
  teamColor: string;
  runs: number;
  fours: number;
  sixes: number;
  balls: number;
  innings: number;
  matches: number;
  highScore: number;
  notOuts: number;
  wickets: number;
  oversBowled: number;
  runsConceded: number;
  dotBalls: number;
  maidens: number;
  catches: number;
  runOuts: number;
}

/* ── MVP formula weights ── */
const MVP_WEIGHTS = {
  runs: 1,
  fours: 0.5,
  sixes: 1,
  wickets: 25,
  catches: 10,
  runOuts: 15,
  dotBalls: 0.5,
  maidens: 10,
};

type Category =
  | "orange_cap"
  | "purple_cap"
  | "most_sixes"
  | "most_fours"
  | "best_fielder"
  | "most_dots"
  | "best_economy"
  | "mvp";

const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: "mvp", label: "MVP", emoji: "🏆" },
  { id: "orange_cap", label: "Orange Cap", emoji: "🧢" },
  { id: "purple_cap", label: "Purple Cap", emoji: "🎩" },
  { id: "most_sixes", label: "Most Sixes", emoji: "💥" },
  { id: "most_fours", label: "Most Fours", emoji: "4️⃣" },
  { id: "best_fielder", label: "Best Fielder", emoji: "🧤" },
  { id: "most_dots", label: "Most Dots", emoji: "⏸️" },
  { id: "best_economy", label: "Best Econ", emoji: "📉" },
];

export default function TournamentCricketStatsPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = params?.id as string;

  const [category, setCategory] = useState<Category>("orange_cap");
  const [players, setPlayers] = useState<PlayerAgg[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournamentName, setTournamentName] = useState("");
  const [search, setSearch] = useState("");

  const loadStats = useCallback(async () => {
    try {
      const { data: tData } = await supabase
        .from("ls_tournaments").select("name").eq("id", tournamentId).maybeSingle();
      setTournamentName((tData as any)?.name ?? "Tournament");

      const { data: matchData } = await supabase
        .from("ls_matches").select("id, team_a_id, team_b_id").eq("tournament_id", tournamentId);
      const matches = (matchData ?? []) as any[];
      const matchIds = matches.map((m) => m.id);
      if (matchIds.length === 0) { setLoading(false); return; }

      const { data: innData } = await supabase
        .from("ls_innings").select("id, match_id").in("match_id", matchIds);
      const innings = (innData ?? []) as any[];
      const inningsIds = innings.map((i) => i.id);
      if (inningsIds.length === 0) { setLoading(false); return; }

      const inningsMatchMap = new Map(innings.map((i: any) => [i.id, i.match_id]));

      const [{ data: batData }, { data: bowlData }] = await Promise.all([
        supabase.from("ls_batting_stats").select("*").in("innings_id", inningsIds),
        supabase.from("ls_bowling_stats").select("*").in("innings_id", inningsIds),
      ]);
      const allBatting = (batData as BattingStats[]) ?? [];
      const allBowling = (bowlData as BowlingStats[]) ?? [];

      const { data: ttData } = await supabase
        .from("ls_tournament_teams").select("team_id").eq("tournament_id", tournamentId);
      const teamIds = (ttData ?? []).map((t: any) => t.team_id);

      const [{ data: plData }, { data: tmData }] = await Promise.all([
        supabase.from("players").select("*").in("team_id", teamIds),
        supabase.from("teams").select("*").in("id", teamIds),
      ]);
      const playersList = (plData as Player[]) ?? [];
      const teams = (tmData as Team[]) ?? [];

      const pMap = new Map(playersList.map((p) => [p.id, p]));
      const tMap = new Map(teams.map((t) => [t.id, t]));

      // Build aggregation
      const agg = new Map<string, PlayerAgg>();

      const getOrCreate = (pid: string): PlayerAgg => {
        if (agg.has(pid)) return agg.get(pid)!;
        const p = pMap.get(pid);
        const t = p?.team_id ? tMap.get(p.team_id) : null;
        const entry: PlayerAgg = {
          playerId: pid,
          playerName: p?.name ?? "Unknown",
          playerPhoto: p?.photo_url ?? null,
          teamName: t?.name ?? "",
          teamLogo: t?.logo_url ?? null,
          teamColor: getTeamColor(t?.name ?? "").primary,
          runs: 0, fours: 0, sixes: 0, balls: 0, innings: 0, matches: 0,
          highScore: 0, notOuts: 0,
          wickets: 0, oversBowled: 0, runsConceded: 0, dotBalls: 0, maidens: 0,
          catches: 0, runOuts: 0,
        };
        agg.set(pid, entry);
        return entry;
      };

      // Track matches per player
      const playerMatches = new Map<string, Set<string>>();

      allBatting.forEach((s) => {
        const entry = getOrCreate(s.player_id);
        entry.runs += s.runs;
        entry.fours += s.fours;
        entry.sixes += s.sixes;
        entry.balls += s.balls_faced;
        if (s.balls_faced > 0 || s.runs > 0) entry.innings++;
        if (!s.is_out) entry.notOuts++;
        if (s.runs > entry.highScore) entry.highScore = s.runs;

        // Fielding stats (Catches & Run Outs)
        if (s.dismissal_fielder_id) {
          if (s.dismissal_type === "caught") {
            const fielder = getOrCreate(s.dismissal_fielder_id);
            fielder.catches++;
          } else if (s.dismissal_type === "run_out") {
            const fielder = getOrCreate(s.dismissal_fielder_id);
            fielder.runOuts++;
          }
        }

        const matchId = inningsMatchMap.get(s.innings_id);
        if (matchId) {
          if (!playerMatches.has(s.player_id)) playerMatches.set(s.player_id, new Set());
          playerMatches.get(s.player_id)!.add(matchId);
        }
      });

      allBowling.forEach((s) => {
        const entry = getOrCreate(s.player_id);
        entry.wickets += s.wickets;
        entry.oversBowled += s.overs;
        entry.runsConceded += s.runs_conceded;
        entry.dotBalls += s.dot_balls;
        entry.maidens += s.maidens;

        const matchId = inningsMatchMap.get(s.innings_id);
        if (matchId) {
          if (!playerMatches.has(s.player_id)) playerMatches.set(s.player_id, new Set());
          playerMatches.get(s.player_id)!.add(matchId);
        }
      });

      // Set match counts
      playerMatches.forEach((matchSet, pid) => {
        const entry = agg.get(pid);
        if (entry) entry.matches = matchSet.size;
      });

      // Compute MVP score
      const allPlayers = Array.from(agg.values());
      allPlayers.forEach((p) => {
        (p as any)._mvpScore =
          p.runs * MVP_WEIGHTS.runs +
          p.fours * MVP_WEIGHTS.fours +
          p.sixes * MVP_WEIGHTS.sixes +
          p.wickets * MVP_WEIGHTS.wickets +
          p.catches * MVP_WEIGHTS.catches +
          p.runOuts * MVP_WEIGHTS.runOuts +
          p.dotBalls * MVP_WEIGHTS.dotBalls +
          p.maidens * MVP_WEIGHTS.maidens;
      });

      setPlayers(allPlayers);
    } catch (err) {
      console.error("Stats load error:", err);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  /* ── Sort & filter by category ── */
  const sortedPlayers = (() => {
    let filtered = [...players];
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((p) =>
        p.playerName.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q)
      );
    }

    switch (category) {
      case "orange_cap":
        return filtered.filter((p) => p.balls > 0).sort((a, b) => b.runs - a.runs);
      case "purple_cap":
        return filtered.filter((p) => p.oversBowled > 0).sort((a, b) => b.wickets - a.wickets);
      case "most_sixes":
        return filtered.filter((p) => p.balls > 0).sort((a, b) => b.sixes - a.sixes);
      case "most_fours":
        return filtered.filter((p) => p.balls > 0).sort((a, b) => b.fours - a.fours);
      case "best_fielder":
        return filtered.sort((a, b) => (b.catches + b.runOuts) - (a.catches + a.runOuts)).filter((p) => (p.catches + p.runOuts) > 0);
      case "most_dots":
        return filtered.filter((p) => p.oversBowled > 0).sort((a, b) => b.dotBalls - a.dotBalls);
      case "best_economy":
        return filtered
          .filter((p) => toRealOvers(p.oversBowled) >= 1)
          .sort((a, b) => {
            const eA = a.runsConceded / toRealOvers(a.oversBowled);
            const eB = b.runsConceded / toRealOvers(b.oversBowled);
            return eA - eB;
          });
      case "mvp":
        return filtered
          .sort((a, b) => ((b as any)._mvpScore ?? 0) - ((a as any)._mvpScore ?? 0));
      default:
        return filtered;
    }
  })().slice(0, 20);

  const heroPlayer = sortedPlayers[0] ?? null;

  const primaryStat = (p: PlayerAgg): { value: string | number; label: string } => {
    switch (category) {
      case "orange_cap": return { value: p.runs, label: "RUNS" };
      case "purple_cap": return { value: p.wickets, label: "WICKETS" };
      case "most_sixes": return { value: p.sixes, label: "SIXES" };
      case "most_fours": return { value: p.fours, label: "FOURS" };
      case "best_fielder": return { value: p.catches + p.runOuts, label: "DISMISSALS" };
      case "most_dots": return { value: p.dotBalls, label: "DOTS" };
      case "best_economy": {
        const e = toRealOvers(p.oversBowled) > 0 ? (p.runsConceded / toRealOvers(p.oversBowled)).toFixed(2) : "0.00";
        return { value: e, label: "ECONOMY" };
      }
      case "mvp": return { value: ((p as any)._mvpScore ?? 0).toFixed(0), label: "RATING" };
      default: return { value: p.runs, label: "RUNS" };
    }
  };

  const categoryColor = (): string => {
    switch (category) {
      case "orange_cap": return "#f97316";
      case "purple_cap": return "#8b5cf6";
      case "most_sixes": return "#ef4444";
      case "most_fours": return "#3b82f6";
      case "best_fielder": return "#10b981";
      case "most_dots": return "#6366f1";
      case "best_economy": return "#14b8a6";
      case "mvp": return "#f59e0b";
      default: return "#f97316";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: categoryColor(), borderTopColor: "transparent" }} />
        <p className="text-[var(--text-muted)] text-sm" style={{ fontFamily: "var(--font-oswald)" }}>LOADING STATS...</p>
      </div>
    );
  }

  const catColor = categoryColor();

  return (
    <div className="w-full max-w-5xl mx-auto px-3 md:px-6 pb-8 space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="pt-4">
        <h1
          className="text-2xl md:text-3xl font-bold uppercase tracking-wider"
          style={{ fontFamily: "var(--font-oswald)", color: "var(--text)" }}
        >
          {tournamentName}
        </h1>
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mt-1">
          Cricket · Player Statistics
        </p>
      </div>

      {/* ═══ HERO CARD ═══ */}
      {heroPlayer && (
        <div
          className="relative rounded-2xl overflow-hidden group"
          style={{
            background: `linear-gradient(135deg, ${heroPlayer.teamColor}18 0%, ${catColor}12 40%, ${heroPlayer.teamColor}08 100%)`,
            border: `1.5px solid ${catColor}30`,
          }}
        >
          {/* Animated background particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="hero-particle hero-particle-1" style={{ background: catColor }} />
            <div className="hero-particle hero-particle-2" style={{ background: heroPlayer.teamColor }} />
            <div className="hero-particle hero-particle-3" style={{ background: catColor }} />
            {/* Gradient shine sweep */}
            <div className="hero-shine" />
          </div>

          {/* Giant rank watermark */}
          <div
            className="absolute -right-2 -top-4 md:-right-4 md:-top-6 text-[8rem] md:text-[12rem] font-black leading-none select-none pointer-events-none"
            style={{ fontFamily: "var(--font-oswald)", color: `${catColor}`, opacity: 0.06 }}
          >
            1
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-8 p-5 md:p-8 relative z-10">
            {/* Player photo - HERO SIZE */}
            <div className="relative flex-shrink-0 hero-photo-entrance w-32 sm:w-40 md:w-52 aspect-[3/4]">
              {/* Pulse ring */}
              <div
                className="absolute inset-0 rounded-2xl animate-pulse-ring"
                style={{ border: `2px solid ${catColor}`, opacity: 0.4 }}
              />
              {heroPlayer.playerPhoto ? (
                <img
                  src={heroPlayer.playerPhoto}
                  alt={heroPlayer.playerName}
                  className="w-full h-full rounded-2xl object-cover shadow-2xl transition-transform duration-500 group-hover:scale-105"
                  style={{
                    border: `3px solid ${catColor}`,
                    boxShadow: `0 0 30px ${catColor}25, 0 8px 32px rgba(0,0,0,0.3)`,
                  }}
                />
              ) : (
                <div
                  className="w-full h-full rounded-2xl flex items-center justify-center text-6xl sm:text-7xl md:text-8xl font-black shadow-2xl transition-transform duration-500 group-hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${heroPlayer.teamColor}, ${catColor})`,
                    color: "#fff",
                    fontFamily: "var(--font-oswald)",
                    boxShadow: `0 0 30px ${catColor}25, 0 8px 32px rgba(0,0,0,0.3)`,
                  }}
                >
                  {heroPlayer.playerName.charAt(0)}
                </div>
              )}
              {/* Category badge */}
              {/* <div
                className="absolute -bottom-2 -right-2 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-lg md:text-xl shadow-lg hero-badge-bounce"
                style={{ background: catColor, boxShadow: `0 4px 15px ${catColor}50` }}
              >
                {CATEGORIES.find((c) => c.id === category)?.emoji}
              </div> */}
            </div>

            <div className="flex-1 min-w-0 relative z-10 text-center sm:text-left">
              {/* Category label */}
              <p
                className="text-[10px] md:text-xs uppercase tracking-[0.25em] font-bold mb-1 hero-text-entrance"
                style={{ color: catColor, animationDelay: "0.1s" }}
              >
                {CATEGORIES.find((c) => c.id === category)?.label}
              </p>
              <p
                className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-wide truncate hero-text-entrance"
                style={{ fontFamily: "var(--font-oswald)", color: "var(--text)", animationDelay: "0.15s" }}
              >
                {heroPlayer.playerName}
              </p>
              <p
                className="text-sm md:text-base uppercase tracking-widest mt-0.5 font-semibold hero-text-entrance"
                style={{ color: heroPlayer.teamColor, animationDelay: "0.2s" }}
              >
                {heroPlayer.teamName}
              </p>

              {/* Stat chips — larger and animated */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 md:gap-3 mt-4">
                {[
                  { label: primaryStat(heroPlayer).label, value: primaryStat(heroPlayer).value, highlight: true },
                  { label: "MAT", value: heroPlayer.matches },
                  { label: "INNS", value: heroPlayer.innings },
                  category === "orange_cap" || category === "mvp"
                    ? { label: "SR", value: heroPlayer.balls > 0 ? ((heroPlayer.runs / heroPlayer.balls) * 100).toFixed(1) : "0.0" }
                    : category === "purple_cap" || category === "best_economy"
                    ? { label: "OVERS", value: formatOvers(heroPlayer.oversBowled) }
                    : { label: "HS", value: heroPlayer.highScore },
                ].map((chip, i) => (
                  <div
                    key={i}
                    className="rounded-xl px-3 py-2 text-center min-w-[60px] md:min-w-[72px] backdrop-blur-sm hero-chip-entrance"
                    style={{
                      background: chip.highlight ? `${catColor}20` : "var(--surface)",
                      border: chip.highlight ? `2px solid ${catColor}` : "1px solid var(--border)",
                      boxShadow: chip.highlight ? `0 0 12px ${catColor}15` : "none",
                      animationDelay: `${0.25 + i * 0.08}s`,
                    }}
                  >
                    <p
                      className="text-lg md:text-2xl font-black tabular-nums"
                      style={{ fontFamily: "var(--font-oswald)", color: chip.highlight ? catColor : "var(--text)" }}
                    >
                      {chip.value}
                    </p>
                    <p className="text-[8px] md:text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                      {chip.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero card animations */}
      <style>{`
        .hero-particle {
          position: absolute;
          border-radius: 50%;
          opacity: 0.15;
          filter: blur(40px);
        }
        .hero-particle-1 {
          width: 120px; height: 120px;
          top: -30px; left: 10%;
          animation: float-particle 6s ease-in-out infinite;
        }
        .hero-particle-2 {
          width: 80px; height: 80px;
          bottom: -20px; right: 15%;
          animation: float-particle 8s ease-in-out infinite 2s;
        }
        .hero-particle-3 {
          width: 60px; height: 60px;
          top: 50%; left: 60%;
          animation: float-particle 7s ease-in-out infinite 4s;
        }
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.15); }
        }
        .hero-shine {
          position: absolute;
          top: 0; left: -100%; width: 50%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
          animation: shine-sweep 4s ease-in-out infinite;
        }
        @keyframes shine-sweep {
          0% { left: -100%; }
          50%, 100% { left: 200%; }
        }
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.06); opacity: 0.15; }
        }
        .animate-pulse-ring { animation: pulse-ring 3s ease-in-out infinite; }
        .hero-photo-entrance {
          animation: hero-photo-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes hero-photo-in {
          from { opacity: 0; transform: scale(0.8) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .hero-text-entrance {
          animation: hero-text-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes hero-text-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-chip-entrance {
          animation: hero-chip-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes hero-chip-in {
          from { opacity: 0; transform: translateY(10px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .hero-badge-bounce {
          animation: badge-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
        }
        @keyframes badge-bounce {
          from { opacity: 0; transform: scale(0); }
          to { opacity: 1; transform: scale(1); }
        }
        .player-row-photo {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .player-row-photo:hover {
          transform: scale(1.15);
        }
      `}</style>

      {/* ═══ CATEGORY TABS ═══ */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className="flex-shrink-0 px-3 py-2 rounded-full text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap"
            style={category === cat.id ? {
              background: catColor,
              color: "#fff",
              fontFamily: "var(--font-oswald)",
            } : {
              background: "var(--surface)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-oswald)",
            }}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* ═══ SEARCH ═══ */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field !py-2 !pl-9 !text-sm"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* ═══ STATS TABLE ═══ */}
      {sortedPlayers.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-lg font-semibold text-[var(--text)] mb-1" style={{ fontFamily: "var(--font-oswald)" }}>
            NO STATS YET
          </h3>
          <p className="text-sm text-[var(--text-muted)]">Complete some matches to see player stats.</p>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: catColor }}>
                  <th className="text-center py-2.5 px-2 text-white text-xs uppercase font-bold" style={{ fontFamily: "var(--font-oswald)" }}>POS</th>
                  <th className="text-left py-2.5 px-3 text-white text-xs uppercase font-bold" style={{ fontFamily: "var(--font-oswald)" }}>PLAYER</th>
                  <th className="text-right py-2.5 px-2 text-xs uppercase font-bold" style={{ fontFamily: "var(--font-oswald)", color: "#fde68a" }}>
                    {primaryStat(sortedPlayers[0]).label}
                  </th>
                  <th className="text-center py-2.5 px-1.5 text-white/80 text-[10px] uppercase font-semibold" style={{ fontFamily: "var(--font-oswald)" }}>MAT</th>
                  <th className="text-center py-2.5 px-1.5 text-white/80 text-[10px] uppercase font-semibold" style={{ fontFamily: "var(--font-oswald)" }}>INN</th>
                  {(category === "orange_cap" || category === "mvp" || category === "most_sixes" || category === "most_fours") && (
                    <>
                      <th className="text-center py-2.5 px-1.5 text-white/80 text-[10px] uppercase font-semibold hidden md:table-cell" style={{ fontFamily: "var(--font-oswald)" }}>HS</th>
                      <th className="text-center py-2.5 px-1.5 text-white/80 text-[10px] uppercase font-semibold hidden md:table-cell" style={{ fontFamily: "var(--font-oswald)" }}>AVG</th>
                      <th className="text-center py-2.5 px-1.5 text-white/80 text-[10px] uppercase font-semibold" style={{ fontFamily: "var(--font-oswald)" }}>SR</th>
                      <th className="text-center py-2.5 px-1.5 text-white/80 text-[10px] uppercase font-semibold hidden md:table-cell" style={{ fontFamily: "var(--font-oswald)" }}>4s</th>
                      <th className="text-center py-2.5 px-1.5 text-white/80 text-[10px] uppercase font-semibold hidden md:table-cell" style={{ fontFamily: "var(--font-oswald)" }}>6s</th>
                    </>
                  )}
                  {(category === "purple_cap" || category === "most_dots" || category === "best_economy") && (
                    <>
                      <th className="text-center py-2.5 px-1.5 text-white/80 text-[10px] uppercase font-semibold" style={{ fontFamily: "var(--font-oswald)" }}>O</th>
                      <th className="text-center py-2.5 px-1.5 text-white/80 text-[10px] uppercase font-semibold" style={{ fontFamily: "var(--font-oswald)" }}>R</th>
                      <th className="text-center py-2.5 px-1.5 text-white/80 text-[10px] uppercase font-semibold hidden md:table-cell" style={{ fontFamily: "var(--font-oswald)" }}>ECON</th>
                      <th className="text-center py-2.5 px-1.5 text-white/80 text-[10px] uppercase font-semibold hidden md:table-cell" style={{ fontFamily: "var(--font-oswald)" }}>DOTS</th>
                    </>
                  )}
                  {category === "best_fielder" && (
                    <>
                      <th className="text-center py-2.5 px-1.5 text-white/80 text-[10px] uppercase font-semibold" style={{ fontFamily: "var(--font-oswald)" }}>CATCHES</th>
                      <th className="text-center py-2.5 px-1.5 text-white/80 text-[10px] uppercase font-semibold" style={{ fontFamily: "var(--font-oswald)" }}>RUN OUTS</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((p, idx) => {
                  const sr = p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(1) : "0.0";
                  const avg = p.innings - p.notOuts > 0 ? (p.runs / (p.innings - p.notOuts)).toFixed(1) : "-";
                  const econ = toRealOvers(p.oversBowled) > 0 ? (p.runsConceded / toRealOvers(p.oversBowled)).toFixed(1) : "0.0";

                  return (
                    <tr
                      key={p.playerId}
                      className="border-b border-[var(--border)]/50 transition-colors hover:bg-[var(--surface-alt)]"
                      style={{
                        animation: `fade-in 0.3s ease-out ${idx * 0.04}s both`,
                      }}
                    >
                      {/* Position */}
                      <td className="text-center py-2.5 px-2">
                        <span
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                          style={
                            idx === 0
                              ? { background: `${catColor}`, color: "#fff", fontFamily: "var(--font-oswald)" }
                              : idx < 3
                              ? { background: `${catColor}20`, color: catColor, fontFamily: "var(--font-oswald)" }
                              : { color: "var(--text-muted)", fontFamily: "var(--font-oswald)" }
                          }
                        >
                          {idx + 1}
                        </span>
                      </td>

                      {/* Player */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className="relative w-12 md:w-16 aspect-[3/4] flex-shrink-0">
                            {p.playerPhoto ? (
                              <img
                                src={p.playerPhoto}
                                alt={p.playerName}
                                className="w-full h-full rounded-xl object-cover player-row-photo"
                                style={{
                                  border: `2px solid ${p.teamColor}`,
                                  boxShadow: idx < 3 ? `0 0 10px ${p.teamColor}20` : "none",
                                }}
                              />
                            ) : (
                              <div
                                className="w-full h-full rounded-xl flex items-center justify-center text-lg md:text-2xl font-bold text-white player-row-photo"
                                style={{ background: p.teamColor, fontFamily: "var(--font-oswald)" }}
                              >
                                {p.playerName.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--text)] text-base md:text-lg truncate max-w-[140px] md:max-w-none">
                              {p.playerName}
                            </p>
                            <p className="text-[10px] md:text-xs uppercase tracking-wider font-medium mt-0.5" style={{ color: p.teamColor }}>
                              {p.teamName}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Primary stat */}
                      <td className="text-right py-2.5 px-2">
                        <span
                          className="text-base font-black tabular-nums"
                          style={{ fontFamily: "var(--font-oswald)", color: idx === 0 ? catColor : "var(--text)" }}
                        >
                          {primaryStat(p).value}
                        </span>
                      </td>

                      {/* Common columns */}
                      <td className="text-center py-2.5 px-1.5 text-[var(--text-muted)] text-xs tabular-nums">{p.matches}</td>
                      <td className="text-center py-2.5 px-1.5 text-[var(--text-muted)] text-xs tabular-nums">{p.innings}</td>

                      {/* Batting columns */}
                      {(category === "orange_cap" || category === "mvp" || category === "most_sixes" || category === "most_fours") && (
                        <>
                          <td className="text-center py-2.5 px-1.5 text-[var(--text-muted)] text-xs tabular-nums hidden md:table-cell">{p.highScore}{p.notOuts > 0 && "*"}</td>
                          <td className="text-center py-2.5 px-1.5 text-[var(--text-muted)] text-xs tabular-nums hidden md:table-cell">{avg}</td>
                          <td className="text-center py-2.5 px-1.5 text-[var(--text-muted)] text-xs tabular-nums">{sr}</td>
                          <td className="text-center py-2.5 px-1.5 text-[var(--text-muted)] text-xs tabular-nums hidden md:table-cell">{p.fours}</td>
                          <td className="text-center py-2.5 px-1.5 text-[var(--text-muted)] text-xs tabular-nums hidden md:table-cell">{p.sixes}</td>
                        </>
                      )}

                      {/* Bowling columns */}
                      {(category === "purple_cap" || category === "most_dots" || category === "best_economy") && (
                        <>
                          <td className="text-center py-2.5 px-1.5 text-[var(--text-muted)] text-xs tabular-nums">{formatOvers(p.oversBowled)}</td>
                          <td className="text-center py-2.5 px-1.5 text-[var(--text-muted)] text-xs tabular-nums">{p.runsConceded}</td>
                          <td className="text-center py-2.5 px-1.5 text-[var(--text-muted)] text-xs tabular-nums hidden md:table-cell">{econ}</td>
                          <td className="text-center py-2.5 px-1.5 text-[var(--text-muted)] text-xs tabular-nums hidden md:table-cell">{p.dotBalls}</td>
                        </>
                      )}

                      {/* Fielder columns */}
                      {category === "best_fielder" && (
                        <>
                          <td className="text-center py-2.5 px-1.5 text-[var(--text-muted)] text-xs tabular-nums">{p.catches}</td>
                          <td className="text-center py-2.5 px-1.5 text-[var(--text-muted)] text-xs tabular-nums">{p.runOuts}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ FOOTER ═══ */}
      <div className="text-center py-4">
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
          {tournamentName} · Powered by Playzo
        </p>
      </div>
    </div>
  );
}
