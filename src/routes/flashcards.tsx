import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from "react";
import {
  BookOpen,
  BrainCircuit,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Keyboard,
  Layers3,
  LoaderCircle,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { callAI } from "@/lib/ai";
import { SMART_EXTRACT_DRAFT_KEY, type SmartExtractDraft } from "@/lib/smartNotes";
import { useKarmelStore } from "@/store/useKarmelStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/flashcards")({
  head: () => ({ meta: [{ title: "Flashcards - KARMEL" }] }),
  component: FlashcardsPage,
});

type Flashcard = { id: string; front: string; back: string };
type FlashcardSet = {
  id: string;
  title: string;
  subject: string;
  cards: Flashcard[];
  createdAt: string;
};
const STORAGE_KEY = "karmel-flashcard-sets";

const cleanJson = (value: string) =>
  value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

function FlashcardsPage() {
  const studentName = useKarmelStore((s) => s.studentName);
  const subjects = useKarmelStore((s) => s.subjects);
  const [view, setView] = useState<"create" | "saved" | "study">("create");
  const [sourceText, setSourceText] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(subjects[0] ?? "General");
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [activeSet, setActiveSet] = useState<FlashcardSet | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [previousCards, setPreviousCards] = useState<string[]>([]);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profileSubjects = useMemo(() => (subjects.length > 0 ? subjects : ["General"]), [subjects]);

  useEffect(() => {
    if (!profileSubjects.includes(subject)) setSubject(profileSubjects[0]);
  }, [profileSubjects, subject]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setSets(JSON.parse(stored) as FlashcardSet[]);
    } catch {
      setSets([]);
    }
  }, []);

  useEffect(() => {
    try {
      const rawDraft = window.sessionStorage.getItem(SMART_EXTRACT_DRAFT_KEY);
      if (!rawDraft) return;
      const draft = JSON.parse(rawDraft) as SmartExtractDraft;
      if (draft.tool !== "flashcards" || !draft.source.trim()) return;
      setSourceText(draft.source);
      setTitle(draft.title);
      window.sessionStorage.removeItem(SMART_EXTRACT_DRAFT_KEY);
    } catch {
      window.sessionStorage.removeItem(SMART_EXTRACT_DRAFT_KEY);
    }
  }, []);

  const saveSets = (nextSets: FlashcardSet[]) => {
    setSets(nextSets);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSets));
  };

  const currentCard = useMemo(
    () => activeSet?.cards.find((card) => card.id === queue[0]) ?? null,
    [activeSet, queue],
  );

  useEffect(() => {
    const requestedSetId = window.localStorage.getItem("karmel-flashcards-open-set");
    if (!requestedSetId) return;
    const requestedSet = sets.find((set) => set.id === requestedSetId);
    if (!requestedSet) return;

    window.localStorage.removeItem("karmel-flashcards-open-set");
    setActiveSet(requestedSet);
    setQueue(shuffle(requestedSet.cards.map((card) => card.id)));
    setPreviousCards([]);
    setIsCardFlipped(false);
    setView("study");
  }, [sets]);

  const generate = async () => {
    if (sourceText.trim().length < 80) {
      setError("Paste a little more text so KARMEL has enough material to make useful cards.");
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const response = await callAI(
        [
          {
            role: "system",
            content:
              "You create accurate, concise study flashcards. Return valid JSON only, with no markdown or commentary.",
          },
          {
            role: "user",
            content: `Create 10 to 18 flashcards from the notes below. Each card must test one important idea. Keep the front as a clear question, term, or prompt. Keep the back as a concise but helpful answer. Do not use knowledge outside the provided notes. Return exactly this JSON shape: {"cards":[{"front":"...","back":"..."}]}.\n\nNotes:\n${sourceText.trim()}`,
          },
        ],
        studentName,
        "flashcards",
      );
      const parsed = JSON.parse(cleanJson(response)) as {
        cards?: Array<{ front?: string; back?: string }>;
      };
      const cards = (parsed.cards ?? [])
        .filter((card) => card.front?.trim() && card.back?.trim())
        .map((card, index) => ({
          id: `${Date.now()}-${index}`,
          front: card.front!.trim(),
          back: card.back!.trim(),
        }));
      if (cards.length < 3)
        throw new Error(
          "KARMEL could not create enough cards from that text. Please try again with more detailed notes.",
        );
      const nextSet: FlashcardSet = {
        id: `${Date.now()}`,
        title: title.trim() || `${subject} revision`,
        subject: subject.trim() || "General",
        cards,
        createdAt: new Date().toISOString(),
      };
      saveSets([nextSet, ...sets]);
      setActiveSet(nextSet);
      setQueue(shuffle(cards.map((card) => card.id)));
      setPreviousCards([]);
      setIsCardFlipped(false);
      setSourceText("");
      setTitle("");
      setView("study");
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "We could not generate flashcards right now.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const openSet = (set: FlashcardSet) => {
    setActiveSet(set);
    setQueue(shuffle(set.cards.map((card) => card.id)));
    setPreviousCards([]);
    setIsCardFlipped(false);
    setView("study");
  };

  const goToNextCard = () => {
    if (!currentCard) return;
    setPreviousCards((cards) => [...cards, currentCard.id]);
    setQueue((cards) => cards.slice(1));
    setIsCardFlipped(false);
  };

  const goToPreviousCard = () => {
    const previousCard = previousCards.at(-1);
    if (!previousCard) return;
    setPreviousCards((cards) => cards.slice(0, -1));
    setQueue((cards) => [previousCard, ...cards]);
    setIsCardFlipped(false);
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Games</p>
            <h1 className="mt-2 text-3xl font-semibold">Flashcards</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Paste your notes, let KARMEL create a study set, then practise what needs the most
              attention.
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-border bg-card p-1">
            <button
              onClick={() => setView("create")}
              className={`rounded-lg px-3 py-2 text-sm transition ${view === "create" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              <Plus className="mr-1.5 inline" size={15} />
              Create
            </button>
            <button
              onClick={() => setView("saved")}
              className={`rounded-lg px-3 py-2 text-sm transition ${view === "saved" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              <Eye className="mr-1.5 inline" size={15} />
              Saved sets {sets.length > 0 ? `(${sets.length})` : ""}
            </button>
          </div>
        </div>

        {view === "create" && (
          <section className="mt-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Set title{" "}
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Cell division revision"
                  className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <div className="grid gap-2 text-sm font-medium">
                <span>Choose your subject</span>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="h-11 rounded-xl bg-background px-3 shadow-none focus:ring-2 focus:ring-primary/30">
                    <SelectValue placeholder="Choose a subject" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border bg-popover p-1">
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Your saved subjects
                    </div>
                    {profileSubjects.map((entry) => (
                      <SelectItem key={entry} value={entry} className="rounded-lg py-2.5">
                        {entry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="mt-5 block text-sm font-medium">
              Drop your work here{" "}
              <span className="font-normal text-muted-foreground">(text only)</span>
              <textarea
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="Paste notes, a textbook section, or revision material here…"
                className="mt-2 min-h-64 w-full resize-y rounded-2xl border border-dashed border-input bg-background/60 p-5 text-sm leading-6 outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Your sets are stored in this browser for now. Database saving comes next.
              </p>
              <button
                disabled={isGenerating || !sourceText.trim()}
                onClick={generate}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <LoaderCircle className="animate-spin" size={17} />
                    Generating flashcards…
                  </>
                ) : (
                  <>
                    <Sparkles size={17} />
                    Generate flashcards
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {view === "saved" && (
          <section className="mt-8">
            {sets.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
                <Layers3 className="mx-auto text-muted-foreground" size={30} />
                <h2 className="mt-4 font-semibold">No flashcard sets yet</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create your first set from notes, then it will appear here.
                </p>
                <button
                  onClick={() => setView("create")}
                  className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
                >
                  Create a set
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {sets.map((set) => (
                  <button
                    key={set.id}
                    onClick={() => openSet(set)}
                    className="group rounded-2xl border border-border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/60 hover:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                        <BookOpen size={18} />
                      </span>
                      <ChevronRight
                        className="text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary"
                        size={18}
                      />
                    </div>
                    <p className="mt-5 text-xs uppercase tracking-wider text-muted-foreground">
                      {set.subject}
                    </p>
                    <h2 className="mt-1 font-semibold">{set.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {set.cards.length} cards · {new Date(set.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {view === "study" && activeSet && (
          <StudySession
            set={activeSet}
            card={currentCard}
            remaining={queue.length}
            canGoPrevious={previousCards.length > 0}
            isFlipped={isCardFlipped}
            onFlip={() => setIsCardFlipped((flipped) => !flipped)}
            onNext={goToNextCard}
            onPrevious={goToPreviousCard}
            onRestart={() => {
              setQueue(shuffle(activeSet.cards.map((card) => card.id)));
              setPreviousCards([]);
              setIsCardFlipped(false);
            }}
          />
        )}
      </div>
    </AppShell>
  );
}

function StudySession({
  set,
  card,
  remaining,
  canGoPrevious,
  isFlipped,
  onFlip,
  onNext,
  onPrevious,
  onRestart,
}: {
  set: FlashcardSet;
  card: Flashcard | null;
  remaining: number;
  canGoPrevious: boolean;
  isFlipped: boolean;
  onFlip: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onRestart: () => void;
}) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [showKeyboardControls, setShowKeyboardControls] = useState(false);

  useEffect(() => {
    setTilt({ x: 0, y: 0 });
  }, [card?.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      )
        return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        onFlip();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onFlip, onNext, onPrevious]);

  const handleCardPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const horizontal = (event.clientX - rect.left) / rect.width;
    const vertical = (event.clientY - rect.top) / rect.height;
    const maxTilt = 8;
    setTilt({
      x: (0.5 - vertical) * maxTilt,
      y: (horizontal - 0.5) * maxTilt,
    });
  };

  const resetCardTilt = () => setTilt({ x: 0, y: 0 });
  const cardStyle: CSSProperties = {
    transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${(isFlipped ? 180 : 0) + tilt.y}deg)`,
  };

  if (!card)
    return (
      <section className="mt-8 rounded-3xl border border-border bg-card p-10 text-center">
        <Check className="mx-auto text-primary" size={36} />
        <h2 className="mt-4 text-xl font-semibold">Session complete</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You worked through {set.cards.length} cards.
        </p>
        <button
          onClick={onRestart}
          className="mt-6 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          <RotateCcw className="mr-1.5 inline" size={15} />
          Study again
        </button>
      </section>
    );
  return (
    <section className="mt-8">
      <p className="text-right text-sm text-muted-foreground">
        {remaining} card{remaining === 1 ? "" : "s"} left
      </p>
      <div className="mt-5 flex items-center gap-3 sm:gap-5">
        <button
          onClick={onPrevious}
          disabled={!canGoPrevious}
          aria-label="Previous card"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-card transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1 [perspective:1200px]">
          <button
            onClick={onFlip}
            onPointerMove={handleCardPointerMove}
            onPointerLeave={resetCardTilt}
            style={cardStyle}
            aria-label={isFlipped ? "Show question" : "Show answer"}
            className="relative flex min-h-80 w-full cursor-pointer [transform-style:preserve-3d] transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none sm:min-h-96"
          >
            <span className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-border bg-card p-8 text-center [backface-visibility:hidden]">
              <BrainCircuit className="text-primary" size={29} />
              <span className="mt-6 text-xs uppercase tracking-[0.25em] text-muted-foreground">
                {set.subject}
              </span>
              <span className="mt-4 max-w-2xl text-xl font-medium leading-relaxed sm:text-2xl">
                {card.front}
              </span>
              <span className="mt-8 text-xs text-muted-foreground">
                Click to reveal the explanation
              </span>
            </span>
            <span className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-primary/35 bg-primary/10 p-8 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <span className="text-xs uppercase tracking-[0.25em] text-primary">Explanation</span>
              <span className="mt-5 max-w-2xl text-lg leading-relaxed sm:text-xl">{card.back}</span>
              <span className="mt-8 text-xs text-muted-foreground">
                Click to see the question again
              </span>
            </span>
          </button>
        </div>
        <button
          onClick={onNext}
          aria-label="Next card"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-card transition hover:bg-accent"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setShowKeyboardControls((show) => !show)}
          aria-expanded={showKeyboardControls}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium transition hover:bg-accent"
        >
          <Keyboard size={16} />
          {showKeyboardControls ? "Hide keyboard controls" : "Keyboard controls"}
        </button>
        {showKeyboardControls ? (
          <div className="mt-3 grid gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground sm:grid-cols-3">
            <p>
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-foreground">
                ↓
              </kbd>{" "}
              Flip card
            </p>
            <p>
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-foreground">
                →
              </kbd>{" "}
              Next card
            </p>
            <p>
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-foreground">
                ←
              </kbd>{" "}
              Previous card
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}
