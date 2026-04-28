/*eslint-disable*/

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useInView, useScroll, useTransform } from "framer-motion";
import {
  MapPin, Search, Filter, Layers, LogIn, Plus, X,
  CheckCircle2, Clock, AlertCircle, Activity, ChevronDown,
  Megaphone, ArrowDown, ArrowRight, Zap, Shield, Eye,
  MessageSquare, TrendingUp, Calendar, Tag, User,
  ExternalLink, ChevronRight, Globe, Flame, RefreshCw, Loader2,
} from "lucide-react";
import { MapClient } from "@/components/civic/MapClient";
import {
  CATEGORIES, REPORTS as STATIC_REPORTS, STATUSES,
  type Category, type Status, type Report,
  getStats, timeAgo,
} from "@/data/reports";
import { StatusBadge, CategoryBadge } from "@/components/civic/StatusBadge";

// ── Asset imports ──────────────────────────────────────────────────────────
import buatLaporanSvg       from "@/assets/buat-laporan.svg";
import verifikasiLaporanSvg from "@/assets/verifikasi-laporan.svg";
import selesaiLaporanSvg    from "@/assets/selesai-laporan.svg";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "AduinKota — Aduin Keluhanmu Disini" },
      {
        name: "description",
        content:
          "Platform pengaduan warga kota secara real-time. Lihat, laporkan, dan pantau permasalahan di kotamu.",
      },
    ],
  }),
  component: LandingPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────
type DbCategory = "WASTE" | "INFRA" | "DISTURB" | "LAND";
type DbStatus   = "PENDING" | "IN_REVIEW" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";

// Response dari /api/reports/public (field terbatas, aman untuk publik)
interface PublicApiReport {
  id:          string;
  title:       string;
  description: string;
  category:    DbCategory;
  status:      DbStatus;
  lat:         number;
  lng:         number;
  province:    string;
  city:        string;
  district:    string;
  village:     string;
  imageUrl:    string | null;
  createdAt:   string;
  user:        { name: string };
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
function apiToReport(r: PublicApiReport): Report {
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

// ─── Hook: Fetch public reports dari /api/reports/public ─────────────────────
// Endpoint ini tidak memerlukan autentikasi — aman untuk landing page publik.
// Fallback ke STATIC_REPORTS jika server tidak tersedia.
function usePublicReports() {
  const [reports,   setReports]   = useState<Report[]>(STATIC_REPORTS);
  const [loading,   setLoading]   = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      // Gunakan endpoint publik — tidak butuh token/auth
      const params = new URLSearchParams({ page: "1", limit: "500" });
      const res    = await fetch(`/api/reports/public?${params}`, {
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) return; // keep static fallback silently

      const json: { data: PublicApiReport[] } = await res.json();
      const mapped = (json.data ?? []).map(apiToReport);
      if (mapped.length > 0) {
        setReports(mapped);
        setLastFetch(new Date());
      }
    } catch {
      // Network error — keep static fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    const id = setInterval(fetchReports, 60_000); // auto-refresh setiap 1 menit
    return () => clearInterval(id);
  }, [fetchReports]);

  return { reports, loading, lastFetch, refetch: fetchReports };
}

/* ─────────────────────────────────────────────
   ANIMATED BACKGROUND CANVAS
───────────────────────────────────────────── */
function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const orbData = [
      { x: 0.12, y: 0.18, r: 420, c: "rgba(108,92,231,",  s: 0.16 },
      { x: 0.88, y: 0.30, r: 340, c: "rgba(0,206,201,",   s: 0.20 },
      { x: 0.50, y: 0.72, r: 380, c: "rgba(162,155,254,", s: 0.13 },
      { x: 0.08, y: 0.82, r: 260, c: "rgba(0,184,148,",   s: 0.25 },
      { x: 0.92, y: 0.88, r: 300, c: "rgba(253,203,110,", s: 0.17 },
    ];

    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 2000,
      s: Math.random() * 1.8 + 0.3,
      v: Math.random() * 0.35 + 0.05,
      o: Math.random() * 0.45 + 0.08,
    }));

    let t = 0;
    let W = 0, H = 0;

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.007;

      orbData.forEach((o, i) => {
        const px = (o.x + Math.sin(t * o.s + i) * 0.09) * W;
        const py = (o.y + Math.cos(t * o.s * 0.7 + i) * 0.07) * H;
        const g  = ctx.createRadialGradient(px, py, 0, px, py, o.r);
        g.addColorStop(0,   o.c + "0.08)");
        g.addColorStop(0.5, o.c + "0.04)");
        g.addColorStop(1,   o.c + "0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, py, o.r, 0, Math.PI * 2); ctx.fill();
      });

      particles.forEach(p => {
        p.y -= p.v;
        if (p.y < -10) p.y = H + 10;
        const pulse = 0.5 + Math.sin(t * 2 + p.x) * 0.5;
        ctx.beginPath(); ctx.arc(p.x % W, p.y, p.s, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(162,155,254,${p.o * pulse})`;
        ctx.fill();
      });

      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 6);
      for (let i = 0; i < 3; i++) {
        const x = -700 + i * 450 + Math.sin(t * 0.28 + i) * 60;
        const g = ctx.createLinearGradient(x, -H, x, H);
        g.addColorStop(0,   "rgba(108,92,231,0)");
        g.addColorStop(0.5, "rgba(108,92,231,0.022)");
        g.addColorStop(1,   "rgba(108,92,231,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x, -H * 1.5, 20, H * 3);
      }
      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ width: "100vw", height: "100vh" }}
      />
      <div
        className="fixed inset-0 z-[1] pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(108,92,231,0.13) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
        }}
      />
    </>
  );
}

/* ─────────────────────────────────────────────
   MAGNETIC CARD WRAPPER
───────────────────────────────────────────── */
function MagneticCard({
  children,
  className = "",
  glowColor = "rgba(108,92,231,0.25)",
  intensity = 8,
}: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  intensity?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top  + rect.height / 2;
    const dx   = (e.clientX - cx) / (rect.width  / 2);
    const dy   = (e.clientY - cy) / (rect.height / 2);
    const pctX = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
    const pctY = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
    card.style.transform = `perspective(800px) rotateY(${dx * intensity}deg) rotateX(${-dy * intensity}deg) translateZ(10px)`;
    card.style.setProperty("--mx", `${pctX}%`);
    card.style.setProperty("--my", `${pctY}%`);
    card.style.setProperty("--glow-opacity", "1");
  }, [intensity]);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg) translateZ(0px)";
    card.style.setProperty("--glow-opacity", "0");
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        transformStyle:   "preserve-3d",
        willChange:       "transform",
        transition:       "transform 0.35s cubic-bezier(0.22,1,0.36,1), border-color 0.35s",
        position:         "relative",
        ["--glow-opacity" as any]: "0",
        ["--mx"           as any]: "50%",
        ["--my"           as any]: "50%",
        ["--glow-color"   as any]: glowColor,
      }}
    >
      <div
        style={{
          position:     "absolute",
          inset:        0,
          borderRadius: "inherit",
          background:   `radial-gradient(circle at var(--mx) var(--my), var(--glow-color), transparent 65%)`,
          opacity:      "var(--glow-opacity)",
          transition:   "opacity 0.4s",
          pointerEvents:"none",
          zIndex:       0,
        }}
      />
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   ANIMATED COUNTER
───────────────────────────────────────────── */
function AnimatedCounter({
  target, suffix = "", duration = 1800,
}: {
  target: number; suffix?: string; duration?: number;
}) {
  const [count, setCount] = useState(0);
  const ref    = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const step  = (now: number) => {
      const p    = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setCount(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

/* ─────────────────────────────────────────────
   FADE-IN
───────────────────────────────────────────── */
function FadeIn({
  children, delay = 0, direction = "up", className = "",
}: {
  children: React.ReactNode; delay?: number;
  direction?: "up" | "left" | "right" | "none"; className?: string;
}) {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const dirs   = {
    up:    { y: 32, x: 0  },
    left:  { y: 0,  x: -32 },
    right: { y: 0,  x: 32  },
    none:  { y: 0,  x: 0   },
  };
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...dirs[direction] }}
      animate={inView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   STATUS CONFIG
───────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string;
  icon: React.ElementType; desc: string;
}> = {
  new:      { label: "Baru Masuk",   color: "#ef4444", bg: "rgba(239,68,68,0.12)",  icon: AlertCircle,  desc: "Laporan diterima"  },
  progress: { label: "Dalam Proses", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: Clock,        desc: "Sedang ditangani"  },
  resolved: { label: "Selesai",      color: "#22c55e", bg: "rgba(34,197,94,0.12)",  icon: CheckCircle2, desc: "Telah diselesaikan" },
};

/* ─────────────────────────────────────────────
   SCANLINE BANNER
───────────────────────────────────────────── */
function ScanlineBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden">
      <motion.div
        className="absolute inset-y-0 w-1/3 pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, rgba(108,92,231,0.07), transparent)" }}
        animate={{ x: ["-100%", "400%"] }}
        transition={{ repeat: Infinity, duration: 5, ease: "linear" }}
      />
      {children}
    </div>
  );
}

/* ─── Ilustrasi ─────────────────────────────────────────────────────────────── */
function IllusBuatLaporan() {
  return (
    <img src={buatLaporanSvg} alt="Buat Laporan"
      className="w-36 h-36 relative z-10 object-contain drop-shadow-lg" />
  );
}
function IllusVerifikasi() {
  return (
    <img src={verifikasiLaporanSvg} alt="Verifikasi Laporan"
      className="w-36 h-36 relative z-10 object-contain drop-shadow-lg" />
  );
}
function IllusMasalahSelesai() {
  return (
    <img src={selesaiLaporanSvg} alt="Masalah Selesai"
      className="w-36 h-36 relative z-10 object-contain drop-shadow-lg" />
  );
}

/* ─── Data Langkah ───────────────────────────────────────────────────────────── */
const STEPS_DATA = [
  {
    num: "1", color: "#6366f1", shadowColor: "rgba(99,102,241,0.6)",
    glowColor: "rgba(99,102,231,0.12)",
    illusGradient: "linear-gradient(160deg, rgba(99,102,241,0.14) 0%, rgba(99,102,241,0.04) 100%)",
    borderHoverColor: "rgba(99,102,241,0.35)",
    title: "Buat Laporan",
    desc: "Daftarkan akun dan buat laporan dengan foto, lokasi, dan deskripsi lengkap permasalahan di kotamu.",
    Illustration: IllusBuatLaporan, progress: "33%", dots: [true, false, false], pulseDelay: 0,
  },
  {
    num: "2", color: "#f59e0b", shadowColor: "rgba(245,158,11,0.6)",
    glowColor: "rgba(245,158,11,0.12)",
    illusGradient: "linear-gradient(160deg, rgba(245,158,11,0.14) 0%, rgba(245,158,11,0.04) 100%)",
    borderHoverColor: "rgba(245,158,11,0.35)",
    title: "Tim Verifikasi",
    desc: "Tim kami memverifikasi laporan dan meneruskan ke dinas terkait untuk segera ditindaklanjuti.",
    Illustration: IllusVerifikasi, progress: "66%", dots: [true, true, false], pulseDelay: 0.5,
  },
  {
    num: "3", color: "#22c55e", shadowColor: "rgba(34,197,94,0.6)",
    glowColor: "rgba(34,197,94,0.12)",
    illusGradient: "linear-gradient(160deg, rgba(34,197,94,0.14) 0%, rgba(34,197,94,0.04) 100%)",
    borderHoverColor: "rgba(34,197,94,0.35)",
    title: "Masalah Selesai",
    desc: "Pantau progress secara real-time. Kamu akan dinotifikasi saat laporan selesai ditangani oleh tim kota.",
    Illustration: IllusMasalahSelesai, progress: "100%", dots: [true, true, true], pulseDelay: 1,
  },
] as const;

/* ─── Kartu Langkah ──────────────────────────────────────────────────────────── */
function StepIllusCard({ step, index }: { step: (typeof STEPS_DATA)[number]; index: number }) {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.13, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
      className="group relative flex flex-col rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden cursor-default"
      style={{ transition: "border-color 0.3s" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = step.borderHoverColor)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${step.glowColor}, transparent 70%)` }}
      />
      <div
        className="absolute top-3.5 right-3.5 h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-black text-white z-10"
        style={{ background: step.color, boxShadow: `0 0 16px ${step.shadowColor}` }}
      >
        {step.num}
      </div>
      <div
        className="relative flex items-center justify-center h-48 overflow-hidden"
        style={{ background: step.illusGradient }}
      >
        <motion.div
          className="absolute w-32 h-32 rounded-full border pointer-events-none"
          style={{ borderColor: step.color }}
          animate={{ scale: [0.85, 1.45, 0.85], opacity: [0.2, 0, 0.2] }}
          transition={{ repeat: Infinity, duration: 2.8, delay: step.pulseDelay, ease: "easeOut" }}
        />
        <step.Illustration />
      </div>
      <div className="flex flex-col flex-1 p-5">
        <h3 className="font-display font-bold text-[17px] text-foreground mb-2">{step.title}</h3>
        <p className="text-[12.5px] text-muted-foreground leading-relaxed flex-1">{step.desc}</p>
        <div className="mt-4 pt-4 border-t border-white/6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Progress</span>
            <span className="text-[11px] font-semibold" style={{ color: step.color }}>{step.progress}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={inView ? { width: step.progress } : {}}
              transition={{ duration: 1.3, delay: 0.5 + index * 0.13, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: step.color }}
            />
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            {step.dots.map((on, di) => (
              <div key={di} className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                style={{ background: on ? step.color : "rgba(255,255,255,0.1)" }} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
function LandingPage() {
  // ── Data dinamis dari /api/reports/public (tanpa autentikasi) ─────────────
  const { reports: allReports, loading: reportsLoading, lastFetch, refetch } = usePublicReports();
  const stats = getStats(allReports);

  const [activeCats,   setActiveCats]  = useState<Category[]>(Object.keys(CATEGORIES) as Category[]);
  const [activeStat,   setActiveStat]  = useState<Status | "all">("all");
  const [search,       setSearch]      = useState("");
  const [selected,     setSelected]    = useState<Report | null>(null);
  const [filtersOpen,  setFiltersOpen] = useState(false);
  const [heroOpen,     setHeroOpen]    = useState(false);
  const [filterStatus, setFilterStatus]= useState<string>("all");
  // Heatmap menggunakan endpoint /api/reports/heatmap/public
  const [showHeatmap,  setShowHeatmap] = useState(false);

  const sectionRef = useRef<HTMLDivElement>(null);

  // ── Filtered reports untuk peta hero ────────────────────────────────────
  const filtered = useMemo(() =>
    allReports.filter(r =>
      activeCats.includes(r.category) &&
      (activeStat === "all" || r.status === activeStat) &&
      (search === "" ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.region.city.toLowerCase().includes(search.toLowerCase()))
    ), [allReports, activeCats, activeStat, search]);

  // ── Filtered reports untuk section laporan terbaru ───────────────────────
  const filteredReports = useMemo(() =>
    allReports.filter(r => filterStatus === "all" || r.status === filterStatus),
    [allReports, filterStatus]);

  const toggleCat = (c: Category) =>
    setActiveCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const scrollToSection = () => sectionRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="bg-background text-foreground overflow-x-hidden">
      <AnimatedBackground />

      {/* ═══════════════════════════════════════
          SECTION 1: FULL-SCREEN MAP HERO
      ═══════════════════════════════════════ */}
      <section className="relative w-screen h-screen overflow-hidden">
        <div className="absolute inset-0">
          {/*
            MapClient menerima:
            - reports: dari database via /api/reports/public
            - showHeatmap: toggle dari user
            - heatmapApiPath: path endpoint heatmap publik (tanpa auth)
            CivicMap akan menggunakan prop ini jika ada,
            atau fallback ke /api/reports/heatmap/public secara default
          */}
          <MapClient
            reports={filtered}
            onSelect={setSelected}
            height="100%"
            showHeatmap={showHeatmap}
            heatmapApiPath="/api/reports/heatmap/public"
          />
        </div>

        {/* TOP NAVBAR */}
        <header className="absolute top-0 left-0 right-0 z-[500] pointer-events-none">
          <div className="pointer-events-auto mx-4 mt-4 flex items-center justify-between gap-3 glass-strong rounded-2xl px-5 py-3 shadow-elevated border border-white/10">
            <div className="flex items-center gap-3 shrink-0">
              <motion.div
                whileHover={{ scale: 1.08, rotate: -5 }}
                className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-glow"
              >
                <MapPin size={18} className="text-primary-foreground" />
              </motion.div>
              <div className="leading-none">
                <div className="font-display text-lg font-bold tracking-tight">AduinKota</div>
                <div className="text-[10px] text-muted-foreground tracking-wide">aduin keluhanmu disini</div>
              </div>
            </div>

            <div className="flex-1 max-w-sm hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-primary/40 transition-colors">
              <Search size={13} className="text-muted-foreground shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari laporan, kota…"
                className="bg-transparent outline-none text-sm w-full placeholder:text-muted-foreground"
              />
            </div>

            <div className="hidden md:flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
              <button onClick={() => setActiveStat("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth ${
                  activeStat === "all" ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
                }`}
              >Semua</button>
              {(Object.keys(STATUSES) as Status[]).map(s => (
                <button key={s} onClick={() => setActiveStat(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth ${
                    activeStat === s ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >{STATUSES[s].label}</button>
              ))}
            </div>

            <Link to="/login"
              className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.03] transition-smooth"
            >
              <LogIn size={14} />
              <span className="hidden sm:inline">Masuk / Daftar</span>
              <span className="sm:hidden">Masuk</span>
            </Link>
          </div>
        </header>

        {/* HERO CARD — desktop */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="hidden lg:block absolute bottom-8 left-6 z-[400] max-w-sm"
        >
          <div className="glass-strong rounded-3xl p-6 shadow-elevated border border-white/10 relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-40 h-40 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
            <div className="text-[10px] uppercase tracking-[0.25em] text-accent mb-2">Website Pengajuan Kota</div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-gradient leading-tight mb-2">
              Suarakan<br />Keluhanmu,<br />Kami Tindak.
            </h1>
            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
              Laporkan permasalahan kota secara real-time. Dari jalan rusak hingga sampah menumpuk — semua terpantau di sini.
            </p>
            <Link to="/login"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition-smooth"
            >
              <Plus size={15} /> Laporkan Masalah di Sekitarmu Sekarang
            </Link>
            <p className="text-[10px] text-muted-foreground text-center mt-3">Login diperlukan untuk mengajukan laporan</p>
          </div>
        </motion.div>

        {/* MOBILE HERO TRIGGER */}
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          onClick={() => setHeroOpen(true)}
          className="lg:hidden absolute bottom-6 left-4 z-[400] flex items-center gap-2 glass-strong border border-white/10 rounded-2xl px-4 py-3 shadow-elevated text-sm font-semibold"
        >
          <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center shadow-glow shrink-0">
            <Megaphone size={13} className="text-primary-foreground" />
          </div>
          <div className="leading-tight text-left">
            <div className="text-xs font-bold">Suarakan Keluhanmu</div>
            <div className="text-[10px] text-muted-foreground">Tap untuk buat pengaduan</div>
          </div>
        </motion.button>

        {/* MOBILE HERO MODAL */}
        <AnimatePresence>
          {heroOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setHeroOpen(false)}
                className="lg:hidden fixed inset-0 z-[600] bg-black/50 backdrop-blur-sm"
              />
              <motion.div
                initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="lg:hidden fixed bottom-0 left-0 right-0 z-[700] glass-strong rounded-t-3xl p-6 shadow-elevated border-t border-white/10"
              >
                <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />
                <button onClick={() => setHeroOpen(false)}
                  className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-smooth border border-white/10">
                  <X size={14} />
                </button>
                <div className="text-[10px] uppercase tracking-[0.25em] text-accent mb-2">Website Pengajuan Kota</div>
                <h2 className="font-display text-2xl font-bold text-gradient leading-tight mb-2">
                  Suarakan Keluhanmu,<br />Kami Tindak.
                </h2>
                <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                  Laporkan permasalahan kota secara real-time. Dari jalan rusak hingga sampah menumpuk — semua terpantau di sini.
                </p>
                <Link to="/login" onClick={() => setHeroOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition-smooth">
                  <Plus size={15} /> Laporkan Masalah di Sekitarmu Sekarang
                </Link>
                <p className="text-[10px] text-muted-foreground text-center mt-3 pb-1">Login diperlukan untuk mengajukan laporan</p>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* STATS ROW */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="absolute bottom-6 right-4 z-[400] flex flex-col gap-2"
        >
          {/* Heatmap toggle + Live indicator */}
          <div className="flex items-center gap-2 self-end">
            {/* Heatmap toggle — menggunakan /api/reports/heatmap/public */}
            <button
              onClick={() => setShowHeatmap(p => !p)}
              title="Toggle heatmap kepadatan masalah"
              className={`glass-strong rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 shadow-elevated text-[10px] font-medium transition-smooth border ${
                showHeatmap
                  ? "text-orange-300 bg-orange-500/20 border-orange-500/40"
                  : "text-muted-foreground border-white/10 hover:text-foreground"
              }`}
            >
              <Flame size={11} className={showHeatmap ? "text-orange-400" : ""} />
              Heatmap
            </button>

            {/* Refresh + last fetch */}
            <div className="glass-strong rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 shadow-elevated border border-white/10 self-end">
              {reportsLoading ? (
                <Loader2 size={10} className="animate-spin text-accent" />
              ) : (
                <motion.div
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              )}
              <span className="text-[10px] text-muted-foreground">
                {reportsLoading ? "Memuat…" : lastFetch
                  ? `Update ${lastFetch.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                  : "Live"}
              </span>
              <button onClick={refetch} className="text-muted-foreground hover:text-foreground transition-smooth ml-0.5">
                <RefreshCw size={10} />
              </button>
            </div>
          </div>

          {/* Filter count */}
          <div className="glass-strong rounded-xl px-3 py-2 flex items-center gap-1.5 shadow-elevated border border-white/10 self-end">
            <Layers size={12} className="text-accent" />
            <span className="font-semibold text-xs">{filtered.length}</span>
            <span className="text-muted-foreground text-xs">/ {allReports.length} laporan</span>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Total",   value: stats.total,    icon: Activity,     color: "var(--primary)" },
              { label: "Baru",    value: stats.open,     icon: AlertCircle,  color: "var(--status-new)" },
              { label: "Proses",  value: stats.progress, icon: Clock,        color: "var(--status-progress)" },
              { label: "Selesai", value: stats.resolved, icon: CheckCircle2, color: "var(--status-resolved)" },
            ].map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.07 }}
                className="glass-strong rounded-xl p-2 lg:p-3 shadow-elevated border border-white/10 relative overflow-hidden"
              >
                <div className="absolute -right-3 -top-3 h-12 w-12 rounded-full blur-xl opacity-25"
                  style={{ background: s.color }} />
                <s.icon size={10} style={{ color: s.color }} className="mb-1" />
                <div className="font-display text-base lg:text-xl font-bold leading-none">{s.value}</div>
                <div className="text-[9px] lg:text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CATEGORY FILTER — desktop */}
        <div className="absolute top-24 left-6 glass-strong rounded-2xl p-3 z-[400] shadow-elevated border border-white/10 w-52 hidden lg:block">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Filter size={12} className="text-accent" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Filter Kategori</span>
          </div>
          <div className="space-y-1">
            {(Object.keys(CATEGORIES) as Category[]).map(c => {
              const cat    = CATEGORIES[c];
              const active = activeCats.includes(c);
              const count  = allReports.filter(r => r.category === c).length;
              return (
                <button key={c} onClick={() => toggleCat(c)}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-smooth text-sm ${active ? "bg-white/8" : "opacity-40 hover:opacity-80"}`}>
                  <span className="h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ background: cat.color, boxShadow: active ? `0 0 8px ${cat.color}` : "none" }} />
                  <span className="flex-1 text-left text-[12px]">{cat.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {reportsLoading ? "…" : count}
                  </span>
                </button>
              );
            })}
          </div>
          {lastFetch && (
            <div className="mt-3 pt-3 border-t border-white/6 text-[9px] text-muted-foreground/60 text-center">
              Diperbarui {lastFetch.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>

        {/* SELECTED REPORT SIDE CARD */}
        <AnimatePresence>
          {selected && (
            <motion.aside
              initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="absolute top-20 right-4 bottom-4 w-80 glass-strong rounded-3xl shadow-elevated overflow-hidden z-[450] flex flex-col border border-white/10"
            >
              <div className="relative h-44 shrink-0">
                <img src={selected.image} alt={selected.title}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                <button onClick={() => setSelected(null)}
                  className="absolute top-3 right-3 h-8 w-8 rounded-full glass-strong flex items-center justify-center hover:bg-white/15 transition-smooth border border-white/10">
                  <X size={14} />
                </button>
                <div className="absolute bottom-3 left-4 right-4 flex flex-wrap gap-2">
                  <CategoryBadge category={CATEGORIES[selected.category].color} label={CATEGORIES[selected.category].label} />
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              <div className="p-5 flex-1 overflow-y-auto">
                <div className="text-[10px] text-muted-foreground tracking-wider uppercase">{selected.id}</div>
                <h3 className="font-display text-lg font-semibold mt-1 leading-snug">{selected.title}</h3>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{selected.description}</p>
                <div className="mt-5 space-y-3 text-sm">
                  <InfoRow icon={<MapPin size={12} />} label="Lokasi"
                    value={`${selected.region.subdistrict}, ${selected.region.city}`} />
                  <InfoRow icon={<span className="text-[10px]">👤</span>} label="Pelapor" value={selected.reporter} />
                  <InfoRow icon={<span className="text-[10px]">⏱</span>} label="Dilaporkan" value={timeAgo(selected.createdAt)} />
                </div>
              </div>
              <div className="p-4 border-t border-border">
                <Link to="/login"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold hover:scale-[1.02] transition-smooth">
                  <LogIn size={13} /> Login untuk melihat detail laporan
                </Link>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* MOBILE FILTER */}
        <button onClick={() => setFiltersOpen(p => !p)}
          className="lg:hidden absolute top-24 left-4 z-[400] glass-strong rounded-xl px-3 py-2.5 flex items-center gap-2 shadow-elevated border border-white/10 text-xs font-medium">
          <Filter size={13} className="text-accent" />
          Filter
          <ChevronDown size={13} className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence>
          {filtersOpen && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="lg:hidden absolute top-40 left-4 glass-strong rounded-2xl p-3 z-[400] shadow-elevated border border-white/10 w-52">
              <div className="space-y-1">
                {(Object.keys(CATEGORIES) as Category[]).map(c => {
                  const cat    = CATEGORIES[c];
                  const active = activeCats.includes(c);
                  return (
                    <button key={c} onClick={() => toggleCat(c)}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-smooth text-sm ${active ? "bg-white/8" : "opacity-40"}`}>
                      <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: cat.color }} />
                      <span className="flex-1 text-left text-[12px]">{cat.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {allReports.filter(r => r.category === c).length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SCROLL CTA */}
        <motion.button onClick={scrollToSection}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[400] flex flex-col items-center gap-1.5 text-muted-foreground hover:text-foreground transition-smooth group">
          <span className="text-[10px] uppercase tracking-[0.2em]">Selengkapnya</span>
          <motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            <ArrowDown size={16} className="group-hover:text-accent" />
          </motion.div>
        </motion.button>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 2: STATS BANNER
      ═══════════════════════════════════════ */}
      <div ref={sectionRef} className="relative z-[2]">
        <ScanlineBanner>
          <section className="relative py-10 border-y border-white/5 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5" />
            <div className="relative max-w-5xl mx-auto px-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Laporan",   target: stats.total,    suffix: "+", color: "#6366f1", icon: Activity },
                  { label: "Laporan Baru",    target: stats.open,     suffix: "",  color: "#ef4444", icon: AlertCircle },
                  { label: "Sedang Diproses", target: stats.progress, suffix: "",  color: "#f59e0b", icon: Clock },
                  { label: "Diselesaikan",    target: stats.resolved, suffix: "",  color: "#22c55e", icon: CheckCircle2 },
                ].map((s, i) => (
                  <FadeIn key={s.label} delay={i * 0.08}>
                    <MagneticCard glowColor={`${s.color}33`}
                      className="relative text-center px-4 py-5 rounded-2xl border border-white/6 bg-white/[0.03] group hover:border-white/15 overflow-hidden cursor-default">
                      <s.icon size={18} className="mx-auto mb-2 relative z-10" style={{ color: s.color }} />
                      <div className="font-display text-3xl font-black relative z-10" style={{ color: s.color }}>
                        <AnimatedCounter target={s.target} suffix={s.suffix} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 relative z-10">{s.label}</div>
                    </MagneticCard>
                  </FadeIn>
                ))}
              </div>
            </div>
          </section>
        </ScanlineBanner>

        {/* ═══════════════════════════════════════
            SECTION 3: ABOUT
        ═══════════════════════════════════════ */}
        <section className="relative py-24 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
          <motion.div
            className="absolute top-1/2 left-0 right-0 h-px pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent, rgba(108,92,231,0.15), rgba(0,206,201,0.1), transparent)" }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          />
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <FadeIn direction="left">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6">
                    <Globe size={12} /> Tentang Platform
                  </div>
                </FadeIn>
                <FadeIn direction="left" delay={0.08}>
                  <h2 className="font-display text-4xl lg:text-5xl font-black leading-[1.1] mb-5">
                    Satu Platform,<br />
                    <motion.span
                      className="text-gradient inline-block"
                      animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                      transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                      style={{ backgroundSize: "200% 100%" }}
                    >
                      Semua Suara
                    </motion.span><br />
                    Warga Kota.
                  </h2>
                </FadeIn>
                <FadeIn direction="left" delay={0.15}>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-md">
                    AduinKota adalah platform digital yang menjembatani warga dan pemerintah kota.
                    Kami percaya setiap keluhan warga adalah peluang untuk membuat kota lebih baik.
                    Dengan teknologi real-time dan peta interaktif, permasalahan kota kini bisa
                    dilaporkan, dipantau, dan diselesaikan secara transparan.
                  </p>
                </FadeIn>
                <FadeIn direction="left" delay={0.2}>
                  <div className="flex flex-wrap gap-3">
                    <Link to="/login"
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.04] hover:shadow-[0_0_32px_rgba(108,92,231,0.5)] transition-smooth">
                      <Plus size={14} /> Buat Laporan
                    </Link>
                    <button onClick={scrollToSection}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 hover:border-white/20 transition-smooth">
                      Lihat Laporan <ArrowRight size={14} />
                    </button>
                  </div>
                </FadeIn>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: MapPin, title: "Peta Real-Time",  desc: "Lihat semua laporan di peta interaktif secara langsung",    color: "#6366f1", delay: 0    },
                  { icon: Shield, title: "Terverifikasi",   desc: "Setiap laporan diverifikasi oleh tim kami",                 color: "#22c55e", delay: 0.08 },
                  { icon: Eye,    title: "Transparan",      desc: "Pantau status laporan kapan saja dan di mana saja",         color: "#f59e0b", delay: 0.15 },
                  { icon: Zap,    title: "Respon Cepat",    desc: "Tim kota siap merespons laporan dalam 24 jam",              color: "#ef4444", delay: 0.22 },
                ].map(f => (
                  <FadeIn key={f.title} delay={f.delay} direction="right">
                    <MagneticCard glowColor={`${f.color}30`}
                      className="relative p-4 rounded-2xl border border-white/8 bg-white/[0.03] hover:border-white/15 overflow-hidden cursor-default">
                      <motion.div
                        className="h-9 w-9 rounded-xl flex items-center justify-center mb-3 relative z-10"
                        style={{ background: `${f.color}18`, border: `1px solid ${f.color}30` }}
                        whileHover={{ scale: 1.12, rotate: -5 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      >
                        <f.icon size={16} style={{ color: f.color }} />
                      </motion.div>
                      <div className="font-semibold text-sm mb-1 relative z-10">{f.title}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed relative z-10">{f.desc}</div>
                    </MagneticCard>
                  </FadeIn>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════
            SECTION 4: HOW IT WORKS
        ═══════════════════════════════════════ */}
        <section className="py-20 relative overflow-hidden border-t border-white/5">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent pointer-events-none" />
          <motion.div
            className="absolute top-8 left-8 w-24 h-24 rounded-full border border-primary/10 pointer-events-none"
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-8 right-8 w-36 h-36 rounded-full border border-accent/10 pointer-events-none"
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.15, 0.4] }}
            transition={{ repeat: Infinity, duration: 6.5, ease: "easeInOut", delay: 1 }}
          />
          <div className="max-w-5xl mx-auto px-6">
            <FadeIn className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium mb-4">
                <Zap size={12} /> Cara Kerja
              </div>
              <h2 className="font-display text-3xl lg:text-4xl font-black">Tiga Langkah Mudah</h2>
              <p className="text-muted-foreground text-sm mt-3 max-w-md mx-auto">
                Dari laporan hingga penyelesaian — prosesnya sederhana dan transparan.
              </p>
            </FadeIn>
            <div className="relative">
              <div className="absolute top-[5.75rem] left-0 right-0 h-px hidden md:block overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <motion.div
                  className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary/40 to-transparent"
                  animate={{ x: ["-100%", "400%"] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                />
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {STEPS_DATA.map((step, i) => (
                  <StepIllusCard key={step.num} step={step} index={i} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════
            SECTION 5: LAPORAN TERBARU
        ═══════════════════════════════════════ */}
        <section className="py-20 border-t border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-20 bg-gradient-to-b from-white/20 to-transparent" />
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
              <FadeIn direction="left">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-3">
                    <TrendingUp size={12} /> Status Laporan
                  </div>
                  <h2 className="font-display text-3xl lg:text-4xl font-black leading-tight">
                    Laporan Warga<br /><span className="text-gradient">Terkini</span>
                  </h2>
                  <p className="text-muted-foreground text-sm mt-2 max-w-sm">
                    Semua laporan bersifat publik. Login untuk menambah atau merespons.
                  </p>
                  {lastFetch && !reportsLoading && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <motion.div
                        className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        Data dari database · {allReports.length} laporan total
                      </span>
                    </div>
                  )}
                  {reportsLoading && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Loader2 size={10} className="animate-spin text-accent" />
                      <span className="text-[10px] text-muted-foreground">Memuat dari database…</span>
                    </div>
                  )}
                </div>
              </FadeIn>

              <FadeIn direction="right" delay={0.1}>
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10">
                  {[
                    { key: "all",      label: "Semua",  count: allReports.length },
                    { key: "new",      label: "Baru",   count: stats.open        },
                    { key: "progress", label: "Proses", count: stats.progress    },
                    { key: "resolved", label: "Selesai",count: stats.resolved    },
                  ].map(tab => (
                    <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth flex items-center gap-1.5 ${
                        filterStatus === tab.key
                          ? "gradient-primary text-primary-foreground shadow-glow"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${filterStatus === tab.key ? "bg-white/20" : "bg-white/8"}`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              </FadeIn>
            </div>

            {/* Loading skeleton */}
            {reportsLoading && (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden animate-pulse">
                    <div className="h-40 bg-white/5" />
                    <div className="p-4 space-y-3">
                      <div className="h-3 bg-white/5 rounded w-3/4" />
                      <div className="h-2 bg-white/5 rounded w-1/2" />
                      <div className="h-2 bg-white/5 rounded w-full" />
                      <div className="h-2 bg-white/5 rounded w-5/6" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Report cards */}
            {!reportsLoading && (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {filteredReports.map((report, i) => (
                    <ReportDetailCard key={report.id} report={report} index={i} />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Empty state */}
            {!reportsLoading && filteredReports.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-sm">Tidak ada laporan untuk filter ini.</p>
              </div>
            )}

            <FadeIn className="mt-10 text-center">
              <Link to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-primary/30 text-sm font-medium transition-smooth group">
                Lihat Semua Laporan
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </FadeIn>
          </div>
        </section>

        {/* ═══════════════════════════════════════
            SECTION 6: CTA BOTTOM
        ═══════════════════════════════════════ */}
        <section className="py-20 border-t border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/8 pointer-events-none" />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-primary/5 pointer-events-none"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-accent/5 pointer-events-none"
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 45, ease: "linear" }}
          />
          <div className="relative max-w-2xl mx-auto px-6 text-center">
            <FadeIn>
              <motion.div
                className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-glow"
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              >
                <MapPin size={28} className="text-primary-foreground" />
              </motion.div>
              <h2 className="font-display text-4xl lg:text-5xl font-black mb-4">Kotamu, Suaramu.</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-md mx-auto">
                Bergabunglah dengan warga yang sudah aktif berkontribusi untuk kota yang lebih baik.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/login"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-bold shadow-glow hover:scale-[1.04] hover:shadow-[0_0_40px_rgba(108,92,231,0.5)] transition-smooth">
                  <Plus size={15} /> Mulai Sekarang — Daftar akun
                </Link>
                <Link to="/login"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 hover:border-white/20 transition-smooth">
                  <LogIn size={14} /> Sudah punya akun? Masuk
                </Link>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/5 py-8 px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center">
                <MapPin size={13} className="text-primary-foreground" />
              </div>
              <div>
                <div className="font-display font-bold text-sm">AduinKota</div>
                <div className="text-[10px] text-muted-foreground">Aduin Keluhanmu Disini</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              © {new Date().getFullYear()} AduinKota · Dibuat untuk warga Indonesia
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-smooth">Kebijakan Privasi</a>
              <a href="#" className="hover:text-foreground transition-smooth">Syarat & Ketentuan</a>
              <a href="#" className="hover:text-foreground transition-smooth">Kontak</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   REPORT DETAIL CARD
───────────────────────────────────────────── */
function ReportDetailCard({ report, index }: { report: Report; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const ref        = useRef(null);
  const inView     = useInView(ref, { once: true, margin: "-40px" });
  const statusCfg  = STATUS_CONFIG[report.status] ?? STATUS_CONFIG["new"];
  const StatusIcon = statusCfg.icon;
  const cat        = CATEGORIES[report.category];

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.55, delay: (index % 6) * 0.07, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
      className="group relative flex flex-col rounded-2xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition-smooth overflow-hidden"
    >
      <div className="relative h-40 overflow-hidden shrink-0">
        <motion.img
          src={report.image} alt={report.title}
          className="w-full h-full object-cover"
          whileHover={{ scale: 1.07 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
        <div
          className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold backdrop-blur-sm"
          style={{ background: statusCfg.bg, border: `1px solid ${statusCfg.color}40`, color: statusCfg.color }}
        >
          <StatusIcon size={11} /> {statusCfg.label}
        </div>
        <div
          className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium backdrop-blur-sm"
          style={{ background: `${cat.color}22`, border: `1px solid ${cat.color}40`, color: cat.color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.color }} />
          {cat.label}
        </div>
        <div className="absolute top-3 left-3 text-[9px] text-white/50 font-mono tracking-wider">#{report.id}</div>
      </div>

      <div className="flex flex-col flex-1 p-4">
        <h3 className="font-display font-bold text-[15px] leading-snug mb-2 line-clamp-2">{report.title}</h3>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin size={10} className="shrink-0" />
            <span className="truncate max-w-[120px]">{report.region.city}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar size={10} className="shrink-0" />
            {timeAgo(report.createdAt)}
          </div>
        </div>
        <p className={`text-xs text-muted-foreground leading-relaxed transition-all ${expanded ? "" : "line-clamp-2"}`}>
          {report.description}
        </p>
        <button onClick={() => setExpanded(p => !p)}
          className="text-[11px] text-primary mt-1 self-start hover:underline">
          {expanded ? "Sembunyikan" : "Selengkapnya"}
        </button>

        <div className="mt-4 pt-3 border-t border-white/6 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin size={11} className="text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Lokasi</div>
              <div className="text-xs font-medium truncate">{report.region.subdistrict}, {report.region.city}</div>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="h-6 w-6 rounded-md bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
              <User size={11} className="text-accent" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Pelapor</div>
              <div className="text-xs font-medium truncate">{report.reporter}</div>
            </div>
          </div>

          <div className="mt-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Progress</span>
              <span className="text-[10px] font-semibold" style={{ color: statusCfg.color }}>
                {report.status === "new" ? "0%" : report.status === "progress" ? "50%" : "100%"}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={inView ? {
                  width: report.status === "new" ? "8%" : report.status === "progress" ? "55%" : "100%"
                } : {}}
                transition={{ duration: 1.2, delay: 0.4 + (index % 6) * 0.07, ease: "easeOut" }}
                className="h-full rounded-full relative overflow-hidden"
                style={{ background: statusCfg.color }}
              >
                <motion.div
                  className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ["-200%", "400%"] }}
                  transition={{ repeat: Infinity, duration: 2, delay: 1 + index * 0.15, ease: "linear" }}
                />
              </motion.div>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              {["Dilaporkan", "Diproses", "Selesai"].map((step, si) => {
                const done =
                  si === 0 ||
                  (si === 1 && report.status !== "new") ||
                  (si === 2 && report.status === "resolved");
                return (
                  <div key={step} className="flex flex-col items-center gap-0.5">
                    <div className="h-1.5 w-1.5 rounded-full transition-smooth"
                      style={{ background: done ? statusCfg.color : "rgba(255,255,255,0.15)" }} />
                    <span className="text-[8px] text-muted-foreground">{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Link to="/login"
          className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 border border-white/8 text-xs font-medium hover:bg-white/10 hover:border-white/20 hover:text-foreground transition-smooth group/btn">
          <ExternalLink size={11} className="group-hover/btn:scale-110 transition-transform" />
          Detail Laporan
        </Link>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   INFO ROW
───────────────────────────────────────────── */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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