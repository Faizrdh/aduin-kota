/*eslint-disable*/
// server.ts  (root project — entry point untuk `npx tsx server.ts`)

import "dotenv/config";
import express      from "express";
import cors         from "cors";
import cookieParser from "cookie-parser";
import { authRouter }                  from "./src/api/auth";
import { reportsRouter }               from "./src/server/reports"; // ← named export ✓
import { optionalAuth }                from "./src/lib/auth.middleware";

const app  = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// ─── Global middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CLIENT_URL ?? "http://localhost:8080",
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",    authRouter);
app.use("/api/reports", optionalAuth, reportsRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Server Error]", err.message);
  res.status(500).json({ error: err.message ?? "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`✅  API server running → http://localhost:${PORT}`);
});