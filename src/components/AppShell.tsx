import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useKarmelStore } from "@/store/useKarmelStore";

export default function AppShell({ children }: { children: ReactNode }) {
  const isAuthed = useKarmelStore((s) => s.isAuthed);
  const logout = useKarmelStore((s) => s.logout);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!isAuthed && pathname !== "/auth") {
      navigate({ to: "/auth", search: { mode: "login" } });
    }
  }, [isAuthed, pathname, navigate]);

  if (!isAuthed) return null;

  return (
    <div className="h-screen overflow-hidden bg-black text-white flex flex-col">
      <header className="sticky top-0 z-30 shrink-0 border-b border-white/10 bg-black/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-wide text-lg">
            KARMEL
          </Link>
          <nav className="flex gap-6 text-sm text-white/60 items-center">
            <Link to="/" activeProps={{ className: "text-white" }} activeOptions={{ exact: true }}>
              Home
            </Link>
            <Link to="/study" activeProps={{ className: "text-white" }}>
              Study
            </Link>
            <Link to="/papers" activeProps={{ className: "text-white" }}>
              Past Papers
            </Link>
            <button
              onClick={() => {
                logout();
                navigate({ to: "/auth", search: { mode: "login" } });
              }}
              className="text-white/60 hover:text-white"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
