import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Camera, Mic, Send, SkipForward, Volume2, X } from "lucide-react";
import { callAI, createPaperRequest, type ChatMessage, type ImageAttachment, type PaperMode } from "@/lib/ai";
import { buildSystemPrompt, modeStarters } from "@/lib/prompts";
import { useKarmelStore } from "@/store/useKarmelStore";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

type Props = { mode: string; subject?: string; contextNote?: string };

const PAPER_MODES: Record<string, PaperMode> = {
  pastpaper_guided: "guided",
  pastpaper_exam: "exam",
  pastpaper_high_yield: "high_yield",
};

const messageText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(messageText).join("");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.content === "string") return record.content;
    if (typeof record.text === "string") return record.text;
    if (Array.isArray(record.parts)) return record.parts.map(messageText).join("");
    return JSON.stringify(value);
  }
  return "";
};

// remark-math recognises dollar delimiters. AI responses may also use the
// standard LaTeX delimiters, so normalise those before parsing while leaving
// fenced and inline code exactly as written.
const normaliseMathDelimiters = (content: string) => content
  .split(/(```[\s\S]*?```|`[^`]*`)/g)
  .map((segment) => {
    if (segment.startsWith("```") || segment.startsWith("`")) return segment;

    return segment
      .replace(/\\\[([\s\S]*?)\\\]/g, (_match, equation: string) => {
        const trimmed = equation.trim();
        return trimmed ? `$$\n${trimmed}\n$$` : _match;
      })
      .replace(/\\\(([^\n]*?)\\\)/g, (_match, equation: string) => {
        const trimmed = equation.trim();
        return trimmed ? `$${trimmed}$` : _match;
      });
  })
  .join("");

const MAX_IMAGE_EDGE = 1280;

const prepareImage = async (file: File): Promise<ImageAttachment> => {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Please choose a photo smaller than 10 MB.");

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("We couldn't read that photo."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const preview = new Image();
    preview.onerror = () => reject(new Error("We couldn't open that photo."));
    preview.onload = () => resolve(preview);
    preview.src = source;
  });
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("We couldn't prepare that photo.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
  const data = dataUrl.split(",")[1];
  if (!data || data.length > Math.ceil(5 * 1024 * 1024 * 4 / 3)) throw new Error("That photo is still too large. Please crop it and try again.");
  return { data, mimeType: "image/jpeg" };
};

const imageSource = (image: ImageAttachment) => `data:${image.mimeType};base64,${image.data}`;

const initialMessage = (mode: string, name: string, subject?: string) => {
  const subjectText = subject ? ` ${subject}` : "";
  const starters: Record<string, string> = {
    quiz: `Hi ${name}. Let's test your${subjectText} knowledge. I'll ask questions one at a time. Ready for the first one?`,
    explain: `Hi ${name}. What topic${subjectText} would you like me to explain?`,
    practice: `Hi ${name}. Let's work through some${subjectText} practice questions. Ready?`,
    practice_test: `Hi ${name}. Would you like practice questions or a quick${subjectText} knowledge check?`,
    guided_study: `Hi ${name}. Let's study${subjectText} step by step. What chapter or topic should we start with?`,
    pat_help: `Hi ${name}. What${subjectText} PAT task or rubric would you like help with?`,
    summarize: `Hi ${name}. What${subjectText} topic should I summarize?`,
    revision: `Hi ${name}. Where should we start revising${subjectText}?`,
  };
  return starters[mode] ?? (mode.startsWith("teacher_") ? `Hi ${name}. How can I help you prepare your lesson resources?` : `Hi ${name}. How can I help you today?`);
};

const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => <h1 className="mb-4 mt-6 text-xl font-semibold text-white first:mt-0">{children}</h1>,
  h2: ({ children }: { children?: ReactNode }) => <h2 className="mb-3 mt-6 text-lg font-semibold text-white first:mt-0">{children}</h2>,
  h3: ({ children }: { children?: ReactNode }) => <h3 className="mb-3 mt-5 text-base font-semibold text-white first:mt-0">{children}</h3>,
  p: ({ children }: { children?: ReactNode }) => <p className="mb-4 whitespace-pre-wrap leading-7 text-white/90 last:mb-0">{children}</p>,
  ul: ({ children }: { children?: ReactNode }) => <ul className="mb-4 list-disc space-y-1.5 pl-5 text-white/90 last:mb-0">{children}</ul>,
  ol: ({ children }: { children?: ReactNode }) => <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-white/90 last:mb-0">{children}</ol>,
  li: ({ children }: { children?: ReactNode }) => <li className="pl-1 leading-7">{children}</li>,
  hr: () => <hr className="my-5 border-0 border-t border-white/20" />,
  blockquote: ({ children }: { children?: ReactNode }) => <blockquote className="mb-4 border-l-2 border-white/25 pl-3 text-white/75 last:mb-0">{children}</blockquote>,
  pre: ({ children }: { children?: ReactNode }) => <pre className="mb-4 overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-3 text-xs leading-6 text-white/90 last:mb-0">{children}</pre>,
  code: ({ children }: { children?: ReactNode }) => <code className="rounded bg-white/10 px-1 py-0.5 text-[0.9em]">{children}</code>,
  strong: ({ children }: { children?: ReactNode }) => <strong className="font-semibold text-white">{children}</strong>,
};

export default function ChatInterface({ mode, subject, contextNote }: Props) {
  const grade = useKarmelStore((state) => state.grade);
  const studentName = useKarmelStore((state) => state.studentName);
  const role = useKarmelStore((state) => state.role);
  const educationLevel = useKarmelStore((state) => state.educationLevel);
  const institutionName = useKarmelStore((state) => state.institutionName);
  const courseOfStudy = useKarmelStore((state) => state.courseOfStudy);
  const yearOfStudy = useKarmelStore((state) => state.yearOfStudy);
  const activePaper = useKarmelStore((state) => state.activePaper);
  const activeStudyMode = useKarmelStore((state) => state.activeStudyMode);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<ImageAttachment | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const initializedSessionRef = useRef<string | null>(null);

  const systemMessage = useMemo(() => {
    const details = [
      `${role === "teacher" ? "Teacher" : "Student"} name: ${studentName}.`,
      subject ? `Subject: ${subject}.` : "",
      modeStarters[mode] ?? "",
      contextNote ? `Context: ${contextNote}` : "",
    ].filter(Boolean).join("\n\n");
    return `${buildSystemPrompt(grade, mode, subject, studentName, role, { educationLevel, institutionName, courseOfStudy, yearOfStudy })}\n\n${details}`;
  }, [contextNote, courseOfStudy, educationLevel, grade, institutionName, mode, role, studentName, subject, yearOfStudy]);

  const paperMode = PAPER_MODES[mode];
  const paperRequest = useMemo(
    () => paperMode ? createPaperRequest(activePaper, paperMode) : undefined,
    [activePaper, paperMode],
  );

  useEffect(() => {
    initializedSessionRef.current = null;
    setError(null);
    setInput("");
    setImage(null);
    setMessages(paperMode ? [{ role: "system", content: systemMessage }] : [
      { role: "system", content: systemMessage },
      { role: "assistant", content: initialMessage(mode, studentName, subject) },
    ]);
  }, [mode, paperMode, studentName, subject, systemMessage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [loading, messages]);

  const sendMessage = useCallback(async (rawText: unknown, hideUserMessage = false) => {
    const attachedImage = image;
    const typedText = messageText(rawText).trim();
    const text = typedText || (attachedImage ? "Please read and help me with the attached photo." : "");
    if (!text || loading) return;

    if (paperMode && !paperRequest) {
      setError("This session needs an active paper and official memo. Return to Papers and select a complete paper.");
      return;
    }

    setError(null);
    setInput("");
    setImage(null);
    const userMessage: ChatMessage = { role: "user", content: text, ...(attachedImage ? { image: attachedImage } : {}) };
    const requestMessages = [...messages, userMessage];
    const displayMessages = hideUserMessage ? messages : requestMessages;
    if (!hideUserMessage) setMessages(requestMessages);
    setLoading(true);

    try {
      const reply = await callAI(requestMessages, studentName, mode, paperRequest, attachedImage ?? undefined);
      setMessages([...displayMessages, { role: "assistant", content: messageText(reply) }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong while contacting KARMEL.");
    } finally {
      setLoading(false);
    }
  }, [loading, messages, mode, paperMode, paperRequest, studentName]);

  const selectImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setError(null);
      setImage(await prepareImage(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't prepare that photo.");
    }
  };

  useEffect(() => {
    if (!paperMode || initializedSessionRef.current === mode || messages.length !== 1 || loading) return;
    initializedSessionRef.current = mode;
    const prompt = paperMode === "high_yield"
      ? "Create the requested High Yield Study Sheet now using the attached exam paper and official memo."
      : paperMode === "exam"
        ? "Initialize the exam simulation. Present Question 1 from the attached active paper only. The learner may skip, move on, or request the memo at any time."
        : "Initialize the guided session from the attached active paper and official memo. Present Question 1 to start.";
    void sendMessage(prompt, true);
  }, [loading, messages.length, mode, paperMode, sendMessage]);

  const toggleDictation = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Speech dictation is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => setInput((current) => {
      const transcript = Array.from(event.results).flatMap((result) => Array.from(result).map((item) => item.transcript)).join(" ").trim();
      return transcript ? `${current}${current ? " " : ""}${transcript}` : current;
    });
    recognition.onerror = () => setError("Voice dictation stopped unexpectedly.");
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setError(null);
    setIsListening(true);
    recognition.start();
  };

  const speak = (content: unknown, index: number) => {
    const text = messageText(content).replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/[`*_>#-]/g, "").replace(/\s+/g, " ").trim();
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    recognitionRef.current?.stop();
  }, []);

  const visibleMessages = messages.filter((message) => message.role !== "system");
  const canSkip = paperMode === "exam" || paperMode === "guided";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 min-h-0 space-y-6 overflow-y-auto px-4 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibleMessages.length === 0 && <p className="text-sm text-white/40">Starting your session…</p>}
        {visibleMessages.map((message, index) => {
          const content = messageText(message.content);
          const renderedContent = normaliseMathDelimiters(content);
          return <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            {message.role === "user" ? (
              <div className="max-w-[80%] space-y-2 rounded-2xl bg-white px-4 py-2 text-sm text-black">
                {message.image && <img src={imageSource(message.image)} alt="Photo sent for AI review" className="max-h-64 rounded-lg object-contain" />}
                {content && <p>{content}</p>}
              </div>
            ) : (
              <div className="max-w-[85%] space-y-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm shadow-sm [&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]} components={markdownComponents}>{renderedContent}</ReactMarkdown>
                </div>
                <button type="button" onClick={() => speak(content, index)} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/20">
                  <Volume2 size={14} />{speakingIndex === index ? "Playing…" : "Read aloud"}
                </button>
              </div>
            )}
          </div>;
        })}
        {loading && <p className="animate-pulse text-sm text-white/40">KARMEL is thinking…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
      <div className="shrink-0 p-3">
        {image && <div className="mx-auto mb-2 flex max-w-3xl items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-2">
          <img src={imageSource(image)} alt="Photo ready to send" className="h-16 w-16 rounded-lg object-cover" />
          <p className="flex-1 text-xs text-white/70">Photo ready to send</p>
          <button type="button" onClick={() => setImage(null)} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Remove photo"><X size={16} /></button>
        </div>}
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <input ref={imageInputRef} type="file" accept="image/*" capture="environment" onChange={(event) => void selectImage(event)} className="sr-only" />
          <button type="button" onClick={() => imageInputRef.current?.click()} disabled={loading} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white disabled:opacity-30" aria-label="Take or upload a photo"><Camera size={17} /></button>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(input); }
          }} rows={1} placeholder={canSkip ? "Answer, type Skip, or ask for the memo…" : "Type your message…"} className="flex-1 resize-none rounded-xl border border-white/15 bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none" />
          <button type="button" onClick={toggleDictation} className={`flex h-11 w-11 items-center justify-center rounded-xl border ${isListening ? "border-red-400 bg-red-500" : "border-white/15 bg-white/10"}`} aria-label={isListening ? "Stop listening" : "Start voice dictation"}><Mic size={16} /></button>
          {canSkip && <button type="button" onClick={() => void sendMessage("Skip this question and present the next question.")} disabled={loading} className="flex h-11 items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white disabled:opacity-30"><SkipForward size={16} />Skip</button>}
          <button type="button" onClick={() => void sendMessage(input)} disabled={loading || (!input.trim() && !image)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-black disabled:opacity-30" aria-label="Send message"><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}
