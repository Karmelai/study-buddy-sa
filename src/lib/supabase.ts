import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const isBrowser = typeof window !== "undefined";

class NoopWebSocket {
  readyState = 3;
  url = "";
  protocol = "";
  extensions = "";
  bufferedAmount = 0;
  binaryType: BinaryType = "blob";
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(_url: string | URL, _protocols?: string | string[]) {}

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return false;
  }
  close() {}
  send() {}
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
  },
  global: {
    headers: {
      "X-Client-Info": "supabase-js-ssr",
    },
  },
  realtime: isBrowser
    ? undefined
    : {
        transport: NoopWebSocket as unknown as typeof WebSocket,
      },
});
