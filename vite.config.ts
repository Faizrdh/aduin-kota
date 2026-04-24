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
        // ── emsifa API Wilayah Indonesia ─────────────────────────────────────
        // /api-wilayah/provinces.json
        //   → https://emsifa.github.io/api-wilayah-indonesia/api/provinces.json
        // /api-wilayah/regencies/11.json
        //   → https://emsifa.github.io/api-wilayah-indonesia/api/regencies/11.json
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

        // ── Nominatim OpenStreetMap (reverse & forward geocoding) ────────────
        // /api-nominatim/reverse?lat=...&lon=...
        //   → https://nominatim.openstreetmap.org/reverse?lat=...&lon=...
        // /api-nominatim/search?q=...
        //   → https://nominatim.openstreetmap.org/search?q=...
        //
        // PENTING: Nominatim WAJIB mendapat header User-Agent yang valid
        // (berisi nama aplikasi + email kontak). Tanpa ini → HTTP 403.
        // Header ini hanya bisa diset di sisi proxy/server, bukan dari browser.
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