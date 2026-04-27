/*eslint-disable*/
// src/server/index.ts  ← INI SERVER SEBENARNYA
import "dotenv/config";
import express      from "express";
import cors         from "cors";
import cookieParser from "cookie-parser";
import { authRouter }    from "@/api/auth";
import reportsRouter from "./reports";
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

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",    authRouter);
app.use("/api/reports", optionalAuth, reportsRouter); // ← app.use BUKAN app.route

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`✅ API server running → http://localhost:${PORT}`);
});