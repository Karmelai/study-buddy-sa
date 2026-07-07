import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import ChatInterface from "@/components/ChatInterface";
import { SUBJECTS, useKarmelStore } from "@/store/useKarmelStore";

export const Route = createFileRoute("/papers")({
  head: () => ({ meta: [{ title: "Past Papers — KARMEL" }] }),
  component: Papers,
});

const YEARS = [2024, 2023, 2022, 2021, 2020];
const SESSIONS = ["November Paper 1", "November Paper 2", "June Paper 1", "June Paper 2"];

function Papers() {
  const grade = useKarmelStore((s) => s.grade);
  const [selectedGrade, setSelectedGrade] = useState<number>(grade);
  const [subject, setSubject] = useState<string | null>(null);
  const [paper, setPaper] = useState<string | null>(null);

  if (subject && paper) {
    return (
      <AppShell>
        <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/40">
                Grade {selectedGrade} · {subject}
              </p>
              <h1 className="text-lg">{paper}</h1>
            </div>
            <button onClick={() => setPaper(null)} className="text-sm text-white/50 hover:text-white">
              Change
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <ChatInterface
              mode="pastpaper"
              subject={subject}
              contextNote={`Simulating ${paper} for Grade ${selectedGrade} ${subject}. Generate realistic CAPS-aligned questions in the style of this paper.`}
              initialAssistantMessage={`Welcome to your ${subject} past paper session (${paper}). I'll give you one question at a time. Type your answer and I'll mark it. Ready? Reply "start" to begin.`}
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
          <p className="text-xs uppercase tracking-widest text-white/40">Past Papers</p>
          <h1 className="text-2xl mt-1">Practice under real conditions</h1>
        </div>

        <div>
          <label className="text-sm text-white/50">Grade</label>
          <div className="mt-2 flex gap-2 flex-wrap">
            {[8, 9, 10, 11, 12].map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGrade(g)}
                className={`px-4 py-2 rounded-lg border text-sm ${
                  selectedGrade === g
                    ? "border-white bg-white text-black"
                    : "border-white/10 hover:border-white/40"
                }`}
              >
                Grade {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-white/50">Subject</label>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={`text-left px-4 py-3 rounded-xl border text-sm ${
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
            <label className="text-sm text-white/50">Select a paper</label>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
              {YEARS.flatMap((y) =>
                SESSIONS.map((s) => `${y} ${s}`),
              ).map((p) => (
                <button
                  key={p}
                  onClick={() => setPaper(p)}
                  className="text-left border border-white/10 hover:border-white/40 rounded-xl px-4 py-3 text-sm transition"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
