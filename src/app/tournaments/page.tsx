"use client";

import { useEffect, useState } from "react";
import type { Tournament } from "@/lib/types/database";
import { TournamentCard } from "@/components/common/TournamentCard";
import { listTournaments } from "@/features/tournaments/api";

export default function TournamentsListPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const data = await listTournaments();
      setTournaments(data);
      setLoading(false);
    }
    fetch();
  }, []);

  const active = tournaments.filter((t) => t.status === "active");
  const upcoming = tournaments.filter((t) => t.status === "upcoming");
  const completed = tournaments.filter((t) => t.status === "completed");

  return (
    <div className="container-app py-8 md:py-12">
      <h1 className="text-2xl md:text-3xl font-bold text-text mb-8">
        All Tournaments
      </h1>

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
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">🏟️</div>
          <h2 className="text-xl font-semibold text-text mb-2">No Tournaments</h2>
          <p className="text-text-muted">Check back soon!</p>
        </div>
      ) : (
        <div className="space-y-10">
          {active.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-accent mb-4 flex items-center gap-2">
                🔴 Active
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((t) => <TournamentCard key={t.id} tournament={t} />)}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-primary mb-4">Upcoming</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((t) => <TournamentCard key={t.id} tournament={t} />)}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-success mb-4">Completed</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completed.map((t) => <TournamentCard key={t.id} tournament={t} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
