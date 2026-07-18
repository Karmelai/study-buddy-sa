import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Brain, CalendarDays, Clock3, FileText, Map } from "lucide-react";
import AppShell from "@/components/AppShell";
import { HowItWorksCarousel, type HowItWorksGuide } from "@/components/ui/how-it-works-carousel";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({ meta: [{ title: "How It Works - KARMEL" }] }),
  component: HowItWorksPage,
});

const guides: HowItWorksGuide[] = [
  {
    icon: BookOpen,
    label: "Start",
    title: "Choose what you want to work on",
    description:
      "Open Study a Subject, pick a subject, then choose a guided study session or build a revision plan.",
  },
  {
    icon: Brain,
    label: "Ask KARMEL",
    title: "Learn with focused AI support",
    description:
      "Ask a question, type your working, or send a clear photo of your notes. KARMEL reads the context and guides you through the selected study activity.",
  },
  {
    icon: FileText,
    label: "Practise",
    title: "Build confidence through practice",
    description:
      "Use practice questions and past papers to identify weak areas. KARMEL can help you understand mistakes and work through the next step.",
  },
  {
    icon: Clock3,
    label: "Focus",
    title: "Make time for deep work",
    description:
      "Use the focus timer when you are ready to concentrate. Consistent study sessions help turn small efforts into steady progress.",
  },
  {
    icon: CalendarDays,
    label: "Plan",
    title: "Keep your important dates organised",
    description:
      "Use Smart Calendar to add deadlines, tests, study blocks, gym sessions, and other events in natural language.",
  },
  {
    icon: Map,
    label: "Progress",
    title: "See your progress grow",
    description:
      "Focused sessions earn XP and move you along your Journey, unlocking profile stickers as you build better study habits.",
  },
];

function HowItWorksPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <HowItWorksCarousel guides={guides} />
      </div>
    </AppShell>
  );
}
