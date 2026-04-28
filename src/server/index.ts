/*eslint-disable*/
// src/server/index.ts
import "dotenv/config";
import express      from "express";
import cors         from "cors";
import cookieParser from "cookie-parser";
import { authRouter }   from "@/api/auth";
import { reportsRouter } from "./reports";  // ← named import, konsisten dengan reports.ts
import { optionalAuth }  from "@/lib/auth.middleware";

const app  = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CLIENT_URL ?? "http://localhost:8080",
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// ─── Debug: log setiap request masuk (hapus di production) ────────────────────
app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",    authRouter);
// optionalAuth di sini hanya untuk set req.userId jika ada token.
// Tiap route di reportsRouter punya auth-nya sendiri (requireAuth / requireAdmin).
app.use("/api/reports", optionalAuth, reportsRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Server Error]", err.message);
  res.status(500).json({ error: err.message ?? "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`✅ API server running → http://localhost:${PORT}`);
  console.log(`   Routes aktif:`);
  console.log(`   GET  /api/health`);
  console.log(`   POST /api/auth/...`);
  console.log(`   GET  /api/reports/all`);
  console.log(`   GET  /api/reports/heatmap  ← pastikan ini muncul`);
  console.log(`   GET  /api/reports/stats`);
  console.log(`   GET  /api/reports/nearby`);
  console.log(`   GET  /api/reports/:id`);
});