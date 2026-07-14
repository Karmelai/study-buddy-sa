import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Brain, Clock3, FileText, Map } from "lucide-react";
import AppShell from "@/components/AppShell";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({ meta: [{ title: "How It Works - KARMEL" }] }),
  component: HowItWorksPage,
});

const steps = [
  { icon: BookOpen, title: "Choose a subject or past paper", text: "Start with the subject, topic, or CAPS past paper that matches what you need to work on." },
  { icon: Brain, title: "Study with guided AI support", text: "Ask questions, break down difficult ideas, and work through examples at your own pace." },
  { icon: FileText, title: "Practise and review difficult concepts", text: "Use practice and past-paper sessions to identify gaps, review feedback, and strengthen understanding." },
  { icon: Clock3, title: "Complete focus sessions", text: "Set aside uninterrupted study time with the focus timer and build a more consistent study routine." },
  { icon: Map, title: "Earn XP and progress through Journey", text: "Completed focus sessions earn XP, helping you level up and unlock new profile stickers along your Journey." },
];

function HowItWorksPage() {
  return <AppShell><div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
    <section className="rounded-3xl border border-border bg-card p-6 sm:p-10">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-primary">How it works</p>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">A clearer path from study time to progress.</h1>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">Karmel brings focused study tools together so you can learn, practise, and track progress in one place.</p>
    </section>
    <section className="mt-6 grid gap-4 sm:grid-cols-2">
      {steps.map(({ icon: Icon, title, text }, index) => <article key={title} className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50 hover:bg-accent/50 sm:p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={19} /></div>
        <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Step {index + 1}</p>
        <h2 className="mt-2 text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
      </article>)}
    </section>
    <section className="mt-6 flex flex-col items-start justify-between gap-5 rounded-3xl border border-primary/30 bg-primary/10 p-6 sm:flex-row sm:items-center">
      <div><h2 className="text-xl font-semibold">Ready to begin?</h2><p className="mt-1 text-sm text-muted-foreground">Choose a subject and take the next step in your study plan.</p></div>
      <Link to="/study" className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90">Study a subject</Link>
    </section>
  </div></AppShell>;
}
