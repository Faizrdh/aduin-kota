/*eslint-disable*/
// src/lib/prisma.ts
// ─── Singleton Prisma Client ──────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

declare global {
  // Hindari multiple instances saat hot reload (dev mode)
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}