import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import ChatInterface from "@/components/ChatInterface";
import { SUBJECTS, useKarmelStore } from "@/store/useKarmelStore";

export const Route = createFileRoute("/study")({
  head: () => ({ meta: [{ title: "Study — KARMEL" }] }),
  component: Study,
});

const MODES = [
  { id: "explain", label: "Explain a Topic", desc: "Break down any topic step-by-step." },
  { id: "practice", label: "Practice Questions", desc: "Try guided practice with feedback." },
  { id: "quiz", label: "Test My Knowledge", desc: "Short quiz with instant marking." },
  { id: "summarize", label: "Summarize Key Notes", desc: "Concise study notes on a topic." },
  { id: "revision", label: "Revision Plan", desc: "Personalized plan up to exam day." },
];

function Study() {
  const [subject, setSubject] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const setLast = useKarmelStore((s) => s.setLast);

  if (subject && mode) {
    const modeLabel = MODES.find((m) => m.id === mode)?.label ?? mode;
    return (
      <AppShell>
        <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/40">{subject}</p>
              <h1 className="text-lg">{modeLabel}</h1>
            </div>
            <button
              onClick={() => {
                setLast(subject, mode);
                setMode(null);
              }}
              className="text-sm text-white/50 hover:text-white"
            >
              Change
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <ChatInterface
              mode={mode}
              subject={subject}
              initialAssistantMessage={`Hi! I'm KARMEL, your ${subject} coach. Let's do ${modeLabel.toLowerCase()}. What topic would you like to focus on?`}
            />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto w-full px-6 py-12 space-y-10">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40">Step 1</p>
          <h1 className="text-2xl mt-1">Choose a subject</h1>
          <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={`text-left px-4 py-3 rounded-xl border text-sm transition ${
                  subject === s
                    ? "border-white bg-white text-black"
                    : "border-white/10 hover:border-white/40"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {subject && (
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40">Step 2</p>
            <h2 className="text-2xl mt-1">How can I help you today?</h2>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className="text-left border border-white/10 hover:border-white/40 rounded-2xl p-5 transition"
                >
                  <h3 className="font-medium">{m.label}</h3>
                  <p className="text-white/50 text-sm mt-1">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
