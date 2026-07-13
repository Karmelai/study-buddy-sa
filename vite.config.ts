// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      proxy: {
        // Keep browser traffic same-origin in development. Vite streams proxied
        // audio responses directly rather than buffering an entire broadcast.
        "/karmel-radio/api/nowplaying": {
          target: "http://127.0.0.1",
          changeOrigin: true,
          rewrite: () => "/api/nowplaying/karmel_radio",
        },
        "/karmel-radio/stream": {
          target: "http://127.0.0.1",
          changeOrigin: true,
          rewrite: () => "/listen/karmel_radio/radio.mp3",
        },
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
