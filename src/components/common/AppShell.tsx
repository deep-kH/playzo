// Conditional shell: hides Header/Footer for admin users
"use client";

import React from "react";
import { useAuth } from "./AuthProvider";
import { Header } from "./Header";
import { Footer } from "./Footer";

import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth();
  const pathname = usePathname();

  // While loading auth, show a minimal shell to avoid flash
  if (isLoading) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-text-muted text-sm">Loading...</p>
        </div>
      </main>
    );
  }

  // Admin users: no public header/footer ONLY on admin routes
  if (isAdmin && pathname?.startsWith("/admin")) {
    return <>{children}</>;
  }

  // Public users: full public shell
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
