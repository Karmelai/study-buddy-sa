import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import ChatInterface from "@/components/ChatInterface";
import { getSubjectConfigForGrade, useKarmelStore } from "@/store/useKarmelStore";
import { TEACHER_MODES } from "@/lib/prompts";

export const Route = createFileRoute("/study")({
  head: () => ({ meta: [{ title: "Study - KARMEL" }] }),
  component: Study,
});

const STUDENT_MODES = [
  { id: "explain", label: "Explain a Topic", desc: "Break down any topic step-by-step." },
  { id: "practice_test", label: "Practice & Test", desc: "Choose practice questions or a quick knowledge check." },
  { id: "guided_study", label: "Guided Study Session", desc: "Study actively with an interactive AI partner that breaks down chapters step-by-step." },
  { id: "pat_help", label: "Help with your PAT", desc: "Get guidance, structure planning, and rubric checks for your Practical Assessment Task." },
  { id: "summarize", label: "Summarize Key Notes", desc: "Concise study notes on a topic." },
  { id: "revision", label: "Revision Plan", desc: "Personalized plan up to exam day." },
];

const subjectButtonClass = "text-left px-4 py-3 rounded-xl border text-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:border-primary/70 hover:bg-accent hover:shadow-lg hover:shadow-primary/10 active:translate-y-0 active:scale-[0.98]";
const studyModeCardClass = "group rounded-2xl border border-border bg-card p-5 text-left transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.01] hover:border-primary/70 hover:bg-accent hover:shadow-xl hover:shadow-primary/10 active:translate-y-0 active:scale-[0.985]";

function Study() {
  const grade = useKarmelStore((s) => s.grade);
  const role = useKarmelStore((s) => s.role);
  const savedSubjects = useKarmelStore((s) => s.subjects);
  const setSubjects = useKarmelStore((s) => s.setSubjects);
  const subjectConfig = getSubjectConfigForGrade(grade);
  const [subject, setSubject] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const setLast = useKarmelStore((s) => s.setLast);
  const MODES = useMemo(() => (role === "teacher" ? TEACHER_MODES : STUDENT_MODES), [role]);

  useEffect(() => {
    setSubject(null);
    setMode(null);
  }, [grade]);

  const displaySubjects = savedSubjects.length > 0 ? savedSubjects : subjectConfig.subjects;

  const handleSubjectSelect = (value: string) => {
    setSubject(value);
    if (savedSubjects.length === 0) {
      setSubjects([value]);
    }
  };

  if (subject && mode) {
    const modeLabel = MODES.find((m) => m.id === mode)?.label ?? mode;
    return (
      <AppShell>
        <div className="flex-1 min-h-0 flex flex-col max-w-3xl w-full mx-auto overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
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
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatInterface
              mode={mode}
              subject={subject}
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
          <h1 className="text-2xl mt-1">{savedSubjects.length > 0 ? "Your subjects" : "Choose a subject"}</h1>
          <p className="mt-2 text-sm text-white/50">
            {savedSubjects.length > 0
              ? role === "teacher"
                ? "Select a subject to build resources and guide your students."
                : "Choose the subject you want to study"
              : subjectConfig.type === "senior"
                ? "These grades follow the senior phase compulsory subject list."
                : "Choose the subjects that apply to your learner."}
          </p>

          {savedSubjects.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-2">
              {displaySubjects.map((s) => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  className={`${subjectButtonClass} ${
                    subject === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/60 hover:bg-accent"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-2">
              {subjectConfig.subjects.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSubjectSelect(s)}
                  className={`${subjectButtonClass} ${
                    subject === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/60 hover:bg-accent"
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
            <p className="text-xs uppercase tracking-widest text-white/40">Step 2</p>
            <h2 className="text-2xl mt-1">How can I help you today?</h2>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={studyModeCardClass}
                >
                  <h3 className="font-medium transition-transform duration-200 group-hover:translate-x-1">{m.label}</h3>
                  <p className="text-white/50 text-sm mt-1 transition-transform duration-200 group-hover:translate-x-1">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
