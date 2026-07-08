import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import ChatInterface from "@/components/ChatInterface";
import { getSubjectConfigForGrade, useKarmelStore } from "@/store/useKarmelStore";

export const Route = createFileRoute("/papers")({
  head: () => ({ meta: [{ title: "Past Papers — KARMEL" }] }),
  component: Papers,
});

const YEARS = [2024, 2023, 2022, 2021, 2020];
const SESSIONS = ["November Paper 1", "November Paper 2", "June Paper 1", "June Paper 2"];

function Papers() {
  const grade = useKarmelStore((s) => s.grade);
  const savedSubjects = useKarmelStore((s) => s.subjects);
  const [selectedGrade, setSelectedGrade] = useState<number>(grade);
  const [subject, setSubject] = useState<string | null>(null);
  const [paper, setPaper] = useState<string | null>(null);
  const subjectConfig = getSubjectConfigForGrade(selectedGrade);
  const displaySubjects = savedSubjects.length > 0 ? savedSubjects : subjectConfig.subjects;

  useEffect(() => {
    setSubject(null);
    setPaper(null);
  }, [selectedGrade]);

  const handleSubjectSelect = (value: string) => {
    setSubject(value);
  };

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
            />
            {/* AI will generate natural opening + first question */}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-12 pb-24">
        <div className="max-w-4xl mx-auto w-full space-y-10">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40">Past Papers</p>
            <h1 className="text-2xl mt-1">Practice under real conditions</h1>
          </div>

        <div>
          <label className="text-sm text-white/50">Subject</label>
          <p className="mt-2 text-sm text-white/50">
            {savedSubjects.length > 0
              ? "Choose subject to search for past paper"
              : subjectConfig.type === "senior"
                ? "Choose the subject you want to practise."
                : "Choose the subject you want to practise."}
          </p>

          {savedSubjects.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
              {displaySubjects.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSubjectSelect(s)}
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
          ) : (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
              {subjectConfig.subjects.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSubjectSelect(s)}
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
          )}
          {savedSubjects.length > 0 && (
            <p className="mt-3 text-sm text-white/45">
              # Note: these are the subjects saved to your account.
            </p>
          )}
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
      </div>
    </AppShell>
  );
}
