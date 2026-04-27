/*eslint-disable*/

// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      proxy: {
        // ── Express API — Auth ────────────────────────────────────────────────
        "/api/auth": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },

        // ── Express API — Reports ─────────────────────────────────────────────
        "/api/reports": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },

        // ── emsifa API Wilayah Indonesia ──────────────────────────────────────
        "/api-wilayah": {
          target: "https://emsifa.github.io",
          changeOrigin: true,
          secure: true,
          rewrite: (path) =>
            path.replace(/^\/api-wilayah/, "/api-wilayah-indonesia/api"),
          headers: {
            "User-Agent": "CivicSpot/1.0 (civicspot@example.com)",
            "Referer": "https://emsifa.github.io",
          },
        },

        // ── Nominatim OpenStreetMap ───────────────────────────────────────────
        "/api-nominatim": {
          target: "https://nominatim.openstreetmap.org",
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api-nominatim/, ""),
          headers: {
            "User-Agent": "CivicSpot/1.0 (civicspot@example.com)",
            "Accept-Language": "id,en;q=0.9",
            "Referer": "https://nominatim.openstreetmap.org",
            "Accept": "application/json",
          },
        },
      },
    },
  },
});