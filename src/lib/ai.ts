// Change these to switch providers/models later.
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "";
const MODEL = "gemini-3.1-flash-lite-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function callAI(messages: ChatMessage[], userName: string = "Student"): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing Gemini API key. Set VITE_GEMINI_API_KEY in your environment.");
  }

  const personalInstruction = `The student's name is ${userName}. Address them warmly by their first name or username in a natural, friendly way. Never mention their email address.`;
  const normalizedMessages = messages[0]?.role === "system"
    ? [{ role: "system", content: `${messages[0].content}\n\n${personalInstruction}` }, ...messages.slice(1)]
    : [{ role: "system", content: personalInstruction }, ...messages];

  const systemPrompt = normalizedMessages.find((message) => message.role === "system")?.content ?? "";
  const contents = normalizedMessages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: systemPrompt
        ? { parts: [{ text: systemPrompt }] }
        : undefined,
      contents,
      generationConfig: {
        temperature: 0.6,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part: { text?: string }) => part.text ?? "").join("");
}
