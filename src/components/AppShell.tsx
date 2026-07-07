import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-wide text-lg">
            KARMEL
          </Link>
          <nav className="flex gap-6 text-sm text-white/60">
            <Link to="/" activeProps={{ className: "text-white" }} activeOptions={{ exact: true }}>
              Home
            </Link>
            <Link to="/study" activeProps={{ className: "text-white" }}>
              Study
            </Link>
            <Link to="/papers" activeProps={{ className: "text-white" }}>
              Past Papers
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
