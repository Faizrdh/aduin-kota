/*eslint-disable*/
// src/server/comments.ts
import { Router } from "express";
import { prisma }  from "../lib/prisma";
import { requireAuth, optionalAuth } from "../lib/auth.middleware";

const router = Router();

// ─── Validator ────────────────────────────────────────────────────────────────
const MAX_CONTENT_LENGTH = 1_000; // karakter

function validateContent(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_CONTENT_LENGTH) return null;
  return trimmed;
}

// ─── GET /api/comments/:reportId ─────────────────────────────────────────────
// Publik (optionalAuth) — siapa saja bisa baca komentar.
// Mendukung pagination: ?page=1&limit=20 (max limit 50).
router.get("/:reportId", optionalAuth, async (req, res, next) => {
  try {
    const reportId = String(req.params.reportId);
    const page     = Math.max(1, parseInt(String(req.query.page  ?? 1), 10) || 1);
    const limit    = Math.min(50, parseInt(String(req.query.limit ?? 20), 10) || 20);
    const skip     = (page - 1) * limit;

    // Pastikan laporan ada ──────────────────────────────────────────────────
    const report = await prisma.report.findUnique({
      where:  { id: reportId },
      select: { id: true, commentCount: true },
    });
    if (!report) return res.status(404).json({ error: "Laporan tidak ditemukan." });

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where:   { reportId },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
      }),
      prisma.comment.count({ where: { reportId } }),
    ]);

    return res.json({
      data: comments,
      meta: {
        total,
        page,
        limit,
        totalPages:   Math.ceil(total / limit),
        commentCount: report.commentCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/comments/:reportId ────────────────────────────────────────────
// Membutuhkan autentikasi.
// Membuat Comment baru + increment Report.commentCount secara atomik.
router.post("/:reportId", requireAuth, async (req, res, next) => {
  try {
    const reportId = String(req.params.reportId);
    const userId   = req.userId!;

    const content = validateContent(req.body?.content);
    if (!content) {
      return res.status(400).json({
        error: `Konten komentar wajib diisi dan tidak boleh melebihi ${MAX_CONTENT_LENGTH} karakter.`,
      });
    }

    // Pastikan laporan ada dan belum REJECTED ─────────────────────────────────
    const report = await prisma.report.findUnique({
      where:  { id: reportId },
      select: { id: true, status: true },
    });
    if (!report) return res.status(404).json({ error: "Laporan tidak ditemukan." });
    if (report.status === "REJECTED") {
      return res.status(400).json({ error: "Tidak dapat berkomentar pada laporan yang telah ditolak." });
    }

    // Transaksi: buat komentar + increment counter ─────────────────────────────
    const [comment] = await prisma.$transaction([
      prisma.comment.create({
        data: { content, reportId, userId },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
      }),
      prisma.report.update({
        where: { id: reportId },
        data:  { commentCount: { increment: 1 } },
      }),
    ]);

    return res.status(201).json({ data: comment });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/comments/:commentId ─────────────────────────────────────────
// Membutuhkan autentikasi.
// Hanya pemilik komentar ATAU admin yang dapat menghapus.
// Menghapus Comment + decrement Report.commentCount secara atomik.
router.delete("/:commentId", requireAuth, async (req, res, next) => {
  try {
    const commentId = String(req.params.commentId);
    const userId    = req.userId!;
    const userRole  = (req as any).userRole as string | undefined; // diisi middleware

    const comment = await prisma.comment.findUnique({
      where:  { id: commentId },
      select: { id: true, userId: true, reportId: true },
    });
    if (!comment) return res.status(404).json({ error: "Komentar tidak ditemukan." });

    const isOwner = comment.userId === userId;
    const isAdmin = userRole === "ADMIN";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Anda tidak memiliki akses untuk menghapus komentar ini." });
    }

    // Transaksi: hapus + decrement counter (clamp ≥ 0) ────────────────────────
    await prisma.$transaction([
      prisma.comment.delete({ where: { id: commentId } }),
      prisma.report.update({
        where: { id: comment.reportId },
        data:  {
          commentCount: {
            // decrement hanya jika > 0 — guard stale data
            decrement: 1,
          },
        },
      }),
    ]);

    // Clamp edge case
    await prisma.report.updateMany({
      where: { id: comment.reportId, commentCount: { lt: 0 } },
      data:  { commentCount: 0 },
    });

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export { router as commentsRouter };
export default router;