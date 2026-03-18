"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "./AuthProvider";
import { useState } from "react";

export function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border-ui">
      <div className="container-app flex items-center justify-between h-14 md:h-16">
        {/* Logo */}
        <Link
          href="/"
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
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/tournaments"
            className="text-sm font-medium text-text-muted hover:text-text no-underline transition-colors"
          >
            Tournaments
          </Link>
          <Link
            href="/live"
            className="text-sm font-medium text-accent no-underline hover:text-accent/80 transition-colors"
          >
            🔴 Live
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="text-sm font-medium text-text-muted hover:text-text no-underline transition-colors"
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {user ? (
            <button
              onClick={() => signOut()}
              className="hidden md:block btn-secondary text-sm !py-1.5 !px-3"
            >
              Sign Out
            </button>
          ) : (
            <Link
              href="/login"
              className="hidden md:block btn-primary text-sm !py-1.5 !px-3 no-underline text-white"
            >
              Admin Login
            </Link>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden btn-secondary !p-2 !min-h-0"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border-ui bg-background animate-fade-in">
          <nav className="container-app py-4 flex flex-col gap-3">
            <Link
              href="/tournaments"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-medium text-text-muted hover:text-text no-underline py-2"
            >
              Tournaments
            </Link>
            <Link
              href="/live"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-medium text-accent no-underline py-2"
            >
              🔴 Live Matches
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-text-muted hover:text-text no-underline py-2"
              >
                Admin Dashboard
              </Link>
            )}
            <div className="border-t border-border-ui pt-3 mt-1">
              {user ? (
                <button
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                  className="btn-secondary w-full text-sm"
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-primary w-full text-sm no-underline text-white text-center block"
                >
                  Admin Login
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

