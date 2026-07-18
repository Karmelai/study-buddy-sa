import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp } from "lucide-react";
import { callAI, type ChatMessage } from "@/lib/ai";
import { useKarmelStore } from "@/store/useKarmelStore";

type Entry = { role: "user" | "assistant"; content: string };

type Props = {
  pageId: string;
  pageTitle: string;
  pageText: string;
  explainRequest: { id: string; text: string } | null;
  onExplainHandled: () => void;
};

export function SmartNotesChat({
  pageId,
  pageTitle,
  pageText,
  explainRequest,
  onExplainHandled,
}: Props) {
  const studentName = useKarmelStore((state) => state.studentName);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessage("");
    setMessages([]);
    setError(null);
  }, [pageId]);

  const send = async (question: string) => {
    if (!question.trim() || isLoading) return;
    const nextMessages = [...messages, { role: "user" as const, content: question.trim() }];
    setMessages(nextMessages);
    setMessage("");
    setError(null);
    setIsLoading(true);
    try {
      const context = pageText.slice(0, 15000) || "This page is currently empty.";
      const requestMessages: ChatMessage[] = [
        {
          role: "system",
          content: `You are KARMEL, a helpful study coach. Help the learner understand their Smart Notes page. Use the page below as the primary source, do not invent page content, and clearly say when the page does not contain enough information.\n\nPage title: ${pageTitle}\n\nPage content:\n${context}`,
        },
        ...nextMessages.slice(-6),
      ];
      const reply = await callAI(requestMessages, studentName, "smart_notes_chat");
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "KARMEL could not respond right now.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!explainRequest || isLoading) return;
    onExplainHandled();
    void send(
      `Explain this selected passage clearly and in the context of my notes:\n\n${explainRequest.text}`,
    );
    // Intentional one-click action from the editor selection toolbar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explainRequest?.id]);

  return (
    <aside className="min-h-0 overflow-hidden border-t border-border/70 bg-card/35 lg:border-l lg:border-t-0">
      <div className="flex h-full min-h-0 flex-col">
        <header className="border-b border-border/70 px-4 py-3">
          <p className="text-sm font-semibold">Ask KARMEL</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Using this page as context</p>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {messages.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-3 text-sm leading-6 text-muted-foreground">
              Ask about this page, or highlight text and choose Explain.
            </p>
          ) : null}
          {messages.map((entry, index) =>
            entry.role === "user" ? (
              <div
                key={index}
                className="ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground"
              >
                {entry.content}
              </div>
            ) : (
              <div
                key={index}
                className="max-w-[96%] rounded-2xl rounded-bl-md border border-border bg-background/70 px-3 py-2 text-sm leading-6 [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_p:last-child]:mb-0"
              >
                <ReactMarkdown>{entry.content}</ReactMarkdown>
              </div>
            ),
          )}
          {isLoading ? (
            <p className="animate-pulse text-sm text-muted-foreground">KARMEL is thinking…</p>
          ) : null}
          {error ? (
            <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          ) : null}
        </div>
        <div className="border-t border-border/70 p-3">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-background/60 p-2">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(message);
                }
              }}
              placeholder="Ask about this page…"
              rows={2}
              disabled={isLoading}
              className="min-w-0 flex-1 resize-none bg-transparent px-1 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => void send(message)}
              disabled={!message.trim() || isLoading}
              className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Send to KARMEL"
            >
              <ArrowUp size={17} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
