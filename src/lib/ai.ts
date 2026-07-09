import { supabase } from "@/lib/supabase";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

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

export async function callAI(messages: ChatMessage[], userName: string = "Student"): Promise<string> {
  const prompt = formatPrompt(messages, userName);
  const { data, error } = await supabase.functions.invoke<{ text?: string }>("gemini-proxy", {
    body: { prompt },
  });

  if (error) {
    throw new Error(error.message || "AI request failed.");
  }

  const text = typeof data === "string"
    ? data
    : data?.text ?? "";

  if (!text.trim()) {
    throw new Error("AI request returned an empty response.");
  }

  return text;
}
