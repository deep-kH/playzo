"use client";

import Link from "next/link";
import { useAuth } from "@/components/common/AuthProvider";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { AuthGuard } from "@/components/common/AuthGuard";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard requireAdmin>
      <div className="min-h-screen flex flex-col">
        {/* Admin Header */}
        <AdminHeader />

        {/* Body: Sidebar + Content */}
        <div className="flex-1 container-app py-6 md:py-8">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            <AdminSidebar />
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

function AdminHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border-ui">
      <div className="container-app flex items-center justify-between h-14">
        {/* Logo */}
        <Link
          href="/admin"
          className="flex items-center gap-2 no-underline hover:no-underline"
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <span className="font-bold text-lg text-text tracking-tight">
            LiveScore
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-md">
            Admin
          </span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user && (
            <button
              onClick={() => signOut()}
              className="btn-secondary text-sm !py-1.5 !px-3"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
