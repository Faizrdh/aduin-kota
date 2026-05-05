/*eslint-disable*/
// src/routes/index.tsx

import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useOptimistic, useTransition } from "react";
import {
  ArrowUpRight, Activity, Clock, CheckCircle2, AlertCircle,
  MapPin, Plus, TrendingUp, Loader2, AlertTriangle, RefreshCw,
  ThumbsUp, Flame,
} from "lucide-react";
import { authFetch } from "@/data/login";
import { StatusBadge, CategoryBadge } from "@/components/civic/StatusBadge";
// ✅ HAPUS baris lama: import { commentsRouter } from "./CommentSection";
// CommentSection adalah komponen React, bukan router server.
// Ia dipakai di map.tsx (detail panel), bukan di sini.

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — AduinKota" },
      { name: "description", content: "Tayangan nyata pengaduan masyarakat Indonesia." },
    ],
  }),
  component: Dashboard,
});

// ─── Types ────────────────────────────────────────────────────────────────────
type DbStatus = "PENDING" | "IN_REVIEW" | "IN_PROGRESS" | "DISPATCHED" | "RESOLVED" | "REJECTED";
type DbCategory = "WASTE" | "INFRA" | "DISTURB" | "LAND";
type DbPriority = "NORMAL" | "HIGH" | "EMERGENCY";
type SortMode   = "terbaru" | "terpopuler";

interface ApiReport {
  id:          string;
  title:       string;
  description: string;
  category:    DbCategory;
  status:      DbStatus;
  priority:    DbPriority;
  province:    string;
  city:        string;
  district:    string;
  village:     string;
  address:     string | null;
  imageUrl:    string | null;
  createdAt:   string;
  updatedAt:   string;
  user:        { id: string; name: string; avatar: string | null };
  _count:      { joins: number };
  voteCount:   number;
}

interface ApiStats {
  total:      number;
  pending:    number;
  inProgress: number;
  resolved:   number;
  rejected:   number;
}

interface ApiReportsResponse {
  data: ApiReport[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Mappings ─────────────────────────────────────────────────────────────────
const CATEGORY_DISPLAY: Record<DbCategory, { label: string; color: string }> = {
  WASTE:   { label: "Pengelolaan Sampah",  color: "red"   },
  INFRA:   { label: "Infrastruktur",       color: "blue"  },
  DISTURB: { label: "Gangguan Ketertiban", color: "amber" },
  LAND:    { label: "Tanah / Sosial",      color: "green" },
};

const STATUS_DISPLAY: Record<DbStatus, { label: string; variant: string }> = {
  PENDING:     { label: "Baru",            variant: "new"        },
  IN_REVIEW:   { label: "Sedang Ditinjau", variant: "progress"   },
  IN_PROGRESS: { label: "Dalam Proses",    variant: "progress"   },
  DISPATCHED:  { label: "Diteruskan",      variant: "dispatched" },
  RESOLVED:    { label: "Selesai",         variant: "resolved"   },
  REJECTED:    { label: "Ditolak",         variant: "rejected"   },
};

// ─── TAMBAH priority config ───────────────────────────────────────────────────
const PRIORITY_BADGE: Record<DbPriority, { label: string; cls: string } | null> = {
  NORMAL:    null,
  HIGH:      { label: "⚡ Prioritas", cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  EMERGENCY: { label: "🔥 Darurat",   cls: "bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse" },
};
const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%231e293b'/%3E%3Ctext x='32' y='36' text-anchor='middle' fill='%2364748b' font-size='10' font-family='sans-serif'%3ENo img%3C/text%3E%3C/svg%3E";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Baru saja";
  if (h < 1) return `${m}m lalu`;
  if (d < 1) return `${h}j lalu`;
  if (d === 1) return "Kemarin";
  return `${d}h lalu`;
}

function toTitle(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className ?? ""}`} />;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, accent, delay,
}: {
  label: string; value: number | string; sub: string;
  icon: React.ElementType; accent: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="glass rounded-2xl p-5 hover:-translate-y-0.5 transition-smooth shadow-soft relative overflow-hidden group"
    >
      <div
        className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-2xl transition-smooth group-hover:opacity-40"
        style={{ background: accent }}
      />
      <div className="flex items-center justify-between mb-4 relative">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon size={16} style={{ color: accent }} />
      </div>
      <div className="font-display text-3xl font-bold relative">{value}</div>
      <div className="text-xs text-muted-foreground mt-1 relative">{sub}</div>
    </motion.div>
  );
}

// ─── Category Bar ─────────────────────────────────────────────────────────────
function CategoryBar({
  category, count, total,
}: {
  category: DbCategory; count: number; total: number;
}) {
  const cat = CATEGORY_DISPLAY[category];
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  const colorMap: Record<string, string> = {
    red:   "var(--status-rejected, #ef4444)",
    blue:  "var(--status-progress, #3b82f6)",
    amber: "var(--status-new, #f59e0b)",
    green: "var(--status-resolved, #10b981)",
  };

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: colorMap[cat.color] ?? "#64748b" }} />
          {cat.label}
        </span>
        <span className="text-muted-foreground">{count}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: colorMap[cat.color] ?? "#64748b" }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ─── MiniVoteButton ───────────────────────────────────────────────────────────
interface MiniVoteButtonProps {
  reportDbId:   string;
  initialCount: number;
}

function MiniVoteButton({ reportDbId, initialCount }: MiniVoteButtonProps) {
  const [committed, setCommitted]    = useState({ count: initialCount, voted: false });
  const [isPending, startTransition] = useTransition();
  const [optimistic, addOptimistic]  = useOptimistic(
    committed,
    (state, newVoted: boolean) => ({
      voted: newVoted,
      count: newVoted ? state.count + 1 : state.count - 1,
    })
  );

  function handleVote(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const newVoted = !committed.voted;
    startTransition(async () => {
      addOptimistic(newVoted);
      try {
        const res = await authFetch(`/api/votes/toggle/${reportDbId}`, { method: "POST" });
        if (res.ok) {
          const data: { voted: boolean; voteCount: number } = await res.json();
          setCommitted({ voted: data.voted, count: data.voteCount });
        }
      } catch {
        // revert via committed state
      }
    });
  }

  return (
    <button
      onClick={handleVote}
      disabled={isPending}
      title={optimistic.voted ? "Batalkan dukungan" : "Dukung"}
      className={[
        "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 shrink-0",
        optimistic.voted
          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
          : "bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-transparent",
        isPending ? "opacity-60 cursor-not-allowed" : "hover:scale-105 active:scale-95",
      ].join(" ")}
    >
      <ThumbsUp
        size={11}
        className={[
          "transition-all",
          optimistic.voted ? "fill-blue-400/40 text-blue-300" : "",
          isPending ? "animate-pulse" : "",
        ].join(" ")}
      />
      <span className="tabular-nums">{optimistic.count}</span>
    </button>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard() {
  const [stats,        setStats]        = useState<ApiStats | null>(null);
  const [reports,      setReports]      = useState<ApiReport[]>([]);
  const [sortMode,     setSortMode]     = useState<SortMode>("terbaru");
  const [statsLoading, setStatsLoading] = useState(true);
  const [feedLoading,  setFeedLoading]  = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const sorted = [...reports].sort((a, b) => {
    if (sortMode === "terpopuler") {
      if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const categoryCounts: Record<DbCategory, number> = {
    WASTE: 0, INFRA: 0, DISTURB: 0, LAND: 0,
  };
  reports.forEach((r) => {
    if (r.category in categoryCounts) categoryCounts[r.category]++;
  });

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await authFetch("/api/reports/stats");
      if (res.ok) {
        const data: ApiStats = await res.json();
        setStats(data);
      }
    } catch {
      // stats gagal tidak blokir halaman
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchRecent = useCallback(async () => {
    setFeedLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/reports/all?page=1&limit=20");
      if (res.status === 401) { setError("Sesi habis. Silakan login kembali."); return; }
      if (!res.ok) { setError(`Gagal memuat data (${res.status})`); return; }
      const json: ApiReportsResponse = await res.json();
      setReports(json.data ?? []);
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setFeedLoading(false);
    }
  }, []);

// ─── GANTI kedua useEffect fetch dengan ini ───────────────────────────────────
useEffect(() => {
  fetchStats();
  // polling setiap 30 detik
  const id = setInterval(fetchStats, 30_000);
  return () => clearInterval(id);
}, [fetchStats]);

useEffect(() => {
  fetchRecent();
  // polling setiap 30 detik
  const id = setInterval(fetchRecent, 30_000);
  return () => clearInterval(id);
}, [fetchRecent]);

  const statCards = [
    {
      label: "Total Laporan",
      value: statsLoading ? "…" : (stats?.total ?? 0),
      sub:   "Semua laporan masuk",
      icon:  Activity,
      accent: "var(--primary)",
    },
    {
      label: "Baru / Pending",
      value: statsLoading ? "…" : (stats?.pending ?? 0),
      sub:   "Menunggu peninjauan",
      icon:  AlertCircle,
      accent: "var(--status-new, #f59e0b)",
    },
    {
      label: "Dalam Proses",
      value: statsLoading ? "…" : (stats?.inProgress ?? 0),
      sub:   "Sedang ditangani",
      icon:  Clock,
      accent: "var(--status-progress, #3b82f6)",
    },
    {
      label: "Selesai",
      value: statsLoading ? "…" : (stats?.resolved ?? 0),
      sub:   "Laporan diselesaikan",
      icon:  CheckCircle2,
      accent: "var(--status-resolved, #10b981)",
    },
  ];

  const topVotedCount = sorted[0]?.voteCount ?? 0;

  return (
    <main className="flex-1 px-5 md:px-10 py-8 max-w-[1500px] w-full mx-auto">

      {/* ── Hero ── */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-accent mb-2">
            tayangan nyata pengaduan · Indonesia
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-gradient leading-tight">
            Pengaduan Masyarakat, Indonesia<br className="hidden md:block" /> secara nyata.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl text-sm md:text-base">
            Pantau laporan dari seluruh Indonesia. Koordinasikan respons, ukur dampak, dan
            jaga masyarakat tetap terinformasi.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <Link
            to="/"
            className="px-4 py-2.5 rounded-xl glass-strong text-sm font-medium hover:bg-white/10 transition-smooth flex items-center gap-2"
          >
            Buka Peta <ArrowUpRight size={15} />
          </Link>
          <Link
            to="/submit"
            className="px-4 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition-smooth flex items-center gap-2"
          >
            <Plus size={15} /> Buat Pengaduan
          </Link>
        </div>
      </header>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 0.06} />
        ))}
      </div>

      {/* ── Two-col layout ── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* ── Recent Feed ── */}
        <div className="lg:col-span-2 glass rounded-2xl p-6 shadow-soft">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-xl font-semibold">Pengaduan Masyarakat</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sortMode === "terpopuler"
                  ? "Diurutkan berdasarkan dukungan terbanyak"
                  : "Laporan terbaru dari masyarakat"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Sort Toggle */}
              <div className="flex items-center gap-1 glass rounded-xl p-1">
                <button
                  onClick={() => setSortMode("terbaru")}
                  className={[
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-smooth whitespace-nowrap",
                    sortMode === "terbaru"
                      ? "bg-white/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <Clock size={11} />
                  Terbaru
                </button>
                <button
                  onClick={() => setSortMode("terpopuler")}
                  className={[
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-smooth whitespace-nowrap",
                    sortMode === "terpopuler"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <ThumbsUp size={11} className={sortMode === "terpopuler" ? "fill-blue-400/30" : ""} />
                  Terpopuler
                </button>
              </div>

              <button
                onClick={fetchRecent}
                className="text-xs text-muted-foreground hover:text-foreground transition-smooth flex items-center gap-1.5"
              >
                <RefreshCw size={12} />
              </button>
              <Link to="/incoming-reports" className="text-xs text-accent hover:underline">
                Lihat Semua →
              </Link>
            </div>
          </div>

          {/* Most Voted highlight banner */}
          <AnimatePresence>
            {sortMode === "terpopuler" && !feedLoading && topVotedCount > 0 && (
              <motion.div
                key="top-voted-banner"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300"
              >
                <Flame size={12} className="text-blue-400 shrink-0" />
                <span>
                  <span className="font-semibold">{sorted[0]?.title}</span>
                  {" "}mendapatkan dukungan terbanyak dengan{" "}
                  <span className="font-semibold">{topVotedCount} suara</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading state */}
          {feedLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl">
                  <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!feedLoading && error && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <div className="h-10 w-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <p className="text-sm text-red-300 text-center">{error}</p>
              <button onClick={fetchRecent} className="text-xs text-accent hover:underline">
                Coba lagi
              </button>
            </div>
          )}

          {/* Data */}
          {!feedLoading && !error && (
            <div className="space-y-2">
              {sorted.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Belum ada laporan.
                </p>
              )}
              <AnimatePresence mode="popLayout">
                {sorted.slice(0, 6).map((r, i) => {
                  const cat        = CATEGORY_DISPLAY[r.category] ?? { label: r.category, color: "gray" };
                  const status     = STATUS_DISPLAY[r.status]     ?? { label: r.status, variant: "new" };
                  const isTopVoted = sortMode === "terpopuler" && i === 0 && r.voteCount > 0;

                  return (
                    <motion.div
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ delay: i * 0.04, layout: { duration: 0.3 } }}
                    >
                      {/*
                       * ✅ FIX: search harus menyertakan semua field yang dideklarasikan
                       * di validateSearch map.tsx: { id, lat, lng }
                       */}
                      <Link
                        to="/map"
                        search={{ id: r.id, lat: undefined, lng: undefined }}
                        className={[
                          "flex items-center gap-4 p-3 rounded-xl transition-smooth border",
                          isTopVoted
                            ? "bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10"
                            : "hover:bg-white/5 border-transparent hover:border-border",
                        ].join(" ")}
                      >
                        {/* Rank badge (only in terpopuler mode) */}
                        {sortMode === "terpopuler" && (
                          <span
                            className={[
                              "shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                              i === 0 ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                              i === 1 ? "bg-white/10 text-white/60" :
                              i === 2 ? "bg-white/5 text-white/40" : "bg-transparent text-muted-foreground/40",
                            ].join(" ")}
                          >
                            {i + 1}
                          </span>
                        )}

                        <img
                          src={r.imageUrl ?? PLACEHOLDER_IMG}
                          alt={r.title}
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }}
                          className="h-14 w-14 rounded-lg object-cover shrink-0 border border-border/30"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <CategoryBadge category={cat.color} label={cat.label} />
                            <StatusBadge status={status.variant as any} />
                              {(() => {
                                const pb = PRIORITY_BADGE[r.priority ?? "NORMAL"];
                                if (!pb) return null;
                                return (
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${pb.cls}`}>
                                    {pb.label}
                                  </span>
                                );
                              })()}
                          </div>
                          <div className="text-sm font-medium truncate">{r.title}</div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <MapPin size={11} />
                            {toTitle(r.village)}, {toTitle(r.city)} · {timeAgo(r.createdAt)}
                          </div>
                        </div>

                        {/* Mini Vote Button */}
                        <MiniVoteButton reportDbId={r.id} initialCount={r.voteCount} />
                      </Link>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Side Column ── */}
        <div className="space-y-6">

          {/* Performa Card */}
          <div className="glass rounded-2xl p-6 shadow-soft relative overflow-hidden">
            <div className="absolute -bottom-12 -right-12 h-48 w-48 rounded-full gradient-primary opacity-30 blur-3xl" />
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent mb-3 relative">
              <TrendingUp size={14} /> performa pengaduan
            </div>

            {statsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <>
                <div className="font-display text-3xl font-bold relative">
                  {stats ? `${stats.resolved} / ${stats.total}` : "—"}
                </div>
                <div className="text-sm text-muted-foreground relative">laporan diselesaikan</div>
              </>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3 relative">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-[11px] text-muted-foreground">Resolution rate</div>
                <div className="font-semibold mt-0.5">
                  {statsLoading ? "…" : stats && stats.total > 0
                    ? `${Math.round((stats.resolved / stats.total) * 100)}%`
                    : "—"}
                </div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-[11px] text-muted-foreground">Ditolak</div>
                <div className="font-semibold mt-0.5">
                  {statsLoading ? "…" : stats?.rejected ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* Top Supported Reports */}
          {!feedLoading && !error && (
            <div className="glass rounded-2xl p-6 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ThumbsUp size={14} className="text-blue-400" />
                  <h3 className="font-semibold text-sm">Dukungan Terbanyak</h3>
                </div>
                <button
                  onClick={() => setSortMode("terpopuler")}
                  className="text-xs text-accent hover:underline"
                >
                  Urutkan →
                </button>
              </div>
              <div className="space-y-3">
                {[...reports]
                  .sort((a, b) => b.voteCount - a.voteCount)
                  .slice(0, 4)
                  .map((r, i) => (
                    <Link
                      key={r.id}
                      to="/map"
                      search={{ id: r.id, lat: undefined, lng: undefined }}
                      className="flex items-center gap-3 hover:opacity-80 transition-smooth"
                    >
                      <span className="text-[11px] font-bold text-muted-foreground/50 w-4 shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] truncate leading-snug">{r.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {toTitle(r.city)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-blue-400 shrink-0">
                        <ThumbsUp size={10} className="fill-blue-400/30" />
                        <span className="font-semibold tabular-nums">{r.voteCount}</span>
                      </div>
                    </Link>
                  ))}
                {reports.every(r => r.voteCount === 0) && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Belum ada laporan yang didukung.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Category Distribution */}
          <div className="glass rounded-2xl p-6 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Jenis Kategori</h3>
              <Link to="/analytics" className="text-xs text-accent hover:underline">
                Detail →
              </Link>
            </div>

            {feedLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-6" />
                    </div>
                    <Skeleton className="h-1.5 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(Object.keys(CATEGORY_DISPLAY) as DbCategory[]).map((k) => (
                  <CategoryBar
                    key={k}
                    category={k}
                    count={categoryCounts[k]}
                    total={reports.length}
                  />
                ))}
                {reports.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Tidak ada data kategori.
                  </p>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}