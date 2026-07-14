import { createFileRoute, Link } from "@tanstack/react-router";
import AppShell from "@/components/AppShell";
import { useKarmelStore } from "@/store/useKarmelStore";
import { BookOpen, Clock3, FileText, Map, Users } from "lucide-react";
import { JOURNEY_REWARDS, xpRequiredForNextLevel } from "@/lib/journey";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KARMEL | AI Study Coach for South African Learners" },
      {
        name: "description",
        content:
          "KARMEL helps South African high school learners study with AI guidance, focused study timers, past-paper practice, and a supportive study community.",
      },
      { property: "og:title", content: "KARMEL | Your AI Study Coach" },
      {
        property: "og:description",
        content:
          "Build better study habits with guided AI support, focus sessions, and past-paper practice designed for South African learners.",
      },
      { name: "twitter:title", content: "KARMEL | Your AI Study Coach" },
      {
        name: "twitter:description",
        content: "Guided study help, focus tools, and past-paper practice for South African high school learners.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { studentName, grade, activities, role, level, xp } = useKarmelStore();

  const recommendation = activities.find((a) => a.weakTopics && a.weakTopics.length > 0) ?? null;
  const isTeacher = role === "teacher";
  const studyTitle = isTeacher ? "AI Teaching Assistant" : "Study a Subject";
  const studyText = isTeacher
    ? "Get guided help with lesson plans, homework, and topics."
    : "Get guided help on any topic with your AI coach.";
  const papersTitle = isTeacher ? "Exam Inspiration Engine" : "Practice Past Paper";
  const papersText = isTeacher
    ? "Let AI analyze past papers to extract high-yield, complex questions to inspire your next assessment."
    : "Work through past exam questions one at a time.";
  const nextReward = JOURNEY_REWARDS.find((reward) => reward.unlockLevel > level);
  const journeyProgress = Math.round((xp / xpRequiredForNextLevel(level)) * 100);
  const dashboardCardClass = "group flex flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.01] hover:border-primary/70 hover:bg-accent hover:shadow-xl hover:shadow-primary/10 active:translate-y-0 active:scale-[0.985] focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 focus:ring-offset-background sm:p-6";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <section className="border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <h1 className="text-3xl font-semibold sm:text-4xl">Hello, {studentName}.</h1>
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/60">Grade {grade}</span>
          </div>
        </section>

        <section className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Link to="/study" className={`${dashboardCardClass} min-h-52 md:col-span-2 lg:col-span-3 lg:row-span-2 lg:min-h-0`}>
            <BookOpen className="text-white/80 transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-110 group-active:scale-95" />
            <div className="mt-auto pt-10 transition-transform duration-200 group-hover:translate-x-0.5 lg:pt-14">
              <h3 className="text-lg font-medium">{studyTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-white/50">{studyText}</p>
            </div>
          </Link>
          <Link to="/timer" className={`${dashboardCardClass} min-h-40`}>
            <Clock3 className="text-white/80 transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-110 group-active:scale-95" />
            <div className="mt-auto pt-7 transition-transform duration-200 group-hover:translate-x-0.5">
              <h3 className="font-medium">Study Timer</h3>
              <p className="mt-1 text-sm text-white/50">Run a focused session with XP and leveling.</p>
            </div>
          </Link>
          <Link to="/papers" className={`${dashboardCardClass} min-h-40`}>
            <FileText className="text-white/80 transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-110 group-active:scale-95" />
            <div className="mt-auto pt-7 transition-transform duration-200 group-hover:translate-x-0.5">
              <h3 className="font-medium">{papersTitle}</h3>
              <p className="mt-1 text-sm text-white/50">{papersText}</p>
            </div>
          </Link>
          <Link to="/journey" className={`${dashboardCardClass} min-h-40`}>
            <Map className="text-white/80 transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-110 group-active:scale-95" />
            <div className="mt-auto pt-7 transition-transform duration-200 group-hover:translate-x-0.5">
              <h3 className="font-medium">Journey</h3>
              <p className="mt-1 text-sm text-white/50">Study, level up, and unlock new stickers.</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-primary" style={{ width: `${journeyProgress}%` }} /></div>
              <p className="mt-2 text-xs text-white/45">{nextReward ? `Next: ${nextReward.name} at Level ${nextReward.unlockLevel}` : "All rewards unlocked"}</p>
            </div>
          </Link>
          <Link
            to="/friends"
            className={`${dashboardCardClass} min-h-40 text-left md:col-span-2 lg:col-span-1`}
          >
            <Users className="text-white/80 transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-110 group-active:scale-95" />
            <div className="mt-auto pt-7 transition-transform duration-200 group-hover:translate-x-0.5">
              <h3 className="font-medium">Friends and study</h3>
              <p className="mt-1 text-sm text-white/50">Discover and follow classmates to grow your study circle.</p>
            </div>
          </Link>
        </section>

        {recommendation && (
          <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
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
