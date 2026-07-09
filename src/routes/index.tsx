import { createFileRoute, Link } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";
import { useKarmelStore } from "@/store/useKarmelStore";
import { BookOpen, Clock3, FileText, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KARMEL - Your Study Coach" },
      { name: "description", content: "AI study coach for South African high school students." },
    ],
  }),
  component: Home,
});

function Home() {
  const { studentName, grade, activities, role } = useKarmelStore();

  const recommendation = activities.find((a) => a.weakTopics && a.weakTopics.length > 0) ?? null;
  const isTeacher = role === "teacher";
  const dashboardHeader = isTeacher ? "Select a subject to prepare" : "Select a subject to study";
  const studyTitle = isTeacher ? "AI Teaching Assistant" : "Study a Subject";
  const studyText = isTeacher
    ? "Get guided help with lesson plans, homework, and topics."
    : "Get guided help on any topic with your AI coach.";
  const papersTitle = isTeacher ? "Exam Inspiration Engine" : "Practice Past Paper";
  const papersText = isTeacher
    ? "Let AI analyze past papers to extract high-yield, complex questions to inspire your next assessment."
    : "Work through past exam questions one at a time.";

  return (
    <AppShell>
      <div className="max-w-5xl w-full mx-auto px-6 py-12 space-y-10">
        <section>
          <p className="text-white/50 text-sm">Welcome back</p>
          <h1 className="text-4xl font-semibold mt-1">Hello, {studentName}.</h1>
          <div className="mt-3 flex items-center gap-3 text-sm text-white/60">
            <span>Grade {grade}</span>
          </div>
        </section>

        <section>
          <p className="text-sm uppercase tracking-widest text-white/40 mb-3">{dashboardHeader}</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link to="/study" className="group border border-white/10 hover:border-white/40 rounded-2xl p-6 transition">
            <BookOpen className="text-white/80" />
            <h3 className="mt-4 font-medium">{studyTitle}</h3>
            <p className="text-white/50 text-sm mt-1">{studyText}</p>
          </Link>
          <Link to="/timer" className="group border border-white/10 hover:border-white/40 rounded-2xl p-6 transition">
            <Clock3 className="text-white/80" />
            <h3 className="mt-4 font-medium">Study Timer</h3>
            <p className="text-white/50 text-sm mt-1">Run a focused session with XP and leveling.</p>
          </Link>
          <Link to="/papers" className="group border border-white/10 hover:border-white/40 rounded-2xl p-6 transition">
            <FileText className="text-white/80" />
            <h3 className="mt-4 font-medium">{papersTitle}</h3>
            <p className="text-white/50 text-sm mt-1">{papersText}</p>
          </Link>
          <Link
            to="/friends"
            className="group text-left border border-white/10 hover:border-white/40 rounded-2xl p-6 transition"
          >
            <Users className="text-white/80" />
            <h3 className="mt-4 font-medium">Friends and study</h3>
            <p className="text-white/50 text-sm mt-1">Discover and follow classmates to grow your study circle.</p>
          </Link>
        </section>

        {recommendation && (
          <section className="rounded-2xl border border-white/10 p-6">
            <p className="text-xs uppercase tracking-widest text-white/40">Recommended for you</p>
            <h3 className="mt-2 text-lg">
              Revise <span className="text-white">{recommendation.weakTopics?.[0]}</span> - you struggled last time in{" "}
              {recommendation.subject}.
            </h3>
          </section>
        )}
      </div>

    </AppShell>
  );
}
