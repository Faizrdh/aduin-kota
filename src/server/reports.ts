/*eslint-disable*/
// src/server/reports.ts

import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { ReportCategory, ReportStatus } from "@prisma/client";
import { requireAuth, optionalAuth, requireAdmin } from "../lib/auth.middleware";
import { classifyReport, DINAS_LABELS } from "./services/aiClassifier";

const router = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────
function getString(val: unknown): string {
  if (Array.isArray(val)) return String(val[0] ?? "");
  return String(val ?? "");
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function boundingBox(lat: number, lng: number, radiusMeters: number) {
  const deltaLat = radiusMeters / 111_000;
  const deltaLng =
    radiusMeters / (111_000 * Math.cos((lat * Math.PI) / 180));
  return {
    lat: { gte: lat - deltaLat, lte: lat + deltaLat },
    lng: { gte: lng - deltaLng, lte: lng + deltaLng },
  };
}

const ACTIVE_HEATMAP_STATUSES: ReportStatus[] = [
  ReportStatus.PENDING,
  ReportStatus.IN_REVIEW,
  ReportStatus.IN_PROGRESS,
];

const HEATMAP_WEIGHT: Record<string, number> = {
  [ReportStatus.PENDING]: 1.0,
  [ReportStatus.IN_REVIEW]: 0.7,
  [ReportStatus.IN_PROGRESS]: 0.7,
};

// ─── GET /api/reports/stats ───────────────────────────────────────────────────
router.get("/stats", requireAdmin, async (_req, res, next) => {
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
});

// ─── GET /api/reports/all ─────────────────────────────────────────────────────
router.get("/all", requireAdmin, async (req, res, next) => {
  try {
    const status = getString(req.query.status);
    const category = getString(req.query.category);
    const search = getString(req.query.search).trim();
    const aiLabel = getString(req.query.ai_label);
    const page = Math.max(1, parseInt(getString(req.query.page), 10) || 1);
    const limit = Math.min(
      500,
      parseInt(getString(req.query.limit), 10) || 15
    );
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status && status !== "all")
      where.status = status.toUpperCase() as ReportStatus;
    if (category && category !== "all")
      where.category = category.toUpperCase() as ReportCategory;
    if (aiLabel && aiLabel !== "all") where.ai_label = aiLabel;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { province: { contains: search, mode: "insensitive" } },
      ];
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
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
});

// ─── GET /api/reports/public ──────────────────────────────────────────────────
router.get("/public", async (req, res, next) => {
  try {
    const page = Math.max(
      1,
      parseInt(getString(req.query.page), 10) || 1
    );
    const limit = Math.min(
      500,
      parseInt(getString(req.query.limit), 10) || 100
    );
    const skip = (page - 1) * limit;
    const where = { status: { not: ReportStatus.REJECTED } };

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          status: true,
          lat: true,
          lng: true,
          province: true,
          city: true,
          district: true,
          village: true,
          imageUrl: true,
          createdAt: true,
          ai_label: true,
          confidence_score: true,
          user: { select: { name: true } },
          _count: { select: { joins: true } },
        },
      }),
      prisma.report.count({ where }),
    ]);

    res.setHeader(
      "Cache-Control",
      "public, max-age=30, stale-while-revalidate=60"
    );
    return res.json({
      data: reports,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/reports/heatmap ─────────────────────────────────────────────────
router.get("/heatmap", requireAdmin, async (req, res, next) => {
  try {
    const swLat = parseFloat(getString(req.query.swLat));
    const swLng = parseFloat(getString(req.query.swLng));
    const neLat = parseFloat(getString(req.query.neLat));
    const neLng = parseFloat(getString(req.query.neLng));
    const hasBbox =
      !isNaN(swLat) &&
      !isNaN(swLng) &&
      !isNaN(neLat) &&
      !isNaN(neLng) &&
      swLat < neLat &&
      swLng < neLng;

    const where: Record<string, unknown> = {
      status: { in: ACTIVE_HEATMAP_STATUSES },
    };

    if (hasBbox) {
      where.lat = { gte: swLat, lte: neLat };
      where.lng = { gte: swLng, lte: neLng };
    }

    const points = await prisma.report.findMany({
      where: where as any,
      select: { lat: true, lng: true, status: true },
      take: 10_000,
    });

    const heatData = points.map((p) => [
      p.lat,
      p.lng,
      HEATMAP_WEIGHT[p.status] ?? 0.5,
    ]);

    res.setHeader(
      "Cache-Control",
      "public, max-age=30, stale-while-revalidate=60"
    );
    return res.json({ data: heatData });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/reports/heatmap/public ─────────────────────────────────────────
router.get("/heatmap/public", async (req, res, next) => {
  try {
    const swLat = parseFloat(getString(req.query.swLat));
    const swLng = parseFloat(getString(req.query.swLng));
    const neLat = parseFloat(getString(req.query.neLat));
    const neLng = parseFloat(getString(req.query.neLng));
    const hasBbox =
      !isNaN(swLat) &&
      !isNaN(swLng) &&
      !isNaN(neLat) &&
      !isNaN(neLng) &&
      swLat < neLat &&
      swLng < neLng;

    const where: Record<string, unknown> = {
      status: { in: ACTIVE_HEATMAP_STATUSES },
    };

    if (hasBbox) {
      where.lat = { gte: swLat, lte: neLat };
      where.lng = { gte: swLng, lte: neLng };
    }

    const points = await prisma.report.findMany({
      where: where as any,
      select: { lat: true, lng: true, status: true },
      take: 10_000,
    });

    const heatData = points.map((p) => [
      p.lat,
      p.lng,
      HEATMAP_WEIGHT[p.status] ?? 0.5,
    ]);

    res.setHeader(
      "Cache-Control",
      "public, max-age=30, stale-while-revalidate=60"
    );
    return res.json({ data: heatData });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/reports/nearby ──────────────────────────────────────────────────
router.get("/nearby", optionalAuth, async (req, res, next) => {
  try {
    const lat = parseFloat(getString(req.query.lat));
    const lng = parseFloat(getString(req.query.lng));
    if (isNaN(lat) || isNaN(lng))
      return res.status(400).json({ error: "lat dan lng wajib." });
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
      return res.status(400).json({ error: "lat/lng di luar rentang." });

    const rawRadius = parseInt(getString(req.query.radius), 10);
    const radius = isNaN(rawRadius)
      ? 100
      : Math.min(Math.max(rawRadius, 1), 5_000);
    const categoryRaw = getString(req.query.category).toUpperCase();
    const validCats = Object.values(ReportCategory) as string[];
    const category =
      categoryRaw && validCats.includes(categoryRaw)
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
        user: { select: { id: true, name: true, avatar: true } },
        _count: { select: { joins: true } },
      },
      take: 200,
    });

    const nearby = candidates
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
});

// ─── GET /api/reports/analytics ──────────────────────────────────────────────
// Harus didefinisikan SEBELUM /:id agar "analytics" tidak
// di-capture sebagai param id.
// Diproteksi requireAdmin — konsisten dengan /stats dan /all.
router.get("/analytics", requireAdmin, async (_req, res, next) => {
  try {
    const now = new Date();
    // Window waktu
    const d7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000); // 7 hari lalu
    const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 14 hari lalu

    // ── Semua query dijalankan paralel ────────────────────────────────────────
    const [
      totalReports,       // Total laporan keseluruhan
      thisWeekCount,      // Laporan dibuat dalam 7 hari terakhir
      lastWeekCount,      // Laporan dibuat 7–14 hari lalu (pembanding)
      resolvedTotal,      // Total RESOLVED keseluruhan (untuk completion rate global)
      categoryBreakdown,  // Jumlah laporan per kategori
      allDistrictRows,    // Semua distinct district (wilayah aktif total)
      thisWeekDistrictRows, // Distinct district yang aktif minggu ini
      newFor7d,           // Laporan baru 7 hari → untuk kolom "new" di trend chart
      resolvedThisWeek,   // RESOLVED dalam 7 hari → trend "resolved" + avg respons KPI
      resolvedLastWeek,   // RESOLVED 7–14 hari lalu → delta avg respons
      resolvedForCat,     // Semua RESOLVED → avg respons per kategori
      allForRegion,       // Semua laporan → kalkulasi top regions
    ] = await Promise.all([
      prisma.report.count(),
      prisma.report.count({ where: { createdAt: { gte: d7 } } }),
      prisma.report.count({ where: { createdAt: { gte: d14, lt: d7 } } }),
      prisma.report.count({ where: { status: ReportStatus.RESOLVED } }),

      prisma.report.groupBy({ by: ["category"], _count: { id: true } }),

      // distinct districts tidak didukung count() — pakai findMany distinct
      prisma.report.findMany({
        select: { district: true },
        distinct: ["district"],
      }),
      prisma.report.findMany({
        where: { createdAt: { gte: d7 } },
        select: { district: true },
        distinct: ["district"],
      }),

      // Trend chart — new: group by createdAt day
      prisma.report.findMany({
        where: { createdAt: { gte: d7 } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),

      // Trend chart — resolved: group by updatedAt day (saat diselesaikan)
      // Sekaligus dipakai untuk avg response KPI minggu ini
      prisma.report.findMany({
        where: {
          status: ReportStatus.RESOLVED,
          updatedAt: { gte: d7 },
        },
        select: { createdAt: true, updatedAt: true },
      }),

      // Avg response KPI minggu lalu (pembanding delta)
      prisma.report.findMany({
        where: {
          status: ReportStatus.RESOLVED,
          updatedAt: { gte: d14, lt: d7 },
        },
        select: { createdAt: true, updatedAt: true },
      }),

      // Response time per kategori — semua resolved
      prisma.report.findMany({
        where: { status: ReportStatus.RESOLVED },
        select: { category: true, createdAt: true, updatedAt: true },
      }),

      // Top regions — butuh status + lokasi semua laporan
      // Hanya ambil field yang diperlukan agar ringan
      prisma.report.findMany({
        select: { district: true, city: true, status: true },
      }),
    ]);

    // ── KPI: Total pengajuan ──────────────────────────────────────────────────
    const weekDelta =
      lastWeekCount > 0
        ? Math.round(
            ((thisWeekCount - lastWeekCount) / lastWeekCount) * 100
          )
        : thisWeekCount > 0
        ? 100
        : 0;

    // ── KPI: Tingkat penyelesaian (global) ────────────────────────────────────
    const completionRate =
      totalReports > 0
        ? Math.round((resolvedTotal / totalReports) * 100)
        : 0;

    // Delta completion rate: minggu ini vs minggu lalu
    // resolvedThisWeek.length / thisWeekCount vs resolvedLastWeek.length / lastWeekCount
    const completionRateThisWeek =
      thisWeekCount > 0
        ? (resolvedThisWeek.length / thisWeekCount) * 100
        : 0;
    const completionRateLastWeek =
      lastWeekCount > 0
        ? (resolvedLastWeek.length / lastWeekCount) * 100
        : 0;
    const completionDelta = Math.round(
      completionRateThisWeek - completionRateLastWeek
    );

    // ── KPI: Rata-rata respons ────────────────────────────────────────────────
    // Proxy: updatedAt − createdAt untuk laporan RESOLVED
    const calcAvgMs = (
      rows: Array<{ createdAt: Date; updatedAt: Date }>
    ): number =>
      rows.length === 0
        ? 0
        : rows.reduce(
            (s, r) =>
              s + (r.updatedAt.getTime() - r.createdAt.getTime()),
            0
          ) / rows.length;

    const avgMsNow  = calcAvgMs(resolvedThisWeek);
    const avgMsLast = calcAvgMs(resolvedLastWeek);

    // Tampilkan dalam jam (1 desimal)
    const avgResponseHours = parseFloat(
      (avgMsNow / (1000 * 60 * 60)).toFixed(1)
    );
    // Delta dalam menit (positif = lebih lambat, negatif = lebih cepat)
    const avgDeltaMin = Math.round(
      (avgMsNow - avgMsLast) / (1000 * 60)
    );

    // ── KPI: Wilayah aktif ────────────────────────────────────────────────────
    const activeDistricts = allDistrictRows.length;
    const activeDistrictsThisWeek = thisWeekDistrictRows.length;

    // ── Chart: 7-day trend ────────────────────────────────────────────────────
    // Bangun ordered map dari 6 hari lalu → hari ini
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const orderedKeys: string[] = [];
    const trendMap: Record<
      string,
      { day: string; new: number; resolved: number }
    > = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = dayNames[d.getDay()];
      orderedKeys.push(key);
      if (!trendMap[key]) trendMap[key] = { day: key, new: 0, resolved: 0 };
    }

    // New: group by createdAt
    for (const r of newFor7d) {
      const key = dayNames[new Date(r.createdAt).getDay()];
      if (trendMap[key]) trendMap[key].new += 1;
    }
    // Resolved: group by updatedAt (hari diselesaikan)
    for (const r of resolvedThisWeek) {
      const key = dayNames[new Date(r.updatedAt).getDay()];
      if (trendMap[key]) trendMap[key].resolved += 1;
    }

    const trend = orderedKeys.map((k) => trendMap[k]);

    // ── Chart: Response time per kategori ─────────────────────────────────────
    const catRespMap: Record<
      string,
      { totalMs: number; count: number }
    > = {};

    for (const r of resolvedForCat) {
      const ms = r.updatedAt.getTime() - r.createdAt.getTime();
      if (!catRespMap[r.category])
        catRespMap[r.category] = { totalMs: 0, count: 0 };
      catRespMap[r.category].totalMs += ms;
      catRespMap[r.category].count  += 1;
    }

    const responseByCat = Object.entries(catRespMap).map(
      ([cat, d]) => ({
        cat,
        // Konversi ms → jam, bulatkan 1 desimal
        hours: parseFloat(
          (d.totalMs / d.count / (1000 * 60 * 60)).toFixed(1)
        ),
      })
    );

    // ── Chart: Top regions berdasarkan completion rate ────────────────────────
    const regionMap: Record<
      string,
      { total: number; resolved: number }
    > = {};

    for (const r of allForRegion) {
      // Gabungkan district + city agar unik
      const key = `${r.district}, ${r.city}`;
      if (!regionMap[key]) regionMap[key] = { total: 0, resolved: 0 };
      regionMap[key].total += 1;
      if (r.status === ReportStatus.RESOLVED) regionMap[key].resolved += 1;
    }

    const topRegions = Object.entries(regionMap)
      // Minimal 2 laporan agar rate bermakna
      .filter(([, d]) => d.total >= 2)
      .map(([name, d]) => ({
        name,
        rate: Math.round((d.resolved / d.total) * 100),
        count: d.total,
      }))
      // Sort: completion rate tertinggi, tie-break: jumlah laporan terbanyak
      .sort((a, b) => b.rate - a.rate || b.count - a.count)
      .slice(0, 5);

    // ── Response ──────────────────────────────────────────────────────────────
    // Cache 60 detik — data analytics tidak perlu real-time ketat
    res.setHeader("Cache-Control", "private, max-age=60");

    return res.json({
      kpis: {
        totalReports,
        weekDelta,
        avgResponseHours,
        avgDeltaMin,
        completionRate,
        completionDelta,
        activeDistricts,
        activeDistrictsThisWeek,
      },
      trend,
      categoryBreakdown: categoryBreakdown.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
      responseByCat,
      topRegions,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/reports — laporan milik user ────────────────────────────────────
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const reports = await prisma.report.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        _count: { select: { joins: true } },
      },
    });
    return res.json({ data: reports });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/reports ── DENGAN AI SMART ROUTING ────────────────────────────
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      province,
      city,
      district,
      village,
      address,
      imageUrl,
      lat,
      lng,
    } = req.body;

    if (
      !title ||
      !description ||
      !category ||
      !province ||
      !city ||
      !district ||
      !village
    ) {
      return res
        .status(400)
        .json({ error: "Field wajib tidak lengkap." });
    }
    const validCategories = Object.values(ReportCategory) as string[];
    const categoryUpper = String(category).toUpperCase();
    if (!validCategories.includes(categoryUpper)) {
      return res
        .status(400)
        .json({ error: `Kategori tidak valid: ${category}` });
    }
    const latVal = lat != null ? parseFloat(String(lat)) : NaN;
    const lngVal = lng != null ? parseFloat(String(lng)) : NaN;
    if (isNaN(latVal) || isNaN(lngVal)) {
      return res
        .status(400)
        .json({ error: "Koordinat lat/lng wajib diisi." });
    }

    const report = await prisma.report.create({
      data: {
        userId: req.userId!,
        title: String(title),
        description: String(description),
        category: categoryUpper as ReportCategory,
        status: ReportStatus.PENDING,
        lat: latVal,
        lng: lngVal,
        province: String(province),
        city: String(city),
        district: String(district),
        village: String(village),
        address: address ? String(address) : undefined,
        imageUrl: imageUrl ? String(imageUrl) : undefined,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        _count: { select: { joins: true } },
      },
    });

    res.status(201).json({ data: report });

    classifyReport(String(description))
      .then(async (result) => {
        if (!result) return;
        await prisma.report.update({
          where: { id: report.id },
          data: {
            ai_label: result.label,
            confidence_score: result.score,
          },
        });
        console.info(
          `[AI] Report ${report.id} → ${result.label} (${(result.score * 100).toFixed(1)}%)`
        );
      })
      .catch((err) => {
        console.error(
          `[AI] Background classify error untuk report ${report.id}:`,
          err
        );
      });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/reports/:id/ai-label — Manual Override (Admin) ───────────────
router.patch("/:id/ai-label", requireAdmin, async (req, res, next) => {
  try {
    const reportId = String(req.params.id);
    const { ai_label } = req.body as { ai_label?: string };

    const validLabels = DINAS_LABELS as readonly string[];
    if (!ai_label || !validLabels.includes(ai_label)) {
      return res.status(400).json({
        error: `ai_label tidak valid. Pilihan: ${DINAS_LABELS.join(", ")}`,
      });
    }

    const existing = await prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!existing)
      return res.status(404).json({ error: "Laporan tidak ditemukan." });

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: {
        ai_label,
        ai_overridden: true,
        ai_override_by: req.userId!,
        ai_override_at: new Date(),
        updatedAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        _count: { select: { joins: true } },
      },
    });

    console.info(
      `[AI] Override: report ${reportId} → "${ai_label}" by admin ${req.userId}`
    );
    return res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/reports/:id/status ───────────────────────────────────────────
router.patch("/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const reportId = String(req.params.id);
    const { status } = req.body as { status?: string };
    const validStatuses = Object.values(ReportStatus) as string[];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Status tidak valid. Pilih: ${validStatuses.join(", ")}`,
      });
    }
    const existing = await prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!existing)
      return res.status(404).json({ error: "Laporan tidak ditemukan." });
    const updated = await prisma.report.update({
      where: { id: reportId },
      data: { status: status as ReportStatus, updatedAt: new Date() },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        _count: { select: { joins: true } },
      },
    });
    return res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/reports/:id/join ───────────────────────────────────────────────
router.post("/:id/join", requireAuth, async (req, res, next) => {
  try {
    const reportId = String(req.params.id);
    const userId = req.userId!;
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report)
      return res.status(404).json({ error: "Laporan tidak ditemukan." });
    if (report.userId === userId)
      return res
        .status(400)
        .json({ error: "Anda adalah pemilik laporan ini." });
    const join = await prisma.reportJoin.upsert({
      where: { reportId_userId: { reportId, userId } },
      create: { reportId, userId, note: req.body?.note ?? null },
      update: {},
    });
    return res.status(201).json({ data: join });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/reports/:id ─────────────────────────────────────────────────────
// Harus PALING BAWAH — semua route spesifik harus di atas ini
router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const report = await prisma.report.findUnique({
      where: { id: String(req.params.id) },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        _count: { select: { joins: true } },
      },
    });
    if (!report)
      return res.status(404).json({ error: "Laporan tidak ditemukan." });

    // ── Nearby reports dalam radius 2 km ──────────────────────────────────────
    const NEARBY_RADIUS_M = 2_000;
    const bbox = boundingBox(report.lat, report.lng, NEARBY_RADIUS_M);

    const candidates = await prisma.report.findMany({
      where: {
        lat: bbox.lat,
        lng: bbox.lng,
        id:  { not: report.id },
        status: { notIn: [ReportStatus.RESOLVED, ReportStatus.REJECTED] },
      } as any,
      select: {
        id:           true,
        title:        true,
        category:     true,
        status:       true,
        lat:          true,
        lng:          true,
        imageUrl:     true,
        city:         true,
        district:     true,
        village:      true,
        createdAt:    true,
        _count:       { select: { joins: true } },
      },
      take: 30,
    });

    // Filter haversine presisi + sort terdekat + batas 10 item
    const nearby = candidates
      .map((r) => ({
        ...r,
        distanceMeters: Math.round(
          haversineMeters(report.lat, report.lng, r.lat, r.lng)
        ),
      }))
      .filter((r) => r.distanceMeters <= NEARBY_RADIUS_M)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 10);

    return res.json({ data: report, nearby });
  } catch (err) {
    next(err);
  }
});

export { router as reportsRouter };
export default router;