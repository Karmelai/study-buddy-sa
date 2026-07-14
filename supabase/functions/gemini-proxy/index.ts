import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "gemini-3.1-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;
const BUCKET = "past-papers";
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GeminiRequestBody = {
  prompt?: string;
  activeStudyMode?: string;
  pdf_storage_path?: string;
  memo_storage_path?: string;
  image_data?: string;
  image_mime_type?: string;
};

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const PHOTO_INSTRUCTION = "A student-submitted photo is attached. Read and inspect it carefully. Answer the student's request using the visible work, handwriting, diagrams, and text. If any part is unclear, say exactly what is unreadable and ask for a clearer crop or photo. Do not claim that you cannot view images.";

const json = (body: unknown, init: ResponseInit = {}) =>
  Response.json(body, {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });

const isSafeStoragePath = (path: string) =>
  Boolean(path) && !path.startsWith("/") && !path.includes("..") && !path.includes("\\");

const toTrimmedString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const isValidBase64 = (value: string) => {
  try {
    atob(value);
    return true;
  } catch {
    return false;
  }
};

const GUIDED_STUDY_RULES = `You are KARMEL, a helpful high-school mathematics tutor.

Persona and style:
- Greet the user exactly once at the start of the session using "Hi [User Name]". Never repeat that greeting or add "Hi" in later turns.
- Be supportive and concise. Guide the student toward the answer instead of simply giving it away.

Mathematical formatting:
- Use $...$ for short inline expressions and $$...$$ on their own lines for full equations.
- Use clean LaTeX: $\\sqrt{x}$ for square roots, $x^2$ for exponents, $\\frac{a}{b}$ for fractions, $\\bar{x}$ for an overline, and $a \\pm b$ for plus-minus operations.
- Never improvise notation as x-bar, y-bar, or [numerator] / [denominator]. Do not wrap ordinary prose in math delimiters.

Guided-study behaviour:
- Do not dump the entire paper or massive blocks of text at once.
- Present the first question clearly from the attached paper and ask the user how they want to approach it.
- Validate the student's logic using the attached official marking memo.
- If they struggle, do not give the final answer immediately; explain the core concept and guide them to the conclusion step-by-step.`;

const EXAM_SIMULATION_RULES = `You are a strict, silent exam proctor.
- Greet the user exactly once at the start of the session using "Hi [User Name]". Never repeat that greeting or add "Hi" in later turns.
- Use the attached examination paper and official memo as the only source of questions, answers, and marking guidance. Do not invent, substitute, or paraphrase a different question.
- Wait for the student to submit an answer.
- Do not provide explanations, study tips, conversational filler, or direct answers unless the student explicitly asks for help or is clearly stuck.
- Keep every response extremely concise.
- Use $...$ for short expressions and $$...$$ on their own lines for full equations. Use clean LaTeX notation such as $\\bar{x}$, $\\sum$, $\\frac{a}{b}$, and $x^2$; never improvised plain-text equations.`;

const HIGH_YIELD_SYSTEM_PROMPT = `You are a master exam tutor. Analyze the provided exam paper and memo. Create a 'High Yield Study Sheet'. For each critical question, format the response exactly as follows:
- Original Question: [Quote the text exactly]
- Simplified Concept: [Explain the question in plain, easy-to-understand English]
- Official Answer: [Provide the answer in concise bullet points derived strictly from the memo]`;

serve(async (req) => {
  console.log("--- FUNCTION START ---");
  console.log("Environment check: Has Service Key?", !!Deno.env.get("SERVICE_ROLE_KEY"));

  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey || !geminiApiKey) {
      console.error("Missing required server environment variables.");
      return json({ error: "Missing required server environment variables." }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const payload = await req.json() as GeminiRequestBody;
    const prompt = toTrimmedString(payload.prompt);
    if (!prompt) return json({ error: "prompt is required." }, { status: 400 });

    const paperMode = payload.activeStudyMode === "guided" || payload.activeStudyMode === "exam" || payload.activeStudyMode === "high_yield";
    const guidedMode = payload.activeStudyMode === "guided";
    const examMode = payload.activeStudyMode === "exam";
    const highYieldMode = payload.activeStudyMode === "high_yield";
    const pdfPath = toTrimmedString(payload.pdf_storage_path);
    const memoPath = toTrimmedString(payload.memo_storage_path);
    const imageData = toTrimmedString(payload.image_data);
    const imageMimeType = toTrimmedString(payload.image_mime_type).toLowerCase();
    const documentParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    let photoPart: { inlineData: { mimeType: string; data: string } } | undefined;

    if (imageData || imageMimeType) {
      if (!imageData || !SUPPORTED_IMAGE_TYPES.has(imageMimeType)) {
        return json({ error: "Please upload a JPEG, PNG, WebP, HEIC, or HEIF image." }, { status: 400 });
      }
      if (imageData.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3)) {
        return json({ error: "The photo is too large. Please choose an image smaller than 5 MB." }, { status: 413 });
      }
      if (!isValidBase64(imageData)) {
        return json({ error: "The uploaded photo could not be read. Please try another image." }, { status: 400 });
      }
      photoPart = { inlineData: { mimeType: imageMimeType, data: imageData } };
    }

    if (paperMode) {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) return json({ error: "Authentication is required." }, { status: 401 });
      if (!isSafeStoragePath(pdfPath) || !isSafeStoragePath(memoPath)) {
        return json({ error: "Valid PDF and memo storage paths are required for guided study." }, { status: 400 });
      }

      const { data: paper, error: paperError } = await admin
        .from("past_papers")
        .select("id")
        .eq("pdf_storage_path", pdfPath)
        .eq("memo_storage_path", memoPath)
        .maybeSingle();
      if (paperError || !paper) return json({ error: "Past paper was not found." }, { status: 404 });

      console.log("Attempting to download PDF path:", pdfPath);
      console.log("Attempting to download Memo path:", memoPath);
      const [pdfResult, memoResult] = await Promise.all([
        admin.storage.from(BUCKET).download(pdfPath),
        admin.storage.from(BUCKET).download(memoPath),
      ]);

      if (pdfResult.error) console.error("Supabase Storage PDF Download Error:", pdfResult.error);
      if (memoResult.error) console.error("Supabase Storage Memo Download Error:", memoResult.error);
      if (pdfResult.error || memoResult.error || !pdfResult.data || !memoResult.data) {
        const reason = pdfResult.error?.message || memoResult.error?.message || "File data missing";
        return json({ error: `Unable to retrieve documents: ${reason}` }, { status: 502 });
      }
      if (pdfResult.data.size === 0 || memoResult.data.size === 0) {
        return json({ error: "The paper or memo file is empty." }, { status: 422 });
      }

      const [pdfBytes, memoBytes] = await Promise.all([
        pdfResult.data.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
        memoResult.data.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
      ]);
      documentParts.push(
        { inlineData: { mimeType: pdfResult.data.type || "application/pdf", data: toBase64(pdfBytes) } },
        { inlineData: { mimeType: memoResult.data.type || "application/pdf", data: toBase64(memoBytes) } },
      );
    }

    const geminiResponse = await fetch(`${GEMINI_URL}&key=${encodeURIComponent(geminiApiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: highYieldMode
          ? { parts: [{ text: HIGH_YIELD_SYSTEM_PROMPT }] }
          : guidedMode
            ? { parts: [{ text: GUIDED_STUDY_RULES }] }
            : examMode
              ? { parts: [{ text: EXAM_SIMULATION_RULES }] }
            : undefined,
        contents: [{
          role: "user",
          parts: paperMode
            ? [
              { text: "Attached are the examination paper and official marking memo. Use them as the source of truth." },
              ...documentParts,
              ...(photoPart ? [photoPart, { text: PHOTO_INSTRUCTION }] : []),
              { text: prompt },
            ]
            : photoPart
              ? [photoPart, { text: PHOTO_INSTRUCTION }, { text: prompt }]
              : [{ text: prompt }],
        }],
        generationConfig: { temperature: 0.6 },
      }),
    });

    if (!geminiResponse.ok || !geminiResponse.body) {
      const details = await geminiResponse.text();
      console.error("Gemini request failed", geminiResponse.status, details);
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
    return json({
      error: "Internal server error.",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
});
