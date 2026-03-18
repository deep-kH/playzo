import Link from "next/link";
import type { Match, Team } from "@/lib/types/database";
import { StatusBadge } from "./StatusBadge";

interface MatchCardProps {
  match: Match;
  teamA?: Team;
  teamB?: Team;
  isAdmin?: boolean;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "TBD";
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function MatchCard({
  match,
  teamA,
  teamB,
  isAdmin = false,
}: MatchCardProps) {
  const isLive = match.status === "live";
  const href =
    isAdmin && match.status === "scheduled"
      ? `/admin/score/${match.id}`
      : `/live/${match.id}`;

  return (
    <Link
      href={href}
      className={`card-hover block no-underline group ${
        isLive ? "border-accent/50 shadow-accent/10 shadow-md" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <StatusBadge status={match.status} />
        {match.venue && (
          <span className="text-xs text-text-muted truncate max-w-[40%]">
            {match.venue}
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {teamA?.logo_url ? (
              <img
                src={teamA.logo_url}
                alt=""
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {teamA?.name?.charAt(0) ?? "A"}
              </div>
            )}
            <span className="font-semibold text-text truncate">
              {teamA?.name ?? "Team A"}
            </span>
          </div>
          {match.result?.winner_id === match.team_a_id && (
            <span className="text-xs font-bold text-success">WON</span>
          )}
        </div>

        <div className="text-center text-xs text-text-muted font-medium">
          VS
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {teamB?.logo_url ? (
              <img
                src={teamB.logo_url}
                alt=""
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                {teamB?.name?.charAt(0) ?? "B"}
              </div>
            )}
            <span className="font-semibold text-text truncate">
              {teamB?.name ?? "Team B"}
            </span>
          </div>
          {match.result?.winner_id === match.team_b_id && (
            <span className="text-xs font-bold text-success">WON</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-border-ui/50 flex items-center justify-between text-xs text-text-muted">
        <span>
          {formatDate(match.start_time)} {formatTime(match.start_time)}
        </span>
        {isAdmin && match.status === "scheduled" ? (
          <span className="text-primary font-semibold">Start Match →</span>
        ) : isLive ? (
          <span className="text-accent font-semibold">Watch Live →</span>
        ) : (
          <span className="text-primary group-hover:translate-x-0.5 transition-transform">
            Details →
          </span>
        )}
      </div>
    </Link>
  );
}

