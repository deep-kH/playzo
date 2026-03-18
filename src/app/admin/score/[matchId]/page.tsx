"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AdminScoreRouter() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.matchId as string;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function routeMatch() {
      if (!matchId || matchId === "undefined") {
        setError("Invalid match ID.");
        return;
      }

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

      // Redirect to the sport-specific admin scorer
      router.replace(`/admin/score/${matchId}/${sport}`);
    }

    routeMatch();
  }, [matchId, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 p-8">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-bold text-text">Error Loading Scorer</h2>
        <p className="text-text-muted text-sm max-w-sm text-center">{error}</p>
        <button
          onClick={() => router.push("/admin")}
          className="mt-4 btn-secondary text-sm px-6 py-2"
        >
          Back to Admin
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-text-muted text-sm">Loading scorer...</p>
    </div>
  );
}
