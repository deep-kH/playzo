import Link from "next/link";
import { useState } from "react";
import type { Match, Team } from "@/lib/types/database";
import { StatusBadge } from "./StatusBadge";

interface MatchCardProps {
  match: Match;
  teamA?: Team;
  teamB?: Team;
  isAdmin?: boolean;
}

export function MatchCard({
  match,
  teamA,
  teamB,
  isAdmin = false,
}: MatchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isLive = match.status === "live";
  const isScheduled = match.status === "scheduled";
  const isCompleted = match.status === "completed";

  const bmPlayers = (match.settings as any)?.badminton_players;
  const isBadminton = !!(bmPlayers);

  // Sport for routing: stored in tournament join via the match data
  const sport = (match as any)?.ls_tournaments?.sport
    || (match.settings as any)?.sport
    || (isBadminton ? "badminton" : "cricket");
  
  const liveOrCompletedHref = `/live/matches/${match.id}/${sport}`;
  const adminScoreHref = `/admin/score/${match.id}/${sport}`;

  // Team / player labels for display
  const sideALabel = isBadminton
    ? (bmPlayers.side_a as any[]).map((p: any) => p.name).join(" & ")
    : teamA?.name ?? "Side A";
  const sideBLabel = isBadminton
    ? (bmPlayers.side_b as any[]).map((p: any) => p.name).join(" & ")
    : teamB?.name ?? "Side B";

  // Use CSS theme variables for states
  let cardThemeClass = "bg-[var(--surface)] border-[var(--border)]";
  if (isLive) {
    cardThemeClass = "bg-[var(--success)]/10 border-[var(--success)]/30 ring-1 ring-[var(--success)]/50";
  } else if (isCompleted) {
    cardThemeClass = "bg-[var(--surface-alt)] opacity-90 border-[var(--border-disabled)]";
  }

  const CardContent = (
    <div className={`p-4 rounded-xl transition-all duration-300 transform no-underline hover:scale-[1.01] hover:shadow-lg ${cardThemeClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isLive && <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />}
          <StatusBadge status={match.status} />
        </div>
      </div>

      {/* Teams / Players */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {!isBadminton && teamA?.logo_url ? (
              <img src={teamA.logo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {sideALabel.charAt(0)}
              </div>
            )}
            <span className="font-semibold text-text truncate">{sideALabel}</span>
          </div>
          {match.result?.winner_id === match.team_a_id && (
            <span className="text-xs font-bold text-success">WON</span>
          )}
        </div>

        <div className="text-center text-xs text-text-muted font-medium">VS</div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {!isBadminton && teamB?.logo_url ? (
              <img src={teamB.logo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                {sideBLabel.charAt(0)}
              </div>
            )}
            <span className="font-semibold text-text truncate">{sideBLabel}</span>
          </div>
          {match.result?.winner_id === match.team_b_id && (
            <span className="text-xs font-bold text-success">WON</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-[var(--border-ui)]/50 flex flex-col gap-2">
        {(isLive || isCompleted) && (
          <div className="flex items-center justify-between text-xs font-semibold">
            {isLive ? (
              <span className="text-[var(--accent)] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" /> Watch Live
              </span>
            ) : (
              <span className="text-[var(--text-muted)]">Post-Match Summary →</span>
            )}
          </div>
        )}

        {isScheduled && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Scheduled</span>
            {isAdmin ? (
               <Link href={adminScoreHref} className="text-xs font-semibold text-[var(--primary)] hover:underline">
                 Start Match →
               </Link>
            ) : (
               <span className="text-[var(--primary)] group-hover:translate-x-0.5 transition-transform text-xs">
                 Details 
               </span>
            )}
          </div>
        )}
        
        {isScheduled && expanded && (
          <div className="mt-2 text-xs text-[var(--text-muted)] border-t border-dashed border-[var(--border-ui)] pt-2 animate-fade-in">
             <p>Match ID: <span className="font-mono text-[10px]">{match.id}</span></p>
             <p>Tournament: {(match.settings as any)?.tournament_name || "Unknown"}</p>
             <p>Format: {(match.settings as any)?.match_type || "Standard"}</p>
          </div>
        )}
      </div>
    </div>
  );

  // If Scheduled, make it expandable without navigating automatically
  if (isScheduled && !isAdmin) {
    return (
      <div className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {CardContent}
      </div>
    );
  }

  // If Admin looking at scheduled, allow expanding clicking the card but the Start Match is a link
  if (isScheduled && isAdmin) {
    return (
      <div className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {CardContent}
      </div>
    );
  }

  // Live or Completed: Entire card is a link
  return (
    <Link href={liveOrCompletedHref} className="block no-underline">
      {CardContent}
    </Link>
  );
}

