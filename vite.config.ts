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
        // Proxy untuk emsifa API wilayah Indonesia
        "/api-wilayah": {
          target: "https://emsifa.github.io",
          changeOrigin: true,
          secure: true,
          rewrite: (path) =>
            path.replace(/^\/api-wilayah/, "/api-wilayah-indonesia/api"),
        },
        // Proxy untuk Nominatim geocoding (OpenStreetMap)
        "/api-nominatim": {
          target: "https://nominatim.openstreetmap.org",
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api-nominatim/, ""),
          headers: {
            "User-Agent": "CivicSpot/1.0 (civicspot@example.com)",
            "Accept-Language": "id,en",
          },
        },
      },
    },
  },
});