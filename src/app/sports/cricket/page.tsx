import Link from "next/link";

export default function CricketPage() {
  return (
    <div className="container-app py-8 md:py-12">
      <div className="max-w-lg mx-auto text-center">
        <div className="text-6xl mb-6">🏏</div>
        <h1 className="text-2xl md:text-3xl font-bold text-text mb-3">
          Cricket
        </h1>
        <p className="text-text-muted mb-6">
          Ball-by-ball scoring, live scorecards, batter & bowler statistics,
          and real-time match updates for local cricket tournaments.
        </p>
        <div className="card inline-block">
          <p className="text-sm text-primary font-medium">
            ✅ Supported — View cricket tournaments
          </p>
        </div>
        <div className="mt-6">
          <Link
            href="/tournaments"
            className="btn-primary no-underline"
          >
            View Tournaments
          </Link>
        </div>
      </div>
    </div>
  );
}
