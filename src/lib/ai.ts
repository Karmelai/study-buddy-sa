import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export type ImageAttachment = {
  data: string;
  mimeType: string;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  image?: ImageAttachment;
};

export type PaperMode = "guided" | "exam" | "high_yield";

export type PaperRequest = {
  activeStudyMode: PaperMode;
  pdf_storage_path: string;
  memo_storage_path: string;
};

type PaperContextSource = {
  pdf_storage_path?: string | null;
  memo_storage_path?: string | null;
};

const extractText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(extractText).join("");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if (typeof record.content === "string") return record.content;
    if (Array.isArray(record.parts)) return record.parts.map(extractText).join("");
  }
  return "";
};

export const createPaperRequest = (
  paper: PaperContextSource | null | undefined,
  activeStudyMode: unknown,
): PaperRequest | undefined => {
  if (
    !paper?.pdf_storage_path ||
    !paper.memo_storage_path ||
    (activeStudyMode !== "guided" && activeStudyMode !== "exam" && activeStudyMode !== "high_yield")
  ) {
    return undefined;
  }

  return {
    activeStudyMode,
    pdf_storage_path: paper.pdf_storage_path,
    memo_storage_path: paper.memo_storage_path,
  };
};

const formatPrompt = (messages: ChatMessage[], userName: string) => {
  const systemMessage = extractText(messages.find((message) => message.role === "system")?.content);
  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${extractText(message.content)}`)
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
      ?.map((part: unknown) => extractText(part))
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
  paperRequest?: PaperRequest,
  image?: ImageAttachment,
): Promise<string> {
  const prompt = formatPrompt(messages, userName);

  if (mode.startsWith("pastpaper_") && !paperRequest) {
    throw new Error("The active paper and official memo must be available before starting this session.");
  }

  if (paperRequest) {
    if (!paperRequest.pdf_storage_path || !paperRequest.memo_storage_path) {
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
        activeStudyMode: paperRequest.activeStudyMode,
        pdf_storage_path: paperRequest.pdf_storage_path,
        memo_storage_path: paperRequest.memo_storage_path,
        ...(image ? { image_data: image.data, image_mime_type: image.mimeType } : {}),
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
    body: JSON.stringify({
      prompt,
      ...(image ? { image_data: image.data, image_mime_type: image.mimeType } : {}),
    }),
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
