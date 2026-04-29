/* eslint-disable */
// src/lib/auth.server.ts

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!; // tetap ada meski tidak dipakai sign JWT opaque

export const ACCESS_TOKEN_TTL  = 30 * 60;           // 30 menit (detik) — sesuai idle requirement
export const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;  // 7 hari   (detik)

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AccessTokenPayload {
  sub:   string; // userId
  email: string;
  role:  string;
  name:  string;
}

// ─── Password ─────────────────────────────────────────────────────────────────
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── Access Token (JWT, 30 menit) ─────────────────────────────────────────────
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
    issuer: "aduinkota",
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET, {
    issuer: "aduinkota",
  }) as AccessTokenPayload;
}

// ─── Refresh Token (opaque random, 7 hari) ────────────────────────────────────
export function generateRefreshToken(): { raw: string; hashed: string } {
  const raw    = crypto.randomBytes(64).toString("hex");
  const hashed = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hashed };
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);
}