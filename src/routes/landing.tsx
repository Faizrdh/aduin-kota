/*eslint-disable*/

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Search,
  Filter,
  Layers,
  LogIn,
  Plus,
  X,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Activity,
  ChevronDown,
} from "lucide-react";
import { MapClient } from "@/components/civic/MapClient";
import {
  CATEGORIES,
  REPORTS,
  STATUSES,
  type Category,
  type Status,
  type Report,
  getStats,
  timeAgo,
} from "@/data/reports";
import { StatusBadge, CategoryBadge } from "@/components/civic/StatusBadge";

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

function LandingPage() {
  const stats = getStats(REPORTS);
  const [activeCats, setActiveCats] = useState<Category[]>(
    Object.keys(CATEGORIES) as Category[]
  );
  const [activeStat, setActiveStat] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Report | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    return REPORTS.filter(
      (r) =>
        activeCats.includes(r.category) &&
        (activeStat === "all" || r.status === activeStat) &&
        (search === "" ||
          r.title.toLowerCase().includes(search.toLowerCase()) ||
          r.region.city.toLowerCase().includes(search.toLowerCase()))
    );
  }, [activeCats, activeStat, search]);

  const toggleCat = (c: Category) =>
    setActiveCats((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      {/* ── Full-screen map base ── */}
      <div className="absolute inset-0">
        <MapClient reports={filtered} onSelect={setSelected} height="100%" />
      </div>

      {/* ══════════════════════════════════
          TOP NAVBAR
      ══════════════════════════════════ */}
      <header className="absolute top-0 left-0 right-0 z-[500] pointer-events-none">
        <div className="pointer-events-auto mx-4 mt-4 flex items-center justify-between gap-3 glass-strong rounded-2xl px-5 py-3 shadow-elevated border border-white/10">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <MapPin size={18} className="text-primary-foreground" />
            </div>
            <div className="leading-none">
              <div className="font-display text-lg font-bold tracking-tight">
                AduinKota
              </div>
              <div className="text-[10px] text-muted-foreground tracking-wide">
                aduin keluhanmu disini
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex-1 max-w-sm hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <Search size={13} className="text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari laporan, kota…"
              className="bg-transparent outline-none text-sm w-full placeholder:text-muted-foreground"
            />
          </div>

          {/* Status tabs */}
          <div className="hidden md:flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10">
            <button
              onClick={() => setActiveStat("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth ${
                activeStat === "all"
                  ? "gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semua
            </button>
            {(Object.keys(STATUSES) as Status[]).map((s) => (
              <button
                key={s}
                onClick={() => setActiveStat(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth ${
                  activeStat === s
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {STATUSES[s].label}
              </button>
            ))}
          </div>

          {/* CTA Login */}
          <Link
            to="/login"
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.03] transition-smooth"
          >
            <LogIn size={14} />
            <span className="hidden sm:inline">Masuk / Daftar</span>
            <span className="sm:hidden">Masuk</span>
          </Link>
        </div>
      </header>

      {/* ══════════════════════════════════
          HERO OVERLAY — bottom-left
      ══════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="absolute bottom-8 left-6 z-[400] max-w-sm"
      >
        <div className="glass-strong rounded-3xl p-6 shadow-elevated border border-white/10">
          <div className="text-[10px] uppercase tracking-[0.25em] text-accent mb-2">
            Website Pengajuan Kota
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-gradient leading-tight mb-2">
            Suarakan<br />Keluhanmu,<br />Kami Tindak.
          </h1>
          <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
            Laporkan permasalahan kota secara real-time. Dari jalan rusak
            hingga sampah menumpuk — semua terpantau di sini.
          </p>
          <Link
            to="/login"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition-smooth"
          >
            <Plus size={15} />
            Buat Pengaduan Sekarang
          </Link>
          <p className="text-[10px] text-muted-foreground text-center mt-3">
            Login diperlukan untuk mengajukan laporan
          </p>
        </div>
      </motion.div>

      {/* ══════════════════════════════════
          STATS ROW — bottom-right
      ══════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.6 }}
        className="absolute bottom-28 right-6 z-[400] flex flex-col gap-3"
      >
        {/* Visible count pill */}
        <div className="glass-strong rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-elevated border border-white/10 text-sm self-end">
          <Layers size={14} className="text-accent" />
          <span className="font-semibold">{filtered.length}</span>
          <span className="text-muted-foreground">/ {REPORTS.length} laporan</span>
        </div>

        {/* Mini stat cards */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Total", value: stats.total, icon: Activity, color: "var(--primary)" },
            { label: "Baru", value: stats.open, icon: AlertCircle, color: "var(--status-new)" },
            { label: "Proses", value: stats.progress, icon: Clock, color: "var(--status-progress)" },
            { label: "Selesai", value: stats.resolved, icon: CheckCircle2, color: "var(--status-resolved)" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.07 }}
              className="glass-strong rounded-xl p-3 shadow-elevated border border-white/10 relative overflow-hidden"
            >
              <div
                className="absolute -right-4 -top-4 h-16 w-16 rounded-full blur-xl opacity-25"
                style={{ background: s.color }}
              />
              <s.icon size={12} style={{ color: s.color }} className="mb-1.5" />
              <div className="font-display text-xl font-bold">{s.value}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ══════════════════════════════════
          CATEGORY FILTER — left floating
      ══════════════════════════════════ */}
      <div className="absolute top-24 left-6 glass-strong rounded-2xl p-3 z-[400] shadow-elevated border border-white/10 w-52 hidden lg:block">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Filter size={12} className="text-accent" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">
            Filter Kategori
          </span>
        </div>
        <div className="space-y-1">
          {(Object.keys(CATEGORIES) as Category[]).map((c) => {
            const cat = CATEGORIES[c];
            const active = activeCats.includes(c);
            const count = REPORTS.filter((r) => r.category === c).length;
            return (
              <button
                key={c}
                onClick={() => toggleCat(c)}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-smooth text-sm ${
                  active ? "bg-white/8" : "opacity-40 hover:opacity-80"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{
                    background: cat.color,
                    boxShadow: active ? `0 0 8px ${cat.color}` : "none",
                  }}
                />
                <span className="flex-1 text-left text-[12px]">{cat.label}</span>
                <span className="text-[10px] text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════
          SELECTED REPORT SIDE CARD
      ══════════════════════════════════ */}
      <AnimatePresence>
        {selected && (
          <motion.aside
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="absolute top-20 right-4 bottom-4 w-80 glass-strong rounded-3xl shadow-elevated overflow-hidden z-[450] flex flex-col border border-white/10"
          >
            <div className="relative h-44 shrink-0">
              <img
                src={selected.image}
                alt={selected.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 h-8 w-8 rounded-full glass-strong flex items-center justify-center hover:bg-white/15 transition-smooth border border-white/10"
              >
                <X size={14} />
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
              <div className="text-[10px] text-muted-foreground tracking-wider uppercase">
                {selected.id}
              </div>
              <h3 className="font-display text-lg font-semibold mt-1 leading-snug">
                {selected.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                {selected.description}
              </p>
              <div className="mt-5 space-y-3 text-sm">
                <InfoRow
                  icon={<MapPin size={12} />}
                  label="Lokasi"
                  value={`${selected.region.subdistrict}, ${selected.region.city}`}
                />
                <InfoRow
                  icon={<span className="text-[10px]">👤</span>}
                  label="Pelapor"
                  value={selected.reporter}
                />
                <InfoRow
                  icon={<span className="text-[10px]">⏱</span>}
                  label="Dilaporkan"
                  value={timeAgo(selected.createdAt)}
                />
              </div>
            </div>

            {/* Login gate for actions */}
            <div className="p-4 border-t border-border">
              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold hover:scale-[1.02] transition-smooth"
              >
                <LogIn size={13} /> Login untuk merespons laporan
              </Link>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════
          MOBILE FILTER TOGGLE
      ══════════════════════════════════ */}
      <button
        onClick={() => setFiltersOpen((p) => !p)}
        className="lg:hidden absolute top-24 left-4 z-[400] glass-strong rounded-xl px-3 py-2.5 flex items-center gap-2 shadow-elevated border border-white/10 text-xs font-medium"
      >
        <Filter size={13} className="text-accent" />
        Filter
        <ChevronDown
          size={13}
          className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* ══════════════════════════════════
          FLOATING CTA — bottom-right
      ══════════════════════════════════ */}
      <Link
        to="/login"
        className="absolute bottom-8 right-8 z-[450] h-14 px-6 rounded-full gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-105 transition-smooth flex items-center gap-2 animate-float"
      >
        <Plus size={18} /> Buat Pengaduan
      </Link>

      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="lg:hidden absolute top-40 left-4 glass-strong rounded-2xl p-3 z-[400] shadow-elevated border border-white/10 w-52"
          >
            <div className="space-y-1">
              {(Object.keys(CATEGORIES) as Category[]).map((c) => {
                const cat = CATEGORIES[c];
                const active = activeCats.includes(c);
                const count = REPORTS.filter((r) => r.category === c).length;
                return (
                  <button
                    key={c}
                    onClick={() => toggleCat(c)}
                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-smooth text-sm ${
                      active ? "bg-white/8" : "opacity-40"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ background: cat.color }}
                    />
                    <span className="flex-1 text-left text-[12px]">{cat.label}</span>
                    <span className="text-[10px] text-muted-foreground">{count}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({
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
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-sm truncate">{value}</div>
      </div>
    </div>
  );
}