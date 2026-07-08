import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { callAI, type ChatMessage } from "@/lib/ai";
import { buildSystemPrompt, modeStarters } from "@/lib/prompts";
import { useKarmelStore } from "@/store/useKarmelStore";
import { Mic, Send, Volume2 } from "lucide-react";

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

type Props = {
  mode: string;
  subject?: string;
  contextNote?: string;
};

export default function ChatInterface({
  mode,
  subject,
  contextNote,
}: Props) {
  const grade = useKarmelStore((s) => s.grade);
  const studentName = useKarmelStore((s) => s.studentName);
  const role = useKarmelStore((s) => s.role);

  const systemContent =
    buildSystemPrompt(grade, mode, subject, studentName, role) +
    `\n\n${role === "teacher" ? "Teacher" : "Student"} name: ${studentName}.` +
    (subject ? `\nSubject: ${subject}.` : "") +
    (modeStarters[mode] ? `\n\n${modeStarters[mode]}` : "") +
    (contextNote ? `\n\nContext: ${contextNote}` : "");

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const base: ChatMessage[] = [{ role: "system", content: systemContent }];
    // Hardcoded initial assistant message based on mode (simplified starters)
    let starterMessage = "";
    switch(mode) {
      case "quiz":
        starterMessage = subject 
          ? `Great choice! Let's test your ${subject} knowledge. I'll ask questions one at a time. Ready for the first one?`
          : "Great choice! Let's test your knowledge. I'll ask questions one at a time. Ready for the first one?";
        break;
      case "explain":
        starterMessage = subject
          ? `Awesome! What topic in ${subject} would you like me to explain?`
          : "Awesome! What topic would you like me to explain?";
        break;
      case "practice":
        starterMessage = subject
          ? `Let's dive into some practice questions on ${subject}. Ready?`
          : "Let's do some practice questions. Ready?";
        break;
      case "summarize":
        starterMessage = subject
          ? `Ready to summarize notes on ${subject}? What topic?`
          : "Ready to summarize notes. What topic should I cover?";
        break;
      case "revision":
        starterMessage = subject
          ? `Time to revise your ${subject} knowledge. Where should we start?`
          : "Time for revision. Where should we begin?";
        break;
      default:
        if (mode.startsWith("teacher_")) {
          const teacherStarters: Record<string, string> = {
            teacher_quiz: `Hi ${studentName}! Let's build a quiz${subject ? ` for ${subject}` : ""}. What topic and how many questions?`,
            teacher_lesson: `Hi ${studentName}! Let's draft a lesson plan${subject ? ` for ${subject}` : ""}. What topic and how long is the lesson?`,
            teacher_marking: `Hi ${studentName}! Share the question, the memo or rubric, and the learner's answer, and I'll help you mark it.`,
            teacher_homework: `Hi ${studentName}! Let's create some homework${subject ? ` for ${subject}` : ""}. What topic and difficulty level?`,
            teacher_simplify: `Hi ${studentName}! Which topic${subject ? ` in ${subject}` : ""} would you like me to simplify, and for which grade?`,
            teacher_remedial: `Hi ${studentName}! Are we building a remedial or extension activity, and on what topic?`,
          };
          starterMessage = teacherStarters[mode] ?? "Hello! How can I help you today?";
        } else {
          starterMessage = "Hello! How can I help you today?";
        }
    
    if (starterMessage) {
      base.push({ role: "assistant", content: starterMessage });
    }
    return base;
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const reply = await callAI(next, studentName);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const visible = messages.filter((m) => m.role !== "system");

  const markdownComponents = {
    p: ({ children }: { children?: React.ReactNode }) => <p className="mb-3 last:mb-0 leading-7 text-white/90">{children}</p>,
    ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-3 list-disc pl-5 space-y-1 text-white/90">{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-3 list-decimal pl-5 space-y-1 text-white/90">{children}</ol>,
    li: ({ children }: { children?: React.ReactNode }) => <li className="leading-7">{children}</li>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-white">{children}</strong>,
    em: ({ children }: { children?: React.ReactNode }) => <em className="italic text-white/95">{children}</em>,
    h1: ({ children }: { children?: React.ReactNode }) => <h1 className="mb-3 text-lg font-semibold text-white">{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 className="mb-2 text-base font-semibold text-white">{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-2 text-sm font-semibold text-white">{children}</h3>,
    a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
      <a href={href} target="_blank" rel="noreferrer" className="text-sky-300 underline underline-offset-2">
        {children}
      </a>
    ),
    img: ({ src, alt }: { src?: string; alt?: string }) => (
      <img
        src={src}
        alt={alt || "Generated image"}
        className="my-3 max-w-full rounded-xl border border-white/10 object-contain"
      />
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="mb-3 border-l-2 border-white/20 pl-3 italic text-white/80">{children}</blockquote>
    ),
    code: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <code className={className ? "rounded bg-white/10 px-1 py-0.5 text-sm" : "rounded bg-white/10 px-1 py-0.5 text-sm"}>
        {children}
      </code>
    ),
    pre: ({ children }: { children?: React.ReactNode }) => <pre className="mb-3 overflow-x-auto rounded-lg bg-black/20 p-3 text-sm">{children}</pre>,
  };

  const renderAssistantContent = (content: string) => {
    const normalizedContent = content.replace(
      /(^|[\s])((https?:\/\/[^\s)]+?(?:\.png|\.jpe?g|\.gif|\.webp|\.svg|\/image(?:\.[a-z0-9]+)?)(?:\?[^\s)]+)?))/gi,
      (_match, prefix, url) => `${prefix}![image](${url})`,
    );

    return (
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
        {normalizedContent}
      </ReactMarkdown>
    );
  };

  const speakMessage = (content: string, index: number) => {
    if (typeof window === "undefined") return;

    const synth = window.speechSynthesis;
    const cleanedText = content
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/[`*_>#-]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanedText) return;

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    setSpeakingIndex(index);
    synth.speak(utterance);
  };

  const toggleDictation = () => {
    if (typeof window === "undefined") return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError("Speech dictation is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => Array.from(result).map((item) => item.transcript).join(" "))
        .join(" ")
        .trim();

      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === "not-allowed") {
        setError("Microphone access was denied.");
      } else {
        setError("Voice dictation stopped unexpectedly.");
      }
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setError(null);
    setIsListening(true);
    recognition.start();
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.length === 0 && (
          <p className="text-white/40 text-sm">Start the conversation below.</p>
        )}
        {visible.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            {m.role === "user" ? (
              <div className="max-w-[80%] rounded-2xl bg-white text-black px-4 py-2 text-sm">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[85%] space-y-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm shadow-sm">
                  {renderAssistantContent(m.content)}
                </div>
                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={() => speakMessage(m.content, i)}
                    className="flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2.5 py-1.5 text-xs text-white/80 transition hover:bg-white/20"
                  >
                    <Volume2 size={14} />
                    {speakingIndex === i ? "Playing…" : "Read aloud"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && <p className="text-white/40 text-sm animate-pulse">KARMEL is thinking…</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-black/80 p-3 backdrop-blur">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Type your message…"
            className="flex-1 resize-none bg-transparent border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
          />
          <button
            type="button"
            onClick={toggleDictation}
            className={`h-11 w-11 flex items-center justify-center rounded-xl border transition ${
              isListening
                ? "border-red-400 bg-red-500 text-white"
                : "border-white/15 bg-white/10 text-white/80 hover:bg-white/20"
            }`}
            aria-label={isListening ? "Stop listening" : "Start voice dictation"}
          >
            <Mic size={16} className={isListening ? "animate-pulse" : ""} />
          </button>
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-white text-black h-11 w-11 flex items-center justify-center disabled:opacity-30"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
