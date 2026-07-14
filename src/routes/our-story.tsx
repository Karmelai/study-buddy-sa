import { createFileRoute } from "@tanstack/react-router";
import { BookHeart, Lightbulb, Target, Users } from "lucide-react";
import AppShell from "@/components/AppShell";

export const Route = createFileRoute("/our-story")({
  head: () => ({ meta: [{ title: "Our Story - KARMEL" }] }),
  component: OurStoryPage,
});

const sections = [
  { icon: Lightbulb, title: "Why Karmel was created", text: "[Add the origin of Karmel here. Describe the moment, need, or idea that led to creating the platform.]" },
  { icon: Users, title: "The problem it aims to solve", text: "[Explain the study challenges South African students face, and how Karmel is intended to make support, practice, and consistency easier to access.]" },
  { icon: BookHeart, title: "The creator's motivation", text: "[Add the creator's own motivation and perspective here. Keep this section personal and factual when you are ready to publish it.]" },
  { icon: Target, title: "The vision for CAPS education", text: "[Describe the long-term vision for helping Grades 8–12 learners build confidence, understanding, and sustainable study habits alongside the CAPS curriculum.]" },
];

function OurStoryPage() {
  return <AppShell><div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
    <section className="rounded-3xl border border-border bg-card p-6 sm:p-10">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-primary">Our story</p>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">Built around a better study experience.</h1>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">This page is intentionally written as an editable starting point. Replace the bracketed copy with Karmel's real story, motivation, and vision.</p>
    </section>
    <section className="mt-6 grid gap-4 md:grid-cols-2">
      {sections.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-border bg-card p-6">
        <Icon className="text-primary" size={22} />
        <h2 className="mt-5 text-xl font-semibold">{title}</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p>
      </article>)}
    </section>
  </div></AppShell>;
}
