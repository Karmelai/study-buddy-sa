import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type GuidedPaperRequest = {
  activeStudyMode: "guided";
  pdf_storage_path: string;
  memo_storage_path: string;
};

const formatPrompt = (messages: ChatMessage[], userName: string) => {
  const systemMessage = messages.find((message) => message.role === "system")?.content ?? "";
  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`)
    .join("\n");

  return [
    systemMessage,
    `Student name: ${userName}.`,
    "Conversation:",
    conversation,
  ]
    .filter(Boolean)
    .join("\n\n");
};

const readGeminiStream = async (response: Response) => {
  if (!response.body) throw new Error("AI response did not include a stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  const consumeLine = (line: string) => {
    if (!line.startsWith("data:")) return;

    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;

    const event = JSON.parse(payload);
    if (event.error) {
      throw new Error(event.error.message ?? "Gemini stream returned an error.");
    }

    text += event.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("") ?? "";
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      consumeLine(buffer.slice(0, newlineIndex).trim());
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf("\n");
    }

    if (done) break;
  }

  consumeLine(buffer.trim());
  return text;
};

export async function callAI(
  messages: ChatMessage[],
  userName: string = "Student",
  mode: string,
  guidedPaper?: GuidedPaperRequest,
): Promise<string> {
  const prompt = formatPrompt(messages, userName);

  if (mode === "pastpaper_guided") {
    if (!guidedPaper) {
      throw new Error("This paper is missing its PDF or memo storage path.");
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch(`${supabaseUrl}/functions/v1/gemini-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        ...(sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
      },
      body: JSON.stringify({
        prompt,
        activeStudyMode: guidedPaper.activeStudyMode,
        pdf_storage_path: guidedPaper.pdf_storage_path,
        memo_storage_path: guidedPaper.memo_storage_path,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error ?? "AI request failed.");
    }

    const text = await readGeminiStream(response);
    if (!text.trim()) throw new Error("AI request returned an empty response.");
    return text;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const response = await fetch(`${supabaseUrl}/functions/v1/gemini-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      ...(sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error ?? "AI request failed.");
  }

  const text = await readGeminiStream(response);

  if (!text.trim()) {
    throw new Error("AI request returned an empty response.");
  }

  return text;
}
