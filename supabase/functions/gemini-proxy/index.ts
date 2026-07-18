import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "gemini-3.1-flash-lite";
const PAST_PAPERS_BUCKET = "past-papers";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PaperMode = "guided" | "exam" | "high_yield";

type GeminiRequestBody = {
  action?: "paper_urls";
  prompt?: string;
  highlightedText?: string;
  message?: string;
  conversation?: Array<{ role?: string; content?: string }>;
  subject?: string;
  activeStudyMode?: PaperMode;
  image_data?: string;
  image_mime_type?: string;
  pdf_storage_path?: string;
  memo_storage_path?: string;
};

const PAPER_MODES = new Set<PaperMode>(["guided", "exam", "high_yield"]);
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const PAPER_INSTRUCTIONS: Record<PaperMode, string> = {
  guided: "You are KARMEL, a supportive tutor. When highlighted text is supplied, explain only that selection and guide the student step by step. Follow the student's requested response length and directness: if they ask only for an answer, give the answer and a short reason. When no paper text is selected, answer the student's general question where possible and ask them to highlight the relevant section for paper-specific help. Do not claim that an answer is memo-verified unless the highlighted text itself is from the memorandum.",
  exam: "You are a strict, concise exam proctor. Treat the highlighted text as the question under examination. Ask the student to answer or clarify their attempt. Do not reveal a complete answer unless they explicitly request help.",
  high_yield: "You are KARMEL's high-yield study coach. Turn the highlighted text into a concise study note: key concept, method, formulas, and common exam trap. Do not invent information absent from the selected text.",
};

const PHOTO_INSTRUCTION = "A student-submitted photo is attached. Read it carefully. Use the visible text, work, and diagrams together with the student's message. If no message was supplied, infer a useful next step from the selected study activity. Do not claim that you cannot view images.";

const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, {
  ...init,
  headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers ?? {}) },
});

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const isSafeStoragePath = (path: string) => Boolean(path) && !path.startsWith("/") && !path.includes("..") && !path.includes("\\");
const conversationText = (value: unknown) => Array.isArray(value)
  ? value.slice(-4).map((entry) => {
    const record = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const role = record.role === "assistant" ? "KARMEL" : "Student";
    return `${role}: ${text(record.content).slice(0, 1400)}`;
  }).filter((entry) => entry.length > 10).join("\n\n").slice(0, 4200)
  : "";

const isValidBase64 = (value: string) => {
  try {
    atob(value);
    return true;
  } catch {
    return false;
  }
};

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey || !geminiApiKey) return json({ error: "Missing server configuration." }, { status: 500 });

    const payload = await req.json() as GeminiRequestBody;
    if (payload.action === "paper_urls") {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) return json({ error: "Authentication is required." }, { status: 401 });
      const pdfPath = text(payload.pdf_storage_path);
      const memoPath = text(payload.memo_storage_path);
      if (!isSafeStoragePath(pdfPath) || !isSafeStoragePath(memoPath)) {
        return json({ error: "A valid question-paper and memorandum path are required." }, { status: 400 });
      }
      const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
      const [pdfResult, memoResult] = await Promise.all([
        admin.storage.from(PAST_PAPERS_BUCKET).createSignedUrl(pdfPath, 60 * 60),
        admin.storage.from(PAST_PAPERS_BUCKET).createSignedUrl(memoPath, 60 * 60),
      ]);
      if (pdfResult.error || memoResult.error || !pdfResult.data?.signedUrl || !memoResult.data?.signedUrl) {
        console.error("Past-paper URL signing failed", pdfResult.error, memoResult.error);
        return json({ error: "We could not open this paper." }, { status: 502 });
      }
      return json({ pdfUrl: pdfResult.data.signedUrl, memoUrl: memoResult.data.signedUrl });
    }

    const mode = payload.activeStudyMode;
    const isPaperMode = Boolean(mode && PAPER_MODES.has(mode));
    const highlightedText = text(payload.highlightedText);
    const message = text(payload.message);
    const subject = text(payload.subject);
    const prompt = text(payload.prompt);
    const conversation = conversationText(payload.conversation);
    const imageData = text(payload.image_data);
    const imageMimeType = text(payload.image_mime_type).toLowerCase();

    if (isPaperMode && !highlightedText && !message) {
      return json({ error: "Write a question or highlight text in the paper or memorandum before sending it to KARMEL." }, { status: 400 });
    }
    if (!isPaperMode && !prompt && !imageData) {
      return json({ error: "A message or image is required." }, { status: 400 });
    }

    let photoPart: { inlineData: { mimeType: string; data: string } } | undefined;
    if (imageData || imageMimeType) {
      if (!imageData || !SUPPORTED_IMAGE_TYPES.has(imageMimeType) || !isValidBase64(imageData)) {
        return json({ error: "Please upload a valid JPEG, PNG, WebP, HEIC, or HEIF image." }, { status: 400 });
      }
      if (imageData.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3)) {
        return json({ error: "The photo is too large. Please choose an image smaller than 5 MB." }, { status: 413 });
      }
      photoPart = { inlineData: { mimeType: imageMimeType, data: imageData } };
    }

    const paperPrompt = isPaperMode
      ? [
        `Subject: ${subject || "Not specified"}`,
        highlightedText ? `Highlighted text:\n${highlightedText}` : "No paper text has been selected.",
        conversation ? `Recent conversation (use this to resolve references such as \"it\" or \"that\"):\n${conversation}` : "",
        message ? `Student request:\n${message}` : "Student request: Explain this selected text.",
      ].join("\n\n")
      : prompt;

    const geminiResponse = await fetch(`${GEMINI_URL}&key=${encodeURIComponent(geminiApiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isPaperMode ? { systemInstruction: { parts: [{ text: PAPER_INSTRUCTIONS[mode!] }] } } : {}),
        contents: [{
          role: "user",
          parts: photoPart
            ? [photoPart, { text: PHOTO_INSTRUCTION }, { text: paperPrompt }]
            : [{ text: paperPrompt }],
        }],
        generationConfig: { temperature: isPaperMode ? 0.4 : 0.6 },
      }),
    });

    if (!geminiResponse.ok || !geminiResponse.body) {
      console.error("Gemini request failed", geminiResponse.status, await geminiResponse.text());
      return json({ error: "The AI service could not complete this request." }, { status: 502 });
    }

    return new Response(geminiResponse.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("gemini-proxy unhandled error:", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
});
