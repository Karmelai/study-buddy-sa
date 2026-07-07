import { createFileRoute, Link } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";
import { useKarmelStore } from "@/store/useKarmelStore";
import { BookOpen, FileText, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KARMEL — Your Study Coach" },
      { name: "description", content: "AI study coach for South African high school students." },
    ],
  }),
  component: Home,
});

function Home() {
  const { studentName, grade, lastSubject, lastMode, activities, setStudent } = useKarmelStore();

  const recommendation =
    activities.find((a) => a.weakTopics && a.weakTopics.length > 0) ?? null;

  return (
    <AppShell>
      <div className="max-w-5xl w-full mx-auto px-6 py-12 space-y-10">
        <section>
          <p className="text-white/50 text-sm">Welcome back</p>
          <h1 className="text-4xl font-semibold mt-1">
            Hello, {studentName}.
          </h1>
          <div className="mt-3 flex items-center gap-3 text-sm text-white/60">
            <span>Grade {grade}</span>
            <span>·</span>
            <button
              onClick={() => {
                const name = prompt("Your name?", studentName) || studentName;
                const g = Number(prompt("Your grade (8-12)?", String(grade))) || grade;
                setStudent(name, g);
              }}
              className="underline underline-offset-4 hover:text-white"
            >
              Edit profile
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/study"
            className="group border border-white/10 hover:border-white/40 rounded-2xl p-6 transition"
          >
            <BookOpen className="text-white/80" />
            <h3 className="mt-4 font-medium">Study a Subject</h3>
            <p className="text-white/50 text-sm mt-1">
              Get guided help on any topic with your AI coach.
            </p>
          </Link>
          <Link
            to="/papers"
            className="group border border-white/10 hover:border-white/40 rounded-2xl p-6 transition"
          >
            <FileText className="text-white/80" />
            <h3 className="mt-4 font-medium">Practice Past Paper</h3>
            <p className="text-white/50 text-sm mt-1">
              Work through past exam questions one at a time.
            </p>
          </Link>
          <Link
            to={lastSubject ? "/study" : "/study"}
            className="group border border-white/10 hover:border-white/40 rounded-2xl p-6 transition"
          >
            <RotateCcw className="text-white/80" />
            <h3 className="mt-4 font-medium">Continue Last Session</h3>
            <p className="text-white/50 text-sm mt-1">
              {lastSubject ? `${lastSubject} · ${lastMode}` : "No recent session yet."}
            </p>
          </Link>
        </section>

        {recommendation && (
          <section className="rounded-2xl border border-white/10 p-6">
            <p className="text-xs uppercase tracking-widest text-white/40">Recommended for you</p>
            <h3 className="mt-2 text-lg">
              Revise <span className="text-white">{recommendation.weakTopics?.[0]}</span> — you
              struggled last time in {recommendation.subject}.
            </h3>
          </section>
        )}

        <section>
          <h2 className="text-sm uppercase tracking-widest text-white/40 mb-4">Recent activity</h2>
          {activities.length === 0 ? (
            <p className="text-white/40 text-sm">No sessions yet. Start studying to see progress here.</p>
          ) : (
            <ul className="divide-y divide-white/5 border-y border-white/5">
              {activities.slice(0, 5).map((a) => (
                <li key={a.id} className="py-3 flex justify-between text-sm">
                  <span>
                    {a.type === "pastpaper" ? "Past paper" : "Study"} · {a.subject}
                    {a.topic ? ` · ${a.topic}` : ""}
                  </span>
                  <span className="text-white/40">
                    {new Date(a.at).toLocaleDateString()}
                    {typeof a.score === "number" ? ` · ${a.score}%` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
