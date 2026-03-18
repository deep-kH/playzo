import Link from "next/link";
import type { Tournament } from "@/lib/types/database";

interface TournamentCardProps {
  tournament: Tournament;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "TBD";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sportEmoji(sport: string): string {
  switch (sport) {
    case "cricket":
      return "🏏";
    case "football":
      return "⚽";
    case "badminton":
      return "🏸";
    default:
      return "🏅";
  }
}

const statusColors: Record<string, string> = {
  upcoming: "text-primary",
  active: "text-accent font-semibold",
  completed: "text-success",
  cancelled: "text-text-muted",
};

export function TournamentCard({ tournament }: TournamentCardProps) {
  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="card-hover block no-underline group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl" aria-hidden="true">
              {sportEmoji(tournament.sport)}
            </span>
            <h3 className="text-base font-semibold text-text truncate group-hover:text-primary transition-colors">
              {tournament.name}
            </h3>
          </div>

          <p className="text-sm text-text-muted capitalize">{tournament.sport}</p>

          {tournament.location && (
            <p className="text-sm text-text-muted mt-1 flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {tournament.location}
            </p>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <span
            className={`text-xs uppercase tracking-wide ${
              statusColors[tournament.status] ?? "text-text-muted"
            }`}
          >
            {tournament.status}
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border-ui/50 flex items-center justify-between text-xs text-text-muted">
        <span>
          {formatDate(tournament.start_date)} — {formatDate(tournament.end_date)}
        </span>
        <span className="text-primary group-hover:translate-x-0.5 transition-transform">
          View →
        </span>
      </div>
    </Link>
  );
}

