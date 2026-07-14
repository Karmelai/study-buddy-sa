import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import AppShell from "@/components/AppShell";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms & Conditions - KARMEL" }] }),
  component: TermsPage,
});

const terms = [
  ["Using Karmel", "Karmel is provided as a study-support platform. Use it responsibly, provide accurate account information, and keep your login details private."],
  ["Accounts and access", "You are responsible for activity on your account. If you believe your account has been accessed without permission, contact the platform administrator promptly."],
  ["Acceptable use", "Do not use Karmel to harass others, share harmful or unlawful content, attempt to disrupt the service, or misuse AI-generated material."],
  ["AI study support", "AI responses are learning aids and may contain mistakes. Check important answers against class materials, teachers, official memos, and reliable sources."],
  ["Community features", "When using Friends and other social features, respect other students' privacy. Do not post or share another person's personal information without permission."],
  ["Changes to the service", "Features, availability, and these terms may change as Karmel develops. Material updates should be communicated through the platform where practical."],
];

function TermsPage() {
  return <AppShell><div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
    <section className="rounded-3xl border border-border bg-card p-6 sm:p-10"><p className="text-xs font-medium uppercase tracking-[0.3em] text-primary">Terms &amp; Conditions</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Using Karmel responsibly.</h1><p className="mt-5 text-sm leading-7 text-muted-foreground sm:text-base">These starter terms explain the expected use of the platform in plain language.</p></section>
    <aside className="mt-6 flex gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm leading-6 text-foreground"><AlertTriangle className="mt-0.5 shrink-0 text-amber-500" size={20} /><p><strong>Important:</strong> This starter content must be reviewed by a qualified legal professional before production use. It is not legal advice.</p></aside>
    <section className="mt-6 space-y-4">{terms.map(([title, text]) => <article key={title} className="rounded-2xl border border-border bg-card p-6"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p></article>)}</section>
  </div></AppShell>;
}
