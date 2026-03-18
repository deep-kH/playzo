export function Footer() {
  return (
    <footer className="border-t border-border-ui bg-surface/50 mt-auto">
      <div className="container-app py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-text-muted">
          © {new Date().getFullYear()} LiveScore Platform. All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          <span className="text-xs text-text-muted/60">
            Built for local tournaments
          </span>
        </div>
      </div>
    </footer>
  );
}

