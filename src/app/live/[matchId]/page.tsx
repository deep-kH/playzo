"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LiveMatchRouter() {
  const params = useParams();
  const router = useRouter();
  const matchId = params?.matchId as string;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function routeMatch() {
      if (!matchId || matchId === "undefined") {
        setError("Invalid match ID.");
        return;
      }

      // Fetch the match and join the tournament to get the sport
      const { data, error: err } = await supabase
        .from("ls_matches")
        .select(`
          id,
          ls_tournaments ( sport )
        `)
        .eq("id", matchId)
        .single();

      if (err || !data) {
        setError("Match not found.");
        return;
      }

      const sport = (data as any).ls_tournaments?.sport;
      if (!sport) {
        setError("Tournament sport not configured.");
        return;
      }

      // Hide all frontend paths except badminton for live view panel
      if (sport !== "badminton") {
        setError(`Live viewing for ${sport} matches is currently disabled.`);
        return;
      }

      // Redirect to the sport-specific live viewer
      router.replace(`/live/matches/${matchId}/${sport}`);
    }

    routeMatch();
  }, [matchId, router]);

  if (error) {
    return (
      <div className="container-app py-16 text-center">
        <h1 className="text-2xl font-bold text-text mb-2">Error</h1>
        <p className="text-text-muted">{error}</p>
        <button
          onClick={() => router.push("/live")}
          className="mt-6 btn-secondary"
        >
          View All Live Matches
        </button>
      </div>
    );
  }

  // Loading state while determining route
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-text-muted text-sm">Loading match...</p>
    </div>
  );
}
