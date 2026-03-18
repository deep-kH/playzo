"use client";

import { useAuth } from "./AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function AuthGuard({ children, requireAdmin = true }: AuthGuardProps) {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }
    // Don't redirect admin to "/" — just block with Access Denied
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-text-muted text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-5xl">🔒</div>
          <h1 className="text-2xl font-bold text-text">Access Denied</h1>
          <p className="text-text-muted max-w-sm">
            You do not have admin privileges. Please contact an administrator.
          </p>
          <button
            onClick={() => router.replace("/")}
            className="btn-secondary text-sm"
          >
            ← Go Home
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
