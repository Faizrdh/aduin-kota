/*eslint-disable*/

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

export const ACCESS_TOKEN_TTL  = 15 * 60;          // 15 menit (detik)
export const REFRESH_TOKEN_TTL = 15 * 24 * 60 * 60; // 15 hari  (detik)

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AccessTokenPayload {
  sub: string;   // userId
  email: string;
  role: string;
  name: string;
}

// ─── Password ─────────────────────────────────────────────────────────────────

/** Hash plain-text password dengan bcrypt (cost 12). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

/** Verifikasi plain password terhadap hash. */
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── Access Token (JWT, 15 menit) ─────────────────────────────────────────────

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

// ─── Refresh Token (opaque random, 15 hari) ───────────────────────────────────

/**
 * Buat refresh token:
 * - `raw`    → string yang dikirim ke klien (HttpOnly cookie)
 * - `hashed` → yang disimpan di database
 */
export function generateRefreshToken(): { raw: string; hashed: string } {
  const raw    = crypto.randomBytes(64).toString("hex");
  const hashed = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hashed };
}

/** Hash token untuk pencocokan di DB. */
export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Tanggal expiry refresh token (15 hari dari sekarang). */
export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);
}