import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { ArrowUp } from "lucide-react";
import { callPastPaperAI, type PaperMode } from "@/lib/ai";

type ChatEntry = { role: "user" | "assistant"; content: string };

// Match normal Study chat behaviour: Gemini can use either $...$ / $$...$$
// or the standard \(...\) / \[...\] LaTex delimiters.
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

type Props = {
  highlightedText: string | null;
  onClearHighlight: () => void;
  subject: string;
  mode: PaperMode;
};

export function PastPaperChat({ highlightedText, onClearHighlight, subject, mode }: Props) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages([]);
    setMessage("");
    setSelectedText(null);
    setError(null);
  }, [mode, subject]);

  const send = useCallback(async (textToExplain: string, followUp = "") => {
    if ((!textToExplain && !followUp.trim()) || loading) return;
    const request = followUp.trim();
    const userContent = request || "Explain this selected section.";
    const nextMessages = [...messages, { role: "user" as const, content: userContent }];
    setMessages(nextMessages);
    setMessage("");
    setError(null);
    setLoading(true);
    try {
      const reply = await callPastPaperAI({
        highlightedText: textToExplain,
        message: request,
        conversation: messages.slice(-4),
        subject,
        activeStudyMode: mode,
      });
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "KARMEL could not respond right now.");
    } finally {
      setLoading(false);
    }
  }, [loading, messages, mode, subject]);

  // A selection is an intentional, one-click request from the floating PDF action.
  useEffect(() => {
    if (!highlightedText || loading) return;
    setSelectedText(highlightedText);
    onClearHighlight();
    void send(highlightedText);
  }, [highlightedText, loading, onClearHighlight, send]);

  const submitMessage = () => {
    if (!message.trim() || loading) return;
    void send(selectedText ?? "", message);
  };

  return (
    <aside className="min-h-0 bg-transparent p-3 sm:p-4 lg:p-5">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-border/40 bg-background/25 shadow-[0_18px_50px_-24px_hsl(var(--foreground)/0.45)] backdrop-blur-lg">
        <header className="border-b border-border/80 px-5 py-4"><p className="text-sm font-semibold">KARMEL</p></header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {messages.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
              Highlight a question or memorandum section, then choose <span className="font-medium text-foreground">Send to KARMEL</span>. You can ask follow-up questions below afterwards.
            </div>
          )}
          {messages.map((entry, index) => entry.role === "user" ? (
            <div key={index} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">{entry.content}</div>
          ) : (
            <div key={index} className="max-w-[94%] rounded-2xl rounded-bl-md border border-border/80 bg-card px-4 py-3 text-sm leading-7 shadow-sm [&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol]:mb-3 [&_ol]:list-decimal [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mb-3"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]}>{normaliseMathDelimiters(entry.content)}</ReactMarkdown></div>
          ))}
          {loading && <p className="animate-pulse px-1 text-sm text-muted-foreground">KARMEL is thinking…</p>}
          {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <div className="p-4 pt-2 sm:p-5 sm:pt-2">
          <div className="flex items-end gap-2 rounded-2xl border border-border/45 bg-background/30 p-2 shadow-[0_12px_28px_-20px_hsl(var(--foreground)/0.55)] backdrop-blur-lg transition focus-within:border-primary/60 focus-within:bg-background/55">
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitMessage(); } }} placeholder={selectedText ? "Ask KARMEL a follow-up…" : "Ask KARMEL anything…"} disabled={loading} rows={2} className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed" />
            <button type="button" onClick={submitMessage} disabled={!message.trim() || loading} className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send to KARMEL"><ArrowUp size={17} /></button>
          </div>
        </div>
      </div>
    </aside>
  );
}
