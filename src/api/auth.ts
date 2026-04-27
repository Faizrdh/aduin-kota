/*eslint-disable*/
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
  REFRESH_TOKEN_TTL,
} from "../lib/auth.server";

export const authRouter = Router();

const COOKIE_NAME = "aduinkota_rt";
const cookieOpts = {
  httpOnly : true,
  secure   : process.env.NODE_ENV === "production",
  sameSite : "lax" as const,
  path     : "/",
  maxAge   : REFRESH_TOKEN_TTL * 1000, // ms
};

// ─── Helper ───────────────────────────────────────────────────────────────────
async function issueTokens(userId: string, res: Response) {
  const user = await prisma.user.findUniqueOrThrow({
    where : { id: userId },
    select: { id: true, email: true, role: true, name: true },
  });

  const accessToken = signAccessToken({
    sub  : user.id,
    email: user.email,
    role : user.role,
    name : user.name,
  });

  const { raw, hashed } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: { token: hashed, userId, expiresAt: refreshTokenExpiry() },
  });

  res.cookie(COOKIE_NAME, raw, cookieOpts);
  return accessToken;
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
authRouter.post("/register", async (req: Request, res: Response) => {
  const { name, email, password, city = "Jakarta" } = req.body;

  if (!name?.trim() || !email?.trim() || !password)
    return res.status(400).json({ error: "Semua field wajib diisi." });

  if (password.length < 6)
    return res.status(400).json({ error: "Password minimal 6 karakter." });

  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (exists)
    return res.status(409).json({ error: "Email sudah terdaftar." });

  const hashed = await hashPassword(password);
  const user   = await prisma.user.create({
    data  : { name: name.trim(), email: email.toLowerCase(), password: hashed, city },
    select: { id: true, name: true, email: true, role: true, city: true },
  });

  const accessToken = await issueTokens(user.id, res);
  return res.status(201).json({ user, accessToken });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
authRouter.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password)
    return res.status(400).json({ error: "Email dan password wajib diisi." });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await verifyPassword(password, user.password)))
    return res.status(401).json({ error: "Email atau password salah." });

  const accessToken = await issueTokens(user.id, res);
  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, city: user.city },
    accessToken,
  });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
authRouter.post("/refresh", async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[COOKIE_NAME];
  if (!rawToken)
    return res.status(401).json({ error: "Refresh token tidak ditemukan." });

  const hashed = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({
    where  : { token: hashed },
    include: { user: true },
  });

  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ error: "Session expired. Silakan login kembali." });
  }

  // Rotate token
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

  const accessToken = await issueTokens(stored.userId, res);
  return res.json({
    user: {
      id   : stored.user.id,
      name : stored.user.name,
      email: stored.user.email,
      role : stored.user.role,
      city : stored.user.city,
    },
    accessToken,
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
authRouter.post("/logout", async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[COOKIE_NAME];
  if (rawToken) {
    const hashed = hashToken(rawToken);
    await prisma.refreshToken
      .update({ where: { token: hashed }, data: { revoked: true } })
      .catch(() => {});
  }
  res.clearCookie(COOKIE_NAME, { path: "/" });
  return res.json({ message: "Logout berhasil." });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
authRouter.get("/me", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Unauthorized." });

  try {
    const { verifyAccessToken } = await import("../lib/auth.server");
    const payload = verifyAccessToken(token);
    const user    = await prisma.user.findUnique({
      where : { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, city: true, avatar: true },
    });
    if (!user) return res.status(404).json({ error: "User tidak ditemukan." });
    return res.json({ user });
  } catch {
    return res.status(401).json({ error: "Token tidak valid atau expired." });
  }
});