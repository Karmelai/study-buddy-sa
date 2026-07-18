import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, Clock3, FileText, Sparkles } from "lucide-react";
import AppShell from "@/components/AppShell";
import { PastPaperChat } from "@/components/PastPaperChat";
import { PastPaperViewer } from "@/components/PastPaperViewer";
import { getPastPaperUrls } from "@/lib/ai";
import { supabase } from "@/lib/supabase";
import { getSubjectConfigForGrade, type PastPaper, useKarmelStore } from "@/store/useKarmelStore";

export const Route = createFileRoute("/papers")({
  head: () => ({ meta: [{ title: "Past Papers — KARMEL" }] }),
  component: Papers,
});

type PaperStudyMode = "guided" | "exam" | "high_yield";

const EXAM_DURATION_SECONDS = 180 * 60;
const paperChoiceClass = "text-left rounded-xl border px-4 py-3 text-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:border-primary/70 hover:bg-accent hover:shadow-lg hover:shadow-primary/10 active:translate-y-0 active:scale-[0.98]";
const paperModeClass = "group rounded-2xl border border-border bg-card p-4 text-left transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.01] hover:border-primary/70 hover:bg-accent hover:shadow-xl hover:shadow-primary/10 active:translate-y-0 active:scale-[0.985]";

const getPaperDurationMinutes = (paper: PastPaper) => {
  const duration = Number(paper.durationMinutes ?? paper.duration_minutes);
  return Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : EXAM_DURATION_SECONDS / 60;
};

const getPaperLabel = (paper: PastPaper) => {
  if (paper.title ?? paper.paper_title) return paper.title ?? paper.paper_title ?? "Past paper";

  const session = paper.session ?? paper.month ?? "";
  const paperNumber = paper.paper_number ? `Paper ${paper.paper_number}` : "";
  return [paper.year, session, session.includes("Paper") ? "" : paperNumber].filter(Boolean).join(" ");
};

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, "0")).join(":");
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
  const [paperForModeSelection, setPaperForModeSelection] = useState<PastPaper | null>(null);
  const [examTimeLeft, setExamTimeLeft] = useState(EXAM_DURATION_SECONDS);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [paperSignedUrl, setPaperSignedUrl] = useState<string | null>(null);
  const [memoSignedUrl, setMemoSignedUrl] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [highlightedText, setHighlightedText] = useState<string | null>(null);
  const [sessionDetailsOpen, setSessionDetailsOpen] = useState(false);

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
          setPapers(
            ((data ?? []) as PastPaper[]).map((paper) => ({
              ...paper,
              durationMinutes: getPaperDurationMinutes(paper),
            })),
          );
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [grade, subject]);

  useEffect(() => {
    let cancelled = false;
    setPaperSignedUrl(null);
    setMemoSignedUrl(null);
    setViewerError(null);
    setHighlightedText(null);
    if (!activePaper || !["guided", "exam", "high_yield"].includes(activeStudyMode ?? "")) return;
    if (!activePaper.pdf_storage_path || !activePaper.memo_storage_path) {
      setViewerError("This paper is missing its question paper or memorandum file.");
      return;
    }

    void getPastPaperUrls(activePaper.pdf_storage_path, activePaper.memo_storage_path).then((urls) => {
      if (cancelled) return;
      setPaperSignedUrl(urls.pdfUrl);
      setMemoSignedUrl(urls.memoUrl);
    }).catch((cause) => {
      if (!cancelled) setViewerError(cause instanceof Error ? cause.message : "We could not open the question paper.");
    });

    return () => { cancelled = true; };
  }, [activePaper, activeStudyMode]);

  useEffect(() => {
    if (activeStudyMode !== "exam" || !activePaper) {
      setExamTimeLeft(EXAM_DURATION_SECONDS);
      setIsTimeUp(false);
      return;
    }

    const duration = activePaper.durationMinutes;
    const durationSeconds = (Number.isFinite(duration) && (duration ?? 0) > 0 ? duration : EXAM_DURATION_SECONDS / 60) * 60;
    setExamTimeLeft(durationSeconds);
    setIsTimeUp(false);

    const timer = window.setInterval(() => {
      setExamTimeLeft((timeLeft) => {
        if (timeLeft <= 1) {
          window.clearInterval(timer);
          setIsTimeUp(true);
          return 0;
        }
        return timeLeft - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activePaper, activeStudyMode]);

  const selectSubject = (nextSubject: string) => {
    setSubject(nextSubject);
    setActivePaper(null);
    setActiveStudyMode(null);
  };

  const startPaperMode = (mode: PaperStudyMode) => {
    if (!paperForModeSelection) return;
    setSessionDetailsOpen(false);
    setActivePaper(paperForModeSelection);
    setActiveStudyMode(mode);
    setPaperForModeSelection(null);
  };

  const exitPaperSession = () => {
    setSessionDetailsOpen(false);
    setActivePaper(null);
    setActiveStudyMode(null);
    setHighlightedText(null);
  };

  const isPaperSession = activePaper && (activeStudyMode === "guided" || activeStudyMode === "exam" || activeStudyMode === "high_yield");

  if (isPaperSession) {
    const selectedPaper = activePaper;
    const duration = selectedPaper.durationMinutes ?? EXAM_DURATION_SECONDS / 60;
    const modeLabel = activeStudyMode === "guided" ? "Guided Study" : activeStudyMode === "exam" ? "Exam Simulation" : "High Yield Review";
    const chatMode = activeStudyMode === "guided" ? "pastpaper_guided" : activeStudyMode === "exam" ? "pastpaper_exam" : "pastpaper_high_yield";

    return (
      <AppShell>
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          <button type="button" onClick={() => setSessionDetailsOpen((open) => !open)} className="absolute left-1/2 top-0 z-30 grid h-11 w-11 -translate-x-1/2 -translate-y-1/3 place-items-center text-muted-foreground transition hover:text-foreground" aria-label="Toggle session details" aria-expanded={sessionDetailsOpen}>
            <ChevronDown size={27} className={`transition-transform ${sessionDetailsOpen ? "rotate-180" : ""}`} />
          </button>
          {sessionDetailsOpen && <div className="shrink-0 border-b border-border px-6 pb-3 pt-6"><div className="mx-auto w-full max-w-3xl"><p className="text-xs uppercase tracking-widest text-muted-foreground">Grade {activePaper.grade} · {activePaper.subject} · {modeLabel}</p><h1 className="mt-1 truncate text-lg">{getPaperLabel(activePaper)}</h1>{activeStudyMode === "exam" ? <span className="mt-2 inline-block font-mono text-xs text-muted-foreground">{formatTime(examTimeLeft)}</span> : null}</div></div>}
          <div className="min-h-0 flex-1 overflow-hidden">
            {isTimeUp ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <Clock3 className="text-primary" size={42} />
                <h2 className="mt-4 text-2xl font-semibold">Time Expired</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">Your {duration}-minute exam simulation has ended. Chat input is now disabled.</p>
                <button onClick={exitPaperSession} className="mt-6 rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-accent">Return to papers</button>
              </div>
            ) : viewerError ? <div className="grid h-full place-items-center p-6 text-sm text-destructive">{viewerError}</div>
              : !paperSignedUrl ? <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">Loading your paper…</div>
                : <div className="grid h-full min-h-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.6fr)]">
                  <PastPaperViewer pdfUrl={paperSignedUrl} memoUrl={memoSignedUrl ?? undefined} showMemoToggle={activeStudyMode === "guided"} onSendHighlight={setHighlightedText} onExit={exitPaperSession} />
                  <PastPaperChat highlightedText={highlightedText} onClearHighlight={() => setHighlightedText(null)} subject={activePaper.subject} mode={activeStudyMode as PaperStudyMode} />
                </div>}
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
            <h1 className="text-2xl mt-1">{role === "teacher" ? "AI-Curated Question Bank" : "Practice under real conditions"}</h1>
          </div>

          <div>
            <label className="text-sm text-white/50">Subject</label>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
              {displaySubjects.map((item) => (
                <button key={item} onClick={() => selectSubject(item)} className={`${paperChoiceClass} ${subject === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
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
                {!isLoading && !loadError && papers.length === 0 && <p className="text-sm text-white/50">No papers are available for Grade {grade} {subject} yet.</p>}
                {papers.map((paper) => (
                  <button key={paper.id} onClick={() => setPaperForModeSelection(paper)} className={`${paperChoiceClass} border-border bg-card`}>
                    {getPaperLabel(paper)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {paperForModeSelection ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-border bg-popover p-5 text-popover-foreground shadow-2xl sm:p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Choose a study mode</p>
            <h2 className="mt-2 text-xl font-semibold">{getPaperLabel(paperForModeSelection)}</h2>
            <div className="mt-6 grid gap-3">
              <button onClick={() => startPaperMode("guided")} className={paperModeClass}>
                <FileText className="text-primary transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-110" size={20} />
                <span className="mt-3 block font-medium transition-transform duration-200 group-hover:translate-x-1">Guided Study</span>
                <span className="mt-1 block text-sm text-muted-foreground transition-transform duration-200 group-hover:translate-x-1">Work through each question with memo-aligned tutoring.</span>
              </button>
              <button onClick={() => startPaperMode("exam")} className={paperModeClass}>
                <Clock3 className="text-primary transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-110" size={20} />
                <span className="mt-3 block font-medium transition-transform duration-200 group-hover:translate-x-1">Exam Simulation</span>
                <span className="mt-1 block text-sm text-muted-foreground transition-transform duration-200 group-hover:translate-x-1">Write under timed exam conditions based on the paper duration.</span>
              </button>
              <button onClick={() => startPaperMode("high_yield")} className={paperModeClass}>
                <Sparkles className="text-primary transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-110" size={20} />
                <span className="mt-3 block font-medium transition-transform duration-200 group-hover:translate-x-1">High Yield Review</span>
                <span className="mt-1 block text-sm text-muted-foreground transition-transform duration-200 group-hover:translate-x-1">Generate a study sheet from critical questions and the official memo.</span>
              </button>
            </div>
            <button onClick={() => setPaperForModeSelection(null)} className="mt-5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
