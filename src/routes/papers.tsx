import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import ChatInterface from "@/components/ChatInterface";
import { supabase } from "@/lib/supabase";
import {
  getSubjectConfigForGrade,
  type PastPaper,
  useKarmelStore,
} from "@/store/useKarmelStore";

export const Route = createFileRoute("/papers")({
  head: () => ({ meta: [{ title: "Past Papers — KARMEL" }] }),
  component: Papers,
});

const getPaperLabel = (paper: PastPaper) => {
  if (paper.title ?? paper.paper_title) return paper.title ?? paper.paper_title ?? "Past paper";

  const session = paper.session ?? paper.month ?? "";
  const paperNumber = paper.paper_number ? `Paper ${paper.paper_number}` : "";
  return [paper.year, session, session.includes("Paper") ? "" : paperNumber]
    .filter(Boolean)
    .join(" ");
};

function Papers() {
  const grade = useKarmelStore((state) => state.grade);
  const role = useKarmelStore((state) => state.role);
  const savedSubjects = useKarmelStore((state) => state.subjects);
  const activePaper = useKarmelStore((state) => state.activePaper);
  const activeStudyMode = useKarmelStore((state) => state.activeStudyMode);
  const setActivePaper = useKarmelStore((state) => state.setActivePaper);
  const setActiveStudyMode = useKarmelStore((state) => state.setActiveStudyMode);
  const [subject, setSubject] = useState<string | null>(null);
  const [papers, setPapers] = useState<PastPaper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const subjectConfig = getSubjectConfigForGrade(grade);
  const displaySubjects = savedSubjects.length > 0 ? savedSubjects : subjectConfig.subjects;

  useEffect(() => {
    if (!subject) {
      setPapers([]);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    void supabase
      .from("past_papers")
      .select("*")
      .eq("grade", grade)
      .eq("subject", subject)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load past papers", error);
          setLoadError("We could not load the available papers. Please try again.");
          setPapers([]);
        } else {
          setPapers((data ?? []) as PastPaper[]);
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [grade, subject]);

  const chatContext = useMemo(() => {
    if (!activePaper || activeStudyMode !== "guided") return null;
    return `Guided study session for ${getPaperLabel(activePaper)} (Grade ${activePaper.grade} ${activePaper.subject}). Walk through it step-by-step, providing full memo-aligned answers and explanations when the student needs help.`;
  }, [activePaper, activeStudyMode]);

  const selectSubject = (nextSubject: string) => {
    setSubject(nextSubject);
    setActivePaper(null);
    setActiveStudyMode(null);
  };

  const startGuidedStudy = (paper: PastPaper) => {
    setActivePaper(paper);
    setActiveStudyMode("guided");
  };

  const exitGuidedStudy = () => {
    setActivePaper(null);
    setActiveStudyMode(null);
  };

  if (activePaper && activeStudyMode === "guided" && chatContext) {
    return (
      <AppShell>
        <div className="flex-1 min-h-0 flex flex-col max-w-3xl w-full mx-auto">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-white/40">
                Grade {activePaper.grade} · {activePaper.subject} · Guided Study
              </p>
              <h1 className="text-lg truncate">{getPaperLabel(activePaper)}</h1>
            </div>
            <button onClick={exitGuidedStudy} className="shrink-0 text-sm text-white/50 hover:text-white">
              Exit
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatInterface mode="pastpaper_guided" subject={activePaper.subject} contextNote={chatContext} />
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
          </div>

          <div>
            <label className="text-sm text-white/50">Subject</label>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
              {displaySubjects.map((item) => (
                <button
                  key={item}
                  onClick={() => selectSubject(item)}
                  className={`text-left px-4 py-3 rounded-xl border text-sm transition ${
                    subject === item
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/60 hover:bg-accent"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {subject && (
            <div>
              <label className="text-sm text-white/50">Select a paper</label>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {isLoading && <p className="text-sm text-white/50">Loading available papers…</p>}
                {loadError && <p className="text-sm text-red-300">{loadError}</p>}
                {!isLoading && !loadError && papers.length === 0 && (
                  <p className="text-sm text-white/50">No papers are available for Grade {grade} {subject} yet.</p>
                )}
                {papers.map((paper) => (
                  <button
                    key={paper.id}
                    onClick={() => startGuidedStudy(paper)}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition hover:border-primary/60 hover:bg-accent"
                  >
                    {getPaperLabel(paper)}
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
