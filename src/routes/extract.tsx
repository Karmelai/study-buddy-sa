import { Navigate, createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState, type DragEvent } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Check,
  CircleHelp,
  ClipboardCheck,
  FileText,
  Layers3,
  Library,
  Play,
  Save,
  Sparkles,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { callAI } from "@/lib/ai";
import {
  normalizeSmartNoteIds,
  SMART_EXTRACT_DRAFT_KEY,
  type SmartExtractDraft,
} from "@/lib/smartNotes";
import { supabase } from "@/lib/supabase";
import { useKarmelStore } from "@/store/useKarmelStore";

export const Route = createFileRoute("/extract")({
  head: () => ({ meta: [{ title: "Smart Extract - KARMEL" }] }),
  component: SmartExtractPage,
});

export type ExtractKind = "summary" | "flashcards" | "quiz" | "test";
type Flashcard = { id: string; front: string; back: string };
type TestDifficulty = "easy" | "standard" | "challenging" | "mixed";
type TestDuration = 0 | 15 | 30 | 45 | 60;
type TestQuestionType = "multiple_choice" | "true_false" | "multiple_select" | "mixed";
type TestQuestion = {
  section: "knowledge" | "understanding" | "application";
  type: Exclude<TestQuestionType, "mixed">;
  question: string;
  options: string[];
  correctOptions: number[];
  explanation: string;
  marks: number;
};
type TestSettings = {
  questionCount: 10 | 15 | 20 | 30;
  difficulty: TestDifficulty;
  duration: TestDuration;
  questionType: TestQuestionType;
};
const TEST_SECTIONS = [
  { id: "knowledge", label: "Section A: Knowledge and Recall", instruction: "Answer all questions.", difficulty: "easier", marks: 1 },
  { id: "understanding", label: "Section B: Understanding", instruction: "Show that you understand the concepts.", difficulty: "medium", marks: 2 },
  { id: "application", label: "Section C: Application", instruction: "Apply your knowledge to scenario-based questions.", difficulty: "harder", marks: 3 },
] as const;
const testSectionCounts = (count: TestSettings["questionCount"]) => {
  const base = Math.floor(count / 3);
  const remainder = count % 3;
  return [base, base + (remainder > 0 ? 1 : 0), base + (remainder > 1 ? 1 : 0)];
};
export interface Quiz {
  quizId: string;
  title: string;
  subject: string;
  questions: Array<MultipleChoiceQuestion | ProcessSortQuestion | MatchingNodesQuestion>;
}
export interface MultipleChoiceQuestion {
  id: string;
  type: "multiple_choice";
  question: string;
  options: string[];
  correctAnswer: string;
}
export interface ProcessSortQuestion {
  id: string;
  type: "process_sort";
  question: string;
  steps: Array<{ id: string; text: string }>;
  correctOrder: string[];
}
export interface MatchingNodesQuestion {
  id: string;
  type: "matching_nodes";
  question: string;
  terms: Array<{ id: string; text: string }>;
  definitions: Array<{ id: string; text: string }>;
  correctPairs: Record<string, string>;
}
type Result =
  | { kind: "summary"; content: string }
  | { kind: "flashcards"; cards: Flashcard[] }
  | { kind: "quiz"; quiz: Quiz }
  | { kind: "test"; questions: TestQuestion[]; settings: TestSettings };
type LibraryItem = {
  id: string;
  title: string;
  subject: string;
  createdAt: string;
  bestScore?: number;
  result: Result;
};
type NotePage = { id: string; title: string; content: string };
type NoteSection = { id: string; title: string; pages: NotePage[] };
type Notebook = { id: string; title: string; sections: NoteSection[] };
const FLASHCARD_STORAGE_KEY = "karmel-flashcard-sets";
const LIBRARY_STORAGE_KEY = "karmel-smart-extract-library";
const SMART_NOTES_STORAGE_KEY = "karmel-smart-notes";
const makeNoteId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const cleanJson = (value: string) =>
  value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
const summaryToNotesHtml = (markdown: string) => {
  const inline = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  const blocks = markdown
    .trim()
    .split(/\n+/)
    .map((line) => {
      if (/^###\s+/.test(line)) return `<h3>${inline(line.replace(/^###\s+/, ""))}</h3>`;
      if (/^##\s+/.test(line)) return `<h2>${inline(line.replace(/^##\s+/, ""))}</h2>`;
      if (/^#\s+/.test(line)) return `<h1>${inline(line.replace(/^#\s+/, ""))}</h1>`;
      if (/^[-*+]\s+/.test(line)) return `<li>${inline(line.replace(/^[-*+]\s+/, ""))}</li>`;
      return `<p>${inline(line)}</p>`;
    })
    .join("");
  return blocks.replace(/((?:<li>.*?<\/li>)+)/g, "<ul>$1</ul>");
};
const OPTIONS: Array<{
  kind: ExtractKind;
  title: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    kind: "summary",
    title: "Summary",
    description: "Extract the key ideas, terms, and takeaways.",
    icon: FileText,
  },
  {
    kind: "flashcards",
    title: "Flashcards",
    description: "Create a reusable study card set.",
    icon: Layers3,
  },
  {
    kind: "quiz",
    title: "Quiz",
    description: "Try a short knowledge check with feedback.",
    icon: CircleHelp,
  },
  {
    kind: "test",
    title: "Test",
    description: "Generate a longer assessment and score it at the end.",
    icon: ClipboardCheck,
  },
];

function SmartExtractPage() {
  return <Navigate to="/summary" replace />;
}

export function SmartExtractToolPage({ tool }: { tool: ExtractKind }) {
  const studentName = useKarmelStore((state) => state.studentName);
  const subjects = useKarmelStore((state) => state.subjects);
  const userId = useKarmelStore((state) => state.userId);
  const [source, setSource] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(subjects[0] ?? "General");
  const [result, setResult] = useState<Result | null>(null);
  const [view, setView] = useState<"create" | "workspace" | "saved">("create");
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [workingKind, setWorkingKind] = useState<ExtractKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [noteNotebooks, setNoteNotebooks] = useState<Notebook[]>([]);
  const [noteDestination, setNoteDestination] = useState({ notebookId: "", sectionId: "" });
  const [testSettings, setTestSettings] = useState<TestSettings>({
    questionCount: 10,
    difficulty: "standard",
    duration: 0,
    questionType: "multiple_choice",
  });
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const availableSubjects = useMemo(() => (subjects.length ? subjects : ["General"]), [subjects]);
  const selectedOption = OPTIONS.find((option) => option.kind === tool)!;
  const SelectedIcon = selectedOption.icon;
  const savedItems = library.filter((item) => item.result.kind === tool);
  const createLabel =
    tool === "quiz"
      ? "Generate Quiz"
      : tool === "test"
        ? "Generate Test"
        : tool === "flashcards"
          ? "Generate Flashcards"
          : "Create Summary";

  useEffect(() => {
    try {
      setLibrary(
        JSON.parse(window.localStorage.getItem(LIBRARY_STORAGE_KEY) ?? "[]") as LibraryItem[],
      );
    } catch {
      setLibrary([]);
    }
  }, []);
  useEffect(() => {
    try {
      const rawDraft = window.sessionStorage.getItem(SMART_EXTRACT_DRAFT_KEY);
      if (!rawDraft) return;
      const draft = JSON.parse(rawDraft) as SmartExtractDraft;
      if (draft.tool !== tool || !draft.source.trim()) return;
      setSource(draft.source);
      setTitle(draft.title);
      window.sessionStorage.removeItem(SMART_EXTRACT_DRAFT_KEY);
    } catch {
      window.sessionStorage.removeItem(SMART_EXTRACT_DRAFT_KEY);
    }
  }, [tool]);
  useEffect(() => {
    try {
      const notes = normalizeSmartNoteIds(
        JSON.parse(window.localStorage.getItem(SMART_NOTES_STORAGE_KEY) ?? "[]") as Notebook[],
      );
      window.localStorage.setItem(SMART_NOTES_STORAGE_KEY, JSON.stringify(notes));
      setNoteNotebooks(notes);
    } catch {
      setNoteNotebooks([]);
    }
  }, []);
  useEffect(() => {
    if (result?.kind !== "summary" || noteDestination.notebookId) return;
    const firstNotebook = noteNotebooks[0];
    if (firstNotebook)
      setNoteDestination({
        notebookId: firstNotebook.id,
        sectionId: firstNotebook.sections[0]?.id ?? "",
      });
  }, [noteDestination.notebookId, noteNotebooks, result]);
  const saveToLibrary = (nextResult: Result, nextSubject = subject, bestScore?: number) => {
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: title.trim() || `${nextSubject} ${selectedOption.title.toLowerCase()}`,
      subject: nextSubject,
      createdAt: new Date().toISOString(),
      bestScore,
      result: nextResult,
    };
    setLibrary((current) => {
      const next = [item, ...current];
      window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return item;
  };

  const generate = async (kind: ExtractKind) => {
    if (source.trim().length < 80) {
      setError("Paste a little more text so Smart Extract has enough material to work with.");
      return;
    }
    setError(null);
    setSaved(false);
    setAnswers({});
    setFlaggedQuestions({});
    setSubmitted(false);
    setWorkingKind(kind);
    const sectionPlan = TEST_SECTIONS.map((section, index) => {
      const count = testSectionCounts(testSettings.questionCount)[index];
      return `${section.label}: exactly ${count} ${section.difficulty} questions, ${section.marks} mark${section.marks === 1 ? "" : "s"} each.`;
    }).join(" ");
    const instructions: Record<ExtractKind, string> = {
      summary:
        "Write the completed summary now. Use only the supplied notes; do not repeat or describe this instruction. Start with a Markdown # heading, then use short ## sections, concise bullet points, and a final Key terms section. Return Markdown only.",
      flashcards:
        'Create 10 to 18 concise flashcards. Return valid JSON only: {"cards":[{"front":"...","back":"..."}]}.',
      quiz: 'Create a mixed interactive quiz with exactly 6 questions: 2 multiple_choice, 2 process_sort, and 2 matching_nodes. Return valid JSON only matching this schema: {"quizId":"...","title":"...","subject":"...","questions":[{"id":"q1","type":"multiple_choice","question":"...","options":["..."],"correctAnswer":"..."},{"id":"q2","type":"process_sort","question":"...","steps":[{"id":"s1","text":"..."}],"correctOrder":["s1"]},{"id":"q3","type":"matching_nodes","question":"...","terms":[{"id":"t1","text":"..."}],"definitions":[{"id":"d1","text":"..."}],"correctPairs":{"t1":"d1"}}]}. Use only supplied notes.',
      test: `Create an exam paper with exactly ${testSettings.questionCount} ${testSettings.questionType === "mixed" ? "mixed assessment" : testSettings.questionType.replaceAll("_", " ")} questions. Use only the supplied notes. Follow this paper blueprint exactly: ${sectionPlan} The student's requested overall difficulty is ${testSettings.difficulty}; retain the section progression regardless. Return valid JSON only: {"questions":[{"section":"knowledge|understanding|application","type":"multiple_choice|true_false|multiple_select","question":"...","options":["..."],"correctOptions":[0],"explanation":"...","marks":1}]}. The marks must be 1 for knowledge, 2 for understanding, and 3 for application. Multiple-choice questions need exactly one correct option and normally four options. True/false questions must use options ["True","False"] and one correct option. Multiple-select questions need two or more correct options.`,
    };
    try {
      const reply = await callAI(
        [
          {
            role: "system",
            content:
              "You are an accurate study-content extractor. Use only the learner's supplied notes.",
          },
          {
            role: "user",
            content: `${instructions[kind]}\n\nSubject: ${subject}\n\nNotes:\n${source.trim()}`,
          },
        ],
        studentName,
        `smart_extract_${kind}`,
      );
      if (kind === "summary") setResult({ kind, content: reply.trim() });
      else if (kind === "flashcards") {
        const parsed = JSON.parse(cleanJson(reply)) as {
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
            "Smart Extract could not create enough flashcards. Please try again with more detailed notes.",
          );
        setResult({ kind, cards });
      } else if (kind === "quiz") {
        const parsed = JSON.parse(cleanJson(reply)) as Partial<Quiz>;
        const questions = (parsed.questions ?? []).filter(isValidQuizQuestion);
        if (questions.length < 3)
          throw new Error(
            "Smart Extract could not create enough quiz questions. Please try again.",
          );
        setResult({
          kind,
          quiz: {
            quizId: parsed.quizId?.trim() || `${Date.now()}-quiz`,
            title: parsed.title?.trim() || title.trim() || `${subject} quiz`,
            subject: parsed.subject?.trim() || subject,
            questions,
          },
        });
      } else {
        const parsed = JSON.parse(cleanJson(reply)) as { questions?: unknown[] };
        const questions = (parsed.questions ?? []).filter(isValidTestQuestion);
        if (questions.length < 3)
          throw new Error(
            "Smart Extract could not create enough questions. Please try again with more detailed notes.",
          );
        setResult({ kind, questions, settings: testSettings });
      }
      setView("workspace");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Smart Extract could not create that study material right now.",
      );
    } finally {
      setWorkingKind(null);
    }
  };

  const saveFlashcards = () => {
    if (!result || result.kind !== "flashcards") return;
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(FLASHCARD_STORAGE_KEY) ?? "[]",
      ) as unknown[];
      const set = {
        id: `${Date.now()}`,
        title: title.trim() || `${subject} revision`,
        subject,
        cards: result.cards,
        createdAt: new Date().toISOString(),
      };
      window.localStorage.setItem(FLASHCARD_STORAGE_KEY, JSON.stringify([set, ...stored]));
      saveToLibrary(result);
      window.localStorage.setItem("karmel-flashcards-open-set", set.id);
      setSaved(true);
    } catch {
      setError("We could not save this flashcard set in your browser.");
    }
  };
  const saveSummaryToNotes = async () => {
    if (!result || result.kind !== "summary") return;
    const page = {
      id: makeNoteId(),
      title: title.trim() || `Summary • ${subject}`,
      content: summaryToNotesHtml(result.content),
    };
    try {
      const notes = JSON.parse(
        window.localStorage.getItem(SMART_NOTES_STORAGE_KEY) ?? "[]",
      ) as Notebook[];
      const notebook = notes.find((item) => item.id === noteDestination.notebookId);
      const rows: Array<Record<string, string | number | null>> = [];
      if (notebook) {
        const section = notebook.sections.find((item) => item.id === noteDestination.sectionId);
        if (section) {
          section.pages.unshift(page);
          rows.push({
            id: page.id,
            parent_id: section.id,
            node_type: "page",
            title: page.title,
            content: page.content,
            position: 0,
          });
        } else {
          const sectionId = makeNoteId();
          notebook.sections.unshift({
            id: sectionId,
            title: "Summaries",
            pages: [page],
          });
          rows.push(
            {
              id: sectionId,
              parent_id: notebook.id,
              node_type: "section",
              title: "Summaries",
              content: null,
              position: 0,
            },
            {
              id: page.id,
              parent_id: sectionId,
              node_type: "page",
              title: page.title,
              content: page.content,
              position: 0,
            },
          );
        }
      } else {
        const notebookId = makeNoteId();
        const sectionId = makeNoteId();
        notes.unshift({
          id: notebookId,
          title: "Smart Extract",
          sections: [{ id: sectionId, title: "Summaries", pages: [page] }],
        });
        rows.push(
          {
            id: notebookId,
            parent_id: null,
            node_type: "notebook",
            title: "Smart Extract",
            content: null,
            position: 0,
          },
          {
            id: sectionId,
            parent_id: notebookId,
            node_type: "section",
            title: "Summaries",
            content: null,
            position: 0,
          },
          {
            id: page.id,
            parent_id: sectionId,
            node_type: "page",
            title: page.title,
            content: page.content,
            position: 0,
          },
        );
      }
      window.localStorage.setItem(SMART_NOTES_STORAGE_KEY, JSON.stringify(notes));
      setNoteNotebooks(notes);
      if (userId) {
        const { error: saveError } = await supabase
          .from("smart_notes")
          .insert(rows.map((row) => ({ ...row, user_id: userId })));
        if (saveError) throw saveError;
      }
    } catch {
      setError("We could not save this summary to Smart Notes.");
    }
  };
  const saveAssessment = () => {
    if (result && (result.kind === "quiz" || result.kind === "test")) {
      saveToLibrary(result);
      setSaved(true);
    }
  };
  const saveQuiz = (bestScore: number) => {
    if (result?.kind === "quiz") {
      saveToLibrary(result, subject, bestScore);
      setSaved(true);
    }
  };
  const score =
    result && result.kind === "test"
      ? result.questions.reduce(
          (total, question, index) => total + (isCorrectTestAnswer(question, answers[index]) ? question.marks : 0),
          0,
        )
      : 0;

  if (view === "workspace" && result)
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <ToolHeader
            title={selectedOption.title}
            view={view}
            savedCount={savedItems.length}
            onViewChange={setView}
          />
          <ResultPanel
            result={result}
            testTitle={`${subject} Test${title.trim() ? `: ${title.trim()}` : ""}`}
            answers={answers}
            setAnswers={setAnswers}
            flaggedQuestions={flaggedQuestions}
            setFlaggedQuestions={setFlaggedQuestions}
            submitted={submitted}
            setSubmitted={setSubmitted}
            score={score}
            onSaveFlashcards={saveFlashcards}
            onSaveSummary={() => {
              if (result.kind === "summary") {
                saveToLibrary(result);
                setSaved(true);
              }
            }}
            onSaveSummaryToNotes={saveSummaryToNotes}
            onSaveAssessment={saveAssessment}
            onSaveQuiz={saveQuiz}
            onStudyFlashcards={() => {
              if (!saved) saveFlashcards();
              window.location.assign("/flashcards");
            }}
            saved={saved}
            noteNotebooks={noteNotebooks}
            noteDestination={noteDestination}
            onNoteDestinationChange={setNoteDestination}
          />
        </div>
      </AppShell>
    );
  if (view === "saved")
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <ToolHeader
            title={selectedOption.title}
            view={view}
            savedCount={savedItems.length}
            onViewChange={setView}
          />
          {savedItems.length ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {savedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setResult(item.result);
                    setTitle(item.title ?? "");
                    setSubject(item.subject);
                    setSaved(true);
                    setAnswers({});
                    setFlaggedQuestions({});
                    setSubmitted(false);
                    setView("workspace");
                  }}
                  className="rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/70 hover:bg-accent"
                >
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {item.subject}
                  </p>
                  <p className="mt-2 font-semibold">{item.title ?? selectedOption.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Saved {new Date(item.createdAt).toLocaleDateString()}
                    {typeof item.bestScore === "number" ? ` · Best score: ${item.bestScore}%` : ""}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No saved {selectedOption.title.toLowerCase()} yet. Create your first one to find it
              here.
            </div>
          )}
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <ToolHeader
          title={selectedOption.title}
          view={view}
          savedCount={savedItems.length}
          onViewChange={setView}
        />
        <section className="mt-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              {selectedOption.title} title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={`e.g. ${subject} ${selectedOption.title.toLowerCase()}`}
                className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Choose your subject
              <select
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="General">General</option>
                {availableSubjects
                  .filter((entry) => entry !== "General")
                  .map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
              </select>
            </label>
          </div>
          {tool === "test" ? (
            <fieldset className="mt-5 grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
              <legend className="px-1 text-sm font-semibold">Test setup</legend>
              <label className="grid gap-2 text-sm font-medium">
                Number of questions
                <select
                  value={testSettings.questionCount}
                  onChange={(event) =>
                    setTestSettings((current) => ({
                      ...current,
                      questionCount: Number(event.target.value) as TestSettings["questionCount"],
                    }))
                  }
                  className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {[10, 15, 20, 30].map((count) => <option key={count} value={count}>{count}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Difficulty
                <select value={testSettings.difficulty} onChange={(event) => setTestSettings((current) => ({ ...current, difficulty: event.target.value as TestDifficulty }))} className="h-11 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="easy">Easy</option><option value="standard">Standard</option><option value="challenging">Challenging</option><option value="mixed">Mixed</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Test duration
                <select value={testSettings.duration} onChange={(event) => setTestSettings((current) => ({ ...current, duration: Number(event.target.value) as TestDuration }))} className="h-11 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value={0}>No timer</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Question types
                <select value={testSettings.questionType} onChange={(event) => setTestSettings((current) => ({ ...current, questionType: event.target.value as TestQuestionType }))} className="h-11 rounded-xl border border-input bg-background px-3 text-sm">
                  <option value="multiple_choice">Multiple choice</option><option value="true_false">True or false</option><option value="multiple_select">Multiple-select</option><option value="mixed">Mixed assessment</option>
                </select>
                <span className="text-xs font-normal text-muted-foreground">Short answer will be added with reviewed AI grading.</span>
              </label>
            </fieldset>
          ) : null}
          <label className="mt-5 block text-sm font-medium">
            Drop your work here{" "}
            <span className="font-normal text-muted-foreground">(text only)</span>
            <textarea
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Paste notes, a textbook section, or revision material here…"
              className="mt-3 min-h-64 w-full resize-y rounded-2xl border border-dashed border-input bg-background/60 p-5 text-sm leading-6 outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end border-t border-border pt-5">
            <button
              type="button"
              onClick={() => void generate(tool)}
              disabled={workingKind !== null || !source.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SelectedIcon size={17} />
              {workingKind === tool
                ? `${createLabel.replace("Generate", "Generating")}…`
                : createLabel}
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ToolHeader({
  title,
  view,
  savedCount,
  onViewChange,
}: {
  title: string;
  view: "create" | "workspace" | "saved";
  savedCount: number;
  onViewChange: React.Dispatch<React.SetStateAction<"create" | "workspace" | "saved">>;
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Smart Extract</p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Create, save, and revisit your {title.toLowerCase()}.
        </p>
      </div>
      <div className="inline-flex rounded-xl border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => onViewChange("create")}
          className={`rounded-lg px-3 py-2 text-sm transition ${view === "create" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          Create
        </button>
        <button
          type="button"
          onClick={() => onViewChange("saved")}
          className={`rounded-lg px-3 py-2 text-sm transition ${view === "saved" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          Saved {savedCount > 0 ? `(${savedCount})` : ""}
        </button>
      </div>
    </div>
  );
}

type QuizAnswer = string | string[] | Record<string, string>;
type QuizAnswers = Record<string, QuizAnswer>;

function isValidQuizQuestion(
  question: unknown,
): question is MultipleChoiceQuestion | ProcessSortQuestion | MatchingNodesQuestion {
  if (!question || typeof question !== "object") return false;
  const item = question as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.question !== "string") return false;
  if (item.type === "multiple_choice")
    return (
      Array.isArray(item.options) &&
      item.options.every((option) => typeof option === "string") &&
      typeof item.correctAnswer === "string"
    );
  if (item.type === "process_sort")
    return (
      Array.isArray(item.steps) &&
      Array.isArray(item.correctOrder) &&
      item.steps.every(
        (step) =>
          step && typeof step === "object" && typeof (step as { id?: unknown }).id === "string",
      )
    );
  if (item.type === "matching_nodes")
    return (
      Array.isArray(item.terms) &&
      Array.isArray(item.definitions) &&
      !!item.correctPairs &&
      typeof item.correctPairs === "object"
    );
  return false;
}

function isValidTestQuestion(question: unknown): question is TestQuestion {
  if (!question || typeof question !== "object") return false;
  const item = question as Record<string, unknown>;
  const validType =
    item.type === "multiple_choice" || item.type === "true_false" || item.type === "multiple_select";
  const section = TEST_SECTIONS.find((candidate) => candidate.id === item.section);
  const options = Array.isArray(item.options) ? item.options : [];
  const correctOptions = Array.isArray(item.correctOptions) ? item.correctOptions : [];
  const validCorrectOptions =
    correctOptions.length > 0 &&
    correctOptions.every((index) => Number.isInteger(index) && (index as number) >= 0 && (index as number) < options.length);
  return (
    validType &&
    !!section &&
    typeof item.question === "string" &&
    item.question.trim().length > 0 &&
    options.length >= 2 &&
    options.every((option) => typeof option === "string") &&
    validCorrectOptions &&
    (item.type === "multiple_select" ? correctOptions.length >= 2 : correctOptions.length === 1) &&
    typeof item.explanation === "string" &&
    Number.isInteger(item.marks) &&
    (item.marks as number) === section.marks
  );
}

const isCorrectTestAnswer = (question: TestQuestion, answer: number[] | undefined) =>
  !!answer &&
  answer.length === question.correctOptions.length &&
  answer.every((index) => question.correctOptions.includes(index));

function TestTimer({ minutes, onExpired }: { minutes: TestDuration; onExpired: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  useEffect(() => {
    setSecondsLeft(minutes * 60);
  }, [minutes]);
  useEffect(() => {
    if (!secondsLeft) {
      onExpired();
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [onExpired, secondsLeft]);
  if (!minutes) return null;
  return (
    <p className="rounded-xl bg-accent px-3 py-2 text-sm font-medium" role="timer">
      Time remaining: {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
    </p>
  );
}

function QuizSession({
  quiz,
  onSave,
  saved,
}: {
  quiz: Quiz;
  onSave: (score: number) => void;
  saved: boolean;
}) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<QuizAnswers>({});
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const question = quiz.questions[currentQuestionIndex];
  const progress = gradeQuiz(quiz, userAnswers);

  const updateAnswer = (questionId: string, answer: QuizAnswer) =>
    setUserAnswers((current) => ({ ...current, [questionId]: answer }));
  const canContinue = question ? isQuizQuestionAnswered(question, userAnswers[question.id]) : false;
  const retake = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setSelectedTermId(null);
    setShowResults(false);
  };

  if (showResults)
    return (
      <section className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              Quiz complete
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{quiz.title}</h2>
            <p className="mt-3 text-lg font-medium text-primary">
              {progress.correctDisplay} / {quiz.questions.length} · {progress.percent}%
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={retake}
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium"
            >
              Retake quiz
            </button>
            <button
              type="button"
              onClick={() => onSave(progress.percent)}
              disabled={saved}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              <Save size={16} />
              {saved ? "Saved" : "Save to Notebook"}
            </button>
          </div>
        </div>
        <div className="mt-7 space-y-3">
          {quiz.questions.map((item, index) => {
            const result = gradeQuizQuestion(item, userAnswers[item.id]);
            return (
              <article
                key={item.id}
                className={`rounded-2xl border p-4 ${result.score === 1 ? "border-primary/50 bg-primary/10" : "border-destructive/50 bg-destructive/10"}`}
              >
                <p className="text-sm font-medium">
                  {index + 1}. {item.question}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{result.message}</p>
              </article>
            );
          })}
        </div>
      </section>
    );

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            {quiz.subject}
          </p>
          <h2 className="mt-1 text-xl font-semibold">{quiz.title}</h2>
        </div>
        <span className="text-sm text-muted-foreground">
          {currentQuestionIndex + 1} / {quiz.questions.length}
        </span>
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-background p-5">
        <p className="text-lg font-medium">{question.question}</p>
        {question.type === "multiple_choice" ? (
          <MultipleChoiceRenderer
            question={question}
            answer={userAnswers[question.id] as string | undefined}
            onAnswer={(answer) => updateAnswer(question.id, answer)}
          />
        ) : null}
        {question.type === "process_sort" ? (
          <ProcessSortRenderer
            question={question}
            order={userAnswers[question.id] as string[] | undefined}
            onOrderChange={(order) => updateAnswer(question.id, order)}
          />
        ) : null}
        {question.type === "matching_nodes" ? (
          <MatchingNodesRenderer
            question={question}
            pairs={userAnswers[question.id] as Record<string, string> | undefined}
            selectedTermId={selectedTermId}
            onSelectTerm={setSelectedTermId}
            onPairsChange={(pairs) => updateAnswer(question.id, pairs)}
          />
        ) : null}
      </div>
      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCurrentQuestionIndex((index) => Math.max(0, index - 1))}
          disabled={currentQuestionIndex === 0}
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => {
            if (currentQuestionIndex === quiz.questions.length - 1) setShowResults(true);
            else {
              setCurrentQuestionIndex((index) => index + 1);
              setSelectedTermId(null);
            }
          }}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {currentQuestionIndex === quiz.questions.length - 1 ? "Finish quiz" : "Next question"}
        </button>
      </div>
    </section>
  );
}

function MultipleChoiceRenderer({
  question,
  answer,
  onAnswer,
}: {
  question: MultipleChoiceQuestion;
  answer?: string;
  onAnswer: (answer: string) => void;
}) {
  return (
    <div className="mt-5 grid gap-2">
      {question.options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onAnswer(option)}
          className={`rounded-xl border px-4 py-3 text-left text-sm transition ${answer === option ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function ProcessSortRenderer({
  question,
  order,
  onOrderChange,
}: {
  question: ProcessSortQuestion;
  order?: string[];
  onOrderChange: (order: string[]) => void;
}) {
  const orderedIds =
    order?.length === question.steps.length ? order : question.steps.map((step) => step.id);
  const reorder = (fromId: string, toId: string) => {
    const next = [...orderedIds];
    const from = next.indexOf(fromId);
    const to = next.indexOf(toId);
    next.splice(from, 1);
    next.splice(to, 0, fromId);
    onOrderChange(next);
  };
  const onDrop = (event: DragEvent<HTMLButtonElement>, targetId: string) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain");
    if (sourceId && sourceId !== targetId) reorder(sourceId, targetId);
  };
  return (
    <div className="mt-5 space-y-2">
      <p className="text-sm text-muted-foreground">Drag the steps into chronological order.</p>
      {orderedIds.map((id, index) => {
        const step = question.steps.find((item) => item.id === id);
        return (
          <button
            key={id}
            type="button"
            draggable
            onDragStart={(event) => event.dataTransfer.setData("text/plain", id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDrop(event, id)}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm hover:bg-accent"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-xs text-primary">
              {index + 1}
            </span>
            {step?.text}
          </button>
        );
      })}
    </div>
  );
}

function MatchingNodesRenderer({
  question,
  pairs = {},
  selectedTermId,
  onSelectTerm,
  onPairsChange,
}: {
  question: MatchingNodesQuestion;
  pairs?: Record<string, string>;
  selectedTermId: string | null;
  onSelectTerm: (id: string | null) => void;
  onPairsChange: (pairs: Record<string, string>) => void;
}) {
  const connect = (definitionId: string) => {
    if (!selectedTermId) return;
    const next = { ...pairs };
    Object.keys(next).forEach((termId) => {
      if (next[termId] === definitionId) delete next[termId];
    });
    next[selectedTermId] = definitionId;
    onPairsChange(next);
    onSelectTerm(null);
  };
  return (
    <div className="mt-5">
      <p className="text-sm text-muted-foreground">
        Select a term, then select its matching definition.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          {question.terms.map((term) => (
            <button
              key={term.id}
              type="button"
              onClick={() => onSelectTerm(term.id)}
              className={`rounded-xl border px-3 py-3 text-left text-sm ${selectedTermId === term.id ? "border-primary bg-primary/10" : pairs[term.id] ? "border-primary/50 bg-primary/5" : "border-border hover:bg-accent"}`}
            >
              {term.text}
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          {question.definitions.map((definition) => (
            <button
              key={definition.id}
              type="button"
              onClick={() => connect(definition.id)}
              className={`rounded-xl border px-3 py-3 text-left text-sm ${Object.values(pairs).includes(definition.id) ? "border-primary/50 bg-primary/5" : "border-border hover:bg-accent"}`}
            >
              {definition.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function isQuizQuestionAnswered(
  question: Quiz["questions"][number],
  answer: QuizAnswer | undefined,
) {
  if (!answer) return false;
  if (question.type === "multiple_choice") return typeof answer === "string";
  if (question.type === "process_sort")
    return Array.isArray(answer) && answer.length === question.steps.length;
  return (
    !Array.isArray(answer) &&
    typeof answer === "object" &&
    Object.keys(answer).length === question.terms.length
  );
}
function gradeQuizQuestion(question: Quiz["questions"][number], answer: QuizAnswer | undefined) {
  if (question.type === "multiple_choice") {
    const score = answer === question.correctAnswer ? 1 : 0;
    return { score, message: score ? "Correct." : `Correct answer: ${question.correctAnswer}` };
  }
  if (question.type === "process_sort") {
    const score =
      Array.isArray(answer) && answer.every((id, index) => id === question.correctOrder[index])
        ? 1
        : 0;
    return {
      score,
      message: score
        ? "Correct order."
        : `Correct order: ${question.correctOrder.map((id) => question.steps.find((step) => step.id === id)?.text).join(" → ")}`,
    };
  }
  const matches = Object.entries(question.correctPairs).filter(
    ([term, definition]) =>
      !Array.isArray(answer) && typeof answer === "object" && answer?.[term] === definition,
  ).length;
  const score = matches / question.terms.length;
  return { score, message: `${matches} of ${question.terms.length} matches correct.` };
}
function gradeQuiz(quiz: Quiz, answers: QuizAnswers) {
  const score = quiz.questions.reduce(
    (total, question) => total + gradeQuizQuestion(question, answers[question.id]).score,
    0,
  );
  return {
    percent: Math.round((score / quiz.questions.length) * 100),
    correctDisplay: Number.isInteger(score) ? score : score.toFixed(1),
  };
}

function ResultPanel({
  result,
  testTitle,
  answers,
  setAnswers,
  flaggedQuestions,
  setFlaggedQuestions,
  submitted,
  setSubmitted,
  score,
  onSaveFlashcards,
  onSaveSummary,
  onSaveSummaryToNotes,
  onSaveAssessment,
  onSaveQuiz,
  onStudyFlashcards,
  saved,
  noteNotebooks,
  noteDestination,
  onNoteDestinationChange,
}: {
  result: Result;
  testTitle: string;
  answers: Record<number, number[]>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, number[]>>>;
  flaggedQuestions: Record<number, boolean>;
  setFlaggedQuestions: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  submitted: boolean;
  setSubmitted: React.Dispatch<React.SetStateAction<boolean>>;
  score: number;
  onSaveFlashcards: () => void;
  onSaveSummary: () => void;
  onSaveSummaryToNotes: () => void;
  onSaveAssessment: () => void;
  onSaveQuiz: (score: number) => void;
  onStudyFlashcards: () => void;
  saved: boolean;
  noteNotebooks: Notebook[];
  noteDestination: { notebookId: string; sectionId: string };
  onNoteDestinationChange: React.Dispatch<
    React.SetStateAction<{ notebookId: string; sectionId: string }>
  >;
}) {
  const [isSaveToNotesOpen, setIsSaveToNotesOpen] = useState(false);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  if (result.kind === "summary")
    return (
      <section className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileText className="text-primary" size={20} />
            <h2 className="text-lg font-semibold">Summary</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSaveSummary}
              disabled={saved}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              <Save size={16} />
              {saved ? "Saved" : "Save summary"}
            </button>
            <button
              type="button"
              onClick={() => setIsSaveToNotesOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium"
            >
              <Save size={16} />
              Save to Smart Notes
            </button>
          </div>
        </div>
        {isSaveToNotesOpen ? (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-to-notes-title"
          >
            <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-6">
              <h3 id="save-to-notes-title" className="text-lg font-semibold">
                Save to Smart Notes
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose where this summary should be stored.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  Smart Notes notebook
                  <select
                    value={noteDestination.notebookId}
                    onChange={(event) => {
                      const selectedNotebook = noteNotebooks.find(
                        (item) => item.id === event.target.value,
                      );
                      onNoteDestinationChange({
                        notebookId: event.target.value,
                        sectionId: selectedNotebook?.sections[0]?.id ?? "",
                      });
                    }}
                    className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus:border-primary"
                  >
                    <option value="">Create Smart Extract notebook</option>
                    {noteNotebooks.map((notebook) => (
                      <option key={notebook.id} value={notebook.id}>
                        {notebook.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Section
                  <select
                    value={noteDestination.sectionId}
                    onChange={(event) =>
                      onNoteDestinationChange((current) => ({
                        ...current,
                        sectionId: event.target.value,
                      }))
                    }
                    disabled={!noteDestination.notebookId}
                    className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus:border-primary disabled:opacity-50"
                  >
                    {!noteDestination.notebookId ? (
                      <option>Create a Summaries section</option>
                    ) : null}
                    {noteNotebooks
                      .find((notebook) => notebook.id === noteDestination.notebookId)
                      ?.sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.title}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSaveToNotesOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSaveSummaryToNotes();
                    setIsSaveToNotesOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
                >
                  <Save size={16} />
                  Save to Smart Notes
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <article className="mt-5 text-sm leading-7 text-foreground/90">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="mb-4 text-2xl font-semibold leading-tight">{children}</h1>
              ),
              h2: ({ children }) => <h2 className="mb-2 mt-6 text-lg font-semibold">{children}</h2>,
              h3: ({ children }) => <h3 className="mb-2 mt-5 font-semibold">{children}</h3>,
              p: ({ children }) => <p className="mb-3">{children}</p>,
              ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-5">{children}</ul>,
              ol: ({ children }) => (
                <ol className="mb-4 list-decimal space-y-1 pl-5">{children}</ol>
              ),
              li: ({ children }) => <li>{children}</li>,
              strong: ({ children }) => (
                <strong className="font-semibold text-foreground">{children}</strong>
              ),
            }}
          >
            {result.content}
          </ReactMarkdown>
        </article>
      </section>
    );
  if (result.kind === "flashcards")
    return (
      <section className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Layers3 className="text-primary" size={20} />
            <h2 className="text-lg font-semibold">Flashcards</h2>
            <span className="text-sm text-muted-foreground">{result.cards.length} cards</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSaveFlashcards}
              disabled={saved}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium disabled:opacity-60"
            >
              <Save size={16} />
              {saved ? "Saved" : "Save set"}
            </button>
            <button
              type="button"
              onClick={onStudyFlashcards}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
            >
              <Play size={16} />
              Study now
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {result.cards.map((card, index) => (
            <article key={card.id} className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Card {index + 1}
              </p>
              <p className="mt-3 font-medium">{card.front}</p>
              <p className="mt-3 border-t border-border pt-3 text-sm leading-6 text-muted-foreground">
                {card.back}
              </p>
            </article>
          ))}
        </div>
      </section>
    );
  if (result.kind === "quiz")
    return <QuizSession quiz={result.quiz} onSave={onSaveQuiz} saved={saved} />;
  const settings = result.settings;
  const totalMarks = result.questions.reduce((total, question) => total + question.marks, 0);
  const answeredCount = result.questions.filter((_, index) => answers[index]?.length).length;
  const completion = Math.round((answeredCount / result.questions.length) * 100);
  const flaggedCount = result.questions.filter((_, index) => flaggedQuestions[index]).length;
  return (
    <section className="mt-6">
      <div className="sticky top-3 z-20 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Smart Extract assessment</p>
            <h2 className="mt-1 text-xl font-semibold">{testTitle}</h2>
            <p className="text-sm text-muted-foreground">{result.questions.length} questions · {totalMarks} marks · Suggested time: {settings.duration ? `${settings.duration} minutes` : "No timer"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {!submitted ? <TestTimer minutes={settings.duration} onExpired={() => setSubmitted(true)} /> : null}
            <span>{answeredCount}/{result.questions.length} answered</span><span>{completion}% complete</span>
            <button type="button" onClick={onSaveAssessment} disabled={saved} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 font-medium disabled:opacity-60"><Save size={16} />{saved ? "Saved" : "Save"}</button>
          </div>
        </div>
      </div>
      {submitted ? (
        <p className="mt-4 rounded-xl bg-primary/15 px-4 py-3 text-sm font-medium text-primary">
          You scored {score} / {totalMarks} marks
        </p>
      ) : null}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="space-y-5">
        {result.questions.map((question, index) => {
          const section = TEST_SECTIONS.find((candidate) => candidate.id === question.section)!;
          const firstInSection = index === 0 || result.questions[index - 1]?.section !== question.section;
          return <Fragment key={`${question.question}-${index}`}>
          {firstInSection ? (
            <div className="border-b border-foreground pb-4 pt-5 first:pt-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{section.label}</p>
              <p className="mt-2 text-sm">{section.instruction} {section.marks} {section.marks === 1 ? "mark" : "marks"} each. Select every correct answer for multiple-select questions.</p>
            </div>
          ) : null}
          <article
            id={`test-question-${index + 1}`}
            key={`${question.question}-${index}`}
            className="scroll-mt-32 border-b border-border bg-background py-6 first:pt-1"
          >
            <div className="flex items-start justify-between gap-4"><p className="font-medium">Question {index + 1}<span className="ml-3 text-sm font-normal text-muted-foreground">[{question.marks} {question.marks === 1 ? "mark" : "marks"}]</span></p><button type="button" disabled={submitted} onClick={() => setFlaggedQuestions((current) => ({ ...current, [index]: !current[index] }))} className={`text-sm font-medium ${flaggedQuestions[index] ? "text-primary" : "text-muted-foreground"}`}>⚑ {flaggedQuestions[index] ? "Flagged" : "Flag for review"}</button></div>
            <p className="mt-3 font-medium">{question.question}</p>
            <div className="mt-3 grid gap-2">
              {question.options.map((option, optionIndex) => {
                const chosen = answers[index]?.includes(optionIndex) ?? false;
                const correct = question.correctOptions.includes(optionIndex);
                const answerClass = submitted
                  ? correct
                    ? "border-primary bg-primary/15"
                    : chosen
                      ? "border-destructive bg-destructive/10"
                      : "border-border"
                  : chosen
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-accent";
                return (
                  <button
                    key={`${option}-${optionIndex}`}
                    type="button"
                    disabled={submitted}
                    onClick={() =>
                      setAnswers((current) => {
                        const selected = current[index] ?? [];
                        const next =
                          question.type === "multiple_select"
                            ? selected.includes(optionIndex)
                              ? selected.filter((item) => item !== optionIndex)
                              : [...selected, optionIndex]
                            : [optionIndex];
                        return { ...current, [index]: next };
                      })
                    }
                    className={`rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:cursor-default ${answerClass}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {submitted ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                <span className="font-medium text-foreground">Answer:</span>{" "}
                {question.correctOptions.map((optionIndex) => question.options[optionIndex]).join(", ")}. {question.explanation}
              </p>
            ) : null}
          </article>
          </Fragment>;
        })}
      </div>
      <aside className="h-fit rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-32">
        <h3 className="font-semibold">Questions</h3>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {result.questions.map((_, index) => {
            const answered = !!answers[index]?.length;
            const flagged = !!flaggedQuestions[index];
            return <button key={index} type="button" onClick={() => document.getElementById(`test-question-${index + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} className={`h-9 rounded-lg border text-sm font-medium ${flagged ? "border-primary bg-primary/15" : answered ? "border-primary/60 bg-primary/10" : "border-border bg-background"}`}>{index + 1}</button>;
          })}
        </div>
        <div className="mt-4 space-y-1 text-xs text-muted-foreground"><p>● Answered</p><p>○ Unanswered</p><p>⚑ Flagged</p></div>
      </aside>
      {!submitted ? (
          <button
          type="button"
          onClick={() => setIsSubmitConfirmOpen(true)}
          disabled={result.questions.some((question, index) => !(answers[index]?.length))}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check size={16} />
          Submit test
          </button>
      ) : null}
      {isSubmitConfirmOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="submit-test-title">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <h3 id="submit-test-title" className="text-xl font-semibold">Submit your test?</h3>
            <div className="mt-5 space-y-2 rounded-2xl bg-accent/60 p-4 text-sm">
              <p><span className="font-medium">Answered:</span> {answeredCount} of {result.questions.length}</p>
              <p><span className="font-medium">Unanswered:</span> {result.questions.length - answeredCount}</p>
              <p><span className="font-medium">Flagged for review:</span> {flaggedCount}</p>
            </div>
            <p className="mt-5 text-sm leading-6 text-muted-foreground">You will not be able to change your answers after submission.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsSubmitConfirmOpen(false)} className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium">Return to test</button>
              <button type="button" onClick={() => { setIsSubmitConfirmOpen(false); setSubmitted(true); }} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Submit test</button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </section>
  );
}
