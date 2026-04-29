/*eslint-disable*/
// src/server/votes.ts
// ─────────────────────────────────────────────────────────────────────────────
// Endpoints:
//   GET  /api/votes/status/:reportId  → { voted, voteCount }
//   POST /api/votes/toggle/:reportId  → { voted, voteCount }  (requires auth)
//
// Both read / write voteCount on the Report model via Prisma Transaction
// so the cached counter stays consistent even under concurrent requests.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, optionalAuth } from "../lib/auth.middleware";

const router = Router();

// ─── GET /api/votes/status/:reportId ─────────────────────────────────────────
// Returns whether the current user (if authenticated) has voted on this report
// and the current cached voteCount.
router.get("/status/:reportId", optionalAuth, async (req, res, next) => {
  try {
    const reportId = String(req.params.reportId);

    const report = await prisma.report.findUnique({
      where:  { id: reportId },
      select: { voteCount: true },
    });

    if (!report) return res.status(404).json({ error: "Laporan tidak ditemukan." });

    let voted = false;
    if (req.userId) {
      const vote = await prisma.vote.findUnique({
        where: { userId_reportId: { userId: req.userId, reportId } },
      });
      voted = !!vote;
    }

    return res.json({ voted, voteCount: report.voteCount });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/votes/toggle/:reportId ────────────────────────────────────────
// Atomically adds OR removes a vote using a Prisma Transaction:
//   - Creates Vote row + increments Report.voteCount  (when voting)
//   - Deletes Vote row + decrements Report.voteCount  (when un-voting)
// voteCount is clamped to ≥ 0 to guard against stale data edge cases.
router.post("/toggle/:reportId", requireAuth, async (req, res, next) => {
  try {
    const reportId = String(req.params.reportId);
    const userId   = req.userId!;

    const report = await prisma.report.findUnique({
      where:  { id: reportId },
      select: { id: true, voteCount: true },
    });
    if (!report) return res.status(404).json({ error: "Laporan tidak ditemukan." });

    const existingVote = await prisma.vote.findUnique({
      where: { userId_reportId: { userId, reportId } },
    });

    let voted: boolean;
    let newVoteCount: number;

    if (existingVote) {
      // ── Un-vote: delete row + decrement counter ──────────────────────────
      const [, updated] = await prisma.$transaction([
        prisma.vote.delete({
          where: { userId_reportId: { userId, reportId } },
        }),
        prisma.report.update({
          where: { id: reportId },
          data:  { voteCount: { decrement: 1 } },
          select: { voteCount: true },
        }),
      ]);
      voted        = false;
      // Guard against negative counts caused by data inconsistency
      newVoteCount = Math.max(0, updated.voteCount);
    } else {
      // ── Vote: create row + increment counter ─────────────────────────────
      const [, updated] = await prisma.$transaction([
        prisma.vote.create({ data: { userId, reportId } }),
        prisma.report.update({
          where: { id: reportId },
          data:  { voteCount: { increment: 1 } },
          select: { voteCount: true },
        }),
      ]);
      voted        = true;
      newVoteCount = updated.voteCount;
    }

    // Clamp edge case (concurrent decrement could go below 0)
    if (newVoteCount < 0) {
      await prisma.report.update({
        where: { id: reportId },
        data:  { voteCount: 0 },
      });
      newVoteCount = 0;
    }

    return res.json({ voted, voteCount: newVoteCount });
  } catch (err) {
    next(err);
  }
});

export { router as votesRouter };
export default router;