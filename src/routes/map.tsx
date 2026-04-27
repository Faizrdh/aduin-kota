/*eslint-disable*/

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Filter, Plus, X, MapPin, Search, Layers,
  Loader2, AlertTriangle, RefreshCw, WifiOff,
} from "lucide-react";
import { MapClient } from "@/components/civic/MapClient";
import { CATEGORIES, STATUSES, type Category, type Status, type Report } from "@/data/reports";
import { StatusBadge, CategoryBadge } from "@/components/civic/StatusBadge";
import { authFetch } from "@/data/login";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Map Reports — CivicSpot" },
      {
        name: "description",
        content:
          "Interactive dark-mode map of citizen reports across Indonesia, filterable by category and status.",
      },
    ],
  }),
  component: MapPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type DbCategory = "WASTE" | "INFRA" | "DISTURB" | "LAND";
type DbStatus   = "PENDING" | "IN_REVIEW" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";

interface ApiReport {
  id:          string;
  title:       string;
  description: string;
  category:    DbCategory;
  status:      DbStatus;
  lat:         number | null;
  lng:         number | null;
  province:    string;
  city:        string;
  district:    string;
  village:     string;
  address:     string | null;
  imageUrl:    string | null;
  createdAt:   string;
  updatedAt:   string;
  user:        { id: string; name: string; avatar: string | null };
  _count?:     { joins: number };
}

// ─── Mappings DB → UI ─────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<DbCategory, Category> = {
  WASTE:   "waste",
  INFRA:   "infra",
  DISTURB: "disturb",
  LAND:    "land",
};

const STATUS_MAP: Record<DbStatus, Status> = {
  PENDING:     "new",
  IN_REVIEW:   "progress",
  IN_PROGRESS: "progress",
  RESOLVED:    "resolved",
  REJECTED:    "cancelled",
};

const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%231e293b'/%3E%3Ctext x='32' y='36' text-anchor='middle' fill='%2364748b' font-size='10' font-family='sans-serif'%3ENo img%3C/text%3E%3C/svg%3E";

// ─── Converter ────────────────────────────────────────────────────────────────

function apiToReport(r: ApiReport): Report | null {
  // Lewati laporan tanpa koordinat — tidak bisa ditampilkan di peta
  if (r.lat === null || r.lng === null) return null;

  return {
    id:          `RPT-${r.id.slice(-4).toUpperCase()}`,
    title:       r.title,
    description: r.description,
    category:    CATEGORY_MAP[r.category] ?? "infra",
    status:      STATUS_MAP[r.status]     ?? "new",
    lat:         r.lat,
    lng:         r.lng,
    image:       r.imageUrl ?? PLACEHOLDER_IMG,
    region: {
      province:    r.province,
      city:        r.city,
      district:    r.district,
      subdistrict: r.village,
    },
    createdAt: r.createdAt,
    reporter:  r.user?.name ?? "—",
  };
}

// ─── timeAgo ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Hook: Fetch all map reports ──────────────────────────────────────────────

function useMapReports() {
  const [reports,   setReports]   = useState<Report[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Ambil semua laporan dengan limit besar — peta tidak pakai pagination
      const params = new URLSearchParams({ page: "1", limit: "500" });
      const res    = await authFetch(`/api/reports/all?${params}`);

      if (res.status === 401) { setError("Sesi habis. Silakan login kembali."); return; }
      if (res.status === 403) { setError("Akses ditolak.");                      return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `Gagal memuat laporan (${res.status})`);
        return;
      }

      const json: { data: ApiReport[] } = await res.json();
      const mapped = (json.data ?? [])
        .map(apiToReport)
        .filter((r): r is Report => r !== null);

      setReports(mapped);
      setLastFetch(new Date());
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh setiap 60 detik
  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 60_000);
    return () => clearInterval(id);
  }, [fetch]);

  return { reports, loading, error, refetch: fetch, lastFetch };
}

// ─── MapPage ──────────────────────────────────────────────────────────────────

function MapPage() {
  const { reports, loading, error, refetch, lastFetch } = useMapReports();

  const [activeCats, setActiveCats] = useState<Category[]>(
    Object.keys(CATEGORIES) as Category[]
  );
  const [activeStat, setActiveStat] = useState<Status | "all">("all");
  const [search,     setSearch]     = useState("");
  const [selected,   setSelected]   = useState<Report | null>(null);
  const [showMobileCats, setShowMobileCats] = useState(false);

  // Saat reports berubah, update selected jika ada yang match
  useEffect(() => {
    if (!selected) return;
    const updated = reports.find(
      (r) => r.id === selected.id || (r.lat === selected.lat && r.lng === selected.lng)
    );
    if (updated) setSelected(updated);
  }, [reports]);

  const filtered = useMemo(() => {
    return reports.filter(
      (r) =>
        activeCats.includes(r.category) &&
        (activeStat === "all" || r.status === activeStat) &&
        (search === "" ||
          r.title.toLowerCase().includes(search.toLowerCase()) ||
          r.region.city.toLowerCase().includes(search.toLowerCase()) ||
          r.region.subdistrict.toLowerCase().includes(search.toLowerCase()))
    );
  }, [reports, activeCats, activeStat, search]);

  const toggleCat = (c: Category) =>
    setActiveCats((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );

  const toggleAllCats = () =>
    setActiveCats((prev) =>
      prev.length === Object.keys(CATEGORIES).length
        ? []
        : (Object.keys(CATEGORIES) as Category[])
    );

  return (
    <main className="flex-1 relative h-[calc(100vh-0px)] md:h-screen overflow-hidden">

      {/* ── Peta ── */}
      <div className="absolute inset-0 p-2 md:p-3">
        <MapClient reports={filtered} onSelect={setSelected} height="100%" />
      </div>

      {/* ── Loading overlay ── */}
      <AnimatePresence>
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[500] bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 pointer-events-none"
          >
            <Loader2 size={28} className="animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">Memuat laporan…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error banner ── */}
      <AnimatePresence>
        {error && !loading && (
          <motion.div
            key="error"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-[500] glass-strong rounded-2xl px-5 py-3 flex items-center gap-3 shadow-elevated max-w-sm w-full mx-4"
          >
            <WifiOff size={16} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-300 flex-1">{error}</p>
            <button
              onClick={refetch}
              className="text-xs text-accent hover:underline whitespace-nowrap"
            >
              Coba lagi
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top bar ── */}
      <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center gap-2 pointer-events-none z-[400]">

        {/* Search */}
        <div className="glass-strong rounded-2xl px-3.5 py-2.5 flex items-center gap-2 pointer-events-auto shadow-elevated flex-1 max-w-xs min-w-0">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari laporan, kota…"
            className="bg-transparent outline-none text-sm w-full placeholder:text-muted-foreground min-w-0"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground shrink-0">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status filter — hidden on very small screens */}
        <div className="glass-strong rounded-2xl p-1.5 items-center gap-1 pointer-events-auto shadow-elevated hidden sm:flex flex-wrap">
          <button
            onClick={() => setActiveStat("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-smooth ${
              activeStat === "all"
                ? "gradient-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {(Object.keys(STATUSES) as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => setActiveStat(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-smooth ${
                activeStat === s
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {STATUSES[s].label}
            </button>
          ))}
        </div>

        {/* Counter + refresh */}
        <div className="ml-auto flex items-center gap-2 pointer-events-auto">
          {lastFetch && (
            <button
              onClick={refetch}
              title={`Terakhir diperbarui: ${lastFetch.toLocaleTimeString("id-ID")}`}
              className="h-8 w-8 rounded-xl glass-strong flex items-center justify-center shadow-elevated text-muted-foreground hover:text-foreground transition-smooth"
            >
              <RefreshCw size={13} />
            </button>
          )}
          <div className="glass-strong rounded-2xl px-3 py-2 flex items-center gap-2 shadow-elevated text-xs">
            <Layers size={13} className="text-accent" />
            <span className="font-medium">{filtered.length}</span>
            <span className="text-muted-foreground hidden sm:inline">/ {reports.length}</span>
          </div>
        </div>
      </div>

      {/* ── Mobile: status filter row ── */}
      <div className="absolute top-[72px] left-4 right-4 flex sm:hidden items-center gap-1.5 overflow-x-auto scrollbar-none z-[400] pointer-events-auto">
        <div className="glass-strong rounded-2xl p-1 flex items-center gap-1 shadow-elevated shrink-0">
          <button
            onClick={() => setActiveStat("all")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-smooth whitespace-nowrap ${
              activeStat === "all"
                ? "gradient-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            Semua
          </button>
          {(Object.keys(STATUSES) as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => setActiveStat(s)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-smooth whitespace-nowrap ${
                activeStat === s ? "bg-white/10 text-foreground" : "text-muted-foreground"
              }`}
            >
              {STATUSES[s].label}
            </button>
          ))}
        </div>

        {/* Mobile category toggle */}
        <button
          onClick={() => setShowMobileCats((p) => !p)}
          className="glass-strong rounded-2xl px-3 py-2 flex items-center gap-1.5 shadow-elevated text-[11px] font-medium shrink-0"
        >
          <Filter size={12} className="text-accent" />
          Kategori
        </button>
      </div>

      {/* ── Category filter — desktop left panel ── */}
      <div className="absolute top-24 left-4 glass-strong rounded-2xl p-3 z-[400] pointer-events-auto shadow-elevated w-52 hidden md:block">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-accent" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Kategori</span>
          </div>
          <button
            onClick={toggleAllCats}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-smooth"
          >
            {activeCats.length === Object.keys(CATEGORIES).length ? "None" : "All"}
          </button>
        </div>
        <div className="space-y-0.5">
          {(Object.keys(CATEGORIES) as Category[]).map((c) => {
            const cat    = CATEGORIES[c];
            const active = activeCats.includes(c);
            const count  = reports.filter((r) => r.category === c).length;
            return (
              <button
                key={c}
                onClick={() => toggleCat(c)}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-smooth text-sm ${
                  active ? "bg-white/8" : "opacity-45 hover:opacity-80"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{
                    background:  cat.color,
                    boxShadow:   active ? `0 0 8px ${cat.color}` : "none",
                  }}
                />
                <span className="flex-1 text-left text-[12px] leading-snug">{cat.label}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {loading ? "…" : count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Last updated */}
        {lastFetch && (
          <div className="mt-3 pt-3 border-t border-border/50 text-[10px] text-muted-foreground/60 text-center">
            Diperbarui {lastFetch.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>

      {/* ── Mobile: category drawer ── */}
      <AnimatePresence>
        {showMobileCats && (
          <motion.div
            key="mobile-cats"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="absolute top-[120px] left-4 glass-strong rounded-2xl p-3 z-[450] pointer-events-auto shadow-elevated w-52 md:hidden"
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Kategori</span>
              <button onClick={() => setShowMobileCats(false)}>
                <X size={13} className="text-muted-foreground" />
              </button>
            </div>
            {(Object.keys(CATEGORIES) as Category[]).map((c) => {
              const cat    = CATEGORIES[c];
              const active = activeCats.includes(c);
              const count  = reports.filter((r) => r.category === c).length;
              return (
                <button
                  key={c}
                  onClick={() => toggleCat(c)}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-smooth ${
                    active ? "bg-white/8" : "opacity-45"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ background: cat.color, boxShadow: active ? `0 0 8px ${cat.color}` : "none" }}
                  />
                  <span className="flex-1 text-left text-[12px]">{cat.label}</span>
                  <span className="text-[10px] text-muted-foreground">{count}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Selected report side card — desktop ── */}
      <AnimatePresence>
        {selected && (
          <motion.aside
            key="detail-card"
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="absolute top-4 right-4 bottom-4 w-80 glass-strong rounded-3xl shadow-elevated overflow-hidden z-[400] flex flex-col hidden md:flex"
          >
            <div className="relative h-44 shrink-0">
              <img
                src={selected.image}
                alt={selected.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PLACEHOLDER_IMG;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 h-8 w-8 rounded-full glass-strong flex items-center justify-center hover:bg-white/15 transition-smooth"
              >
                <X size={15} />
              </button>
              <div className="absolute bottom-3 left-4 right-4 flex flex-wrap gap-2">
                <CategoryBadge
                  category={CATEGORIES[selected.category].color}
                  label={CATEGORIES[selected.category].label}
                />
                <StatusBadge status={selected.status} />
              </div>
            </div>
            <div className="p-5 flex-1 overflow-y-auto">
              <div className="text-[10px] text-muted-foreground tracking-wider uppercase font-mono">
                {selected.id}
              </div>
              <h3 className="font-display text-lg font-semibold mt-1 leading-snug">
                {selected.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                {selected.description}
              </p>

              <div className="mt-5 space-y-3 text-sm">
                <Row
                  icon={<MapPin size={13} />}
                  label="Lokasi"
                  value={`${selected.region.subdistrict}, ${selected.region.district}, ${selected.region.city}`}
                />
                <Row
                  icon={<span className="text-[10px]">📍</span>}
                  label="Koordinat"
                  value={`${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)}`}
                />
                <Row
                  icon={<span className="text-[10px]">👤</span>}
                  label="Pelapor"
                  value={selected.reporter}
                />
                <Row
                  icon={<span className="text-[10px]">⏱</span>}
                  label="Dikirim"
                  value={timeAgo(selected.createdAt)}
                />
              </div>
            </div>
            <div className="p-4 border-t border-border flex gap-2 shrink-0">
              <button className="flex-1 px-3 py-2 rounded-xl glass text-xs font-medium hover:bg-white/10 transition-smooth">
                Tugaskan
              </button>
              <button className="flex-1 px-3 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold hover:scale-[1.02] transition-smooth">
                Tandai selesai
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Selected report — mobile bottom sheet ── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key="mobile-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="absolute bottom-0 left-0 right-0 glass-strong rounded-t-3xl shadow-elevated z-[400] flex flex-col md:hidden max-h-[55vh] overflow-hidden"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            <div className="px-4 pb-2 flex items-start justify-between shrink-0">
              <div className="flex flex-wrap gap-1.5">
                <CategoryBadge
                  category={CATEGORIES[selected.category].color}
                  label={CATEGORIES[selected.category].label}
                />
                <StatusBadge status={selected.status} />
              </div>
              <button
                onClick={() => setSelected(null)}
                className="h-7 w-7 rounded-full glass flex items-center justify-center"
              >
                <X size={13} />
              </button>
            </div>
            <div className="px-4 pb-4 overflow-y-auto flex-1">
              <div className="text-[10px] text-muted-foreground font-mono tracking-wide">
                {selected.id}
              </div>
              <h3 className="font-semibold text-base mt-0.5 leading-snug">{selected.title}</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-3">
                {selected.description}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin size={11} />
                <span className="truncate">
                  {selected.region.subdistrict}, {selected.region.city}
                </span>
                <span className="ml-auto shrink-0">{timeAgo(selected.createdAt)}</span>
              </div>
            </div>
            <div className="px-4 pb-5 pt-2 flex gap-2 shrink-0 border-t border-border">
              <button className="flex-1 px-3 py-2.5 rounded-xl glass text-xs font-medium hover:bg-white/10 transition-smooth">
                Tugaskan
              </button>
              <button className="flex-1 px-3 py-2.5 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold">
                Tandai selesai
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating CTA ── */}
      <Link
        to="/submit"
        className="absolute bottom-6 right-4 md:bottom-8 md:right-8 z-[450] h-12 md:h-14 px-5 md:px-6 rounded-full gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-105 transition-smooth flex items-center gap-2 animate-float text-sm md:text-base"
      >
        <Plus size={16} /> <span className="hidden sm:inline">Buat Pengaduan</span>
        <span className="sm:hidden">Lapor</span>
      </Link>

      {/* ── Empty state — no reports with coords ── */}
      {!loading && !error && reports.length > 0 && filtered.length === 0 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[400] glass-strong rounded-2xl px-5 py-3 text-xs text-muted-foreground shadow-elevated whitespace-nowrap">
          Tidak ada laporan yang cocok dengan filter ini.
        </div>
      )}
    </main>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 h-6 w-6 rounded-md bg-white/5 flex items-center justify-center text-muted-foreground shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm truncate">{value}</div>
      </div>
    </div>
  );
}