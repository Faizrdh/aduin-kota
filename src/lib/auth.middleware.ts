/*eslint-disable*/
// src/lib/auth.middleware.ts

import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "./auth.server";
import { prisma } from "./prisma";

declare global {
  namespace Express {
    interface Request {
      userId?:   string;
      userRole?: string;
    }
  }
}

// ─── requireAuth ──────────────────────────────────────────────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace("Bearer ", "").trim();
  if (!token) {
    res.status(401).json({ error: "Unauthorized — token tidak ditemukan." });
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Token tidak valid atau sudah kadaluarsa." });
  }
}

// ─── optionalAuth ─────────────────────────────────────────────────────────────
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace("Bearer ", "").trim();
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.userId = payload.sub;
    } catch {
      // invalid → lanjut sebagai guest
    }
  }
  next();
}

// ─── requireAdmin — sync token check + async role check via .catch(next) ─────
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace("Bearer ", "").trim();
  if (!token) {
    res.status(401).json({ error: "Unauthorized — token tidak ditemukan." });
    return;
  }

  let userId: string;
  try {
    const payload = verifyAccessToken(token);
    userId = payload.sub;
    req.userId = userId;
  } catch {
    res.status(401).json({ error: "Token tidak valid atau sudah kadaluarsa." });
    return;
  }

  // Async bagian: cek role dari DB
  prisma.user
    .findUnique({ where: { id: userId }, select: { role: true } })
    .then((user) => {
      if (!user) {
        res.status(401).json({ error: "User tidak ditemukan." });
        return;
      }
      const isAdmin =
        !("role" in user) || (user as any).role === "ADMIN";

      if (!isAdmin) {
        res.status(403).json({ error: "Forbidden — hanya admin yang dapat mengakses." });
        return;
      }

      req.userRole = (user as any).role ?? "ADMIN";
      next();
    })
    .catch(next); 
}