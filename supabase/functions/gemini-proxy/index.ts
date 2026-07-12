import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "gemini-3.1-flash-lite-preview";
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
};

const json = (body: unknown, init: ResponseInit = {}) =>
  Response.json(body, {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });

const isSafeStoragePath = (path: string) =>
  Boolean(path) && !path.startsWith("/") && !path.includes("..") && !path.includes("\\");

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const GUIDED_STUDY_RULES = `You are an encouraging high school AI tutor. Do not dump the entire paper or massive blocks of text at once. Present the first question clearly from the attached paper and ask the user how they want to approach it. Validate their logic using the attached official marking memo. If they struggle, do not give them the final answer immediately—break down the core concept and guide them toward the right conclusion step-by-step.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !geminiApiKey) {
    return json({ error: "Missing required server environment variables." }, { status: 500 });
  }

  let payload: GeminiRequestBody;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prompt = payload.prompt?.trim();
  if (!prompt) return json({ error: "prompt is required." }, { status: 400 });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const guidedMode = payload.activeStudyMode === "guided";
  const pdfPath = payload.pdf_storage_path?.trim() ?? "";
  const memoPath = payload.memo_storage_path?.trim() ?? "";

  const documentParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
  if (guidedMode) {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Authentication is required." }, { status: 401 });

    if (!isSafeStoragePath(pdfPath) || !isSafeStoragePath(memoPath)) {
      return json({ error: "Valid PDF and memo storage paths are required for guided study." }, { status: 400 });
    }

    // Do not allow the service-role storage client to become a general file reader.
    const { data: paper, error: paperError } = await admin
      .from("past_papers")
      .select("id")
      .eq("pdf_storage_path", pdfPath)
      .eq("memo_storage_path", memoPath)
      .maybeSingle();
    if (paperError || !paper) return json({ error: "Past paper was not found." }, { status: 404 });

    const [pdfResult, memoResult] = await Promise.all([
      admin.storage.from(BUCKET).download(pdfPath),
      admin.storage.from(BUCKET).download(memoPath),
    ]);
    if (pdfResult.error || memoResult.error || !pdfResult.data || !memoResult.data) {
      console.error("Unable to download guided-study documents", pdfResult.error ?? memoResult.error);
      return json({ error: "Unable to retrieve the paper documents." }, { status: 502 });
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

  const response = await fetch(`${GEMINI_URL}&key=${encodeURIComponent(geminiApiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: guidedMode ? { parts: [{ text: GUIDED_STUDY_RULES }] } : undefined,
      contents: [{
        role: "user",
        parts: guidedMode
          ? [{ text: "Attached are the examination paper followed by its official marking memo. Use them as the source of truth." }, ...documentParts, { text: prompt }]
          : [{ text: prompt }],
      }],
      generationConfig: { temperature: 0.6 },
    }),
  });

  if (!response.ok || !response.body) {
    const details = await response.text();
    console.error("Gemini request failed", response.status, details);
    return json({ error: "The AI service could not complete this request." }, { status: 502 });
  }

  return new Response(response.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
