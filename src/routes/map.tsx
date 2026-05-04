/*eslint-disable*/
// src/routes/map.tsx

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useMemo, useState, useEffect, useCallback,
  useRef, useOptimistic, useTransition,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Filter, Plus, X, MapPin, Search, Layers,
  Loader2, WifiOff, RefreshCw, Flame, ThumbsUp,
  LocateFixed, Navigation,
} from "lucide-react";
import { MapClient } from "@/components/civic/MapClient";
import {
  CATEGORIES, STATUSES,
  type Category, type Status, type Report,
} from "@/data/reports";
import { StatusBadge, CategoryBadge } from "@/components/civic/StatusBadge";
import { AIBadge }                    from "@/components/civic/AIBadge";
import { CommentSection }             from "@/components/civic/CommentSection";
import {
  NearbyReportsSection,
  type NearbyReportItem,
} from "@/components/civic/NearbyReportsSection";
import { authFetch, useAuthStore }    from "@/data/login";

// ─── Route Definition ─────────────────────────────────────────────────────────
export const Route = createFileRoute("/map")({
  validateSearch: (search: Record<string, unknown>) => ({
    id:  typeof search.id === "string"                     ? search.id          : undefined,
    lat: search.lat != null && !isNaN(Number(search.lat)) ? Number(search.lat) : undefined,
    lng: search.lng != null && !isNaN(Number(search.lng)) ? Number(search.lng) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Map Reports — AduinKota" },
      { name: "description", content: "Interactive dark-mode map of citizen reports across Indonesia." },
    ],
  }),
  component: MapPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────
type DbCategory = "WASTE" | "INFRA" | "DISTURB" | "LAND";
type DbStatus   = "PENDING" | "IN_REVIEW" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";

interface ApiReport {
  id:               string;
  title:            string;
  description:      string;
  category:         DbCategory;
  status:           DbStatus;
  lat:              number;
  lng:              number;
  province:         string;
  city:             string;
  district:         string;
  village:          string;
  address:          string | null;
  imageUrl:         string | null;
  createdAt:        string;
  updatedAt:        string;
  user:             { id: string; name: string; avatar: string | null };
  _count?:          { joins: number };
  voteCount:        number;
  ai_label?:        string | null;
  confidence_score?: number | null;
  ai_overridden?:   boolean;
}

// ─── Nearby filter constants ──────────────────────────────────────────────────
const RADIUS_OPTIONS = [
  { label: "500 m",  value: 500   },
  { label: "1 km",   value: 1_000 },
  { label: "2 km",   value: 2_000 },
  { label: "5 km",   value: 5_000 },
  { label: "10 km",  value: 10_000 },
] as const;

type RadiusValue = typeof RADIUS_OPTIONS[number]["value"];

// ─── Mappings ─────────────────────────────────────────────────────────────────
const CATEGORY_MAP: Record<DbCategory, Category> = {
  WASTE: "waste", INFRA: "infra", DISTURB: "disturb", LAND: "land",
};
const STATUS_MAP: Record<DbStatus, Status> = {
  PENDING: "new", IN_REVIEW: "progress", IN_PROGRESS: "progress",
  RESOLVED: "resolved", REJECTED: "cancelled",
};

const HIDDEN_STATUSES: Status[] = ["resolved", "cancelled"];

const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%231e293b'/%3E%3Ctext x='32' y='36' text-anchor='middle' fill='%2364748b' font-size='10' font-family='sans-serif'%3ENo img%3C/text%3E%3C/svg%3E";

// ─── Haversine (client-side, untuk filter radius) ─────────────────────────────
function haversineM(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R    = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Converter ────────────────────────────────────────────────────────────────
function apiToReport(r: ApiReport): Report {
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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatRadius(v: number) {
  return v < 1_000 ? `${v} m` : `${v / 1_000} km`;
}

// ─── Hook: semua laporan untuk peta ──────────────────────────────────────────
function useMapReports() {
  const [reports,   setReports]   = useState<Report[]>([]);
  const rawMapRef                 = useRef<Map<string, ApiReport>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: "1", limit: "500" });
      const res    = await authFetch(`/api/reports/all?${params}`);
      if (res.status === 401) { setError("Sesi habis. Silakan login kembali."); return; }
      if (res.status === 403) { setError("Akses ditolak."); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `Gagal memuat laporan (${res.status})`);
        return;
      }
      const json: { data: ApiReport[] } = await res.json();
      const apiList = json.data ?? [];

      const newMap = new Map<string, ApiReport>();
      apiList.forEach((r) => newMap.set(`RPT-${r.id.slice(-4).toUpperCase()}`, r));
      rawMapRef.current = newMap;

      setReports(apiList.map(apiToReport));
      setLastFetch(new Date());
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    const id = setInterval(fetchReports, 60_000);
    return () => clearInterval(id);
  }, [fetchReports]);

  const getRaw = useCallback(
    (shortId: string): ApiReport | undefined => rawMapRef.current.get(shortId),
    []
  );

  return { reports, loading, error, refetch: fetchReports, lastFetch, getRaw };
}

// ─── Hook: nearby reports untuk laporan yang sedang dibuka ───────────────────
function useNearbyReports(reportDbId: string | null | undefined) {
  const [nearby,  setNearby]  = useState<NearbyReportItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!reportDbId) { setNearby([]); return; }

    let cancelled = false;
    setLoading(true);

    authFetch(`/api/reports/${reportDbId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { data: ApiReport; nearby: NearbyReportItem[] } | null) => {
        if (!cancelled) setNearby(data?.nearby ?? []);
      })
      .catch(() => { if (!cancelled) setNearby([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [reportDbId]);

  return { nearby, loading };
}

// ─── VoteButton ───────────────────────────────────────────────────────────────
interface VoteButtonProps {
  reportDbId:    string;
  initialCount:  number;
  initialVoted:  boolean;
  size?:         "sm" | "md";
  onVoteChange?: (voted: boolean, count: number) => void;
}

function VoteButton({
  reportDbId, initialCount, initialVoted, size = "md", onVoteChange,
}: VoteButtonProps) {
  const [committed, setCommitted]  = useState({ voted: initialVoted, count: initialCount });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCommitted({ voted: initialVoted, count: initialCount });
  }, [initialVoted, initialCount]);

  const [optimistic, addOptimistic] = useOptimistic(
    committed,
    (state, newVoted: boolean) => ({
      voted: newVoted,
      count: newVoted ? state.count + 1 : state.count - 1,
    })
  );

  function handleVote() {
    const newVoted = !committed.voted;
    startTransition(async () => {
      addOptimistic(newVoted);
      try {
        const res = await authFetch(`/api/votes/toggle/${reportDbId}`, { method: "POST" });
        if (res.ok) {
          const data: { voted: boolean; voteCount: number } = await res.json();
          setCommitted({ voted: data.voted, count: data.voteCount });
          onVoteChange?.(data.voted, data.voteCount);
        }
      } catch {
        // optimistic revert
      }
    });
  }

  const isVoted = optimistic.voted;
  const isSm    = size === "sm";

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleVote(); }}
      disabled={isPending}
      title={isVoted ? "Batalkan dukungan" : "Dukung laporan ini"}
      className={[
        "flex items-center gap-1.5 rounded-xl font-medium transition-all duration-200 select-none",
        isSm ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        isVoted
          ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.15)]"
          : "glass text-muted-foreground hover:text-foreground border border-transparent hover:border-border",
        isPending ? "opacity-70 cursor-not-allowed" : "hover:scale-[1.04] active:scale-[0.97]",
      ].join(" ")}
    >
      <ThumbsUp
        size={isSm ? 11 : 13}
        className={[
          "transition-transform duration-150",
          isVoted  ? "fill-blue-400/40 text-blue-300 scale-110" : "",
          isPending ? "animate-pulse" : "",
        ].join(" ")}
      />
      <span className={isVoted ? "text-blue-300 font-semibold" : "tabular-nums"}>
        {optimistic.count}
      </span>
    </button>
  );
}

// ─── MapPage ──────────────────────────────────────────────────────────────────
function MapPage() {
  const { reports, loading, error, refetch, lastFetch, getRaw } = useMapReports();
  const currentUser = useAuthStore((s) => s.user);

  const [activeCats,     setActiveCats]     = useState<Category[]>(Object.keys(CATEGORIES) as Category[]);
  const [activeStat,     setActiveStat]     = useState<Status | "all">("all");
  const [search,         setSearch]         = useState("");
  const [selected,       setSelected]       = useState<Report | null>(null);
  const [selectedRaw,    setSelectedRaw]    = useState<ApiReport | null>(null);
  const [showMobileCats, setShowMobileCats] = useState(false);
  const [showHeatmap,    setShowHeatmap]    = useState(false);

  // ── Nearby location filter state ───────────────────────────────────────────
  const [nearbyMode,   setNearbyMode]   = useState(false);
  const [nearbyRadius, setNearbyRadius] = useState<RadiusValue>(2_000);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading,   setLocLoading]   = useState(false);
  const [locError,     setLocError]     = useState<string | null>(null);

  const [voteStatus,        setVoteStatus]        = useState<{ voted: boolean; count: number } | null>(null);
  const [voteStatusLoading, setVoteStatusLoading] = useState(false);

  // ── Nearby reports untuk sidebar ──────────────────────────────────────────
  const { nearby: nearbyItems, loading: nearbyLoading } = useNearbyReports(
    selectedRaw?.id ?? null
  );

  const { id: deepLinkId, lat: deepLinkLat, lng: deepLinkLng } = Route.useSearch();
  const navigate = useNavigate({ from: "/map" });

  const [flyTo, setFlyTo]       = useState<{ center: [number, number]; zoom: number; seq?: number } | null>(null);
  const flySeqRef               = useRef(0);
  const deepLinkHandledRef      = useRef<string | null>(null);

  // ── Toggle nearby mode — minta izin lokasi ────────────────────────────────
  function toggleNearbyMode() {
    if (nearbyMode) {
      setNearbyMode(false);
      setUserLocation(null);
      setLocError(null);
      return;
    }
    if (!navigator.geolocation) {
      setLocError("Browser tidak mendukung geolokasi.");
      return;
    }
    setLocLoading(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setNearbyMode(true);
        setLocLoading(false);
        // Fly ke lokasi user
        flySeqRef.current += 1;
        setFlyTo({ center: [loc.lat, loc.lng], zoom: 14, seq: flySeqRef.current });
      },
      (err) => {
        setLocLoading(false);
        if (err.code === 1) {
          setLocError("Izin lokasi ditolak. Aktifkan di pengaturan browser.");
        } else if (err.code === 2) {
          setLocError("Lokasi tidak tersedia saat ini.");
        } else {
          setLocError("Waktu permintaan lokasi habis. Coba lagi.");
        }
      },
      { timeout: 8_000, maximumAge: 60_000 }
    );
  }

  // ── Deep-link ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!deepLinkId) { deepLinkHandledRef.current = null; return; }
    if (loading) return;
    if (deepLinkHandledRef.current === deepLinkId) return;

    const targetReport = reports.find((r) => getRaw(r.id)?.id === deepLinkId);
    if (!targetReport) return;

    deepLinkHandledRef.current = deepLinkId;

    const raw = getRaw(targetReport.id);
    setSelected(targetReport);
    setSelectedRaw(raw ?? null);

    const lat = raw?.lat ?? deepLinkLat;
    const lng = raw?.lng ?? deepLinkLng;
    if (lat != null && lng != null) {
      flySeqRef.current += 1;
      setFlyTo({ center: [lat, lng], zoom: 16, seq: flySeqRef.current });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkId, loading, reports]);

  // ── Vote status ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedRaw) { setVoteStatus(null); return; }
    setVoteStatusLoading(true);
    authFetch(`/api/votes/status/${selectedRaw.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { voted: boolean; voteCount: number } | null) => {
        if (data) setVoteStatus({ voted: data.voted, count: data.voteCount });
      })
      .catch(() => setVoteStatus({ voted: false, count: selectedRaw.voteCount ?? 0 }))
      .finally(() => setVoteStatusLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRaw?.id]);

  // ── Sync selected saat reports di-refresh ─────────────────────────────────
  useEffect(() => {
    if (!selected) return;
    const updated = reports.find(
      (r) => r.id === selected.id || (r.lat === selected.lat && r.lng === selected.lng)
    );
    if (updated) {
      setSelected(updated);
      setSelectedRaw(getRaw(updated.id) ?? null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  // ── handleSelect ──────────────────────────────────────────────────────────
  function handleSelect(report: Report | null) {
    setSelected(report);
    if (!report) {
      setSelectedRaw(null);
      setVoteStatus(null);
      if (deepLinkId) {
        navigate({ to: "/map", search: { id: undefined, lat: undefined, lng: undefined }, replace: true });
      }
      return;
    }
    setSelectedRaw(getRaw(report.id) ?? null);
  }

  // ── handleNearbySelect ─────────────────────────────────────────────────────
  function handleNearbySelect(item: NearbyReportItem) {
    const existing = reports.find((r) => {
      const raw = getRaw(r.id);
      return raw?.id === item.id;
    });

    if (existing) {
      handleSelect(existing);
    } else {
      const tempReport: Report = {
        id:          `RPT-${item.id.slice(-4).toUpperCase()}`,
        title:       item.title,
        description: "",
        category:    (CATEGORY_MAP as any)[item.category] ?? "infra",
        status:      (STATUS_MAP   as any)[item.status]   ?? "new",
        lat:         item.lat,
        lng:         item.lng,
        image:       item.imageUrl ?? PLACEHOLDER_IMG,
        region: {
          province:    "",
          city:        item.city,
          district:    item.district,
          subdistrict: item.village,
        },
        createdAt: item.createdAt,
        reporter:  "—",
      };
      handleSelect(tempReport);
    }

    flySeqRef.current += 1;
    setFlyTo({ center: [item.lat, item.lng], zoom: 16, seq: flySeqRef.current });
  }

  // ── Filters — termasuk nearby radius ──────────────────────────────────────
  const filtered = useMemo(() => {
    let base = reports.filter(
      (r) =>
        !HIDDEN_STATUSES.includes(r.status) &&
        activeCats.includes(r.category) &&
        (activeStat === "all" || r.status === activeStat) &&
        (search === "" ||
          r.title.toLowerCase().includes(search.toLowerCase()) ||
          r.region.city.toLowerCase().includes(search.toLowerCase()) ||
          r.region.subdistrict.toLowerCase().includes(search.toLowerCase()))
    );

    // ── Nearby location filter ───────────────────────────────────────────────
    if (nearbyMode && userLocation) {
      base = base.filter(
        (r) => haversineM(userLocation.lat, userLocation.lng, r.lat, r.lng) <= nearbyRadius
      );
    }

    return base;
  }, [reports, activeCats, activeStat, search, nearbyMode, userLocation, nearbyRadius]);

  const activeReports = useMemo(
    () => reports.filter((r) => !HIDDEN_STATUSES.includes(r.status)),
    [reports]
  );

  // Hitung berapa laporan dalam setiap radius option (untuk badge info)
  const radiusCounts = useMemo(() => {
    if (!nearbyMode || !userLocation) return {} as Record<number, number>;
    const counts: Record<number, number> = {};
    for (const opt of RADIUS_OPTIONS) {
      counts[opt.value] = activeReports.filter(
        (r) => haversineM(userLocation.lat, userLocation.lng, r.lat, r.lng) <= opt.value
      ).length;
    }
    return counts;
  }, [nearbyMode, userLocation, activeReports]);

  const toggleCat    = (c: Category) =>
    setActiveCats((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  const toggleAllCats = () =>
    setActiveCats((prev) =>
      prev.length === Object.keys(CATEGORIES).length
        ? []
        : (Object.keys(CATEGORIES) as Category[])
    );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="flex-1 relative h-[calc(100vh-0px)] md:h-screen overflow-hidden">

      {/* Peta */}
      <div className="absolute inset-0 p-2 md:p-3">
        <MapClient
          reports={filtered}
          onSelect={handleSelect}
          height="100%"
          showHeatmap={showHeatmap}
          flyTo={flyTo}
          // Tandai posisi user di peta saat nearby mode aktif
          pickedPos={nearbyMode && userLocation ? userLocation : null}
        />
      </div>

      {/* Loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[500] bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 pointer-events-none"
          >
            <Loader2 size={28} className="animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">Memuat laporan…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner */}
      <AnimatePresence>
        {error && !loading && (
          <motion.div
            key="error"
            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-[500] glass-strong rounded-2xl px-5 py-3 flex items-center gap-3 shadow-elevated max-w-sm w-full mx-4"
          >
            <WifiOff size={16} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-300 flex-1">{error}</p>
            <button onClick={refetch} className="text-xs text-accent hover:underline whitespace-nowrap">
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

        {/* Status filter desktop */}
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
          {(Object.keys(STATUSES) as Status[])
            .filter((s) => !HIDDEN_STATUSES.includes(s))
            .map((s) => (
              <button
                key={s}
                onClick={() => setActiveStat(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-smooth ${
                  activeStat === s ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {STATUSES[s].label}
              </button>
            ))}
        </div>

        {/* Right-side controls */}
        <div className="ml-auto flex items-center gap-2 pointer-events-auto">

          {/* Heatmap */}
          <button
            onClick={() => setShowHeatmap((p) => !p)}
            className={`h-8 px-3 rounded-xl glass-strong flex items-center gap-1.5 shadow-elevated text-xs font-medium transition-smooth ${
              showHeatmap
                ? "text-orange-300 bg-orange-500/20 border border-orange-500/40"
                : "text-muted-foreground hover:text-foreground border border-transparent"
            }`}
          >
            <Flame size={13} className={showHeatmap ? "text-orange-400" : ""} />
            <span className="hidden sm:inline">Heatmap</span>
          </button>

          {/* ── Nearby / Sekitar Saya ── */}
          <button
            onClick={toggleNearbyMode}
            disabled={locLoading}
            title={
              locError
                ? locError
                : nearbyMode
                ? `Filter aktif: ${formatRadius(nearbyRadius)} dari lokasi Anda — klik untuk nonaktifkan`
                : "Filter laporan di sekitar lokasi saya"
            }
            className={[
              "h-8 px-3 rounded-xl glass-strong flex items-center gap-1.5 shadow-elevated text-xs font-medium transition-smooth",
              nearbyMode
                ? "text-emerald-300 bg-emerald-500/20 border border-emerald-500/40"
                : locError
                ? "text-red-400 border border-red-500/30 bg-red-500/10"
                : "text-muted-foreground hover:text-foreground border border-transparent",
              locLoading ? "opacity-70 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {locLoading
              ? <Loader2 size={13} className="animate-spin" />
              : nearbyMode
              ? <Navigation size={13} className="text-emerald-400" />
              : <LocateFixed size={13} className={locError ? "text-red-400" : ""} />
            }
            <span className="hidden sm:inline">
              {locLoading
                ? "Mencari…"
                : nearbyMode
                ? `Sekitar (${formatRadius(nearbyRadius)})`
                : "Terdekat"
              }
            </span>
          </button>

          {/* Refresh */}
          {lastFetch && (
            <button
              onClick={refetch}
              title={`Terakhir diperbarui: ${lastFetch.toLocaleTimeString("id-ID")}`}
              className="h-8 w-8 rounded-xl glass-strong flex items-center justify-center shadow-elevated text-muted-foreground hover:text-foreground transition-smooth"
            >
              <RefreshCw size={13} />
            </button>
          )}

          {/* Counter */}
          <div className="glass-strong rounded-2xl px-3 py-2 flex items-center gap-2 shadow-elevated text-xs">
            <Layers size={13} className={nearbyMode ? "text-emerald-400" : "text-accent"} />
            <span className={`font-medium ${nearbyMode ? "text-emerald-300" : ""}`}>{filtered.length}</span>
            <span className="text-muted-foreground hidden sm:inline">/ {activeReports.length}</span>
          </div>
        </div>
      </div>

      {/* ── Nearby radius bar — muncul tepat di bawah top bar ── */}
      <AnimatePresence>
        {nearbyMode && userLocation && (
          <motion.div
            key="radius-bar"
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0,   opacity: 1 }}
            exit={{    y: -16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="absolute top-[68px] left-1/2 -translate-x-1/2 z-[400] pointer-events-auto"
          >
            <div className="glass-strong rounded-2xl px-3 py-2 flex items-center gap-2 shadow-elevated whitespace-nowrap">
              {/* Ikon + label */}
              <Navigation size={11} className="text-emerald-400 shrink-0" />
              <span className="text-[10px] text-emerald-300/80 font-medium">Radius:</span>

              {/* Tombol radius */}
              <div className="flex items-center gap-1">
                {RADIUS_OPTIONS.map((opt) => {
                  const isActive = nearbyRadius === opt.value;
                  const count    = radiusCounts[opt.value] ?? 0;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setNearbyRadius(opt.value)}
                      className={[
                        "relative px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150",
                        isActive
                          ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-[0_0_8px_rgba(52,211,153,0.2)]"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                      ].join(" ")}
                    >
                      {opt.label}
                      {/* Badge jumlah laporan di radius ini */}
                      {count > 0 && (
                        <span
                          className={[
                            "absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full text-[8px] font-bold flex items-center justify-center px-0.5",
                            isActive
                              ? "bg-emerald-400 text-emerald-950"
                              : "bg-white/20 text-foreground/70",
                          ].join(" ")}
                        >
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="h-4 w-px bg-white/10 mx-1" />

              {/* Jumlah hasil filter aktif */}
              <span className="text-[10px] tabular-nums">
                <span className="text-emerald-300 font-semibold">{filtered.length}</span>
                <span className="text-muted-foreground"> laporan</span>
              </span>

              {/* Tombol tutup */}
              <button
                onClick={() => { setNearbyMode(false); setUserLocation(null); setLocError(null); }}
                className="ml-1 h-5 w-5 rounded-full glass flex items-center justify-center text-muted-foreground hover:text-foreground transition-smooth"
                title="Matikan filter lokasi"
              >
                <X size={10} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error toast geolokasi ── */}
      <AnimatePresence>
        {locError && !nearbyMode && (
          <motion.div
            key="loc-error"
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0,   opacity: 1 }}
            exit={{    y: -16, opacity: 0 }}
            className="absolute top-[68px] left-1/2 -translate-x-1/2 z-[400] pointer-events-auto"
          >
            <div className="glass-strong rounded-2xl px-4 py-2 flex items-center gap-2 shadow-elevated">
              <WifiOff size={12} className="text-red-400 shrink-0" />
              <span className="text-[11px] text-red-300 whitespace-nowrap">{locError}</span>
              <button
                onClick={() => setLocError(null)}
                className="ml-1 h-5 w-5 rounded-full glass flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X size={10} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile: status filter */}
      <div className="absolute top-[72px] left-4 right-4 flex sm:hidden items-center gap-1.5 overflow-x-auto scrollbar-none z-[400] pointer-events-auto">
        <div className="glass-strong rounded-2xl p-1 flex items-center gap-1 shadow-elevated shrink-0">
          <button
            onClick={() => setActiveStat("all")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-smooth whitespace-nowrap ${
              activeStat === "all" ? "gradient-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Semua
          </button>
          {(Object.keys(STATUSES) as Status[])
            .filter((s) => !HIDDEN_STATUSES.includes(s))
            .map((s) => (
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
        <button
          onClick={() => setShowHeatmap((p) => !p)}
          className={`glass-strong rounded-2xl px-3 py-2 flex items-center gap-1.5 shadow-elevated text-[11px] font-medium shrink-0 ${
            showHeatmap ? "text-orange-300 bg-orange-500/20 border border-orange-500/40" : ""
          }`}
        >
          <Flame size={12} className={showHeatmap ? "text-orange-400" : "text-accent"} /> Heatmap
        </button>

        {/* Mobile: nearby toggle */}
        <button
          onClick={toggleNearbyMode}
          disabled={locLoading}
          className={[
            "glass-strong rounded-2xl px-3 py-2 flex items-center gap-1.5 shadow-elevated text-[11px] font-medium shrink-0 transition-smooth",
            nearbyMode
              ? "text-emerald-300 bg-emerald-500/20 border border-emerald-500/40"
              : locError
              ? "text-red-400 border border-red-500/30"
              : "",
          ].join(" ")}
        >
          {locLoading
            ? <Loader2 size={12} className="animate-spin" />
            : nearbyMode
            ? <Navigation size={12} className="text-emerald-400" />
            : <LocateFixed size={12} className={locError ? "text-red-400" : "text-accent"} />
          }
          {nearbyMode ? `${formatRadius(nearbyRadius)}` : "Terdekat"}
        </button>

        <button
          onClick={() => setShowMobileCats((p) => !p)}
          className="glass-strong rounded-2xl px-3 py-2 flex items-center gap-1.5 shadow-elevated text-[11px] font-medium shrink-0"
        >
          <Filter size={12} className="text-accent" /> Kategori
        </button>
      </div>

      {/* Mobile: radius picker — muncul saat nearby mode aktif di mobile */}
      <AnimatePresence>
        {nearbyMode && userLocation && (
          <motion.div
            key="mobile-radius"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{    y: 10, opacity: 0 }}
            className="absolute top-[120px] left-4 z-[450] pointer-events-auto sm:hidden"
          >
            <div className="glass-strong rounded-2xl px-3 py-2 flex items-center gap-1.5 shadow-elevated">
              <Navigation size={10} className="text-emerald-400 shrink-0" />
              <div className="flex items-center gap-1">
                {RADIUS_OPTIONS.map((opt) => {
                  const isActive = nearbyRadius === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setNearbyRadius(opt.value)}
                      className={[
                        "px-2 py-0.5 rounded-lg text-[10px] font-medium transition-smooth",
                        isActive
                          ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/50"
                          : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] text-emerald-300 font-semibold tabular-nums ml-1">
                {filtered.length}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Heatmap legend */}
      <AnimatePresence>
        {showHeatmap && (
          <motion.div
            key="heatmap-legend"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-20 left-4 z-[400] glass-strong rounded-2xl px-4 py-3 shadow-elevated pointer-events-none hidden md:block"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Kepadatan Masalah Aktif
            </p>
            <div
              className="h-2.5 w-32 rounded-full"
              style={{ background: "linear-gradient(to right, #00ff00, #ffff00, #ff8800, #ff0000)" }}
            />
            <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
              <span>Rendah</span><span>Tinggi</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Nearby mode legend / info card ── */}
      <AnimatePresence>
        {nearbyMode && userLocation && (
          <motion.div
            key="nearby-legend"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-20 left-4 z-[400] glass-strong rounded-2xl px-4 py-3 shadow-elevated pointer-events-none hidden md:block"
          >
            <div className="flex items-center gap-2 mb-2">
              <Navigation size={11} className="text-emerald-400" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                Filter Lokasi Aktif
              </p>
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              {/* Lingkaran radius visual */}
              <div className="h-3 w-3 rounded-full border-2 border-emerald-400/60 bg-emerald-400/20 shrink-0" />
              <span className="text-[11px] text-muted-foreground">
                Radius <span className="text-emerald-300 font-semibold">{formatRadius(nearbyRadius)}</span> dari posisi Anda
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#82C8E5] shrink-0" />
              <span className="text-[11px] text-muted-foreground">
                Koordinat:{" "}
                <span className="text-foreground/70 tabular-nums font-mono text-[10px]">
                  {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                </span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category filter — desktop */}
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
            const count  = nearbyMode && userLocation
              ? filtered.filter((r) => r.category === c).length
              : activeReports.filter((r) => r.category === c).length;
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
                  style={{ background: cat.color, boxShadow: active ? `0 0 8px ${cat.color}` : "none" }}
                />
                <span className="flex-1 text-left text-[12px] leading-snug">{cat.label}</span>
                <span className={`text-[10px] tabular-nums ${nearbyMode ? "text-emerald-400/70" : "text-muted-foreground"}`}>
                  {loading ? "…" : count}
                </span>
              </button>
            );
          })}
        </div>
        {lastFetch && (
          <div className="mt-3 pt-3 border-t border-border/50 text-[10px] text-muted-foreground/60 text-center">
            Diperbarui {lastFetch.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
        {/* Nearby status di category panel */}
        {nearbyMode && userLocation && (
          <div className="mt-2 px-1 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5">
            <Navigation size={9} className="text-emerald-400 shrink-0" />
            <span className="text-[10px] text-emerald-300/80">
              Filter {formatRadius(nearbyRadius)} aktif
            </span>
          </div>
        )}
      </div>

      {/* Mobile: category drawer */}
      <AnimatePresence>
        {showMobileCats && (
          <motion.div
            key="mobile-cats"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
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
                  <span className="text-[10px] text-muted-foreground">
                    {activeReports.filter((r) => r.category === c).length}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Detail Card Desktop ── */}
      <AnimatePresence>
        {selected && (
          <motion.aside
            key="detail-card"
            initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="absolute top-4 right-4 bottom-4 w-80 glass-strong rounded-3xl shadow-elevated overflow-hidden z-[400] flex-col hidden md:flex"
          >
            {/* Foto */}
            <div className="relative h-44 shrink-0">
              <img
                src={selected.image}
                alt={selected.title}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <button
                onClick={() => handleSelect(null)}
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

            {/* Konten scrollable */}
            <div className="p-5 flex-1 overflow-y-auto">
              <div className="text-[10px] text-muted-foreground tracking-wider uppercase font-mono">
                {selected.id}
              </div>
              <h3 className="font-display text-lg font-semibold mt-1 leading-snug">{selected.title}</h3>

              {/* AI Badge */}
              {(selectedRaw?.ai_label || selectedRaw?.ai_label === null) && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Dinas terkait:</span>
                  <AIBadge
                    label={selectedRaw.ai_label ?? null}
                    score={selectedRaw.confidence_score ?? null}
                    overridden={selectedRaw.ai_overridden ?? false}
                    size="md"
                    showScore
                  />
                </div>
              )}

              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{selected.description}</p>

              {/* Vote */}
              <div className="mt-5 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Dukungan Warga</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      Dukung untuk prioritaskan penanganan
                    </p>
                  </div>
                  {voteStatusLoading ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass text-xs text-muted-foreground">
                      <Loader2 size={12} className="animate-spin" />
                      <span>…</span>
                    </div>
                  ) : (
                    selectedRaw && voteStatus !== null && (
                      <VoteButton
                        reportDbId={selectedRaw.id}
                        initialCount={voteStatus.count}
                        initialVoted={voteStatus.voted}
                        size="md"
                        onVoteChange={(voted, count) => setVoteStatus({ voted, count })}
                      />
                    )
                  )}
                </div>
                {voteStatus && voteStatus.count > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden origin-left"
                  >
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500/60 to-blue-400/80"
                      animate={{ width: `${Math.min(100, (voteStatus.count / 50) * 100)}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </motion.div>
                )}
              </div>

              {/* Info rows */}
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
                {/* Tampilkan jarak dari user saat nearby mode aktif */}
                {nearbyMode && userLocation && (
                  <Row
                    icon={<Navigation size={13} className="text-emerald-400" />}
                    label="Jarak dari Anda"
                    value={(() => {
                      const m = Math.round(haversineM(userLocation.lat, userLocation.lng, selected.lat, selected.lng));
                      return m < 1_000 ? `${m} meter` : `${(m / 1_000).toFixed(2)} km`;
                    })()}
                  />
                )}
                <Row icon={<span className="text-[10px]">👤</span>} label="Pelapor"  value={selected.reporter} />
                <Row icon={<span className="text-[10px]">⏱</span>}  label="Dikirim"  value={timeAgo(selected.createdAt)} />
              </div>

              {/* ── Nearby Reports Section ── */}
              <NearbyReportsSection
                items={nearbyItems}
                loading={nearbyLoading}
                onSelect={handleNearbySelect}
              />

              {/* Comments */}
              {selectedRaw && (
                <CommentSection
                  reportId={selectedRaw.id}
                  currentUserId={currentUser?.id}
                  currentUserRole={currentUser?.role as any}
                />
              )}
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

      {/* ── Mobile bottom sheet ── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key="mobile-sheet"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="absolute bottom-0 left-0 right-0 glass-strong rounded-t-3xl shadow-elevated z-[400] flex flex-col md:hidden max-h-[70vh] overflow-hidden"
          >
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
                {selectedRaw && (
                  <AIBadge
                    label={selectedRaw.ai_label ?? null}
                    score={selectedRaw.confidence_score ?? null}
                    overridden={selectedRaw.ai_overridden ?? false}
                    size="sm"
                  />
                )}
                {/* Jarak badge di mobile */}
                {nearbyMode && userLocation && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-300 font-semibold">
                    <Navigation size={9} />
                    {(() => {
                      const m = Math.round(haversineM(userLocation.lat, userLocation.lng, selected.lat, selected.lng));
                      return m < 1_000 ? `${m}m` : `${(m / 1_000).toFixed(1)}km`;
                    })()}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleSelect(null)}
                className="h-7 w-7 rounded-full glass flex items-center justify-center"
              >
                <X size={13} />
              </button>
            </div>

            <div className="px-4 pb-4 overflow-y-auto flex-1">
              <div className="text-[10px] text-muted-foreground font-mono tracking-wide">{selected.id}</div>
              <h3 className="font-semibold text-base mt-0.5 leading-snug">{selected.title}</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-3">
                {selected.description}
              </p>

              {/* Mobile Vote Row */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin size={11} />
                  <span className="truncate max-w-[160px]">
                    {selected.region.subdistrict}, {selected.region.city}
                  </span>
                  <span className="shrink-0">{timeAgo(selected.createdAt)}</span>
                </div>
                {voteStatusLoading ? (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-xl glass text-[11px] text-muted-foreground">
                    <Loader2 size={11} className="animate-spin" />
                  </div>
                ) : (
                  selectedRaw && voteStatus !== null && (
                    <VoteButton
                      reportDbId={selectedRaw.id}
                      initialCount={voteStatus.count}
                      initialVoted={voteStatus.voted}
                      size="sm"
                      onVoteChange={(voted, count) => setVoteStatus({ voted, count })}
                    />
                  )
                )}
              </div>

              {/* ── Nearby Reports Section — mobile compact ── */}
              <NearbyReportsSection
                items={nearbyItems}
                loading={nearbyLoading}
                onSelect={handleNearbySelect}
                compact
              />

              {/* Comments */}
              {selectedRaw && (
                <CommentSection
                  reportId={selectedRaw.id}
                  currentUserId={currentUser?.id}
                  currentUserRole={currentUser?.role as any}
                  compact
                />
              )}
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

      {/* Floating CTA */}
      <Link
        to="/submit"
        className="absolute bottom-6 right-4 md:bottom-8 md:right-8 z-[450] h-12 md:h-14 px-5 md:px-6 rounded-full gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-105 transition-smooth flex items-center gap-2 animate-float text-sm md:text-base"
      >
        <Plus size={16} />
        <span className="hidden sm:inline">Buat Pengaduan</span>
        <span className="sm:hidden">Lapor</span>
      </Link>

      {/* Empty state */}
      {!loading && !error && activeReports.length > 0 && filtered.length === 0 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[400] glass-strong rounded-2xl px-5 py-3 text-xs text-muted-foreground shadow-elevated whitespace-nowrap">
          {nearbyMode
            ? `Tidak ada laporan dalam radius ${formatRadius(nearbyRadius)} dari lokasi Anda.`
            : "Tidak ada laporan aktif yang cocok dengan filter ini."
          }
        </div>
      )}
    </main>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────
function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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