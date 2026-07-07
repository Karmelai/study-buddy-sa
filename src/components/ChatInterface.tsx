import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { callAI, type ChatMessage } from "@/lib/ai";
import { buildSystemPrompt, modeStarters } from "@/lib/prompts";
import { useKarmelStore } from "@/store/useKarmelStore";
import { Send } from "lucide-react";

type Props = {
  mode: string;
  subject?: string;
  contextNote?: string;
  initialAssistantMessage?: string;
};

export default function ChatInterface({
  mode,
  subject,
  contextNote,
  initialAssistantMessage,
}: Props) {
  const grade = useKarmelStore((s) => s.grade);
  const studentName = useKarmelStore((s) => s.studentName);

  const systemContent =
    buildSystemPrompt(grade, mode) +
    `\n\nStudent name: ${studentName}.` +
    (subject ? `\nSubject: ${subject}.` : "") +
    (modeStarters[mode] ? `\n\n${modeStarters[mode]}` : "") +
    (contextNote ? `\n\nContext: ${contextNote}` : "");

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const base: ChatMessage[] = [{ role: "system", content: systemContent }];
    if (initialAssistantMessage) {
      base.push({ role: "assistant", content: initialAssistantMessage });
    }
    return base;
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      const reply = await callAI(next);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const visible = messages.filter((m) => m.role !== "system");

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
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
              <div className="max-w-[85%] prose prose-invert prose-sm text-white/90">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}
        {loading && <p className="text-white/40 text-sm animate-pulse">KARMEL is thinking…</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      <div className="border-t border-white/10 p-3">
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
