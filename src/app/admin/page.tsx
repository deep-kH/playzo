"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminDashboardStats, type DashboardStats as Stats } from "@/features/dashboard/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    tournaments: 0,
    teams: 0,
    players: 0,
    liveMatches: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await getAdminDashboardStats();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const cards = [
    {
      label: "Tournaments",
      value: stats.tournaments,
      href: "/admin/tournaments",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Teams",
      value: stats.teams,
      href: "/admin/teams",
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Players",
      value: stats.players,
      href: "/admin/players",
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Live Matches",
      value: stats.liveMatches,
      href: "/admin/tournaments",
      color: "text-accent",
      bg: "bg-accent/10",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="card-hover no-underline"
          >
            <div className={`text-3xl font-bold ${card.color} mb-1`}>
              {loading ? (
                <div className="skeleton h-9 w-12" />
              ) : (
                card.value
              )}
            </div>
            <p className="text-sm text-text-muted">{card.label}</p>
          </Link>
        ))}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-text mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/teams" className="btn-primary text-sm no-underline">
            + New Team
          </Link>
          <Link
            href="/admin/tournaments"
            className="btn-primary text-sm no-underline"
          >
            + New Tournament
          </Link>
          <Link href="/admin/players" className="btn-secondary text-sm no-underline">
            + New Player
          </Link>
        </div>
      </div>
    </div>
  );
}
