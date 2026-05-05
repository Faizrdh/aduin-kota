/*eslint-disable*/

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

        // ── Express API — Votes ───────────────────────────────────────────────
        "/api/votes": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },

          // ── Express API — Comments ────────────────────────────────────────────
        "/api/comments": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },

          // ── Express API — Exports ─────────────────────────────────────────────
        "/api/exports": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },

        // ── Express API — Admin Users ─────────────────────────────────────────
        "/api/admin/users": {
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