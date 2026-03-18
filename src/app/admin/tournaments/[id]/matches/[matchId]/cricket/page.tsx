// Cricket scorer — redirect to the canonical scorer route with loading UI
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AdminCricketMatchPage() {
  const params = useParams<{ id: string; matchId: string }>();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(true);

  useEffect(() => {
    if (!params?.matchId) {
      setRedirecting(false);
      return;
    }
    router.replace(`/admin/score/${params.matchId}`);
  }, [params?.matchId, router]);

  if (!params?.matchId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-[var(--text-muted)]">No match ID found.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        <p className="text-[var(--text-muted)] text-sm">Loading cricket scorer...</p>
      </div>
    </div>
  );
}
