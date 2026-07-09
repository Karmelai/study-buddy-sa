import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Timer, Sparkles, ArrowLeft } from "lucide-react";
import AppShell from "@/components/AppShell";
import ChatInterface from "@/components/ChatInterface";
import { getSubjectConfigForGrade, useKarmelStore } from "@/store/useKarmelStore";
import {
  generateSmartExtract,
  startExamSession,
  type SmartExtractItem,
  type ExamSession,
} from "@/lib/pastPapersService";

export const Route = createFileRoute("/papers")({
  head: () => ({ meta: [{ title: "Past Papers — KARMEL" }] }),
  component: Papers,
});

const YEARS = [2024, 2023, 2022, 2021, 2020];
const SESSIONS = ["November Paper 1", "November Paper 2", "June Paper 1", "June Paper 2"];

type StudyMode = "guided" | "exam" | "extract";

const MODES: Array<{
  id: StudyMode;
  icon: typeof BookOpen;
  title: string;
  desc: string;
}> = [
  {
    id: "guided",
    icon: BookOpen,
    title: "Guided Study Session",
    desc: "Work through the paper step-by-step with an AI tutor providing full explanations and answers.",
  },
  {
    id: "exam",
    icon: Timer,
    title: "Real Exam Simulation",
    desc: "Test your speed under exam conditions. AI provides hints only, no full answers.",
  },
  {
    id: "extract",
    icon: Sparkles,
    title: "High-Yield Review (Smart Extract)",
    desc: "AI scans the paper and memo to extract only the most complex, high-value questions.",
  },
];

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function ExamTimer({ session }: { session: ExamSession }) {
  const [remaining, setRemaining] = useState(session.durationSeconds);

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
      setRemaining(Math.max(0, session.durationSeconds - elapsed));
    }, 1000);
    return () => clearInterval(id);
  }, [session]);

  const critical = remaining < 300;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/5">
      <Timer size={14} className={critical ? "text-red-400" : "text-white/70"} />
      <span className={`text-sm font-mono tabular-nums ${critical ? "text-red-400" : "text-white"}`}>
        {formatTime(remaining)}
      </span>
    </div>
  );
}

function SmartExtractView({
  paper,
  subject,
  onBack,
}: {
  paper: string;
  subject: string;
  onBack: () => void;
}) {
  const [items, setItems] = useState<SmartExtractItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    generateSmartExtract(paper, subject).then((data) => {
      if (!cancelled) setItems(data);
    });
    return () => {
      cancelled = true;
    };
  }, [paper, subject]);

  if (!items) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="relative h-16 w-16 mb-6">
          <div className="absolute inset-0 rounded-full border border-white/10" />
          <div className="absolute inset-0 rounded-full border-t border-white animate-spin" />
          <Sparkles size={20} className="absolute inset-0 m-auto text-white/80" />
        </div>
        <p className="text-sm uppercase tracking-widest text-white/40">Scanning</p>
        <h2 className="mt-2 text-lg">Reading {paper}</h2>
        <p className="mt-2 text-sm text-white/50 max-w-md">
          Extracting the highest-yield questions and cross-referencing the memo…
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40">High-Yield Review</p>
            <h1 className="text-2xl mt-1">{paper}</h1>
            <p className="mt-1 text-sm text-white/50">{subject} · {items.length} questions extracted</p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, i) => (
            <article
              key={i}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs uppercase tracking-widest text-white/40">
                  Question {i + 1}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full border border-white/15 text-white/70">
                  {item.marks} marks
                </span>
              </div>

              <p className="text-sm text-white/40 italic leading-6">
                {item.originalQuestion}
              </p>

              <p className="text-base text-white font-medium leading-7">
                {item.rephrasedQuestion}
              </p>

              <div className="pt-2 border-t border-white/5">
                <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
                  Official answer
                </p>
                <ul className="space-y-1.5">
                  {item.officialAnswerBullets.map((b, j) => (
                    <li key={j} className="text-sm text-white/80 leading-6 pl-4 relative">
                      <span className="absolute left-0 top-2.5 h-1 w-1 rounded-full bg-white/50" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModeSelector({
  paper,
  subject,
  onSelect,
  onCancel,
}: {
  paper: string;
  subject: string;
  onSelect: (mode: StudyMode) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-black p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40">Choose a mode</p>
            <h2 className="mt-1 text-xl">{paper}</h2>
            <p className="mt-1 text-sm text-white/50">{subject}</p>
          </div>
          <button onClick={onCancel} className="text-sm text-white/50 hover:text-white">
            Cancel
          </button>
        </div>

        <div className="mt-6 space-y-2">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className="w-full text-left flex items-start gap-4 rounded-xl border border-white/10 hover:border-white/40 hover:bg-white/[0.03] transition p-4"
              >
                <div className="shrink-0 h-10 w-10 rounded-lg border border-white/10 flex items-center justify-center">
                  <Icon size={18} className="text-white/80" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-white">{m.title}</h3>
                  <p className="mt-1 text-xs text-white/50 leading-5">{m.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Papers() {
  const grade = useKarmelStore((s) => s.grade);
  const role = useKarmelStore((s) => s.role);
  const savedSubjects = useKarmelStore((s) => s.subjects);
  const [selectedGrade] = useState<number>(grade);
  const [subject, setSubject] = useState<string | null>(null);
  const [paper, setPaper] = useState<string | null>(null);
  const [pendingPaper, setPendingPaper] = useState<string | null>(null);
  const [mode, setMode] = useState<StudyMode | null>(null);
  const [examSession, setExamSession] = useState<ExamSession | null>(null);
  const subjectConfig = getSubjectConfigForGrade(selectedGrade);
  const displaySubjects = savedSubjects.length > 0 ? savedSubjects : subjectConfig.subjects;

  const chatConfig = useMemo(() => {
    if (!paper || !subject || !mode) return null;
    if (mode === "guided") {
      return {
        mode: "pastpaper_guided",
        contextNote: `Guided study session for ${paper} (Grade ${selectedGrade} ${subject}). Walk through it step-by-step, providing full memo-aligned answers and explanations when the student needs help.`,
      };
    }
    if (mode === "exam") {
      return {
        mode: "pastpaper_exam",
        contextNote: `Simulated exam for ${paper} (Grade ${selectedGrade} ${subject}). Enforce exam conditions — hints only, never full answers.`,
      };
    }
    return null;
  }, [paper, subject, mode, selectedGrade]);

  const resetToPaperList = () => {
    setPaper(null);
    setMode(null);
    setExamSession(null);
  };

  const handleModeSelect = async (chosen: StudyMode) => {
    if (!pendingPaper || !subject) return;
    setPaper(pendingPaper);
    setPendingPaper(null);
    setMode(chosen);
    if (chosen === "exam") {
      const session = await startExamSession(pendingPaper, subject);
      setExamSession(session);
    }
  };

  // Smart Extract full-screen view
  if (paper && subject && mode === "extract") {
    return (
      <AppShell>
        <SmartExtractView paper={paper} subject={subject} onBack={resetToPaperList} />
      </AppShell>
    );
  }

  // Chat view (guided or exam)
  if (paper && subject && chatConfig) {
    return (
      <AppShell>
        <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-white/40">
                Grade {selectedGrade} · {subject} · {mode === "exam" ? "Exam Simulation" : "Guided Study"}
              </p>
              <h1 className="text-lg truncate">{paper}</h1>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {mode === "exam" && examSession && <ExamTimer session={examSession} />}
              <button
                onClick={resetToPaperList}
                className="text-sm text-white/50 hover:text-white"
              >
                Exit
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ChatInterface
              mode={chatConfig.mode}
              subject={subject}
              contextNote={chatConfig.contextNote}
            />
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
            <h1 className="text-2xl mt-1">
              {role === "teacher" ? "AI-Curated Question Bank" : "Practice under real conditions"}
            </h1>
            {role === "teacher" && (
              <p className="mt-2 text-sm text-white/50">
                Select an official past paper below. The AI will read the paper and pull out the most interesting, complex, and curriculum-aligned questions to help you build your upcoming tests and memos.
              </p>
            )}
          </div>

          <div>
            <label className="text-sm text-white/50">Subject</label>
            <p className="mt-2 text-sm text-white/50">
              {savedSubjects.length > 0
                ? "Choose subject to search for past paper"
                : "Choose the subject you want to practise."}
            </p>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
              {displaySubjects.map((s) => (
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
                {YEARS.flatMap((y) => SESSIONS.map((s) => `${y} ${s}`)).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPendingPaper(p)}
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

      {pendingPaper && subject && (
        <ModeSelector
          paper={pendingPaper}
          subject={subject}
          onSelect={handleModeSelect}
          onCancel={() => setPendingPaper(null)}
        />
      )}
    </AppShell>
  );
}
