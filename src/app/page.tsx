"use client";

import { useEffect, useState } from "react";
import type { Tournament } from "@/lib/types/database";
import { TournamentCard } from "@/components/common/TournamentCard";
import { listActiveOrUpcomingTournaments } from "@/features/tournaments/api";

export default function HomePage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTournaments() {
      const data = await listActiveOrUpcomingTournaments();
      setTournaments((data as Tournament[]) ?? []);
      setLoading(false);
    }
    fetchTournaments();
  }, []);

  return (
    <div className="container-app py-8 md:py-12">
      {/* Hero */}
      <section className="mb-10 md:mb-14">
        <h1 className="text-3xl md:text-4xl font-bold text-text mb-3">
          Playzo - Live Sports Scoring
        </h1>
        <p className="text-lg text-text-muted max-w-xl">
          Follow your favourite local tournaments in real time. Ball-by-ball
          cricket, goal-by-goal football, and more — all updated live.
        </p>
      </section>

      {/* Tournaments */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text">
            Active Tournaments
          </h2>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card space-y-3">
                <div className="skeleton h-5 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
                <div className="skeleton h-4 w-full" />
              </div>
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-4xl mb-4">🏟️</div>
            <h3 className="text-lg font-semibold text-text mb-2">
              No Active Tournaments
            </h3>
            <p className="text-text-muted text-sm max-w-sm mx-auto">
              There are no tournaments currently running. Check back soon or ask
              your admin to create one.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
