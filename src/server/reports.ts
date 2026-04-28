/*eslint-disable*/
// src/server/reports.ts

import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { ReportCategory, ReportStatus } from "@prisma/client";
import { requireAuth, optionalAuth, requireAdmin } from "../lib/auth.middleware";

const router = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────
function getString(val: unknown): string {
  if (Array.isArray(val)) return String(val[0] ?? "");
  return String(val ?? "");
}

function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R     = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLng  = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function boundingBox(lat: number, lng: number, radiusMeters: number) {
  const deltaLat = radiusMeters / 111_000;
  const deltaLng = radiusMeters / (111_000 * Math.cos((lat * Math.PI) / 180));
  return {
    lat: { gte: lat - deltaLat, lte: lat + deltaLat },
    lng: { gte: lng - deltaLng, lte: lng + deltaLng },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTE ORDER MATTERS: literal paths MUST come before /:id
// ═════════════════════════════════════════════════════════════════════════════

// ─── GET /api/reports/stats ───────────────────────────────────────────────────
router.get(
  "/stats",
  requireAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [total, pending, inReview, inProgress, resolved, rejected] =
        await Promise.all([
          prisma.report.count(),
          prisma.report.count({ where: { status: ReportStatus.PENDING } }),
          prisma.report.count({ where: { status: ReportStatus.IN_REVIEW } }),
          prisma.report.count({ where: { status: ReportStatus.IN_PROGRESS } }),
          prisma.report.count({ where: { status: ReportStatus.RESOLVED } }),
          prisma.report.count({ where: { status: ReportStatus.REJECTED } }),
        ]);
      return res.json({
        total,
        pending,
        inProgress: inReview + inProgress,
        resolved,
        rejected,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/reports/all ─────────────────────────────────────────────────────
router.get(
  "/all",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status   = getString(req.query.status);
      const category = getString(req.query.category);
      const search   = getString(req.query.search).trim();
      const page     = Math.max(1,  parseInt(getString(req.query.page),  10) || 1);
      const limit    = Math.min(500, parseInt(getString(req.query.limit), 10) || 15);
      const skip     = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (status   && status   !== "all") where.status   = status.toUpperCase()   as ReportStatus;
      if (category && category !== "all") where.category = category.toUpperCase() as ReportCategory;
      if (search) {
        where.OR = [
          { title:       { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { city:        { contains: search, mode: "insensitive" } },
          { province:    { contains: search, mode: "insensitive" } },
        ];
      }

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            user:   { select: { id: true, name: true, avatar: true } },
            _count: { select: { joins: true } },
          },
        }),
        prisma.report.count({ where }),
      ]);

      return res.json({
        data: reports,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/reports/public ──────────────────────────────────────────────────
// Endpoint publik untuk landing page — tidak memerlukan autentikasi.
// Hanya mengembalikan field yang aman untuk publik (tidak ada data sensitif user).
// Status REJECTED disembunyikan dari publik.
router.get(
  "/public",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page  = Math.max(1,   parseInt(getString(req.query.page),  10) || 1);
      const limit = Math.min(500, parseInt(getString(req.query.limit), 10) || 100);
      const skip  = (page - 1) * limit;

      // Sembunyikan laporan REJECTED dari publik
      const where = {
        status: { not: ReportStatus.REJECTED },
      };

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id:          true,
            title:       true,
            description: true,
            category:    true,
            status:      true,
            lat:         true,
            lng:         true,
            province:    true,
            city:        true,
            district:    true,
            village:     true,
            imageUrl:    true,
            createdAt:   true,
            // Hanya nama user yang ditampilkan publik, bukan id/avatar
            user: { select: { name: true } },
            _count: { select: { joins: true } },
          },
        }),
        prisma.report.count({ where }),
      ]);

      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
      return res.json({
        data: reports,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/reports/heatmap ─────────────────────────────────────────────────
router.get(
  "/heatmap",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const WEIGHT: Record<ReportStatus, number> = {
        [ReportStatus.PENDING]:     1.0,
        [ReportStatus.IN_REVIEW]:   0.7,
        [ReportStatus.IN_PROGRESS]: 0.7,
        [ReportStatus.RESOLVED]:    0.2,
        [ReportStatus.REJECTED]:    0.1,
      };

      const swLat = parseFloat(getString(req.query.swLat));
      const swLng = parseFloat(getString(req.query.swLng));
      const neLat = parseFloat(getString(req.query.neLat));
      const neLng = parseFloat(getString(req.query.neLng));

      const hasBbox =
        !isNaN(swLat) && !isNaN(swLng) && !isNaN(neLat) && !isNaN(neLng) &&
        swLat >= -90  && neLat <=  90  &&
        swLng >= -180 && neLng <= 180  &&
        swLat < neLat && swLng < neLng;

      const where = hasBbox
        ? {
            lat: { gte: swLat, lte: neLat },
            lng: { gte: swLng, lte: neLng },
          }
        : {};

      const points = await prisma.report.findMany({
        where,
        select: { lat: true, lng: true, status: true },
        take: 10_000,
      });

      const heatData: [number, number, number][] = points.map((p) => [
        p.lat,
        p.lng,
        WEIGHT[p.status] ?? 0.1,
      ]);

      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
      return res.json({ data: heatData });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/reports/heatmap/public ──────────────────────────────────────────
// Heatmap publik untuk landing page — tidak memerlukan autentikasi.
// REJECTED dikecualikan dari perhitungan bobot publik.
router.get(
  "/heatmap/public",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const WEIGHT: Partial<Record<ReportStatus, number>> = {
        [ReportStatus.PENDING]:     1.0,
        [ReportStatus.IN_REVIEW]:   0.7,
        [ReportStatus.IN_PROGRESS]: 0.7,
        [ReportStatus.RESOLVED]:    0.2,
      };

      const swLat = parseFloat(getString(req.query.swLat));
      const swLng = parseFloat(getString(req.query.swLng));
      const neLat = parseFloat(getString(req.query.neLat));
      const neLng = parseFloat(getString(req.query.neLng));

      const hasBbox =
        !isNaN(swLat) && !isNaN(swLng) && !isNaN(neLat) && !isNaN(neLng) &&
        swLat >= -90  && neLat <=  90  &&
        swLng >= -180 && neLng <= 180  &&
        swLat < neLat && swLng < neLng;

      const baseWhere = { status: { not: ReportStatus.REJECTED } };
      const where = hasBbox
        ? {
            ...baseWhere,
            lat: { gte: swLat, lte: neLat },
            lng: { gte: swLng, lte: neLng },
          }
        : baseWhere;

      const points = await prisma.report.findMany({
        where,
        select: { lat: true, lng: true, status: true },
        take: 10_000,
      });

      const heatData: [number, number, number][] = points.map((p) => [
        p.lat,
        p.lng,
        WEIGHT[p.status] ?? 0.2,
      ]);

      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
      return res.json({ data: heatData });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/reports/nearby ──────────────────────────────────────────────────
router.get(
  "/nearby",
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lat = parseFloat(getString(req.query.lat));
      const lng = parseFloat(getString(req.query.lng));

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "Parameter lat dan lng wajib diisi dan harus berupa angka." });
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ error: "Nilai lat/lng di luar rentang valid." });
      }

      const rawRadius = parseInt(getString(req.query.radius), 10);
      const radius    = isNaN(rawRadius) ? 100 : Math.min(Math.max(rawRadius, 1), 5_000);

      const categoryRaw     = getString(req.query.category).toUpperCase();
      const validCategories = Object.values(ReportCategory) as string[];
      const category        = categoryRaw && validCategories.includes(categoryRaw)
        ? (categoryRaw as ReportCategory)
        : undefined;

      const bbox = boundingBox(lat, lng, radius);
      const candidateWhere: Record<string, unknown> = {
        ...bbox,
        status: { notIn: [ReportStatus.RESOLVED, ReportStatus.REJECTED] },
      };
      if (category) candidateWhere.category = category;

      const candidates = await prisma.report.findMany({
        where: candidateWhere as any,
        include: {
          user:   { select: { id: true, name: true, avatar: true } },
          _count: { select: { joins: true } },
        },
        take: 200,
      });

      type ReportWithDistance = (typeof candidates)[number] & { distanceMeters: number };
      const nearby: ReportWithDistance[] = candidates
        .map((r) => ({
          ...r,
          distanceMeters: Math.round(haversineMeters(lat, lng, r.lat, r.lng)),
        }))
        .filter((r) => r.distanceMeters <= radius)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      return res.json({ data: nearby });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/reports — laporan milik user yang login ─────────────────────────
router.get(
  "/",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reports = await prisma.report.findMany({
        where:   { userId: req.userId! },
        orderBy: { createdAt: "desc" },
        include: {
          user:   { select: { id: true, name: true, avatar: true } },
          _count: { select: { joins: true } },
        },
      });
      return res.json({ data: reports });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/reports ────────────────────────────────────────────────────────
router.post(
  "/",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        title, description, category, province, city, district,
        village, address, imageUrl, lat, lng,
      } = req.body;

      if (!title || !description || !category || !province || !city || !district || !village) {
        return res.status(400).json({ error: "Field wajib tidak lengkap." });
      }

      const validCategories = Object.values(ReportCategory) as string[];
      const categoryUpper   = String(category).toUpperCase();
      if (!validCategories.includes(categoryUpper)) {
        return res.status(400).json({ error: `Kategori tidak valid: ${category}` });
      }

      const latVal = lat != null && lat !== "" ? parseFloat(String(lat)) : undefined;
      const lngVal = lng != null && lng !== "" ? parseFloat(String(lng)) : undefined;

      if (latVal === undefined || lngVal === undefined || isNaN(latVal) || isNaN(lngVal)) {
        return res
          .status(400)
          .json({ error: "Koordinat lat/lng wajib diisi agar laporan dapat dipetakan." });
      }

      const report = await prisma.report.create({
        data: {
          userId:      req.userId!,
          title:       String(title),
          description: String(description),
          category:    categoryUpper as ReportCategory,
          status:      ReportStatus.PENDING,
          lat:         latVal,
          lng:         lngVal,
          province:    String(province),
          city:        String(city),
          district:    String(district),
          village:     String(village),
          address:     address  ? String(address)  : undefined,
          imageUrl:    imageUrl ? String(imageUrl) : undefined,
        },
        include: {
          user:   { select: { id: true, name: true, avatar: true } },
          _count: { select: { joins: true } },
        },
      });

      return res.status(201).json({ data: report });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/reports/:id/join ───────────────────────────────────────────────
router.post(
  "/:id/join",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reportId = String(req.params.id);
      const userId   = req.userId!;

      const report = await prisma.report.findUnique({ where: { id: reportId } });
      if (!report) return res.status(404).json({ error: "Laporan tidak ditemukan." });
      if (report.userId === userId) return res.status(400).json({ error: "Anda adalah pemilik laporan ini." });

      const join = await prisma.reportJoin.upsert({
        where:  { reportId_userId: { reportId, userId } },
        create: { reportId, userId, note: req.body?.note ?? null },
        update: {},
      });

      return res.status(201).json({ data: join });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/reports/:id/status ────────────────────────────────────────────
router.patch(
  "/:id/status",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reportId = String(req.params.id);
      const { status } = req.body as { status?: string };

      const validStatuses = Object.values(ReportStatus) as string[];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          error: `Status tidak valid. Pilih: ${validStatuses.join(", ")}`,
        });
      }

      const existing = await prisma.report.findUnique({ where: { id: reportId } });
      if (!existing) return res.status(404).json({ error: "Laporan tidak ditemukan." });

      const updated = await prisma.report.update({
        where:   { id: reportId },
        data:    { status: status as ReportStatus, updatedAt: new Date() },
        include: {
          user:   { select: { id: true, name: true, avatar: true } },
          _count: { select: { joins: true } },
        },
      });

      return res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/reports/:id ─────────────────────────────────────────────────────
router.get(
  "/:id",
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reportId = String(req.params.id);
      const report   = await prisma.report.findUnique({
        where:   { id: reportId },
        include: {
          user:   { select: { id: true, name: true, avatar: true } },
          _count: { select: { joins: true } },
        },
      });
      if (!report) return res.status(404).json({ error: "Laporan tidak ditemukan." });
      return res.json({ data: report });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Exports ──────────────────────────────────────────────────────────────────
export { router as reportsRouter };
export default router;