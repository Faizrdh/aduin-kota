/* eslint-disable */
// server/adminUsers.ts

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth.middleware";

const router = Router();

const USER_SELECT = {
  id       : true,
  name     : true,
  email    : true,
  role     : true,
  city     : true,
  createdAt: true,
} as const;

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get("/", requireAdmin, async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select : USER_SELECT,
  });
  return res.json({ users });
});

// ─── POST /api/admin/users ────────────────────────────────────────────────────
router.post("/", requireAdmin, async (req: Request, res: Response) => {
  const { name, email, password, role, city } = req.body as {
    name?    : string;
    email?   : string;
    password?: string;
    role?    : string;
    city?    : string;
  };

  if (!name?.trim())                   return res.status(400).json({ error: "Nama wajib diisi." });
  if (!email?.trim())                  return res.status(400).json({ error: "Email wajib diisi." });
  if (!/\S+@\S+\.\S+/.test(email))     return res.status(400).json({ error: "Format email tidak valid." });
  if (!password || password.length < 8) return res.status(400).json({ error: "Password minimal 8 karakter." });
  if (!["CITIZEN", "OFFICER", "ADMIN"].includes(role ?? ""))
    return res.status(400).json({ error: "Role tidak valid." });

  const existing = await prisma.user.findUnique({ where: { email: email.trim() } });
  if (existing) return res.status(409).json({ error: "Email sudah terdaftar." });

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name    : name.trim(),
      email   : email.trim().toLowerCase(),
      password: hashed,
      role    : role as "CITIZEN" | "OFFICER" | "ADMIN",
      city    : city?.trim() || "Jakarta",
    },
    select: USER_SELECT,
  });

  return res.status(201).json({ user });
});

// ─── PUT /api/admin/users/:id ─────────────────────────────────────────────────
router.put("/:id", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, password, role, city } = req.body as {
    name?    : string;
    email?   : string;
    password?: string;
    role?    : string;
    city?    : string;
  };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: "Pengguna tidak ditemukan." });

  if (name  !== undefined && !name.trim())  return res.status(400).json({ error: "Nama tidak boleh kosong." });
  if (email !== undefined) {
    if (!email.trim())                      return res.status(400).json({ error: "Email tidak boleh kosong." });
    if (!/\S+@\S+\.\S+/.test(email))        return res.status(400).json({ error: "Format email tidak valid." });
    const dup = await prisma.user.findFirst({ where: { email: email.trim(), NOT: { id } } });
    if (dup) return res.status(409).json({ error: "Email sudah digunakan pengguna lain." });
  }
  if (role !== undefined && !["CITIZEN", "OFFICER", "ADMIN"].includes(role))
    return res.status(400).json({ error: "Role tidak valid." });
  if (password !== undefined && password.length < 8)
    return res.status(400).json({ error: "Password minimal 8 karakter." });

  const updateData: Record<string, unknown> = {};
  if (name  !== undefined) updateData.name  = name.trim();
  if (email !== undefined) updateData.email = email.trim().toLowerCase();
  if (role  !== undefined) updateData.role  = role;
  if (city  !== undefined) updateData.city  = city.trim() || "Jakarta";
  if (password)            updateData.password = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({ where: { id }, data: updateData, select: USER_SELECT });
  return res.json({ user });
});

// ─── DELETE /api/admin/users/:id ──────────────────────────────────────────────
router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  const { id }   = req.params;
  const adminId  = (req as any).user?.id; // set oleh requireAdmin middleware

  if (id === adminId) return res.status(400).json({ error: "Tidak dapat menghapus akun sendiri." });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: "Pengguna tidak ditemukan." });

  await prisma.user.delete({ where: { id } });
  return res.json({ message: "Pengguna berhasil dihapus." });
});

export default router;